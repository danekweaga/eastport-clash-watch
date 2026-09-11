import type { EventRecord } from './types.ts'

export type LiveStatus = {
  mode: 'live' | 'cached' | 'sample' | 'error'
  message: string
  lastChecked: string | null
  lastChanged: string | null
  sourceCount: number
}

export const ORGANIZERS = [
  {
    id: '3570959959',
    name: 'Volta',
    profile: 'https://www.eventbrite.ca/o/3570959959',
  },
  {
    id: '51349688173',
    name: 'Tribe Network',
    profile: 'https://www.eventbrite.ca/o/tribe-network-51349688173',
  },
] as const

const FLAGSHIP_HINT = /showcase|mixer|meetup|huddle|investment|demo day|pitch|forum|panel|governance/i
const CASUAL_HINT = /yoga|coffee|hockey|run club|wellness|meditat/i

export function mapEventbriteEvent(raw: EventbriteEvent, orgName: string): EventRecord | null {
  const start = raw.start?.local ?? raw.start?.utc
  if (!raw.id || !raw.name?.text || !start) return null
  const date = start.slice(0, 10)
  const name = raw.name.text.trim()
  const flagship = FLAGSHIP_HINT.test(name) && !CASUAL_HINT.test(name)
  return {
    id: `eb-${raw.id}`,
    org: orgName,
    name,
    date,
    flagship,
    movable: true,
    url: raw.url,
    source: 'eventbrite',
  }
}

export type EventbriteEvent = {
  id: string
  name?: { text?: string }
  start?: { local?: string; utc?: string }
  url?: string
  status?: string
}

export type EventsApiResponse = {
  events: EventRecord[]
  status: LiveStatus
}
