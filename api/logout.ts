import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clearSessionCookie, noStore, requireSameOrigin } from './_lib/auth.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res)) return
  res.setHeader('Set-Cookie', clearSessionCookie())
  return res.status(200).json({ authenticated: false })
}
