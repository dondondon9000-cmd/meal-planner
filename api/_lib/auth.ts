import { createHash, createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE = 'hearth_session'
const SESSION_SECONDS = 60 * 60 * 24 * 30

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing server configuration: ${name}`)
  return value
}

function sign(payload: string) {
  return createHmac('sha256', required('SESSION_SECRET')).update(payload).digest('base64url')
}

export function verifyPassword(password: string) {
  const configured = process.env.HOUSEHOLD_PASSWORD
  if (configured) {
    const expected = createHash('sha256').update(configured).digest()
    const actual = createHash('sha256').update(password).digest()
    return timingSafeEqual(actual, expected)
  }
  const salt = Buffer.from(required('HOUSEHOLD_PASSWORD_SALT'), 'hex')
  const expected = Buffer.from(required('HOUSEHOLD_PASSWORD_HASH'), 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createSessionCookie() {
  const payload = Buffer.from(JSON.stringify({ sub: 'shared-household', exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString('base64url')
  const token = `${payload}.${sign(payload)}`
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

function parseCookie(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2))
}

export function hasValidSession(req: VercelRequest) {
  try {
    const token = parseCookie(req.headers.cookie)[COOKIE]
    if (!token) return false
    const [payload, signature] = token.split('.')
    if (!payload || !signature) return false
    const expected = Buffer.from(sign(payload))
    const actual = Buffer.from(signature)
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub?: string; exp?: number }
    return decoded.sub === 'shared-household' && Number(decoded.exp) > Date.now() / 1000
  } catch { return false }
}

export function requireSession(req: VercelRequest, res: VercelResponse) {
  if (hasValidSession(req)) return true
  res.status(401).json({ error: 'Authentication required' })
  return false
}

export function requireSameOrigin(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin
  const host = req.headers['x-forwarded-host'] || req.headers.host
  if (!origin || !host) { res.status(403).json({ error: 'Origin check failed' }); return false }
  try {
    if (new URL(origin).host !== host) { res.status(403).json({ error: 'Origin check failed' }); return false }
    return true
  } catch { res.status(403).json({ error: 'Origin check failed' }); return false }
}

export function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0')
  res.setHeader('X-Content-Type-Options', 'nosniff')
}
