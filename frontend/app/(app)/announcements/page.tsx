'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Loader2,
  FileSpreadsheet,
  FileDown,
  Package,
  Info,
  AlertCircle,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import MultiSelect from '@/components/MultiSelect';
import ResultsTable from '@/components/ResultsTable';
import * as api from '@/lib/api';
import { exportCsv, exportXlsx } from '@/lib/export';
import type { AnnouncementMeta, AnnouncementRow, Company } from '@/lib/types';

const KEYWORD_PRESETS: Record<string, string> = {
  'Trading Window Closure': 'trading window',
  'Board Meeting': 'board meeting',
  'Financial Results': 'result',
  Dividend: 'dividend',
  'Investor Presentation': 'investor presentation',
  'Analyst / Investor Meet': 'analyst',
  'Annual Report': 'annual report',
  'Shareholding Pattern': 'shareholding',
  Acquisition: 'acquisition',
  '(No keyword — category only)': '',
};

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
const TODAY = new Date().toISOString().slice(0, 10);

type Source = 'index' | 'custom';

export default function AnnouncementsPage() {
  // reference data
  const [indices, setIndices] = useState<string[]>(['All']);
  const [categories, setCategories] = useState<string[]>(['-1']);
  const [companies, setCompanies] = useState<Company[]>([]);

  // filter state
  const [source, setSource] = useState<Source>('index');
  const [index, setIndex] = useState('Nifty50');
  const [selectedScrips, setSelectedScrips] = useState<string[]>([]);
  const [customCodes, setCustomCodes] = useState('500325, 532540');
  const [category, setCategory] = useState('-1');
  const [preset, setPreset] = useState('Trading Window Closure');
  const [keyword, setKeyword] = useState(KEYWORD_PRESETS['Trading Window Closure']);
  const [from, setFrom] = useState(isoDaysAgo(90));
  const [to, setTo] = useState(TODAY);
  const [mode, setMode] = useState<'latest' | 'all'>('latest');

  // results
  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [rows, setRows] = useState<AnnouncementRow[] | null>(null);
  const [meta, setMeta] = useState<AnnouncementMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  // load indices + categories once
  useEffect(() => {
    api.getIndices().then((r) => setIndices(r.indices)).catch(() => {});
    api.getCategories().then((r) => setCategories(r.categories)).catch(() => {});
  }, []);

  // load companies whenever the index changes
  useEffect(() => {
    if (source !== 'index') return;
    api
      .getCompanies(index)
      .then((r) => setCompanies(r.companies))
      .catch(() => setCompanies([]));
    setSelectedScrips([]);
  }, [index, source]);

  const companyOptions = useMemo(
    () =>
      companies.map((c) => ({
        value: c.scrip_code,
        label: c.company,
        sub: c.symbol,
      })),
    [companies],
  );

  // The roster we send to the backend.
  const roster = useMemo(() => {
    if (source === 'custom') {
      const codes = customCodes
        .split(/[\s,]+/)
        .map((c) => c.trim())
        .filter(Boolean);
      return codes.map((code) => ({ scrip_code: code, company: code, symbol: '' }));
    }
    const chosen =
      selectedScrips.length > 0
        ? companies.filter((c) => selectedScrips.includes(c.scrip_code))
        : companies;
    return chosen.map((c) => ({
      scrip_code: c.scrip_code,
      company: c.company,
      symbol: c.symbol,
    }));
  }, [source, customCodes, selectedScrips, companies]);

  function onPreset(p: string) {
    setPreset(p);
    setKeyword(KEYWORD_PRESETS[p] ?? '');
  }

  async function runFetch() {
    setError(null);
    if (roster.length === 0) {
      setError('Select at least one company.');
      return;
    }
    setLoading(true);
    setRows(null);
    setMeta(null);
    try {
      const res = await api.fetchAnnouncements({
        companies: roster,
        from,
        to,
        category,
        keyword,
        mode,
      });
      setRows(res.rows);
      setMeta(res.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }

  const stamp = `${from.replace(/-/g, '')}_${to.replace(/-/g, '')}`;
  const pdfItems = (rows || [])
    .filter((r) => r.pdf_url)
    .map((r) => ({
      url: r.pdf_url,
      name: `${r.company.replace(/[^A-Za-z0-9]+/g, '_')}_${r.scrip_code}`,
    }));

  async function onZip() {
    if (pdfItems.length === 0) return;
    setZipLoading(true);
    try {
      const blob = await api.downloadZip(pdfItems, `bse_pdfs_${stamp}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bse_pdfs_${stamp}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('ZIP export failed.');
    } finally {
      setZipLoading(false);
    }
  }

  return (
    <>
      <Topbar
        title="BSE Corporate Announcements"
        subtitle="Live corporate filings from BSE India"
      />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
          {/* ---------------- Filters ---------------- */}
          <div className="card h-fit p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Filters</h2>

            {/* Source */}
            <div className="mb-4">
              <label className="label">Companies from</label>
              <div className="grid grid-cols-2 gap-2">
                {(['index', 'custom'] as Source[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSource(s)}
                    className={
                      'rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ' +
                      (source === s
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50')
                    }
                  >
                    {s === 'index' ? 'Index list' : 'Custom codes'}
                  </button>
                ))}
              </div>
            </div>

            {source === 'index' ? (
              <>
                <div className="mb-4">
                  <label className="label">Index</label>
                  <select
                    className="input"
                    value={index}
                    onChange={(e) => setIndex(e.target.value)}
                  >
                    {indices.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="label">Companies</label>
                  <MultiSelect
                    options={companyOptions}
                    selected={selectedScrips}
                    onChange={setSelectedScrips}
                    emptyLabel={`All ${companies.length} in index`}
                  />
                </div>
              </>
            ) : (
              <div className="mb-4">
                <label className="label">BSE scrip codes</label>
                <textarea
                  className="input min-h-[80px] font-mono text-xs"
                  value={customCodes}
                  onChange={(e) => setCustomCodes(e.target.value)}
                  placeholder="500325, 532540"
                />
                <p className="mt-1 text-xs text-slate-400">Comma or space separated.</p>
              </div>
            )}

            <div className="my-4 border-t border-slate-100" />

            {/* Category */}
            <div className="mb-4">
              <label className="label">BSE category</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === '-1' ? 'All categories' : c}
                  </option>
                ))}
              </select>
            </div>

            {/* Keyword */}
            <div className="mb-4">
              <label className="label">Keyword preset</label>
              <select className="input" value={preset} onChange={(e) => onPreset(e.target.value)}>
                {Object.keys(KEYWORD_PRESETS).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="label">Keyword filter</label>
              <input
                className="input"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. trading window"
              />
            </div>

            <div className="my-4 border-t border-slate-100" />

            {/* Dates */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label className="label">From</label>
                <input
                  type="date"
                  className="input"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div>
                <label className="label">To</label>
                <input
                  type="date"
                  className="input"
                  value={to}
                  max={TODAY}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            {/* View mode */}
            <div className="mb-5">
              <label className="label">Result view</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { v: 'latest', t: 'Latest per company', d: 'One row per company' },
                  { v: 'all', t: 'All announcements', d: 'Every matching filing' },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setMode(o.v as 'latest' | 'all')}
                    className={
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ' +
                      (mode === o.v
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-slate-200 hover:bg-slate-50')
                    }
                  >
                    <span
                      className={mode === o.v ? 'font-medium text-brand-700' : 'text-slate-700'}
                    >
                      {o.t}
                    </span>
                    <span className="text-xs text-slate-400">{o.d}</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={runFetch} className="btn-primary w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Fetch announcements
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">
              {roster.length} companies · {from} → {to}
            </p>
          </div>

          {/* ---------------- Results ---------------- */}
          <div className="min-w-0 space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}

            {loading && (
              <div className="card flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
                <p className="text-sm">
                  Fetching from BSE — {roster.length} companies. This can take up to a
                  minute for a full index.
                </p>
              </div>
            )}

            {!loading && rows && meta && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1 text-sm text-slate-600">
                   <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-brand-500" />
                    {meta.mode === 'latest' ? (
                      <span>
                        <b>{rows.length}</b> companies ·{' '}
                        <b>{meta.withMatch}</b> with a matching filing in range
                      </span>
                    ) : (
                      <span>
                        <b>{rows.length}</b> announcements ·{' '}
                        {meta.totalFetched} scanned
                      </span>
                    )}
                   </div>
                   {!!meta.failed && meta.failed > 0 && (
                     <div className="flex items-center gap-1.5 text-xs text-amber-600">
                       <AlertCircle className="h-3.5 w-3.5" />
                       {meta.failed} compan{meta.failed === 1 ? 'y' : 'ies'} couldn&apos;t be
                       fetched (BSE throttling) — re-run to retry.
                     </div>
                   )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportXlsx(rows, `bse_announcements_${stamp}.xlsx`)}
                      className="btn-secondary"
                      disabled={rows.length === 0}
                    >
                      <FileSpreadsheet className="h-4 w-4" /> Excel
                    </button>
                    <button
                      onClick={() => exportCsv(rows, `bse_announcements_${stamp}.csv`)}
                      className="btn-secondary"
                      disabled={rows.length === 0}
                    >
                      <FileDown className="h-4 w-4" /> CSV
                    </button>
                    <button
                      onClick={onZip}
                      className="btn-secondary"
                      disabled={pdfItems.length === 0 || zipLoading}
                    >
                      {zipLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Package className="h-4 w-4" />
                      )}
                      ZIP ({pdfItems.length})
                    </button>
                  </div>
                </div>

                <div className="card overflow-hidden">
                  {rows.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-400">
                      No announcements matched. Try widening the date range or clearing
                      the keyword.
                    </div>
                  ) : (
                    <ResultsTable rows={rows} />
                  )}
                </div>
              </>
            )}

            {!loading && !rows && !error && (
              <div className="card flex flex-col items-center justify-center gap-2 py-20 text-center text-slate-400">
                <Search className="h-8 w-8 text-slate-300" />
                <p className="text-sm">
                  Set your filters and hit <b>Fetch announcements</b>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
