import { neon } from '@neondatabase/serverless'
import { historyEventTypes, type HistoryEvent, type HistoryEventType } from '../../src/model.js'

const HOUSEHOLD_KEY = 'primary'

function client() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Missing server configuration: DATABASE_URL')
  return neon(url)
}

export function isHistoryEventType(value: unknown): value is HistoryEventType {
  return typeof value === 'string' && (historyEventTypes as string[]).includes(value)
}

export async function ensureHistoryTable() {
  const sql = client()
  await sql`create table if not exists history_events (
    id text primary key,
    household_key text not null default 'primary',
    type text not null,
    payload jsonb not null,
    occurred_at timestamptz not null default now()
  )`
  await sql`create index if not exists history_events_household_date on history_events (household_key, occurred_at desc)`
}

export async function appendHistoryEvents(events: { type: HistoryEventType; payload: Record<string, unknown> }[]) {
  await ensureHistoryTable()
  const sql = client()
  await Promise.all(events.map(event =>
    sql`insert into history_events (id, household_key, type, payload) values (${crypto.randomUUID()}, ${HOUSEHOLD_KEY}, ${event.type}, ${JSON.stringify(event.payload)}::jsonb)`
  ))
}

// A household's full history is small (home cooking/shopping cadence, not transaction
// volume), so one capped read is simpler and plenty - no pagination needed yet.
export async function listHistoryEvents(limit = 5000): Promise<HistoryEvent[]> {
  await ensureHistoryTable()
  const sql = client()
  const rows = await sql`select id, type, payload, occurred_at from history_events where household_key = ${HOUSEHOLD_KEY} order by occurred_at desc limit ${limit}`
  return rows.map(row => ({
    id: row.id as string,
    type: row.type as HistoryEventType,
    payload: row.payload as Record<string, unknown>,
    occurredAt: new Date(row.occurred_at as string).toISOString(),
  }))
}
