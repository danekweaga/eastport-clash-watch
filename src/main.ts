import './style.css'
import { findClashes, parseCsv } from './clashes.ts'
import { sampleEvents } from './sample.ts'
import type { LiveStatus } from './eventbrite.ts'
import type { ClashPair, EventRecord, Filter } from './types.ts'

let events: EventRecord[] = [...sampleEvents]
let filter: Filter = 'all'
let liveBusy = false
let status: LiveStatus = {
  mode: 'sample',
  message: 'Starting live watcher…',
  lastChecked: null,
  lastChanged: null,
  sourceCount: 0,
}

const app = document.querySelector<HTMLDivElement>('#app')!
const CLIENT_POLL_MS = 60_000

function formatDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function eventCard(event: EventRecord, clashDates: Set<string>, flagshipClashes: ClashPair[]): string {
  const clash = clashDates.has(event.date)
  const flagshipClash = flagshipClashes.some((pair) => pair.date === event.date)
  const title = event.url
    ? `<a href="${escapeHtml(event.url)}" target="_blank" rel="noreferrer">${escapeHtml(event.name)}</a>`
    : escapeHtml(event.name)
  return `
    <article class="card ${flagshipClash ? 'flagship-clash' : clash ? 'clash' : ''}">
      <div class="card-top">
        <h3>${title}</h3>
        <span class="badge ${event.movable ? 'movable' : 'fixed'}">${event.movable ? 'May move' : 'Fixed'}</span>
      </div>
      <p class="meta">${escapeHtml(event.org)} · ${formatDate(event.date)}</p>
      <p class="meta">
        ${event.flagship ? '<span class="badge flagship">Flagship</span>' : ''}
        ${clash ? '<span class="badge overlap">Same-day overlap</span>' : ''}
        ${event.source === 'eventbrite' ? '<span class="badge live">Eventbrite</span>' : ''}
      </p>
    </article>
  `
}

function clashCard(pair: ClashPair): string {
  const names = pair.events.map((event) => `${event.org}: ${event.name}`).join(' · ')
  return `
    <article class="card ${pair.bothFlagship ? 'flagship-clash' : 'clash'}">
      <div class="card-top">
        <h3>${formatDate(pair.date)}</h3>
        <span class="badge overlap">${pair.bothFlagship ? 'Flagship pair' : 'Overlap'}</span>
      </div>
      <p class="meta">${escapeHtml(names)}</p>
      <p class="meta">${pair.anyMovable ? 'At least one date might still move with notice.' : 'All listed dates on this day look fixed.'}</p>
    </article>
  `
}

function liveBanner(): string {
  const modeClass = status.mode === 'live' ? 'ok' : status.mode === 'error' ? 'bad' : 'warm'
  return `
    <div class="live-bar ${modeClass}">
      <div>
        <strong>${status.mode === 'live' ? 'Live Eventbrite' : status.mode === 'error' ? 'Live sync issue' : 'Saved listings'}</strong>
        <span>${escapeHtml(status.message)}</span>
      </div>
      <div class="live-actions">
        <button class="ghost" id="refresh-live" type="button" ${liveBusy ? 'disabled' : ''}>${liveBusy ? 'Checking…' : 'Check now'}</button>
      </div>
    </div>
  `
}

