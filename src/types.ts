export type EventRecord = {
  id: string
  org: string
  name: string
  date: string
  flagship: boolean
  movable: boolean
  url?: string
  source?: 'eventbrite' | 'csv' | 'sample'
}

export type ClashPair = {
  date: string
  events: EventRecord[]
  bothFlagship: boolean
  anyMovable: boolean
}

export type Filter = 'all' | 'clashes' | 'flagship'
