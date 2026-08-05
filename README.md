# CS Dashboard

One workspace for **Company Secretaries in India** — corporate filings,
research and compliance in a single tool. This repo is the POC: a web app whose
first fully-working module is **live BSE corporate announcements**.

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
  a branded dashboard shell, and the BSE Announcements tab with all the POC
  features (index/custom company selection, category + keyword filters, date
  range, latest-per-company vs all views, Excel/CSV/ZIP export).

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

## How the BSE feature works

Same engine as the POC, now server-side:

1. Pick companies (an index like Nifty50, or paste custom BSE scrip codes).
2. Choose a category and/or keyword (e.g. **Trading Window Closure**) and a
   date range (defaults to the last 90 days so quarterly filings are covered).
3. **Latest per company** shows one row per company with its most recent
   matching filing (companies with none are shown greyed; companies that
   couldn't be fetched are flagged amber — not silently blank).
4. Export to Excel / CSV, or download a ZIP of the PDFs.

The backend fetches from BSE's public announcement endpoint, resolves each PDF
to a working URL (`AttachLive` vs `AttachHis`), and proxies PDF views/downloads
(BSE blocks refererless browser clicks).

## Notes

- `backend/src/data/companies.csv` is a hand-entered Nifty50/Sensex seed list —
  verify scrip codes before relying on them; auto-sync is a future step.
- Auth is intentionally simple for the POC (JWT + a JSON user file). Swap for a
  real database before production.
- A full-index (50 company) fetch makes ~50 sequential BSE calls plus link
  verification — expect up to a minute the first time.

## Roadmap (next modules)

Compliance Calendar · Laws & Circulars · Resolutions & Templates · Board &
Committees · Clients — sketched in the sidebar, to be built after the POC.
