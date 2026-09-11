const ORGANIZERS = [
  { id: '3570959959', name: 'Volta' },
  { id: '51349688173', name: 'Tribe Network' },
]

const FLAGSHIP_HINT = /showcase|mixer|meetup|huddle|investment|demo day|pitch|forum|panel|governance/i
const CASUAL_HINT = /yoga|coffee|hockey|run club|wellness|meditat/i

const FALLBACK = [
  { id: 'csv-1', org: 'Volta', name: 'AI Showcase and Mixer', date: '2026-09-16', flagship: true, movable: true, url: 'https://www.eventbrite.ca/e/ai-showcase-and-mixer-tickets-1995680744830', source: 'csv' },
  { id: 'csv-2', org: 'Volta', name: 'Yoga', date: '2026-09-10', flagship: false, movable: true, url: 'https://www.eventbrite.ca/e/yoga-tickets-1996833845786', source: 'csv' },
  { id: 'csv-3', org: 'Volta', name: 'Yoga', date: '2026-09-24', flagship: false, movable: true, url: 'https://www.eventbrite.ca/e/yoga-tickets-1996833845786', source: 'csv' },
  { id: 'csv-4', org: 'Volta', name: 'Vibe Coding Meetup', date: '2026-09-21', flagship: true, movable: true, url: 'https://www.eventbrite.ca/e/vibe-coding-meetup-tickets-1998361732737', source: 'csv' },
  { id: 'csv-5', org: 'Volta', name: 'Turning Cybersecurity Privacy and AI Governance into a Business Advantage', date: '2026-09-28', flagship: true, movable: true, url: 'https://www.eventbrite.ca/e/turning-cybersecurity-privacy-and-ai-governance-into-a-business-advantage-tickets-1998983989925', source: 'csv' },
  { id: 'csv-6', org: 'Volta', name: 'Vibe Coding Meetup', date: '2026-08-17', flagship: true, movable: true, url: 'https://www.eventbrite.ca/e/vibe-coding-meetup-tickets-1995463015596', source: 'csv' },
  { id: 'csv-7', org: 'Tribe Network', name: 'Startup Huddle Halifax Session 3', date: '2026-01-29', flagship: true, movable: true, url: 'https://www.eventbrite.ca/e/startup-huddle-halifax-session-3-tribe-network-tickets-1975808662898', source: 'csv' },
]

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

async function fetchOrganizerEvents(token, organizerId, orgName, status) {
  // Organizer events endpoint only accepts a small query set (no time_filter / page_size).
  const url = new URL(`https://www.eventbriteapi.com/v3/organizers/${organizerId}/events/`)
  url.searchParams.set('status', status)
  url.searchParams.set('order_by', status === 'live' ? 'start_asc' : 'start_desc')

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
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

function dedupe(events) {
  const map = new Map()
  for (const event of events) map.set(event.id, event)
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('en-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export async function loadEventsPayload() {
  const checked = new Date().toISOString()
  const token = process.env.EVENTBRITE_TOKEN?.trim() ?? ''

  if (!token) {
    return {
      events: FALLBACK,
      status: {
        mode: 'sample',
        message: 'EVENTBRITE_TOKEN is not set on Vercel — showing saved Halifax listings. Add it in Project Settings → Environment Variables.',
        lastChecked: checked,
        lastChanged: checked,
        sourceCount: FALLBACK.length,
      },
    }
  }

  try {
    const collected = []
    for (const org of ORGANIZERS) {
      collected.push(...await fetchOrganizerEvents(token, org.id, org.name, 'live'))
      collected.push(...await fetchOrganizerEvents(token, org.id, org.name, 'ended'))
    }
    const events = dedupe(collected)
    return {
      events,
      status: {
        mode: 'live',
        message: `Live Eventbrite sync OK at ${formatTime(checked)}. Watching Volta + Tribe Network.`,
        lastChecked: checked,
        lastChanged: checked,
        sourceCount: events.length,
      },
    }
  } catch (error) {
    return {
      events: FALLBACK,
      status: {
        mode: 'error',
        message: `Eventbrite refresh failed: ${error instanceof Error ? error.message : String(error)}. Showing saved Halifax listings.`,
        lastChecked: checked,
        lastChanged: null,
        sourceCount: FALLBACK.length,
      },
    }
  }
}
