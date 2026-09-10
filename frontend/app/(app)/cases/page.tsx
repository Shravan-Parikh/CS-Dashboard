'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Gavel,
  Search,
  Loader2,
  AlertCircle,
  ExternalLink,
  FileText,
  X,
  Zap,
  Sparkles,
  Copy,
  Check,
  IndianRupee,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  Star,
  FileSpreadsheet,
  FileDown,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';
import Topbar from '@/components/Topbar';
import * as api from '@/lib/api';
import { useWatchlist } from '@/lib/watchlist';
import { useTasks } from '@/lib/tasks';
import { exportCasesCsv, exportCasesXlsx } from '@/lib/export';
import type { CaseOrder, CaseStats } from '@/lib/types';

const EXAMPLES = [
  'trading window closure',
  'structured digital database',
  'contra trade',
  'pre-clearance',
  'trading plan',
  'designated person',
];

const OUTCOME_LABEL: Record<string, string> = {
  penalty: 'Penalty imposed',
  settled: 'Settled',
  warning: 'Warning / caution',
  disposed: 'Disposed / dismissed',
  exonerated: 'Exonerated',
  unclear: 'Not determined',
};

const OUTCOME_STYLE: Record<string, string> = {
  penalty: 'bg-red-50 text-red-700',
  settled: 'bg-amber-50 text-amber-700',
  warning: 'bg-amber-50 text-amber-700',
  disposed: 'bg-slate-100 text-slate-600',
  exonerated: 'bg-emerald-50 text-emerald-700',
  unclear: 'bg-slate-100 text-slate-500',
};

