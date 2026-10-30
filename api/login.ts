import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSessionCookie, noStore, requireSameOrigin, verifyPassword } from './_lib/auth.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res)) return
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!password || password.length > 256 || !verifyPassword(password)) return res.status(401).json({ error: 'That household password was not recognized' })
  res.setHeader('Set-Cookie', createSessionCookie())
  return res.status(200).json({ authenticated: true })
}
