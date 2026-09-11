import { loadEventsPayload } from '../lib/events.js'

export default async function handler(_req, res) {
  const payload = await loadEventsPayload()
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
  res.status(200).json(payload)
}
