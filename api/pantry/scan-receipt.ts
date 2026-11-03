import type { VercelRequest, VercelResponse } from '@vercel/node'
import { noStore, requireSameOrigin, requireSession } from '../_lib/auth.js'

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

const itemsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array', maxItems: 60,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          amount: { type: 'number', minimum: 0.01, maximum: 100 },
          unit: { type: 'string', minLength: 1, maxLength: 30 },
        },
      },
    },
  },
} as const

function extractToolInput(response: Record<string, unknown>): { items: { name: string; amount?: number; unit?: string }[] } {
  const content = Array.isArray(response.content) ? response.content : []
  for (const block of content) {
    if (block && typeof block === 'object' && (block as { type?: unknown }).type === 'tool_use') {
      return (block as { input: { items: { name: string; amount?: number; unit?: string }[] } }).input
    }
  }
  throw new Error('The model did not return a parsed item list')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res) || !requireSession(req, res)) return

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return res.status(503).json({ error: 'Receipt scanning needs an Anthropic API key added to the site', code: 'AI_NOT_CONFIGURED' })

  const mediaType = typeof req.body?.mediaType === 'string' ? req.body.mediaType : ''
  const image = typeof req.body?.image === 'string' ? req.body.image : ''
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType as typeof ALLOWED_MEDIA_TYPES[number])) {
    return res.status(400).json({ error: 'Unsupported image type — use JPEG, PNG, or WebP' })
  }
  // Base64 inflates the raw byte count by about a third; this caps the IMAGE itself around
  // 4MB raw, comfortably inside Vercel's ~4.5MB request body limit alongside the rest of the
  // JSON payload. The client already downsizes the photo before it ever gets here — this is a
  // backstop, not the primary size control.
  if (image.length > 5_600_000) return res.status(413).json({ error: 'That photo is too large — it should have been resized automatically. Try again or use a different photo.' })
  if (!image) return res.status(400).json({ error: 'No image provided' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: process.env.ANTHROPIC_RECIPE_MODEL?.trim() || 'claude-haiku-5-5',
        max_tokens: 2000,
        system: 'Read this grocery receipt or online order summary and extract each purchased grocery/food/household item as its own entry with a plain, generic name (e.g. "yellow onion", not "YEL ONION 3LB #4011"). Include the quantity and unit only when the receipt clearly shows them — omit amount and unit entirely rather than guessing. Skip anything that is not an item itself: subtotals, tax, fees, bag charges, coupons, loyalty discounts, payment lines, and store/header text.',
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: 'Extract the purchased items from this receipt.' },
          ],
        }],
        tools: [{ name: 'receipt_items', description: 'Return the extracted grocery items as structured data.', input_schema: itemsSchema }],
        tool_choice: { type: 'tool', name: 'receipt_items' },
      }),
    })
    const data = await response.json() as Record<string, unknown>
    if (!response.ok) throw new Error(typeof (data.error as { message?: unknown } | undefined)?.message === 'string' ? (data.error as { message: string }).message : 'Anthropic request failed')
    const parsed = extractToolInput(data)
    return res.status(200).json({ items: parsed.items })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Receipt scanning failed'
    return res.status(502).json({ error: message.slice(0, 180) })
  }
}
