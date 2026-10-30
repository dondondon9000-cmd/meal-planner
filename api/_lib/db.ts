import { neon } from '@neondatabase/serverless'
import { initialPantry, seedMembers, seedRecipes, seedSlots } from '../../src/model.js'

export type AppState = {
  recipes: unknown[]
  members: unknown[]
  slots: unknown[]
  pantry: unknown[]
  manualItems: unknown[]
  groceryChecks: Record<string, boolean>
  storeOverrides: Record<string, string>
  preferences: Record<string, unknown>
}

const defaultState: AppState = {
  recipes: seedRecipes,
  members: seedMembers,
  slots: seedSlots,
  pantry: initialPantry,
  manualItems: [
    { id: 'dog-food', name: 'Bramble’s dog food', amount: 1, unit: 'bag', category: 'Pet', store: 'Walmart', checked: false, source: 'pet' },
    { id: 'dish-tabs', name: 'Dishwasher tablets', amount: 1, unit: 'box', category: 'Household', store: 'Walmart', checked: false, source: 'manual' },
  ],
  groceryChecks: {},
  storeOverrides: {},
  preferences: { cuisine: 'Flexible', cookingLimit: 45, budget: 'Balanced', weekBegins: 'Monday' },
}

function client() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('Missing server configuration: DATABASE_URL')
  return neon(url)
}

export async function ensureStateTable() {
  const sql = client()
  await sql`create table if not exists household_app_state (
    household_key text primary key,
    state jsonb not null,
    revision bigint not null default 1,
    updated_at timestamptz not null default now()
  )`
  await sql`insert into household_app_state (household_key, state)
    values ('primary', ${JSON.stringify(defaultState)}::jsonb)
    on conflict (household_key) do nothing`
}

export async function readState() {
  await ensureStateTable()
  const sql = client()
  const rows = await sql`select state, revision, updated_at from household_app_state where household_key = 'primary'`
  return { state: rows[0].state as AppState, revision: Number(rows[0].revision), updatedAt: rows[0].updated_at }
}

export async function writeState(state: AppState, expectedRevision?: number) {
  await ensureStateTable()
  const sql = client()
  if (expectedRevision !== undefined) {
    const rows = await sql`update household_app_state
      set state = ${JSON.stringify(state)}::jsonb, revision = revision + 1, updated_at = now()
      where household_key = 'primary' and revision = ${expectedRevision}
      returning revision, updated_at`
    if (!rows.length) return null
    return { revision: Number(rows[0].revision), updatedAt: rows[0].updated_at }
  }
  const rows = await sql`update household_app_state
    set state = ${JSON.stringify(state)}::jsonb, revision = revision + 1, updated_at = now()
    where household_key = 'primary'
    returning revision, updated_at`
  return { revision: Number(rows[0].revision), updatedAt: rows[0].updated_at }
}
