import type { VercelRequest, VercelResponse } from '@vercel/node'
import { noStore, requireSameOrigin, requireSession } from './_lib/auth.js'
import { readState, writeState, type AppState } from './_lib/db.js'

const keys: (keyof AppState)[] = ['recipes', 'members', 'slots', 'pantry', 'manualItems', 'groceryChecks', 'storeOverrides', 'preferences']

function validState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return keys.every(key => key in state) && ['recipes', 'members', 'slots', 'pantry', 'manualItems'].every(key => Array.isArray(state[key])) && typeof state.groceryChecks === 'object' && typeof state.storeOverrides === 'object' && typeof state.preferences === 'object'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (!requireSession(req, res)) return
  try {
    if (req.method === 'GET') return res.status(200).json(await readState())
    if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })
    if (!requireSameOrigin(req, res)) return
    const rawSize = Buffer.byteLength(JSON.stringify(req.body || {}))
    if (rawSize > 1_000_000) return res.status(413).json({ error: 'Household state is too large' })
    if (!validState(req.body?.state)) return res.status(400).json({ error: 'Invalid household state' })
    const expected = Number.isSafeInteger(req.body?.revision) ? Number(req.body.revision) : undefined
    const result = await writeState(req.body.state, expected)
    if (!result) return res.status(409).json({ error: 'A newer household change is available', ...(await readState()) })
    return res.status(200).json(result)
  } catch (error) {
    console.error('State request failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ error: 'Household storage is unavailable' })
  }
}
