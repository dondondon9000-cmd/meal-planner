import type { VercelRequest, VercelResponse } from '@vercel/node'
import { noStore, requireSameOrigin, requireSession } from './_lib/auth.js'
import { appendHistoryEvents, isHistoryEventType, listHistoryEvents } from './_lib/history.js'
import type { HistoryEventType } from '../src/model.js'

const MAX_EVENTS_PER_REQUEST = 25
const MAX_PAYLOAD_BYTES = 4000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  noStore(res)
  if (!requireSession(req, res)) return

  if (req.method === 'GET') {
    try {
      return res.status(200).json({ events: await listHistoryEvents() })
    } catch (error) {
      console.error('History read failed', error instanceof Error ? error.message : 'unknown error')
      return res.status(500).json({ error: 'Household history is unavailable' })
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSameOrigin(req, res)) return

  const events = req.body?.events
  if (!Array.isArray(events) || !events.length || events.length > MAX_EVENTS_PER_REQUEST) {
    return res.status(400).json({ error: `events must contain 1-${MAX_EVENTS_PER_REQUEST} items` })
  }

  const clean: { type: HistoryEventType; payload: Record<string, unknown> }[] = []
  for (const event of events) {
    if (!event || typeof event !== 'object' || !isHistoryEventType(event.type) || !event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
      return res.status(400).json({ error: 'Invalid history event' })
    }
    if (Buffer.byteLength(JSON.stringify(event.payload)) > MAX_PAYLOAD_BYTES) {
      return res.status(400).json({ error: 'Event payload too large' })
    }
    clean.push({ type: event.type, payload: event.payload })
  }

  try {
    await appendHistoryEvents(clean)
    return res.status(201).json({ ok: true })
  } catch (error) {
    console.error('History write failed', error instanceof Error ? error.message : 'unknown error')
    return res.status(500).json({ error: 'Household history is unavailable' })
  }
}
