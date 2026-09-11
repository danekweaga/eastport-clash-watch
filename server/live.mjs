import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

loadEnv(path.join(root, '.env'))

const PORT = Number(process.env.PORT ?? 5173)
const TOKEN = process.env.EVENTBRITE_TOKEN?.trim() ?? ''
const POLL_MS = Number(process.env.LIVE_POLL_MS ?? 120_000)

const ORGANIZERS = [
  { id: '3570959959', name: 'Volta' },
  { id: '51349688173', name: 'Tribe Network' },
]

const FLAGSHIP_HINT = /showcase|mixer|meetup|huddle|investment|demo day|pitch|forum|panel|governance/i
const CASUAL_HINT = /yoga|coffee|hockey|run club|wellness|meditat/i

/** @type {{ events: any[], fingerprint: string, lastChecked: string | null, lastChanged: string | null, mode: string, message: string }} */
let cache = {
  events: [],
  fingerprint: '',
  lastChecked: null,
  lastChanged: null,
  mode: TOKEN ? 'live' : 'sample',
  message: TOKEN
    ? 'Connecting to Eventbrite…'
    : 'No EVENTBRITE_TOKEN yet — showing saved Halifax listings. Add a token to .env for live updates.',
}

await refreshEvents()
setInterval(() => {
  void refreshEvents()
}, POLL_MS)

const vite = await createViteServer({
  root,
  server: { middlewareMode: true },
  appType: 'spa',
})

const server = (await import('node:http')).createServer(async (req, res) => {
  try {
    const url = req.url ?? '/'
    if (url.startsWith('/api/events')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify({
        events: cache.events,
        status: {
          mode: cache.mode,
          message: cache.message,
          lastChecked: cache.lastChecked,
          lastChanged: cache.lastChanged,
          sourceCount: cache.events.length,
        },
      }))
      return
    }

    if (url.startsWith('/api/refresh') && req.method === 'POST') {
      await refreshEvents()
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ ok: true, status: {
        mode: cache.mode,
        message: cache.message,
        lastChecked: cache.lastChecked,
        lastChanged: cache.lastChanged,
        sourceCount: cache.events.length,
      } }))
      return
    }

    vite.middlewares(req, res, async () => {
      const index = fs.readFileSync(path.join(root, 'index.html'), 'utf-8')
      const html = await vite.transformIndexHtml(url, index)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(html)
    })
  } catch (error) {
    vite.ssrFixStacktrace(error)
    res.statusCode = 500
    res.end(String(error))
  }
})

server.listen(PORT, () => {
  console.log(`Clash Watch live server: http://127.0.0.1:${PORT}`)
  console.log(TOKEN
    ? `Eventbrite live polling every ${Math.round(POLL_MS / 1000)}s for Volta + Tribe Network`
    : 'Set EVENTBRITE_TOKEN in .env to enable live Eventbrite updates')
})

async function refreshEvents() {
  const checked = new Date().toISOString()
  cache.lastChecked = checked

  if (!TOKEN) {
    const fallback = await loadFallbackCsv()
    const fingerprint = fingerprintEvents(fallback)
    if (fingerprint !== cache.fingerprint) {
      cache.fingerprint = fingerprint
      cache.lastChanged = checked
      cache.events = fallback
    } else if (!cache.events.length) {
      cache.events = fallback
    }
    cache.mode = 'sample'
    cache.message = 'No EVENTBRITE_TOKEN — using saved Halifax CSV. Add a private Eventbrite token to turn on live updates.'
    return
  }

  try {
    const collected = []
    for (const org of ORGANIZERS) {
      const live = await fetchOrganizerEvents(org.id, org.name, 'live')
      const ended = await fetchOrganizerEvents(org.id, org.name, 'ended', 15)
      collected.push(...live, ...ended)
    }
    const deduped = dedupe(collected).sort((a, b) => a.date.localeCompare(b.date))
    const fingerprint = fingerprintEvents(deduped)
    const changed = fingerprint !== cache.fingerprint
    if (changed) {
      cache.fingerprint = fingerprint
      cache.lastChanged = checked
      cache.events = deduped
      console.log(`[live] ${deduped.length} events — list changed`)
    } else {
      console.log(`[live] ${deduped.length} events — no change`)
    }
    cache.mode = 'live'
    cache.message = changed
      ? `Live Eventbrite update at ${formatTime(checked)} — new or changed events detected.`
      : `Live Eventbrite sync OK at ${formatTime(checked)}. Watching Volta + Tribe Network.`
  } catch (error) {
    console.error('[live] refresh failed', error)
    if (!cache.events.length) {
      cache.events = await loadFallbackCsv()
    }
    cache.mode = 'error'
    cache.message = `Eventbrite refresh failed: ${error instanceof Error ? error.message : String(error)}. Showing last known list.`
  }
}

