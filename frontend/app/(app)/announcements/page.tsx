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
  Radio,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import ModuleTabs from '@/components/ModuleTabs';
import MultiSelect from '@/components/MultiSelect';
import ResultsTable from '@/components/ResultsTable';
import CompanyPanel from '@/components/CompanyPanel';
import SavedViews from '@/components/SavedViews';
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

const TABS = [
  { label: 'Latest feed', href: '/announcements/latest', icon: Radio },
  { label: 'Company search', href: '/announcements', icon: Search },
];

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
  const [panelScrip, setPanelScrip] = useState<string | null>(null);
  const [panelName, setPanelName] = useState<string | undefined>();

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

  const segmented = (active: boolean) =>
    'rounded-md px-3 py-1.5 text-sm font-medium transition ' +
    (active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white');

  return (
    <>
      <Topbar
        title="BSE Corporate Announcements"
        subtitle="Live corporate filings from BSE India"
      />
      <ModuleTabs tabs={TABS} />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="space-y-6">
          {/* ---------------- Filters (top bar) ---------------- */}
          <div className="card p-4">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              {/* Source */}
              <div>
                <label className="label">Companies from</label>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {(['index', 'custom'] as Source[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSource(s)}
                      className={segmented(source === s)}
                    >
                      {s === 'index' ? 'Index list' : 'Custom codes'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Companies selection */}
              {source === 'index' ? (
                <>
                  <div className="w-40">
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
                  <div className="min-w-[220px] flex-1">
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
                <div className="min-w-[240px] flex-1">
                  <label className="label">BSE scrip codes</label>
                  <input
                    className="input font-mono text-xs"
                    value={customCodes}
                    onChange={(e) => setCustomCodes(e.target.value)}
                    placeholder="500325, 532540"
                  />
                </div>
              )}

              {/* Category */}
              <div className="w-44">
                <label className="label">Category</label>
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

              {/* Keyword preset */}
              <div className="w-48">
                <label className="label">Keyword preset</label>
                <select className="input" value={preset} onChange={(e) => onPreset(e.target.value)}>
                  {Object.keys(KEYWORD_PRESETS).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Keyword filter */}
              <div className="w-44">
                <label className="label">Keyword</label>
                <input
                  className="input"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. trading window"
                />
              </div>

              {/* From */}
              <div className="w-36">
                <label className="label">From</label>
                <input
                  type="date"
                  className="input"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>

              {/* To */}
              <div className="w-36">
                <label className="label">To</label>
                <input
                  type="date"
                  className="input"
                  value={to}
                  max={TODAY}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>

              {/* View mode */}
              <div>
                <label className="label">Result view</label>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {[
                    { v: 'latest', t: 'Latest / company' },
                    { v: 'all', t: 'All filings' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setMode(o.v as 'latest' | 'all')}
                      className={segmented(mode === o.v)}
                    >
                      {o.t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fetch */}
              <div className="ml-auto">
                <label className="label select-none opacity-0">Go</label>
                <button onClick={runFetch} className="btn-primary" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Fetch announcements
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {roster.length} companies · {from} → {to}
            </p>

            <div className="mt-3">
              <SavedViews
                current={{
                  source,
                  index,
                  selectedScrips,
                  customCodes,
                  category,
                  preset,
                  keyword,
                  from,
                  to,
                  mode,
                }}
                onApply={(f) => {
                  if (f.source === 'index' || f.source === 'custom') setSource(f.source);
                  if (typeof f.index === 'string') setIndex(f.index);
                  if (Array.isArray(f.selectedScrips)) setSelectedScrips(f.selectedScrips);
                  if (typeof f.customCodes === 'string') setCustomCodes(f.customCodes);
                  if (typeof f.category === 'string') setCategory(f.category);
                  if (typeof f.preset === 'string') setPreset(f.preset);
                  if (typeof f.keyword === 'string') setKeyword(f.keyword);
                  if (typeof f.from === 'string') setFrom(f.from);
                  if (typeof f.to === 'string') setTo(f.to);
                  if (f.mode === 'latest' || f.mode === 'all') setMode(f.mode);
                }}
              />
            </div>
          </div>

          {/* ---------------- Results (full width) ---------------- */}
          <div className="space-y-4">
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
                          <b>{rows.length}</b> announcements · {meta.totalFetched} scanned
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
                    <ResultsTable
                      rows={rows}
                      onCompanyClick={(scrip, name) => {
                        setPanelScrip(scrip);
                        setPanelName(name);
                      }}
                    />
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

      <CompanyPanel
        scrip={panelScrip}
        fallbackName={panelName}
        onClose={() => setPanelScrip(null)}
      />
    </>
  );
}
