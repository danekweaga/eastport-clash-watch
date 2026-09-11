import './style.css'
import { findClashes, parseCsv } from './clashes.ts'
import { sampleEvents } from './sample.ts'
import type { ClashPair, EventRecord, Filter } from './types.ts'

let events = [...sampleEvents]
let filter: Filter = 'all'
const app = document.querySelector<HTMLDivElement>('#app')!

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
  return `
    <article class="card ${flagshipClash ? 'flagship-clash' : clash ? 'clash' : ''}">
      <div class="card-top">
        <h3>${escapeHtml(event.name)}</h3>
        <span class="badge ${event.movable ? 'movable' : 'fixed'}">${event.movable ? 'May move' : 'Fixed'}</span>
      </div>
      <p class="meta">${escapeHtml(event.org)} · ${formatDate(event.date)}</p>
      <p class="meta">
        ${event.flagship ? '<span class="badge flagship">Flagship</span>' : ''}
        ${clash ? '<span class="badge overlap">Same-day overlap</span>' : ''}
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
      <span class="eyebrow">Eastport Events Network · read-only watch</span>
      <h1>See same-day overlaps before dates lock.</h1>
      <p>A shared view, not a weekly chore. Flagship-on-flagship pairs sit at the top. Fixed funder and venue dates stay marked as immovable.</p>
      <div class="stats">
        <div class="stat"><strong>${events.length}</strong><span>listed events</span></div>
        <div class="stat"><strong>${clashes.length}</strong><span>same-day overlaps</span></div>
        <div class="stat hot"><strong>${flagshipClashes.length}</strong><span>flagship pairs</span></div>
      </div>
    </header>
    <div class="layout">
      <section class="panel">
        <h2>Watch list</h2>
        <p class="lede">Import a CSV or keep the sample network. Overlaps are detected automatically from dates.</p>
        <div class="controls">
          <label class="upload">Import CSV<input id="csv" type="file" accept=".csv,text/csv" /></label>
          <button class="ghost" id="reset" type="button">Load sample</button>
          <a class="ghost" href="/sample-events.csv" download style="display:inline-flex;align-items:center;text-decoration:none;">Download CSV template</a>
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
        <p class="lede">${movableClashes.length} overlap${movableClashes.length === 1 ? '' : 's'} include at least one movable date. Visibility will not free a locked funder or venue window.</p>
        <div class="list">
          ${clashes.length ? clashes.map(clashCard).join('') : '<p class="empty">No cross-organisation same-day pairs in this list.</p>'}
        </div>
        <p class="note">This view does not measure attendance. A named owner still has to keep the list current.</p>
      </aside>
    </div>
  `

  bind()
}

function bind(): void {
  app.querySelector('#reset')?.addEventListener('click', () => {
    events = [...sampleEvents]
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
    if (parsed.length) events = parsed
    render()
  })
}

render()