async function fetchOrganizerEvents(organizerId, orgName, status, pageSize = 50) {
  const url = new URL(`https://www.eventbriteapi.com/v3/organizers/${organizerId}/events/`)
  url.searchParams.set('status', status)
  url.searchParams.set('order_by', status === 'live' ? 'start_asc' : 'start_desc')
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('time_filter', status === 'live' ? 'current_future' : 'past')

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${orgName} ${status}: ${response.status} ${body.slice(0, 180)}`)
  }
  const data = await response.json()
  const events = Array.isArray(data.events) ? data.events : []
  return events.flatMap((raw) => {
    const mapped = mapEvent(raw, orgName)
    return mapped ? [mapped] : []
  })
}

function mapEvent(raw, orgName) {
  const start = raw.start?.local ?? raw.start?.utc
  if (!raw.id || !raw.name?.text || !start) return null
  const name = String(raw.name.text).trim()
  return {
    id: `eb-${raw.id}`,
    org: orgName,
    name,
    date: String(start).slice(0, 10),
    flagship: FLAGSHIP_HINT.test(name) && !CASUAL_HINT.test(name),
    movable: true,
    url: raw.url,
    source: 'eventbrite',
  }
}

async function loadFallbackCsv() {
  const file = path.join(root, 'public', 'halifax-real-events.csv')
  if (!fs.existsSync(file)) return []
  const text = fs.readFileSync(file, 'utf-8')
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const header = splitCsv(lines[0]).map((cell) => cell.trim().toLowerCase())
  const orgIndex = header.indexOf('org')
  const nameIndex = header.findIndex((cell) => cell === 'event_name' || cell === 'name')
  const dateIndex = header.findIndex((cell) => cell === 'event_date' || cell === 'date')
  const flagshipIndex = header.indexOf('flagship')
  const movableIndex = header.indexOf('movable')
  const urlIndex = header.indexOf('source')
  return lines.slice(1).flatMap((line, index) => {
    const cells = splitCsv(line)
    const org = cells[orgIndex]?.trim() ?? ''
    const name = cells[nameIndex]?.trim() ?? ''
    const date = cells[dateIndex]?.trim() ?? ''
    if (!org || !name || !date) return []
    return [{
      id: `csv-${index + 1}`,
      org,
      name,
      date,
      flagship: /^(yes|true|1|y)$/i.test(cells[flagshipIndex] ?? ''),
      movable: /^(yes|true|1|y)$/i.test(cells[movableIndex] ?? 'yes'),
      url: cells[urlIndex]?.trim(),
      source: 'csv',
    }]
  })
}

function dedupe(events) {
  const map = new Map()
  for (const event of events) map.set(event.id, event)
  return [...map.values()]
}

function fingerprintEvents(events) {
  return events.map((event) => `${event.id}|${event.date}|${event.name}`).sort().join(';')
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function splitCsv(line) {
  const out = []
  let current = ''
  let quoted = false
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  out.push(current)
  return out
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return
  for (const line of fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}
