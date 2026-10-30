import type { VercelRequest, VercelResponse } from '@vercel/node'
import { noStore, requireSession } from '../_lib/auth.js'
import { searchMealDb } from '../_lib/mealdb.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSession(req, res)) return

  const raw = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q
  const query = raw?.trim() || ''
  if (query.length < 2 || query.length > 80) return res.status(400).json({ error: 'Enter between 2 and 80 characters' })

  try {
    const recipes = await searchMealDb(query)
    return res.status(200).json({ source: 'TheMealDB', recipes })
  } catch {
    return res.status(502).json({ error: 'Internet recipe search is temporarily unavailable' })
  }
}
