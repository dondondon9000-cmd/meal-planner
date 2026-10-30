export type BarcodeProduct = { name: string; brand?: string }

export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands`
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) })
  if (!response.ok) throw new Error(`Barcode lookup returned ${response.status}`)
  const data = await response.json() as { status?: number; product?: { product_name?: string; brands?: string } }
  const name = data.product?.product_name?.trim()
  if (data.status !== 1 || !name) return null
  return { name, brand: data.product?.brands?.split(',')[0]?.trim() || undefined }
}
