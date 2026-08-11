# CS Dashboard

One workspace for **Company Secretaries in India** — corporate filings,
research and compliance in a single tool. This repo is the POC.

Working modules:

| Module | What it does |
| --- | --- |
| **Latest Filings** | Market-wide BSE feed, filtered to the ~35 filing types a CS actually owns |
| **Announcements** | Company/index search over a date range, with Excel/CSV/ZIP export |
| **Compliance Calendar** | Statutory due dates for a listed company, computed from rules |
| **Company 360** | Slide-over with any company's full filing timeline, from any row |

```
CS-Dashboard/
├── backend/          Node + Express API (BSE client, JWT auth, exports)
├── frontend/         Next.js + Tailwind app (login + dashboard)
└── streamlit-poc/    Original Streamlit proof-of-concept (reference)
    (app.py, bse_client.py, data/, requirements.txt at repo root for now)
```

> The Streamlit files (`app.py`, `bse_client.py`, `data/companies.csv`) remain
> at the repo root as the original POC. The **web app** (backend + frontend) is
> the product going forward.

## Architecture

- **backend/** — Express API. Ports the BSE announcement client to Node, adds
  email/password auth (JWT, file-backed user store — no native deps), and
  endpoints for announcements, companies, a PDF proxy, and ZIP export.
- **frontend/** — Next.js (App Router) + TypeScript + Tailwind. Login/register,
  a branded dashboard shell, and the four modules above.

Key backend files:

```
backend/src/
├── bseClient.js      BSE transport: paging, date chunking, malformed-header fallback
├── csRelevance.js    the CS relevance buckets — (category, subcategory) pairs
├── compliance.js     statutory rules + due-date generation
└── routes/           announcements (search · latest feed · company 360), compliance, export
```

## Run it locally

You need **two terminals**.

### 1. Backend (port 4000)

```bash
cd backend
cp .env.example .env        # first time only
npm install                 # first time only
npm run dev
```

### 2. Frontend (port 3000)

```bash
cd frontend
cp .env.local.example .env.local   # first time only
npm install                        # first time only
npm run dev
```

Open **http://localhost:3000**, create an account, and you're in.

## The BSE API, as actually observed

BSE's announcement endpoint is undocumented, and its limits are not what you'd
guess. These were established by probing the live API, and they dictate how each
feature is built — read this before changing `bseClient.js`.

| Query shape | Date-span limit | Notes |
| --- | --- | --- |
| Single scrip (`strscrip` set) | **none** — 180 days works | Company search and Company 360 rely on this |
| Market-wide + `strCat=-1` | **one day only** | Anything wider silently returns `{}` |
| Market-wide + a *named* category | **~30 days** | Wider returns `{}` |

Two things make the market-wide feed practical:

- The cap is **volume-independent** — 30 days returning 19,000 rows succeeds
  while 60 days returning 125 rows fails. It's a server-side date check, not a
  result-size guard. So we chunk market-wide ranges at 25 days.
- The **`subcategory` parameter filters server-side** by exact name. That's what
  makes the CS feed cheap: "trading window closures" is one call, not a scan of
  every Insider Trading row.

`Table1[0].ROWCNT` carries the total row count, which is what allows real
pagination instead of walking pages until one comes back short.

Two quirks worth knowing:

- BSE serves some responses with **malformed HTTP/1.1 headers** (a leading space
  before the header name). Node's `fetch` rejects these outright, and it is
  deterministic per response — retrying never helps, and some pages become
  permanently unreachable. `bseGet()` falls back to `node:https` with
  `insecureHTTPParser` for exactly these. Without it, a year of Reliance filings
  stops dead at page 4.
- Text fields arrive with SQL-escaped quotes (`scrutinizer''s`), normalised in
  `parseRow`.

## How each module works

**Latest Filings** — `GET /api/announcements/latest`. Fetches by
(category, subcategory) pairs drawn from `csRelevance.js`, in parallel, and tags
every row with its CS bucket. Covers the whole market in ~3–5s, versus ~1 minute
for a 50-company search. PDF links are deliberately *not* pre-resolved: the
`/api/pdf` proxy already falls back between `AttachLive` and `AttachHis`.

**Announcements** — one BSE call per company, sequentially. "Latest per company"
gives one row each, with companies BSE refused flagged amber rather than left
silently blank.

**Compliance Calendar** — `GET /api/compliance`. `compliance.js` holds
*rules*, not dates: each obligation declares a cadence (quarterly, half-yearly,
annual-from-FY-end, fixed date, AGM-relative) and an offset, and due dates are
computed per request. So the calendar stays correct next FY with no re-keying.
Set the actual AGM date to correct AOC-4, MGT-7 and Reg. 34(1), which otherwise
assume the s.96 outer limit of 30 September.

**Company 360** — `GET /api/company/:scrip`. Single-scrip queries have no span
limit, so a year of filings comes back in one paged sweep.

## Notes

- `backend/src/data/companies.csv` is a hand-entered Nifty50/Sensex seed list —
  verify scrip codes before relying on them; auto-sync is a future step. The
  Latest Filings feed is *not* limited to it: it covers the whole market and uses
  the CSV only to add symbols and to power the "Universe" filter.
- The compliance rules are standard timelines with the governing provision cited
  on each item. They're a planning aid, not legal advice — entity-category
  carve-outs (SME, HVDLE, top-100/500/1000 by market cap) shift some dates.
- Auth and persistence run on **Firebase** (Auth + Firestore). See below.

## Firebase (auth + database)

Auth and persistence run on Firebase. The backend talks to Firebase over its
**REST APIs** (`src/firebase.js`) rather than `firebase-admin`, so no
service-account key needs provisioning — only the public web API key and
project id, both in `backend/.env`.

Two consequences worth knowing:

- **Firestore calls are made as the signed-in user**, carrying their ID token,
  so security rules genuinely apply. There is no privileged bypass.
- **ID tokens are verified locally** against Google's rotating public certs, so
  auth costs no network round-trip per request. Tokens last one hour; the
  frontend transparently refreshes on a 401 and replays the request.

### Collections

All prefixed `cs_` so nothing else in the shared Firebase project is touched:

| Collection | Shape | Purpose |
| --- | --- | --- |
| `cs_users/{uid}` | profile + `role` | account record; `role` drives admin access |
| `cs_watchlists/{uid}` | `{ companies: [...] }` | the companies a user tracks |
| `cs_saved_views/{uid}` | `{ views: [...] }` | saved search/filter presets |
| `cs_activity/{id}` | `{ uid, event, meta, at }` | usage log — what the pilot actually uses |

### Security rules

**`firestore.rules` is a fragment to merge, not a file to publish.** Firestore
rules are project-wide and publishing replaces the whole ruleset — pasting it in
as-is would drop the other app's rules. Copy only the `cs_*` blocks into the
existing ruleset in the Firebase console.

### Accounts

Self-service sign-up is off during the pilot (`ALLOW_PUBLIC_SIGNUP=false`).
Create accounts from the terminal:

```bash
cd backend
node scripts/create-user.js "Full Name" person@firm.com
```

It prints a generated password. Emails listed in `ADMIN_EMAILS` get the `admin`
role, which unlocks `GET /api/auth/admin/users`, `POST /api/auth/admin/users`
and `GET /api/admin/activity`.

## Roadmap (next modules)

Laws & Circulars · Resolutions & Templates · Board & Committees · Clients —
sketched in the sidebar, to be built after the POC. A real database is the next
structural step; nothing is persisted today, so every view is a live fetch.