/** ₹ in the units an Indian CS reads: lakh and crore. */
function inr(n: number) {
  if (!n) return '—';
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} lakh`;
  return `₹${n.toLocaleString('en-IN')}`;
}

const fmtExact = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const PIT_DOC = 'sebi-pit-regulations-2015';

/**
 * Where a citation chip should link, or null if we don't hold that instrument.
 *
 * A numbered PIT provision becomes an exact `ref` lookup scoped to the PIT
 * document — a fuzzy search for "regulation 9" finds nothing (the tokenizer
 * drops both words), and an unscoped lookup would surface SAST's Regulation 9
 * instead. SEBI Act sections are deliberately not linked: the Act isn't in the
 * corpus, so any link would land somewhere misleading.
 */
function lawLinkFor(citation: string): string | null {
  const reg = /^PIT (Reg\.|Schedule)\s*(\S+)$/.exec(citation);
  if (reg) {
    const ref = reg[1] === 'Schedule' ? `Schedule ${reg[2]}` : `Regulation ${reg[2]}`;
    return `/law?ref=${encodeURIComponent(ref)}&docs=${PIT_DOC}`;
  }
  if (/^SEBI Act s\./.test(citation)) return null;
  const phrase =
    citation.startsWith('SDD') ? 'structured digital database' : citation;
  return `/law?q=${encodeURIComponent(phrase)}`;
}

const upsiLabel = (stats: CaseStats | null, id: string) =>
  stats?.upsi?.find((u) => u.id === id)?.label || id;

const fmtPeriod = (p: string) => {
  if (!p) return '';
  const [y, m] = p.split('-');
  if (!m) return y;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
};

export default function CaseLawPage() {
  const { companies: watched } = useWatchlist();
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [authorities, setAuthorities] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [bands, setBands] = useState<string[]>([]);
  const [citations, setCitations] = useState<string[]>([]);
  const [upsi, setUpsi] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [sort, setSort] = useState<'recent' | 'relevance' | 'penalty' | 'oldest'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<CaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openCase, setOpenCase] = useState<CaseOrder | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getCaseFacets()
      .then((r) => setStats(r.stats))
      .catch(() => setError('Could not load the case corpus'));
  }, []);

  const PAGE = 25;

  const buildQuery = useCallback(
    (offset: number): api.CaseQuery => ({
      q: submitted,
      orderTypes,
      authorities,
      outcomes,
      bands,
      citations,
      upsi,
      years,
      // Cross-reference against the companies this CS actually acts for.
      companies: mineOnly ? watched.map((c) => c.company).filter(Boolean) : [],
      sort,
      limit: PAGE,
      offset,
    }),
    [submitted, orderTypes, authorities, outcomes, bands, citations, upsi, years, mineOnly, watched, sort],
  );

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.searchCases(buildQuery(0));
      setResults(r.results);
      setTotal(r.meta.total);
      setElapsed(r.meta.elapsedMs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    run();
  }, [run]);

  /** Append the next page — without this, anything past the first page is unreachable. */
  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await api.searchCases(buildQuery(results.length));
      setResults((cur) => [...cur, ...r.results]);
      setTotal(r.meta.total);
    } catch {
      setError('Could not load more orders');
    } finally {
      setLoadingMore(false);
    }
  }

  /** Export needs the whole filtered set, not just what's on screen. */
  async function exportAll(kind: 'csv' | 'xlsx') {
    try {
      const r = await api.searchCases({ ...buildQuery(0), limit: 100 });
      const stamp = new Date().toISOString().slice(0, 10);
      const name = `pit_case_law_${stamp}`;
      if (kind === 'csv') exportCasesCsv(r.results, `${name}.csv`);
      else exportCasesXlsx(r.results, `${name}.xlsx`);
    } catch {
      setError('Export failed');
    }
  }

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const activeFilters =
    orderTypes.length + authorities.length + outcomes.length + bands.length +
    citations.length + years.length + upsi.length + (mineOnly ? 1 : 0);

  function clearAll() {
    setOrderTypes([]);
    setAuthorities([]);
    setOutcomes([]);
    setBands([]);
    setCitations([]);
    setUpsi([]);
    setYears([]);
    setMineOnly(false);
  }

  /**
   * Boilerplate citations make useless filters: PIT Reg. 2 is *definitions* and
   * appears in nearly every order, so it partitions nothing. The behavioural
   * ones — trading window, SDD, contra trade, pre-clearance — are what a CS
   * actually filters on, so those come first.
   */
  const topCitations = useMemo(() => {
    const all = stats?.citations || [];
    const BOILERPLATE = ['PIT Reg. 2', 'PIT Reg. 1'];
    const behavioural = ['Trading window', 'SDD (Reg. 3(5))', 'Contra trade', 'Pre-clearance'];
    const rank = (id: string) =>
      behavioural.includes(id) ? 0 : BOILERPLATE.includes(id) ? 2 : 1;
    return [...all].sort((a, b) => rank(a.id) - rank(b.id) || b.count - a.count).slice(0, 14);
  }, [stats]);

  return (
    <>
      <Topbar
        title="PIT Case Law"
        subtitle="Every SEBI and SAT insider-trading order, searchable by facts and regulation"
      />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          {/* Search */}
          <div className="card p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(query.trim());
                setSort(query.trim() ? 'relevance' : 'recent');
              }}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <input
                  ref={inputRef}
                  className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-24 text-sm text-slate-800 placeholder-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search the orders — e.g. “traded during trading window closure”"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-2 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Search
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setQuery(ex);
                    setSubmitted(ex);
                    setSort('relevance');
                  }}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200"
                >
                  {ex}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Filter className="h-3.5 w-3.5" /> Filters
                {activeFilters > 0 && (
                  <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                    {activeFilters}
                  </span>
                )}
                {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600"
              >
                <option value="recent">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="penalty">Highest penalty</option>
                {submitted && <option value="relevance">Most relevant</option>}
              </select>

              {activeFilters > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Clear filters
                </button>
              )}

              {watched.length > 0 && (
                <button
                  onClick={() => setMineOnly((v) => !v)}
                  title="Only orders naming a company you follow"
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                    mineOnly
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <Star className="h-3.5 w-3.5" fill={mineOnly ? 'currentColor' : 'none'} />
                  My companies
                </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => exportAll('xlsx')}
                  disabled={total === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </button>
                <button
                  onClick={() => exportAll('csv')}
                  disabled={total === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                >
                  <FileDown className="h-3.5 w-3.5" /> CSV
                </button>
              </div>
            </div>

            {showFilters && stats && (
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                <FilterRow label="UPSI was">
                  {(stats.upsi || []).map((u) => (
                    <Chip key={u.id} on={upsi.includes(u.id)} onClick={() => toggle(upsi, setUpsi, u.id)}>
                      {u.label} <span className="opacity-50">{u.count}</span>
                    </Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Order type">
                  {stats.orderTypes.map((t) => (
                    <Chip
                      key={t.id}
                      on={orderTypes.includes(t.id)}
                      onClick={() => toggle(orderTypes, setOrderTypes, t.id)}
                    >
                      {t.label}
                    </Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Forum">
                  {stats.authorities.map((a) => (
                    <Chip
                      key={a}
                      on={authorities.includes(a)}
                      onClick={() => toggle(authorities, setAuthorities, a)}
                    >
                      {a}
                    </Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Outcome">
                  {stats.outcomes.map((o) => (
                    <Chip
                      key={o.id}
                      on={outcomes.includes(o.id)}
                      onClick={() => toggle(outcomes, setOutcomes, o.id)}
                    >
                      {o.label}
                    </Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Penalty">
                  {stats.penaltyBands.map((b) => (
                    <Chip key={b.id} on={bands.includes(b.id)} onClick={() => toggle(bands, setBands, b.id)}>
                      {b.label}
                    </Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Cites">
                  {topCitations.map((c) => (
                    <Chip
                      key={c.id}
                      on={citations.includes(c.id)}
                      onClick={() => toggle(citations, setCitations, c.id)}
                    >
                      {c.id} <span className="opacity-50">{c.count}</span>
                    </Chip>
                  ))}
                </FilterRow>
                <FilterRow label="Year">
                  {stats.years.map((y) => (
                    <Chip
                      key={y}
                      on={years.includes(String(y))}
                      onClick={() => toggle(years, setYears, String(y))}
                    >
                      {y}
                    </Chip>
                  ))}
                </FilterRow>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-slate-600">
            {loading ? (
              <span className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </span>
            ) : (
              <>
                <b>{total}</b> order{total === 1 ? '' : 's'}
                {submitted && ` matching “${submitted}”`}
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <Zap className="h-3 w-3" /> {elapsed}ms
                </span>
                {total > results.length && (
                  <span className="text-xs text-slate-400">showing {results.length}</span>
                )}
              </>
            )}
          </div>

          {!loading && results.length === 0 ? (
            <div className="card py-16 text-center text-sm text-slate-400">
              Nothing matched. Try fewer words, or clear the filters.
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((c) => (
                <li key={c.id} className="card overflow-hidden">
                  <button
                    onClick={() => setOpenCase(c)}
                    className="w-full p-4 text-left transition hover:bg-slate-50/60"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {c.authority}
                      </span>
                      <span className="rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        {c.orderTypeLabel}
                      </span>
                      <span
                        className={clsx(
                          'rounded px-2 py-0.5 text-[10px] font-semibold',
                          OUTCOME_STYLE[c.outcome],
                        )}
                      >
                        {OUTCOME_LABEL[c.outcome] || c.outcome}
                      </span>
                      {c.penaltyDetected && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <IndianRupee className="h-2.5 w-2.5" />
                          {inr(c.penalty).replace('₹', '')}
                        </span>
                      )}
                      <span className="text-[11px] font-medium text-slate-500">
                        {c.orderDate ? fmtExact(c.orderDate) : fmtPeriod(c.period)}
                      </span>
                      {c.orderNo && (
                        <span className="font-mono text-[10px] text-slate-400">{c.orderNo}</span>
                      )}
                      <span className="text-[11px] text-slate-300">{c.pages}p</span>
                    </div>

                    {(c.company || c.subject) && (
                      <p className="text-sm font-semibold text-slate-900">
                        {c.company || c.subject}
                      </p>
                    )}
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{c.title}</p>

                    {c.snippet && (
                      <p
                        className="mt-2 border-l-2 border-slate-200 pl-3 text-[13px] leading-relaxed text-slate-600 [&_mark]:rounded [&_mark]:bg-amber-100 [&_mark]:px-0.5 [&_mark]:text-slate-900"
                        dangerouslySetInnerHTML={{ __html: c.snippet }}
                      />
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {(c.upsi || []).map((u) => (
                        <span
                          key={u}
                          className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
                        >
                          {upsiLabel(stats, u)}
                        </span>
                      ))}
                      {c.citations.slice(0, 6).map((x) => (
                        <span
                          key={x}
                          className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500"
                        >
                          {x}
                        </span>
                      ))}
                      {c.citations.length > 6 && (
                        <span className="text-[10px] text-slate-400">
                          +{c.citations.length - 6}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {results.length < total && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-secondary w-full"
            >
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              Load {Math.min(25, total - results.length)} more · {results.length} of {total}
            </button>
          )}

          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            <Gavel className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>{stats?.count ?? 0} orders found</b> ({stats?.range?.from}–{stats?.range?.to}) —{' '}
              <b>not an exhaustive set</b>. They are discovered from SEBI&apos;s own order
              titles, so a PIT case titled only “Adjudication Order in respect of …” will
              not appear. Order type, penalty, UPSI and citations are extracted from the
              text by pattern rules: treat the penalty as <b>detected, not certified</b>,
              and read the order before relying on it.
              {stats?.cappedWindows ? (
                <> {stats.cappedWindows} search window(s) hit SEBI&apos;s row cap.</>
              ) : null}
            </span>
          </p>
        </div>
      </div>

      <CaseDrawer id={openCase?.id || null} preview={openCase} onClose={() => setOpenCase(null)} />
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition',
        on
          ? 'border-brand-200 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
      )}
    >
      {children}
    </button>
  );
}

/** Prompt tuned to what §3.1 of the spec asks an AI to produce for a case. */
function casePrompt(c: CaseOrder) {
  return `You are assisting a Company Secretary in India. I am attaching a SEBI/SAT order on insider trading.

