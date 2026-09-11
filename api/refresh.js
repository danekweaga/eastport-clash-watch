import { loadEventsPayload } from '../lib/events.js'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return
  }
  const payload = await loadEventsPayload()
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({ ok: true, ...payload })
}
