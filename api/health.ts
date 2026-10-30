import type { VercelRequest, VercelResponse } from '@vercel/node'
import { noStore, requireSession } from './_lib/auth.js'
import { readState } from './_lib/db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSession(req, res)) return
  try { const data = await readState(); return res.status(200).json({ ok: true, database: 'neon', revision: data.revision }) }
  catch { return res.status(503).json({ ok: false, database: 'unavailable' }) }
}
