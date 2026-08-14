'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Radio,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileText,
  ExternalLink,
  Info,
  FileSpreadsheet,
  FileDown,
  Zap,
  Star,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import ModuleTabs from '@/components/ModuleTabs';
import CompanyPanel from '@/components/CompanyPanel';
import WatchlistStar from '@/components/WatchlistStar';
import AiSummaryModal, { type SummaryTarget } from '@/components/AiSummaryModal';
import * as api from '@/lib/api';
import { useWatchlist } from '@/lib/watchlist';
import { exportLatestCsv, exportLatestXlsx } from '@/lib/export';
import type { CsBucket, LatestMeta, LatestRow } from '@/lib/types';

const TABS = [
  { label: 'Latest feed', href: '/announcements/latest', icon: Radio },
  { label: 'Company search', href: '/announcements', icon: Search },
];

const DAY_OPTIONS = [
  { v: 1, t: 'Today' },
  { v: 2, t: '2 days' },
  { v: 7, t: '7 days' },
  { v: 30, t: '30 days' },
];

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Undated';
  const today = new Date();
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (same(d, today)) return 'Today';
  if (same(d, yest)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function LatestAnnouncementsPage() {
  const { companies: watched } = useWatchlist();

  const [buckets, setBuckets] = useState<CsBucket[]>([]);
  const [selected, setSelected] = useState<string[]>([]); // empty = all
  const [indices, setIndices] = useState<string[]>(['All']);
  // 'All' | 'watchlist' | an index name
  const [index, setIndex] = useState('All');
  const [days, setDays] = useState(2);
  const [keyword, setKeyword] = useState('');

  const [rows, setRows] = useState<LatestRow[] | null>(null);
  const [meta, setMeta] = useState<LatestMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelScrip, setPanelScrip] = useState<string | null>(null);
  const [panelName, setPanelName] = useState<string | undefined>();
  const [summaryTarget, setSummaryTarget] = useState<SummaryTarget | null>(null);

  useEffect(() => {
    api.getCsBuckets().then((r) => setBuckets(r.buckets)).catch(() => {});
    api.getIndices().then((r) => setIndices(r.indices)).catch(() => {});
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLatest({
        days,
        buckets: selected,
        // 'watchlist' narrows the same market-wide sweep to followed companies.
        ...(index === 'watchlist'
          ? { scrips: watched.map((c) => c.scrip_code) }
          : { index }),
        keyword: keyword.trim(),
        limit: 500,
      });
      setRows(res.rows);
      setMeta(res.meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the feed');
    } finally {
      setLoading(false);
    }
  }, [days, selected, index, keyword, watched]);

  // Load on mount and whenever the shape of the query changes. Keyword is
  // applied client-side below as well, so it doesn't need to trigger a refetch.
  const watchKey = index === 'watchlist' ? watched.map((c) => c.scrip_code).join(',') : '';
  useEffect(() => {
    if (index === 'watchlist' && watched.length === 0) {
      setRows([]);
      setMeta(null);
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, selected, index, watchKey]);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const kw = keyword.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      `${r.headline} ${r.company} ${r.subcategory}`.toLowerCase().includes(kw),
    );
  }, [rows, keyword]);

  // Group by calendar day for a feed that reads chronologically.
  const groups = useMemo(() => {
    if (!filtered) return [];
    const out: { key: string; label: string; rows: LatestRow[] }[] = [];
    for (const r of filtered) {
      const key = (r.news_dt || '').slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(r);
      else out.push({ key, label: dayLabel(r.news_dt), rows: [r] });
    }
    return out;
  }, [filtered]);

  function toggleBucket(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  const activeCount = selected.length === 0 ? buckets.length : selected.length;
  const stamp = `${meta?.from || ''}_${meta?.to || ''}`.replace(/-/g, '');

  return (
    <>
      <Topbar
        title="Latest Announcements"
        subtitle="Market-wide BSE filings, filtered to what a Company Secretary needs"
      />
      <ModuleTabs tabs={TABS} />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="space-y-5">
          {/* -------------------- Controls -------------------- */}
          <div className="card p-4">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <div>
                <label className="label">Window</label>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {DAY_OPTIONS.map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setDays(o.v)}
                      className={
                        'rounded-md px-3 py-1.5 text-sm font-medium transition ' +
                        (days === o.v
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white')
                      }
                    >
                      {o.t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-44">
                <label className="label">Universe</label>
                <select className="input" value={index} onChange={(e) => setIndex(e.target.value)}>
                  <option value="All">Whole market</option>
                  <option value="watchlist">
                    My companies ({watched.length})
                  </option>
                  {indices
                    .filter((i) => i !== 'All')
                    .map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                </select>
              </div>

              <div className="min-w-[200px] flex-1">
                <label className="label">Filter these results</label>
                <input
                  className="input"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Type to narrow by headline or company…"
                />
              </div>

              <button onClick={run} className="btn-secondary" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Refresh
              </button>
            </div>

            {/* Bucket chips */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <label className="label mb-0">
                  Relevance filters · {activeCount} of {buckets.length} active
                </label>
                {selected.length > 0 && (
                  <button
                    onClick={() => setSelected([])}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    Show all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {buckets.map((b) => {
                  const on = selected.length === 0 || selected.includes(b.id);
                  const n = meta?.perBucket?.[b.id];
                  return (
                    <button
                      key={b.id}
                      onClick={() => toggleBucket(b.id)}
                      title={`${b.why}${b.reference ? `\n\n${b.reference}` : ''}`}
                      className={
                        'rounded-full border px-3 py-1.5 text-xs font-medium transition ' +
                        (on
                          ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                          : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600')
                      }
                    >
                      {b.label}
                      {n !== undefined && on && (
                        <span className="ml-1.5 text-brand-400">{n}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* -------------------- Results -------------------- */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {loading && !rows && (
            <div className="card flex flex-col items-center gap-3 py-24 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <p className="text-sm">Sweeping the market for CS-relevant filings…</p>
            </div>
          )}

          {/* Watchlist scope with nothing followed yet — explain, don't show zero. */}
          {index === 'watchlist' && watched.length === 0 && !loading && (
            <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Star className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">
                You&apos;re not following any companies yet
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                Star a company on any row to follow it, or pick several at once from My
                Companies. Then this view shows only their filings.
              </p>
              <Link
                href="/companies"
                className="mt-1 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              >
                Pick my companies <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          {filtered && meta && !(index === 'watchlist' && watched.length === 0) && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 shrink-0 text-brand-500" />
                    <span>
                      <b>{filtered.length}</b>
                      {filtered.length !== meta.total && ` of ${meta.total}`} filings ·{' '}
                      {meta.from} → {meta.to}
                      {index === 'watchlist'
                        ? ' · my companies only'
                        : index !== 'All' && ` · ${index} only`}
                    </span>
                    {meta.fetchedAt && (
                      <span className="text-xs text-slate-400">
                        updated{' '}
                        {new Date(meta.fetchedAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      <Zap className="h-3 w-3" />
                      {(meta.elapsedMs / 1000).toFixed(1)}s · {meta.slices} slices
                    </span>
                  </div>
                  {meta.truncated && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Some categories had more filings than one sweep returns — narrow the
                      window or pick fewer relevance filters to see everything.
                    </div>
                  )}
                  {meta.failedSlices > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {meta.failedSlices} of {meta.slices} slices failed at BSE — refresh to
                      retry.
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => exportLatestXlsx(filtered, `bse_cs_feed_${stamp}.xlsx`)}
                    className="btn-secondary"
                    disabled={filtered.length === 0}
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Excel
                  </button>
                  <button
                    onClick={() => exportLatestCsv(filtered, `bse_cs_feed_${stamp}.csv`)}
                    className="btn-secondary"
                    disabled={filtered.length === 0}
                  >
                    <FileDown className="h-4 w-4" /> CSV
                  </button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="card py-20 text-center text-sm text-slate-400">
                  Nothing matched. Widen the window, clear the text filter, or switch the
                  universe back to the whole market.
                </div>
              ) : (
                <div className="card overflow-hidden">
                  {groups.map((g) => (
                    <div key={g.key}>
                      <div className="sticky top-0 z-10 flex items-center justify-between border-y border-slate-100 bg-slate-50/95 px-4 py-2 backdrop-blur first:border-t-0">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {g.label}
                        </span>
                        <span className="text-xs text-slate-400">{g.rows.length}</span>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {g.rows.map((r, i) => (
                          <li
                            key={`${r.news_id}-${i}`}
                            className="flex gap-3 px-4 py-3 hover:bg-slate-50/60"
                          >
                            <div className="w-11 shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-400">
                              {fmtTime(r.news_dt)}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                                <WatchlistStar
                                  company={{
                                    scrip_code: r.scrip_code,
                                    company: r.company,
                                    symbol: r.symbol,
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    setPanelScrip(r.scrip_code);
                                    setPanelName(r.company);
                                  }}
                                  className="max-w-[16rem] truncate text-sm font-medium text-slate-800 hover:text-brand-600 hover:underline sm:max-w-[22rem]"
                                  title="View this company's full filing timeline"
                                >
                                  {r.company}
                                </button>
                                {r.symbol && (
                                  <span className="text-[11px] text-slate-400">{r.symbol}</span>
                                )}
                                {r.inUniverse && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                    tracked
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] leading-snug text-slate-600">
                                {r.headline}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                                  {r.bucketLabel}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {r.subcategory}
                                </span>
                                {r.reference && (
                                  <span className="text-[11px] text-slate-300">
                                    {r.reference}
                                  </span>
                                )}
                              </div>
                            </div>

                            {r.pdf_url && (
                              <div className="mt-0.5 flex shrink-0 items-center gap-1 self-start">
                                <button
                                  onClick={() => setSummaryTarget(r)}
                                  title="Get a ready-made prompt to summarise this with Claude or ChatGPT"
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-medium text-violet-600 hover:bg-violet-50"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  <span className="hidden sm:inline">Summarise</span>
                                </button>
                                <a
                                  href={api.pdfProxyUrl(r.pdf_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-medium text-brand-600 hover:bg-brand-50"
                                >
                                  <FileText className="h-3 w-3" /> PDF
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CompanyPanel
        scrip={panelScrip}
        fallbackName={panelName}
        onClose={() => setPanelScrip(null)}
      />
      <AiSummaryModal target={summaryTarget} onClose={() => setSummaryTarget(null)} />
    </>
  );
}
