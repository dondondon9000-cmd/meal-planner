import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const sql = neon(process.env.DATABASE_URL)

await sql`create table if not exists household_app_state (
  household_key text primary key,
  state jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
)`

console.log('Household state migration is ready.')
