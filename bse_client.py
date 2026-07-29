"""
bse_client.py
=============

Thin wrapper around BSE India's (undocumented but public) corporate
announcement JSON endpoints. This is "Option 2" from the project plan:
the same endpoints that power www.bseindia.com's Corporate Announcements
page.

No official docs exist, so the field names below are derived from the
live API response. They can change without notice — treat this module as
the one place you'll need to patch if BSE tweaks the API.

Nothing here requires an API key. It DOES require browser-like headers,
otherwise BSE returns 403 / an Akamai block page.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, asdict
from typing import Iterable

import httpx

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ANN_URL = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w"

# Recent attachments live here; older ones move to AttachHis. We try Live
# first (covers the common "last few weeks" case) and expose a helper to
# build either.
ATTACH_LIVE = "https://www.bseindia.com/xml-data/corpfiling/AttachLive/{name}"
ATTACH_HIS = "https://www.bseindia.com/xml-data/corpfiling/AttachHis/{name}"

# BSE's top-level announcement categories. "-1" means "all categories".
# Sub-classifications (e.g. "Trading Window") live inside the headline /
# subject text, so we filter those with a keyword rather than a category.
CATEGORIES = [
    "-1",  # All
    "AGM/EGM",
    "Board Meeting",
    "Company Update",
    "Corp. Action",
    "Insider Trading / SAST",
    "New Listing",
    "Result",
    "Integrated Filing",
    "Others",
]

# Browser-like headers. The Referer/Origin matter — without them BSE 403s.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.bseindia.com/",
    "Origin": "https://www.bseindia.com",
    "Connection": "keep-alive",
}


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class Announcement:
    scrip_code: str
    company: str
    headline: str
    category: str
    subcategory: str
    news_dt: str          # ISO-ish string as returned by BSE
    news_id: str
    attachment: str       # file name only, may be empty
    pdf_url: str          # fully built URL, "" if no attachment

    def as_row(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fmt(d: dt.date) -> str:
    """BSE wants dates as YYYYMMDD strings."""
    return d.strftime("%Y%m%d")


def _decode(resp: httpx.Response) -> dict:
    """BSE returns the body as a JSON-*encoded string* (double-encoded), and a
    bare "No Record Found!" string when a query matches nothing. Normalise both
    to a dict with a "Table" key."""
    import json

    data = resp.json()
    if isinstance(data, str):
        text = data.strip()
        if not text or text.lower().startswith("no record"):
            return {"Table": [], "Table1": []}
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return {"Table": [], "Table1": []}
    return data if isinstance(data, dict) else {"Table": [], "Table1": []}


def build_pdf_url(attachment: str, historical: bool = False) -> str:
    if not attachment:
        return ""
    tpl = ATTACH_HIS if historical else ATTACH_LIVE
    return tpl.format(name=attachment)


def _parse_row(row: dict) -> Announcement:
    """Map a raw BSE JSON row to our Announcement dataclass.

    BSE occasionally renames fields; we look up a few known aliases so a
    single rename doesn't wipe out a column.
    """

    def pick(*keys: str) -> str:
        for k in keys:
            v = row.get(k)
            if v not in (None, ""):
                return str(v).strip()
        return ""

    attachment = pick("ATTACHMENTNAME", "Attachmentname")
    return Announcement(
        scrip_code=pick("SCRIP_CD", "Scrip_Cd"),
        company=pick("SLONGNAME", "Slongname", "COMPANYNAME"),
        headline=pick("HEADLINE", "NEWSSUB", "News_submission_dt"),
        category=pick("CATEGORYNAME", "Categoryname"),
        subcategory=pick("SUBCATNAME", "Subcatname"),
        news_dt=pick("NEWS_DT", "News_dt", "DissemDT"),
        news_id=pick("NEWSID", "Newsid"),
        attachment=attachment,
        pdf_url=build_pdf_url(attachment),
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def fetch_announcements(
    from_date: dt.date,
    to_date: dt.date,
    scrip_code: str | None = None,
    category: str = "-1",
    max_pages: int = 25,
    client: httpx.Client | None = None,
) -> list[Announcement]:
    """Fetch announcements for a single scrip (or all scrips) in a range.

    Parameters
    ----------
    from_date, to_date : date range (inclusive).
    scrip_code : BSE numeric scrip code as a string. None/"" = all companies.
    category : one of CATEGORIES. "-1" = all.
    max_pages : safety cap on pagination (BSE returns ~50 rows/page).
    client : optional shared httpx.Client (lets the caller reuse connections).
    """

    owns_client = client is None
    if client is None:
        client = httpx.Client(headers=HEADERS, timeout=30.0)

    results: list[Announcement] = []
    try:
        for page in range(1, max_pages + 1):
            params = {
                "pageno": page,
                "strCat": category or "-1",
                "subcategory": "-1",
                "strPrevDate": _fmt(from_date),
                "strToDate": _fmt(to_date),
                "strSearch": "P",
                "strscrip": scrip_code or "",
                "strType": "C",
            }
            resp = client.get(ANN_URL, params=params)
            resp.raise_for_status()
            payload = _decode(resp)
            rows = payload.get("Table") or []
            if not rows:
                break
            results.extend(_parse_row(r) for r in rows)
            # Fewer than a full page => no more data.
            if len(rows) < 50:
                break
    finally:
        if owns_client:
            client.close()

    return results


def fetch_for_scrips(
    scrip_codes: Iterable[str],
    from_date: dt.date,
    to_date: dt.date,
    category: str = "-1",
    progress=None,
) -> list[Announcement]:
    """Fetch announcements for many scrips, reusing one HTTP connection.

    `progress` is an optional callable(done, total, label) used by the UI
    to render a progress bar.
    """

    scrips = [s for s in scrip_codes if s]
    out: list[Announcement] = []
    with httpx.Client(headers=HEADERS, timeout=30.0) as client:
        total = len(scrips)
        for i, code in enumerate(scrips, start=1):
            if progress:
                progress(i, total, code)
            try:
                out.extend(
                    fetch_announcements(
                        from_date,
                        to_date,
                        scrip_code=code,
                        category=category,
                        client=client,
                    )
                )
            except (httpx.HTTPError, ValueError):
                # One bad scrip / transient error shouldn't kill the batch.
                continue
    return out


def download_pdf(url: str, client: httpx.Client | None = None) -> bytes:
    """Download a single PDF and return its bytes.

    Recent filings sit under AttachLive; older ones move to AttachHis. We try
    the given URL first and, on a 404, retry the alternate folder. Raises on a
    genuine failure.
    """
    owns = client is None
    if client is None:
        client = httpx.Client(headers=HEADERS, timeout=60.0)

    # Build the list of URLs to try: the requested one, then its alternate.
    candidates = [url]
    if "AttachLive" in url:
        candidates.append(url.replace("AttachLive", "AttachHis"))
    elif "AttachHis" in url:
        candidates.append(url.replace("AttachHis", "AttachLive"))

    try:
        last_exc: Exception | None = None
        for candidate in candidates:
            try:
                resp = client.get(candidate)
                resp.raise_for_status()
                return resp.content
            except httpx.HTTPStatusError as e:
                last_exc = e
                if e.response.status_code != 404:
                    raise
        raise last_exc  # type: ignore[misc]
    finally:
        if owns:
            client.close()


def _alternates(url: str) -> list[str]:
    """The URL plus its Live/His counterpart."""
    if not url:
        return []
    out = [url]
    if "AttachLive" in url:
        out.append(url.replace("AttachLive", "AttachHis"))
    elif "AttachHis" in url:
        out.append(url.replace("AttachHis", "AttachLive"))
    return out


def resolve_pdf_url(url: str, client: httpx.Client | None = None) -> str:
    """Return a PDF URL that actually returns 200, trying Live then His.

    BSE's HEAD is unreliable (Live returns 404 on HEAD but 200 on GET), so we
    use a streamed GET and read only the status line — no body download.
    Falls back to the original URL if nothing resolves.
    """
    if not url:
        return ""
    owns = client is None
    if client is None:
        client = httpx.Client(headers=HEADERS, timeout=30.0)
    try:
        for candidate in _alternates(url):
            try:
                with client.stream("GET", candidate) as r:
                    if r.status_code == 200:
                        return candidate
            except httpx.HTTPError:
                continue
        return url
    finally:
        if owns:
            client.close()


def resolve_many(urls: Iterable[str], progress=None) -> dict[str, str]:
    """Resolve a batch of PDF URLs, reusing one connection. Returns {url: working_url}."""
    unique = [u for u in dict.fromkeys(urls) if u]
    out: dict[str, str] = {}
    with httpx.Client(headers=HEADERS, timeout=30.0) as client:
        total = len(unique)
        for i, u in enumerate(unique, start=1):
            if progress:
                progress(i, total)
            out[u] = resolve_pdf_url(u, client=client)
    return out
