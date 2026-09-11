# Eastport Clash Watch

A small shared **read view** for Atlantic Canada founder-facing events. It helps organisers spot same-day overlaps early — especially flagship-on-flagship pairs — without becoming another weekly update chore.

## What it does

- Shows a shared list of events across organisations
- Flags same-day overlaps automatically
- Highlights pairs where **both** events are flagship
- Lets you import a simple CSV (or use the sample network data)
- Does **not** claim to move fixed funder/venue dates or measure attendance impact

## What it is not

- Not a full multi-org calendar that everyone must maintain weekly
- Not a mandate system (no organisation can force another's date)
- Not proof that clashes change attendance

## Local run

```bash
npm install
npm run dev
```

## CSV format

```csv
org,event_name,event_date,flagship,movable
Eastport,Founder workshop,2026-10-16,yes,yes
Saint John Hub,Demo day,2026-10-16,yes,no
```

## Fit for the problem

Built for Eastport Events Network's discovery findings: late visibility of overlaps, limited authority across orgs, prior shared calendars failing for lack of ownership, and many flagship dates that stay fixed even when visible.
