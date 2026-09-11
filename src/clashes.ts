import type { ClashPair, EventRecord } from './types.ts'

export function findClashes(events: EventRecord[]): ClashPair[] {
  const byDate = new Map<string, EventRecord[]>()
  for (const event of events) {
    const list = byDate.get(event.date) ?? []
    list.push(event)
    byDate.set(event.date, list)
  }

  return [...byDate.entries()]
    .map(([date, dayEvents]) => ({
      date,
      events: dayEvents,
      bothFlagship: new Set(dayEvents.map((item) => item.org)).size > 1
        && dayEvents.filter((item) => item.flagship).length >= 2,
      anyMovable: dayEvents.some((item) => item.movable),
    }))
    .filter((pair) => new Set(pair.events.map((item) => item.org)).size > 1)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function parseCsv(text: string): EventRecord[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const header = splitCsv(lines[0] ?? '').map((cell) => cell.trim().toLowerCase())
  const orgIndex = header.findIndex((cell) => cell === 'org')
  const nameIndex = header.findIndex((cell) => cell === 'event_name' || cell === 'name')
  const dateIndex = header.findIndex((cell) => cell === 'event_date' || cell === 'date')
  const flagshipIndex = header.findIndex((cell) => cell === 'flagship')
  const movableIndex = header.findIndex((cell) => cell === 'movable')
  if (orgIndex < 0 || nameIndex < 0 || dateIndex < 0) return []

  return lines.slice(1).flatMap((line, index) => {
    const cells = splitCsv(line)
    const org = cells[orgIndex]?.trim() ?? ''
    const name = cells[nameIndex]?.trim() ?? ''
    const date = cells[dateIndex]?.trim() ?? ''
    if (!org || !name || !date) return []
    return [{
      id: `import-${index + 1}`,
      org,
      name,
      date,
      flagship: yes(cells[flagshipIndex]),
      movable: yes(cells[movableIndex]),
    }]
  })
}

function yes(value: string | undefined): boolean {
  return /^(yes|true|1|y)$/i.test(value?.trim() ?? '')
}

function splitCsv(line: string): string[] {
  const out: string[] = []
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
