import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupBarcode } from './barcode'

afterEach(() => { vi.unstubAllGlobals() })

describe('lookupBarcode', () => {
  it('returns the product name and brand when found', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      status: 1, product: { product_name: 'Rolled Oats', brands: 'Quaker,Other' },
    }), { status: 200 })))
    await expect(lookupBarcode('030000000000')).resolves.toEqual({ name: 'Rolled Oats', brand: 'Quaker' })
  })

  it('returns null when the product is not in the database', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 })))
    await expect(lookupBarcode('000000000000')).resolves.toBeNull()
  })

  it('throws when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    await expect(lookupBarcode('000000000000')).rejects.toThrow()
  })
})
