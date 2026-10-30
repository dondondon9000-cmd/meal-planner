import type { VercelRequest, VercelResponse } from '@vercel/node'
import { hasValidSession, noStore } from './_lib/auth.js'

export default function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  return res.status(200).json({ authenticated: hasValidSession(req), persistence: process.env.DATABASE_URL ? 'neon' : 'unavailable' })
}
