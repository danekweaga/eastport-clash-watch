# Eastport Clash Watch

A small shared **read view** for Halifax founder-facing events. It watches **Volta** and **Tribe Network** on Eventbrite, flags same-day overlaps, and refreshes automatically when new listings appear.

## Live updates

Eventbrite blocks browser calls, so live mode runs through a tiny local server:

1. Create a private token at [Eventbrite API keys](https://www.eventbrite.com/platform/api-keys)
2. Copy `.env.example` to `.env` and set `EVENTBRITE_TOKEN=...`
3. Run:

```bash
npm install
npm run live
```

Open the URL it prints (default `http://127.0.0.1:5173`).

- Server re-checks Eventbrite about every **2 minutes**
- Page re-pulls `/api/events` every **60 seconds**
- **Check now / Refresh from Eventbrite** forces an immediate sync
- Without a token, it loads `public/halifax-real-events.csv` instead

Organizers watched:

- Volta — https://www.eventbrite.ca/o/3570959959
- Tribe Network — https://www.eventbrite.ca/o/tribe-network-51349688173

## What it does

- Shows a shared list across organisations
- Flags same-day overlaps automatically
- Highlights likely flagship pairs
- Links back to Eventbrite when live
- Optional CSV import for one-off snapshots

## What it is not

- Not a full multi-org calendar everyone must maintain weekly
- Not a mandate system
- Not proof that clashes change attendance

## CSV format

```csv
org,event_name,event_date,flagship,movable
Volta,AI Showcase and Mixer,2026-09-16,yes,yes
Tribe Network,Startup Huddle Halifax Session 3,2026-01-29,yes,yes
```
