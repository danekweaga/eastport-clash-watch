export type EventRecord = {
  id: string
  org: string
  name: string
  date: string
  flagship: boolean
  movable: boolean
}

export type ClashPair = {
  date: string
  events: EventRecord[]
  bothFlagship: boolean
  anyMovable: boolean
}

export type Filter = 'all' | 'clashes' | 'flagship'