function render(): void {
  const clashes = findClashes(events)
  const clashDates = new Set(clashes.map((pair) => pair.date))
  const flagshipClashes = clashes.filter((pair) => pair.bothFlagship)
  const movableClashes = clashes.filter((pair) => pair.anyMovable)

  const visibleEvents = events
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.org.localeCompare(b.org))
    .filter((event) => {
      if (filter === 'clashes') return clashDates.has(event.date)
      if (filter === 'flagship') return event.flagship
      return true
    })

  app.innerHTML = `
    <header class="hero">
      <span class="eyebrow">Halifax · Volta + Tribe Network · auto-refresh</span>
      <h1>See same-day overlaps before dates lock.</h1>
      <p>Watches Eventbrite for Volta and Tribe Network. When a new listing appears, the watch list updates without a weekly manual chore.</p>
      <div class="stats">
        <div class="stat"><strong>${events.length}</strong><span>listed events</span></div>
        <div class="stat"><strong>${clashes.length}</strong><span>same-day overlaps</span></div>
        <div class="stat hot"><strong>${flagshipClashes.length}</strong><span>flagship pairs</span></div>
      </div>
    </header>
    ${liveBanner()}
    <div class="layout">
      <section class="panel">
        <h2>Watch list</h2>
        <p class="lede">Live mode pulls from Eventbrite. You can still import a CSV if you want a one-off snapshot.</p>
        <div class="controls">
          <button class="primary" id="refresh-live-main" type="button" ${liveBusy ? 'disabled' : ''}>${liveBusy ? 'Checking…' : 'Refresh from Eventbrite'}</button>
          <label class="upload">Import CSV<input id="csv" type="file" accept=".csv,text/csv" /></label>
          <button class="ghost" id="reset" type="button">Load sample</button>
          <a class="ghost" href="/halifax-real-events.csv" download style="display:inline-flex;align-items:center;text-decoration:none;">Halifax CSV</a>
        </div>
        <div class="filters">
          <button class="chip ${filter === 'all' ? 'active' : ''}" data-filter="all" type="button">All events</button>
          <button class="chip ${filter === 'clashes' ? 'active' : ''}" data-filter="clashes" type="button">Overlaps only</button>
          <button class="chip ${filter === 'flagship' ? 'active' : ''}" data-filter="flagship" type="button">Flagship</button>
        </div>
        <div class="list">
          ${visibleEvents.length ? visibleEvents.map((event) => eventCard(event, clashDates, flagshipClashes)).join('') : '<p class="empty">Nothing in this filter.</p>'}
        </div>
      </section>
      <aside class="panel">
        <h2>Where a date might still move</h2>
        <p class="lede">${movableClashes.length} overlap${movableClashes.length === 1 ? '' : 's'} include at least one movable date.</p>
        <div class="list">
          ${clashes.length ? clashes.map(clashCard).join('') : '<p class="empty">No cross-organisation same-day pairs in this list.</p>'}
        </div>
        <p class="note">Live updates need an Eventbrite private token in <code>.env</code>. The server checks Volta and Tribe Network every couple of minutes; the page refreshes every minute.</p>
      </aside>
    </div>
  `

  bind()
}

function bind(): void {
  app.querySelector('#reset')?.addEventListener('click', () => {
    events = [...sampleEvents]
    status = {
      mode: 'sample',
      message: 'Loaded built-in sample data (not live Eventbrite).',
      lastChecked: new Date().toISOString(),
      lastChanged: new Date().toISOString(),
      sourceCount: events.length,
    }
    render()
  })
  app.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      filter = button.dataset.filter as Filter
      render()
    })
  })
  app.querySelector<HTMLInputElement>('#csv')?.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    const parsed = parseCsv(await file.text())
    if (parsed.length) {
      events = parsed.map((item) => ({ ...item, source: 'csv' as const }))
      status = {
        mode: 'cached',
        message: `Imported ${parsed.length} rows from CSV.`,
        lastChecked: new Date().toISOString(),
        lastChanged: new Date().toISOString(),
        sourceCount: parsed.length,
      }
    }
    render()
  })
  const refresh = () => {
    void pullLive(true)
  }
  app.querySelector('#refresh-live')?.addEventListener('click', refresh)
  app.querySelector('#refresh-live-main')?.addEventListener('click', refresh)
}

async function pullLive(forceServerRefresh = false): Promise<void> {
  liveBusy = true
  render()
  try {
    if (forceServerRefresh) {
      await fetch('/api/refresh', { method: 'POST', cache: 'no-store' }).catch(() => undefined)
    }
    const response = await fetch(forceServerRefresh ? `/api/events?ts=${Date.now()}` : '/api/events', { cache: 'no-store' })
    if (!response.ok) throw new Error(`API ${response.status}`)
    const data = await response.json() as { events: EventRecord[]; status: LiveStatus }
    const next = Array.isArray(data.events) ? data.events : []
    const previousIds = new Set(events.map((event) => event.id))
    const added = next.filter((event) => !previousIds.has(event.id))
    events = next.length ? next : events
    status = data.status
    if (added.length) {
      status = {
        ...status,
        message: `${status.message} New on the list: ${added.slice(0, 3).map((event) => event.name).join('; ')}${added.length > 3 ? '…' : ''}`,
      }
    }
  } catch {
    status = {
      mode: 'error',
      message: 'Could not reach the live server. Run npm run live (not only npm run dev) so /api/events is available.',
      lastChecked: new Date().toISOString(),
      lastChanged: status.lastChanged,
      sourceCount: events.length,
    }
  } finally {
    liveBusy = false
    render()
  }
}

render()
void pullLive(false)
window.setInterval(() => {
  void pullLive(false)
}, CLIENT_POLL_MS)
