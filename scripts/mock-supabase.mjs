/**
 * A pretend Supabase, for looking at the site without setting up a real one.
 *
 * It answers the same web requests a real Supabase project would (sign-up, sign-in,
 * reading and writing events and preferences), but everything lives in memory: stop
 * the server and it is all gone. Start it with `npm run dev:mock`.
 *
 * DEVELOPMENT ONLY. It has no database, no Row Level Security and no real auth —
 * every rule this project cares about is enforced in supabase/migrations, and none
 * of it is enforced here. Never point anything but your own laptop at it.
 */
import http from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.MOCK_PORT || 54321)

const users = new Map() // email -> {id, email, password}
const tokens = new Map() // access_token -> user id
const prefs = new Map() // user id -> row
let events = []

const ORG = randomUUID()
const day = (n, h) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(h, 0, 0, 0)
  return d.toISOString()
}
const seed = [
  ['Transmasc Coffee & Crafts', 'The Fold Café, Glasgow', 3, 11, ['trans_masc', 'nb'], ['meetup', 'art'], ['free', 'accessible_venue', 'alcohol_free'], 11],
  ['Name & Document Change Clinic', 'Central Library, Manchester', 5, 13, ['trans_masc', 'trans_fem', 'nb'], ['workshop', 'support_group'], ['free', 'accessible_venue'], 42],
  ['Sunday Kickabout — All Levels', 'Bramley Astroturf, Leeds', 6, 10, ['all_welcome', 'allies'], ['sports'], ['free', 'alcohol_free'], 19],
  ['HOWL — Sapphic Warehouse Party', 'Unit 12, Hackney Wick', 9, 22, ['sapphic', 'lesbian', 'bi_pan', 'nb'], ['party'], ['21+', 'ticketed'], 218],
  ['Slow Burn: A Speed-Dating Night', 'The Alma, Bristol', 12, 19, ['trans_fem', 'trans_masc', 'nb', 'bi_pan'], ['dating_mixer'], ['18+', 'ticketed'], 37],
  ['Life Drawing for Queer Bodies', 'Studio 4, Cardiff', 16, 18, ['all_welcome', 'gay', 'lesbian', 'nb'], ['art', 'workshop'], ['18+', 'ticketed', 'accessible_venue'], 14]
]
events = seed.map(([title, location, d, h, identity, type, vibe, going]) => ({
  id: randomUUID(),
  title,
  description: `${title} — seeded row for the mock backend so the feed has something to render.`,
  location,
  start_date: day(d, h),
  end_date: day(d, h + 3),
  is_public: true,
  is_free: !vibe.includes('ticketed'),
  requires_approval: false,
  capacity: null,
  theme: 'minimal',
  user_id: ORG,
  cover_image_url: null,
  identity_tags: identity,
  event_type_tags: type,
  vibe_tags: vibe,
  going_count: going,
  created_at: new Date().toISOString()
}))

const json = (res, code, body) => {
  res.writeHead(code, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
    'access-control-expose-headers': '*'
  })
  res.end(JSON.stringify(body))
}

const session = (user) => {
  const token = randomUUID()
  tokens.set(token, user.id)
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: randomUUID(),
    user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
  }
}

const currentUser = (req) => {
  const auth = req.headers.authorization || ''
  return tokens.get(auth.replace('Bearer ', '')) || null
}

const parseOr = (clause, row) => {
  // or=(title.ilike.%x%,location.ilike.%x%)
  const inner = clause.replace(/^\(|\)$/g, '')
  return inner.split(',').some((part) => {
    const [column, op, ...rest] = part.split('.')
    const value = rest.join('.').replace(/%/g, '').toLowerCase()
    if (op !== 'ilike') return false
    return String(row[column] ?? '').toLowerCase().includes(value)
  })
}

const applyFilters = (rows, params) => {
  let out = rows
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset'].includes(key)) continue
    if (key === 'or') {
      out = out.filter((row) => parseOr(raw, row))
      continue
    }
    const [op, ...rest] = raw.split('.')
    const value = rest.join('.')
    if (op === 'eq') out = out.filter((row) => String(row[key]) === value)
    else if (op === 'gte') out = out.filter((row) => new Date(row[key]) >= new Date(value))
    else if (op === 'ov') {
      const wanted = value.replace(/^\{|\}$/g, '').split(',').filter(Boolean)
      out = out.filter((row) => (row[key] || []).some((tag) => wanted.includes(tag)))
    }
  }
  const order = params.get('order')
  if (order) {
    const [column, dir] = order.split('.')
    out = [...out].sort((a, b) =>
      dir === 'desc'
        ? new Date(b[column]) - new Date(a[column])
        : new Date(a[column]) - new Date(b[column])
    )
  }
  return out
}

const body = (req) =>
  new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data ? JSON.parse(data) : null))
  })

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (req.method === 'OPTIONS') return json(res, 204, {})

    // ---- auth
    if (url.pathname === '/auth/v1/signup') {
      const { email, password } = await body(req)
      if (users.has(email)) return json(res, 400, { message: 'User already registered' })
      const user = { id: randomUUID(), email, password }
      users.set(email, user)
      return json(res, 200, session(user))
    }
    if (url.pathname === '/auth/v1/token') {
      const { email, password } = await body(req)
      const user = users.get(email)
      if (!user || user.password !== password) {
        return json(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' })
      }
      return json(res, 200, session(user))
    }
    if (url.pathname === '/auth/v1/logout') return json(res, 204, {})
    if (url.pathname === '/auth/v1/user') {
      const id = currentUser(req)
      const user = [...users.values()].find((u) => u.id === id)
      if (!user) return json(res, 401, { message: 'Unauthorized' })
      return json(res, 200, { id: user.id, email: user.email, aud: 'authenticated', app_metadata: {}, user_metadata: {} })
    }

    // ---- rest
    const table = url.pathname.replace('/rest/v1/', '')
    const uid = currentUser(req)
    const wantsObject = (req.headers.accept || '').includes('pgrst.object')

    const respond = (rows) => {
      if (!wantsObject) return json(res, 200, rows)
      if (rows.length === 0) {
        return json(res, 406, { code: 'PGRST116', message: 'No rows found', details: 'Results contain 0 rows' })
      }
      return json(res, 200, rows[0])
    }

    if (table === 'events') {
      if (req.method === 'GET') {
        // Mirrors the RLS read policy: public rows, plus your own.
        const visible = events.filter((row) => row.is_public || row.user_id === uid)
        return respond(applyFilters(visible, url.searchParams))
      }
      if (req.method === 'POST') {
        const payload = (await body(req))[0]
        const row = { id: randomUUID(), going_count: 0, created_at: new Date().toISOString(), ...payload }
        events.push(row)
        return respond([row])
      }
    }

    if (table === 'user_preferences') {
      if (req.method === 'GET') {
        const rows = uid && prefs.has(uid) ? [prefs.get(uid)] : []
        return respond(applyFilters(rows, url.searchParams))
      }
      if (req.method === 'POST') {
        const payload = await body(req)
        const row = Array.isArray(payload) ? payload[0] : payload
        if (row.user_id !== uid) return json(res, 403, { message: 'new row violates row-level security policy' })
        prefs.set(uid, row)
        return respond([row])
      }
    }

    if (table === 'attendees') return respond([])

    return json(res, 404, { message: `mock: unhandled ${req.method} ${req.url}` })
  })
  .listen(PORT, () => console.log(`  pretend Supabase listening on http://localhost:${PORT}`))
