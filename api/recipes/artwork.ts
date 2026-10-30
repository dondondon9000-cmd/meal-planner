import type { VercelRequest, VercelResponse } from '@vercel/node'
import { noStore, requireSameOrigin, requireSession } from '../_lib/auth.js'

export const config = { maxDuration: 60 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res) || !requireSession(req, res)) return
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) return res.status(503).json({ error: 'Recipe artwork needs an OpenAI API key added to the site' })
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 100) : ''
  const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 240) : ''
  const ingredients = Array.isArray(req.body?.ingredients) ? req.body.ingredients.filter((item: unknown) => typeof item === 'string').slice(0, 10).join(', ') : ''
  if (!title) return res.status(400).json({ error: 'Recipe title is required' })
  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(55_000),
      body: JSON.stringify({
        model: process.env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-2',
        prompt: `A warm, appetizing overhead food photograph of ${title}. ${description}. Main ingredients: ${ingredients}. Rustic dark green and amber cottage-kitchen styling, natural window light, realistic home-cooked plating, no text, no logos, no people.`,
        size: '1024x1024', quality: 'low', output_format: 'webp', output_compression: 70,
      }),
    })
    const data = await response.json() as { data?: Array<{ b64_json?: string }>; error?: { message?: string } }
    if (!response.ok) throw new Error(data.error?.message || 'OpenAI image request failed')
    const base64 = data.data?.[0]?.b64_json
    if (!base64) throw new Error('No artwork was returned')
    return res.status(200).json({ imageUrl: `data:image/webp;base64,${base64}` })
  } catch (error) {
    return res.status(502).json({ error: (error instanceof Error ? error.message : 'Artwork generation failed').slice(0, 180) })
  }
}
