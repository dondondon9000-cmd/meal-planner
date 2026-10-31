import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'
import { Check, ScanBarcode, X } from 'lucide-react'
import { lookupBarcode } from './barcode'

type ScanEntry = { code: string; name: string; found: boolean }

// Chrome/Android (and some others) expose a hardware-accelerated native barcode
// reader. It's dramatically more reliable for live 1D barcodes (UPC/EAN) than
// the pure-JS @zxing decoder below, so we prefer it whenever it's available and
// only fall back to zxing for browsers that don't support it (notably Safari/iOS).
interface NativeDetectedBarcode { rawValue: string }
interface NativeBarcodeDetector { detect(source: CanvasImageSource): Promise<NativeDetectedBarcode[]> }
interface NativeBarcodeDetectorConstructor { new(options?: { formats?: string[] }): NativeBarcodeDetector }
declare global { interface Window { BarcodeDetector?: NativeBarcodeDetectorConstructor } }

const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar', 'qr_code']

export function BarcodeScannerDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (name: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const lastCodeRef = useRef<string | null>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'denied'>('starting')
  const [entries, setEntries] = useState<ScanEntry[]>([])
  const onAddRef = useRef(onAdd)
  onAddRef.current = onAdd

  // Deliberately empty deps: this starts the camera exactly once per dialog open.
  // Re-running it on every parent re-render (e.g. the background sync poll firing
  // every few seconds) would tear down and restart getUserMedia mid-scan, so any
  // prop the loop needs goes through a ref instead of the dependency array.
  useEffect(() => {
    let cancelled = false

    const handleCode = async (code: string) => {
      if (busyRef.current || code === lastCodeRef.current) return
      busyRef.current = true
      lastCodeRef.current = code
      try {
        const product = await lookupBarcode(code)
        if (cancelled) return
        if (product) {
          onAddRef.current(product.brand ? `${product.brand} ${product.name}` : product.name)
          setEntries(current => [{ code, name: product.name, found: true }, ...current].slice(0, 6))
        } else {
          setEntries(current => [{ code, name: code, found: false }, ...current].slice(0, 6))
        }
      } catch {
        if (!cancelled) setEntries(current => [{ code, name: code, found: false }, ...current].slice(0, 6))
      } finally {
        window.setTimeout(() => { busyRef.current = false; lastCodeRef.current = null }, 1500)
      }
    }

    const startNative = async (DetectorCtor: NativeBarcodeDetectorConstructor) => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (cancelled) { stream.getTracks().forEach(track => track.stop()); return }
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      if (cancelled) return
      setStatus('scanning')
      const detector = new DetectorCtor({ formats: BARCODE_FORMATS })
      const loop = async () => {
        if (cancelled) return
        try {
          const results = await detector.detect(video)
          if (results[0]) void handleCode(results[0].rawValue)
        } catch { /* transient decode errors are expected between frames */ }
        rafRef.current = window.requestAnimationFrame(loop)
      }
      rafRef.current = window.requestAnimationFrame(loop)
    }

    const startZxing = async () => {
      const reader = new BrowserMultiFormatReader()
      const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, videoRef.current ?? undefined, (result) => {
        if (cancelled || !result) return
        void handleCode(result.getText())
      })
      if (cancelled) { controls.stop(); return }
      controlsRef.current = controls
      setStatus('scanning')
    }

    ;(window.BarcodeDetector ? startNative(window.BarcodeDetector) : startZxing())
      .catch(() => { if (!cancelled) setStatus('denied') })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="modal-backdrop"><div className="dialog small barcode-dialog">
    <button className="close" onClick={onClose}><X /></button>
    <div className="dialog-icon"><ScanBarcode /></div>
    <h2>Scan pantry barcodes</h2>
    <p className="muted">Point your camera at a package barcode. Found items are added straight to your draft list below — keep scanning as many as you like.</p>
    <div className="barcode-video-frame">
      <video ref={videoRef} muted playsInline />
      <div className="barcode-reticle" aria-hidden="true" />
      {status === 'denied' && <div className="barcode-overlay"><p>Camera access was blocked. Allow camera permission for this site, then try again — or just type items in below.</p></div>}
    </div>
    {entries.length > 0 && <ul className="barcode-results">
      {entries.map((entry, index) => <li key={`${entry.code}-${index}`} className={entry.found ? 'found' : 'missing'}>
        {entry.found ? <Check size={15} /> : <X size={15} />}
        <span>{entry.found ? entry.name : `Not found — code ${entry.code}. Type it in manually.`}</span>
      </li>)}
    </ul>}
    <button className="button full" onClick={onClose}>Done scanning</button>
  </div></div>
}