Order
- Title: ${c.title}
- Forum: ${c.authority} · ${c.orderTypeLabel}
- Date: ${c.period}
${c.company ? `- Company / scrip: ${c.company}\n` : ''}${c.penaltyDetected ? `- Penalty (detected from the text): ₹${c.penalty.toLocaleString('en-IN')}\n` : ''}- Provisions cited: ${c.citations.join(', ') || 'see document'}

Please give me, in this order:

1. Summary — 3 to 5 bullets. What happened, who, and what was decided.
2. Key holdings / ratio decidendi — the reasoning that decides the case, quoted where it matters.
3. What the compliance failure actually was — the specific control that was missing or ignored (SDD, trading window, pre-clearance, contra-trade, disclosure timing).
4. Lessons for a Compliance Officer — concrete changes to the code of conduct, the SDD, or the pre-clearance process that would have prevented this.
5. Penalty and reasoning — the amount and the mitigating or aggravating factors the adjudicating officer weighed under s.15J.

Rules: quote the order for anything material. If something is not stated, say "not stated in the order" rather than inferring. Do not summarise the standard SEBI preamble.`;
}

function CaseDrawer({
  id,
  preview,
  onClose,
}: {
  id: string | null;
  preview: CaseOrder | null;
  onClose: () => void;
}) {
  const { create: createTask } = useTasks();
  const [full, setFull] = useState<CaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [citeCopied, setCiteCopied] = useState(false);

  useEffect(() => {
    if (!id) {
      setFull(null);
      setShowText(false);
      setCopied(false);
      setAdded(null);
      setCiteCopied(false);
      return;
    }
    let live = true;
    setLoading(true);
    api
      .getCase(id)
      .then((r) => live && setFull(r.case))
      .catch(() => {})
      .finally(() => live && setLoading(false));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [id, onClose]);

  const c = full || preview;
  if (!id || !c) return null;

  /** A citation in the form a CS would paste into a note or a board paper. */
  async function copyCitation() {
    const c2 = c!;
    const parts = [
      c2.company || c2.subject || '',
      c2.orderNo ? `(${c2.orderNo})` : '',
      c2.authority,
      c2.orderTypeLabel,
      c2.orderDate ? `dated ${fmtExact(c2.orderDate)}` : fmtPeriod(c2.period),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(`${parts.join(', ')}. ${c2.pdfUrl}`);
      setCiteCopied(true);
      setTimeout(() => setCiteCopied(false), 2000);
    } catch {
      setCiteCopied(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(casePrompt(c!));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function addTask() {
    try {
      const r = await createTask({
        title: `Review order: ${(c!.company || c!.subject || c!.title).slice(0, 120)}`,
        priority: 'normal',
        source: `case:${c!.id}`,
        sourceLabel: `${c!.authority} ${c!.orderTypeLabel}`,
      });
      setAdded(r.duplicate ? 'Already on your task list' : 'Added to your tasks');
    } catch {
      setAdded('Could not add to tasks');
    }
    setTimeout(() => setAdded(null), 2500);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden />

      <aside className="relative flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                {c.authority}
              </span>
              <span className="rounded bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                {c.orderTypeLabel}
              </span>
              <span className="text-[11px] text-slate-400">
                {c.orderDate ? fmtExact(c.orderDate) : fmtPeriod(c.period)} · {c.pages} pages
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              {c.company || c.subject || 'Order'}
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">{c.title}</p>
            {c.orderNo && (
              <p className="mt-1 font-mono text-[11px] text-slate-400">{c.orderNo}</p>
            )}
            <button
              onClick={copyCitation}
              title="Copy a citation you can paste into a board note"
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700"
            >
              {citeCopied ? <><Check className="h-3 w-3" /> Citation copied</> : <><Copy className="h-3 w-3" /> Copy citation</>}
            </button>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-4">
            <Fact label="Outcome" value={OUTCOME_LABEL[c.outcome] || c.outcome} />
            <Fact
              label="Penalty"
              value={c.penaltyDetected ? inr(c.penalty) : 'Not detected'}
              muted={!c.penaltyDetected}
            />
            <Fact label="Forum" value={c.authority} />
            <Fact label="Year" value={String(c.year || '—')} />
          </div>

          {c.citations.length > 0 && (
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Provisions cited
              </p>
              <div className="flex flex-wrap gap-1.5">
                {c.citations.map((x) => {
                  const href = lawLinkFor(x);
                  return href ? (
                    <Link
                      key={x}
                      href={href}
                      title={`Read ${x} in Know the Law`}
                      className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      <Scale className="h-3 w-3 opacity-50" />
                      {x}
                    </Link>
                  ) : (
                    <span
                      key={x}
                      title="The SEBI Act isn't in the document library yet"
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500"
                    >
                      {x}
                    </span>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Click a PIT provision to read its text in Know the Law.
              </p>
            </div>
          )}

          {/* Self-serve summary — no inference cost, prompt tuned for case law. */}
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                <Sparkles className="h-3.5 w-3.5" /> Summarise with Claude or ChatGPT
              </p>
              <button
                onClick={copyPrompt}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
                  copied ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-600 text-white hover:bg-brand-700',
                )}
              >
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy prompt</>}
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Copy the prompt, open the order PDF, and paste both into Claude or ChatGPT. It
              asks for the summary, key holdings, the control that failed, lessons for a
              compliance officer, and the s.15J reasoning behind the penalty.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
            <a href={c.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              <FileText className="h-4 w-4" /> Order PDF
            </a>
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              SEBI page <ExternalLink className="h-3 w-3" />
            </a>
            <button onClick={addTask} className="btn-secondary">
              <Plus className="h-4 w-4" /> Add to tasks
            </button>
            {added && <span className="self-center text-xs text-emerald-700">{added}</span>}
          </div>

          <div className="px-5 py-4">
            <button
              onClick={() => setShowText((v) => !v)}
              className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              {showText ? <>Hide order text <ChevronUp className="h-3 w-3" /></> : <>Read the order text <ChevronDown className="h-3 w-3" /></>}
            </button>
            {loading && !full && (
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the order…
              </p>
            )}
            {showText && full?.text && (
              <pre className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-sans text-[12.5px] leading-relaxed text-slate-700">
                {full.text}
              </pre>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Fact({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={clsx('mt-0.5 text-sm font-semibold capitalize', muted ? 'text-slate-400' : 'text-slate-800')}>
        {value}
      </p>
    </div>
  );
}
