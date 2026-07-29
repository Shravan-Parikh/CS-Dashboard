"""
BSE Corporate Announcements — Streamlit MVP
===========================================

Pick an index (or upload your own list), a category / keyword, and a date
range → pull matching corporate announcements straight from BSE and export
them to Excel / CSV / a ZIP of the PDFs.

Run:
    streamlit run app.py
"""

from __future__ import annotations

import datetime as dt
import io
import re
import zipfile
from pathlib import Path

import httpx
import pandas as pd
import streamlit as st

import bse_client as bse

DATA_DIR = Path(__file__).parent / "data"
COMPANIES_CSV = DATA_DIR / "companies.csv"

# A few handy keyword presets. "" = no keyword filter.
KEYWORD_PRESETS = {
    "Trading Window Closure": "trading window",
    "Board Meeting": "board meeting",
    "Financial Results": "result",
    "Dividend": "dividend",
    "Investor Presentation": "investor presentation",
    "Analyst / Investor Meet": "analyst",
    "Annual Report": "annual report",
    "Shareholding Pattern": "shareholding",
    "Acquisition": "acquisition",
    "(No keyword — use category only)": "",
}

st.set_page_config(page_title="BSE Announcements", page_icon="📄", layout="wide")


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


@st.cache_data
def load_companies() -> pd.DataFrame:
    df = pd.read_csv(COMPANIES_CSV, dtype={"scrip_code": str})
    df["scrip_code"] = df["scrip_code"].str.strip()
    return df


def indices_in(df: pd.DataFrame) -> list[str]:
    vals: set[str] = set()
    for cell in df["indices"].dropna():
        for tag in str(cell).split(";"):
            tag = tag.strip()
            if tag:
                vals.add(tag)
    return sorted(vals)


def filter_by_index(df: pd.DataFrame, index_name: str) -> pd.DataFrame:
    if index_name == "All (full list)":
        return df
    mask = df["indices"].fillna("").str.contains(rf"(?:^|;)\s*{re.escape(index_name)}\s*(?:;|$)")
    return df[mask]


# ---------------------------------------------------------------------------
# Fetch + filter
# ---------------------------------------------------------------------------


@st.cache_data(show_spinner=False, ttl=1800)
def fetch(scrips: tuple[str, ...], from_date: dt.date, to_date: dt.date, category: str) -> pd.DataFrame:
    """Cached fetch. Cache key = args, so repeat searches are instant for 30 min."""
    progress_bar = st.progress(0.0, text="Contacting BSE…")

    def on_progress(done: int, total: int, label: str):
        progress_bar.progress(done / max(total, 1), text=f"Fetching {label} ({done}/{total})")

    anns = bse.fetch_for_scrips(
        scrips,
        from_date,
        to_date,
        category=category,
        progress=on_progress,
    )
    progress_bar.empty()

    rows = [a.as_row() for a in anns]
    df = pd.DataFrame(rows)
    return df


def apply_keyword(df: pd.DataFrame, keyword: str) -> pd.DataFrame:
    if df.empty or not keyword:
        return df
    kw = keyword.lower()
    hay = (
        df.get("headline", "").fillna("").str.lower()
        + " "
        + df.get("subcategory", "").fillna("").str.lower()
        + " "
        + df.get("category", "").fillna("").str.lower()
    )
    return df[hay.str.contains(re.escape(kw))]


DISPLAY_COLS = ["company", "symbol", "scrip_code", "news_dt", "category", "subcategory", "headline", "pdf_url"]


def latest_per_company(fetched: pd.DataFrame, roster: pd.DataFrame) -> pd.DataFrame:
    """One row per company in `roster`, carrying its most recent matching filing.

    Companies with no match in the fetched set still appear, with blank
    date/headline/pdf — so you can see the full index at a glance and which
    companies haven't filed the announcement you're tracking.
    """
    base = roster[["company", "symbol", "scrip_code"]].drop_duplicates("scrip_code").copy()

    if fetched is None or fetched.empty:
        for c in ["news_dt", "category", "subcategory", "headline", "pdf_url"]:
            base[c] = ""
        base["found"] = ""
        return base[["found"] + DISPLAY_COLS]

    f = fetched.copy()
    f["_dt"] = pd.to_datetime(f["news_dt"], errors="coerce")
    # Latest matching filing per scrip.
    latest = (
        f.sort_values("_dt")
        .groupby("scrip_code", as_index=False)
        .last()[["scrip_code", "news_dt", "category", "subcategory", "headline", "pdf_url"]]
    )

    merged = base.merge(latest, on="scrip_code", how="left").fillna("")
    merged["found"] = merged["news_dt"].apply(lambda v: "✓" if v else "")
    # Matched companies first (newest at top), then the blanks.
    merged["_dt"] = pd.to_datetime(merged["news_dt"], errors="coerce")
    merged = merged.sort_values("_dt", ascending=False, na_position="last").drop(columns="_dt")
    return merged[["found"] + DISPLAY_COLS]


