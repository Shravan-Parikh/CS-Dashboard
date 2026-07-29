# BSE Corporate Announcements — MVP

Pull corporate filings (Trading Window Closure, Board Meetings, Results,
Dividends, etc.) straight from **BSE India** for the companies in an index,
filter by category / keyword / date, and export to **Excel / CSV / a ZIP of
PDFs**.

Frontend **and** backend are Streamlit for this MVP (no separate API server
yet — that's the next step).

## Data source

This uses BSE's own public announcement JSON endpoint
(`api.bseindia.com/BseIndiaAPI/api/AnnGetData/w`) — the same one that powers
the Corporate Announcements page on bseindia.com. **No API key required.** It
is undocumented, so if BSE changes it, the fix lives in one file:
[`bse_client.py`](bse_client.py).

## Setup

The virtual environment already exists (`venv/`). Activate it and install deps:

```bash
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
streamlit run app.py
```

It opens at http://localhost:8501.

## How to use

1. **Companies from** — pick an *Index list* (Nifty50 / Sensex seeded in
   `data/companies.csv`), *Upload CSV* (needs a `scrip_code` column), or paste
   *Custom scrip codes*.
2. **Category / keyword** — e.g. keyword preset **Trading Window Closure**.
3. **Date range** — defaults to the last 14 days.
4. **Fetch announcements** → results table with clickable PDF links.
5. Export to **Excel / CSV**, or **Build ZIP of PDFs**.

## Files

| File | Purpose |
|------|---------|
| `app.py` | Streamlit UI (front + back) |
| `bse_client.py` | BSE endpoint wrapper — patch here if BSE changes |
| `data/companies.csv` | Seed index constituents + BSE scrip codes |
| `requirements.txt` | Dependencies |

## Notes & caveats

- **`data/companies.csv` is a static seed list** (Nifty 50 / Sensex union).
  Scrip codes were entered by hand — verify before relying on them, and update
  the file as index membership changes. Later this should be auto-synced.
- BSE occasionally throttles rapid requests. Results are cached for 30 min
  (per identical search) to be polite.
- "Trading Window" filings are matched by **keyword** because BSE files them
  under the broad *Company Update* category, not a dedicated one.
- Older PDFs may 404 on the `AttachLive` path (they move to `AttachHis`).
  `bse_client.build_pdf_url(..., historical=True)` builds the alternate URL.

## Next steps (from the plan)

- SQLite cache + daily sync job (APScheduler / cron) so the UI reads a local
  DB instead of hitting BSE each time.
- Auto-sync index constituents.
- Expose a FastAPI `GET /announcements` for other tools to consume.
- Optional PDF OCR + semantic search.