def resolve_pdf_links(show: pd.DataFrame) -> pd.DataFrame:
    """Rewrite each pdf_url to a folder (AttachLive/AttachHis) that returns 200."""
    if "pdf_url" not in show.columns:
        return show
    urls = [u for u in show["pdf_url"].tolist() if u]
    if not urls:
        return show
    if len(urls) > 150:
        st.caption(f"Skipped link verification ({len(urls)} PDFs — too many); links use the default path.")
        return show
    bar = st.progress(0.0, text=f"Verifying {len(urls)} PDF links…")
    mapping = bse.resolve_many(urls, progress=lambda i, t: bar.progress(i / max(t, 1)))
    bar.empty()
    out = show.copy()
    out["pdf_url"] = out["pdf_url"].map(lambda u: mapping.get(u, u))
    return out


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------


def to_excel_bytes(df: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Announcements")
    return buf.getvalue()


def build_pdf_zip(df: pd.DataFrame) -> tuple[bytes, int, int]:
    """Download every PDF and bundle into a ZIP. Returns (bytes, ok, failed)."""
    buf = io.BytesIO()
    ok = failed = 0
    with httpx.Client(headers=bse.HEADERS, timeout=60.0) as client, zipfile.ZipFile(
        buf, "w", zipfile.ZIP_DEFLATED
    ) as zf:
        for _, row in df.iterrows():
            url = row.get("pdf_url") or ""
            if not url:
                continue
            fname = row.get("attachment") or url.rsplit("/", 1)[-1]
            company = re.sub(r"[^A-Za-z0-9]+", "_", str(row.get("company", "")))[:40]
            try:
                content = bse.download_pdf(url, client=client)
                zf.writestr(f"{company}__{fname}", content)
                ok += 1
            except (httpx.HTTPError, ValueError):
                failed += 1
    return buf.getvalue(), ok, failed


# ---------------------------------------------------------------------------
# UI
# ---------------------------------------------------------------------------


st.title("📄 BSE Corporate Announcements")
st.caption(
    "Pull corporate filings straight from BSE India. Data source: BSE's own "
    "public announcement endpoints (no key required)."
)

companies = load_companies()

with st.sidebar:
    st.header("Filters")

    # --- Universe selection -------------------------------------------------
    source = st.radio(
        "Companies from",
        ["Index list", "Upload CSV", "Custom scrip codes"],
        help="Upload CSV needs a `scrip_code` column. Custom = comma-separated BSE codes.",
    )

    selected_df = pd.DataFrame(columns=["company", "symbol", "scrip_code"])

    if source == "Index list":
        idx_options = ["All (full list)"] + indices_in(companies)
        index_name = st.selectbox("Index", idx_options, index=min(1, len(idx_options) - 1))
        universe = filter_by_index(companies, index_name)
        names = st.multiselect(
            "Companies (leave empty = all in index)",
            options=universe["company"].tolist(),
        )
        selected_df = universe if not names else universe[universe["company"].isin(names)]

    elif source == "Upload CSV":
        up = st.file_uploader("CSV with a `scrip_code` column", type=["csv"])
        if up is not None:
            udf = pd.read_csv(up, dtype=str)
            if "scrip_code" not in udf.columns:
                st.error("CSV must contain a `scrip_code` column.")
            else:
                udf["scrip_code"] = udf["scrip_code"].astype(str).str.strip()
                if "company" not in udf.columns:
                    udf["company"] = udf["scrip_code"]
                selected_df = udf
                st.success(f"Loaded {len(udf)} companies.")

    else:  # Custom scrip codes
        raw = st.text_area("BSE scrip codes (comma or newline separated)", "500325, 532540")
        codes = [c.strip() for c in re.split(r"[,\s]+", raw) if c.strip()]
        selected_df = pd.DataFrame({"company": codes, "symbol": codes, "scrip_code": codes})

    st.divider()

    # --- Category / keyword -------------------------------------------------
    category = st.selectbox(
        "BSE category",
        bse.CATEGORIES,
        format_func=lambda c: "All categories" if c == "-1" else c,
    )
    preset = st.selectbox("Keyword preset", list(KEYWORD_PRESETS.keys()))
    keyword = st.text_input(
        "Keyword filter (matches headline/subject)",
        value=KEYWORD_PRESETS[preset],
        help="Case-insensitive substring match. Clear it to disable.",
    )

    st.divider()

    # --- Dates --------------------------------------------------------------
    today = dt.date(2026, 7, 29)  # aligns with app's "today"; edit freely
    # 90-day default so quarterly filings (e.g. Trading Window Closure, usually
    # filed at quarter-end) fall inside the window without extra fiddling.
    default_from = today - dt.timedelta(days=90)
    date_range = st.date_input(
        "Date range",
        value=(default_from, today),
        max_value=today,
    )
    if isinstance(date_range, tuple) and len(date_range) == 2:
        from_date, to_date = date_range
    else:
        from_date = to_date = date_range if isinstance(date_range, dt.date) else default_from

    st.divider()

    # --- Result view --------------------------------------------------------
    view_mode = st.radio(
        "Result view",
        ["Latest per company", "All announcements"],
        help=(
            "Latest per company: one row for every selected company, showing its "
            "most recent matching filing (blank if none in range). "
            "All announcements: every matching filing, one row each."
        ),
    )

    run = st.button("🔎 Fetch announcements", type="primary", use_container_width=True)


# --- Main panel -------------------------------------------------------------

# Normalise the selected roster so every source has company/symbol/scrip_code.
roster = selected_df.copy()
for col in ("company", "symbol", "scrip_code"):
    if col not in roster.columns:
        roster[col] = roster.get("scrip_code", "")
roster["scrip_code"] = roster["scrip_code"].astype(str).str.strip()
roster = roster[roster["scrip_code"] != ""].drop_duplicates("scrip_code")

scrips = tuple(roster["scrip_code"].tolist())

st.write(
    f"**{len(scrips)}** companies selected · "
    f"view **{view_mode}** · "
    f"category **{'All' if category == '-1' else category}** · "
    f"{from_date:%d %b %Y} → {to_date:%d %b %Y}"
)

if run:
    if not scrips:
        st.warning("No companies selected.")
    elif from_date > to_date:
        st.error("Start date is after end date.")
    else:
        try:
            df = fetch(scrips, from_date, to_date, category)
        except httpx.HTTPError as e:
            st.error(f"BSE request failed: {e}")
            df = pd.DataFrame()

        df = apply_keyword(df, keyword)

        # Shape the output per the chosen view, then verify PDF links once.
        if view_mode == "Latest per company":
            show = latest_per_company(df, roster)
        else:
            cols = [c for c in DISPLAY_COLS if c in df.columns]
            show = df[cols].sort_values("news_dt", ascending=False) if not df.empty else df

        show = resolve_pdf_links(show)
        st.session_state["results"] = show
        st.session_state["mode"] = view_mode

# Render whatever is in session (survives download-button reruns).
show = st.session_state.get("results")

if show is not None:
    matched = int((show.get("pdf_url", pd.Series(dtype=str)) != "").sum()) if not show.empty else 0
    is_pivot = st.session_state.get("mode") == "Latest per company"

    if show.empty:
        st.info("No announcements matched. Try widening the date range or clearing the keyword.")
    else:
        if is_pivot:
            st.success(f"{len(show)} companies · {matched} with a matching filing in range.")
        else:
            st.success(f"{len(show)} announcements found.")

        st.dataframe(
            show,
            use_container_width=True,
            hide_index=True,
            column_config={
                "found": st.column_config.TextColumn("✓", width="small", help="Has a matching filing"),
                "pdf_url": st.column_config.LinkColumn("PDF", display_text="Open PDF"),
                "news_dt": st.column_config.TextColumn("Date/Time"),
                "headline": st.column_config.TextColumn("Headline", width="large"),
            },
        )

        c1, c2, c3 = st.columns(3)
        stamp = f"{from_date:%Y%m%d}_{to_date:%Y%m%d}"
        with c1:
            st.download_button(
                "⬇️ Excel",
                data=to_excel_bytes(show),
                file_name=f"bse_announcements_{stamp}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
        with c2:
            st.download_button(
                "⬇️ CSV",
                data=show.to_csv(index=False).encode("utf-8"),
                file_name=f"bse_announcements_{stamp}.csv",
                mime="text/csv",
                use_container_width=True,
            )
        with c3:
            if st.button("📦 Build ZIP of PDFs", use_container_width=True):
                with st.spinner("Downloading PDFs from BSE…"):
                    zbytes, ok, failed = build_pdf_zip(show)
                st.session_state["zip"] = (zbytes, ok, failed, stamp)

        if "zip" in st.session_state:
            zbytes, ok, failed, zstamp = st.session_state["zip"]
            st.download_button(
                f"⬇️ Download PDFs ({ok} ok, {failed} failed)",
                data=zbytes,
                file_name=f"bse_pdfs_{zstamp}.zip",
                mime="application/zip",
            )
else:
    st.info("Set your filters in the sidebar and hit **Fetch announcements**.")
