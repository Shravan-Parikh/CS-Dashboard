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
} from 'lucide-react';
import clsx from 'clsx';
import Topbar from '@/components/Topbar';
import * as api from '@/lib/api';
import type { CaseOrder, CaseStats } from '@/lib/types';

const EXAMPLES = [
  'trading window closure',
  'structured digital database',
  'contra trade',
  'pre-clearance',
  'trading plan',
  'designated person',
];

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
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const [orderTypes, setOrderTypes] = useState<string[]>([]);
  const [authorities, setAuthorities] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<string[]>([]);
  const [bands, setBands] = useState<string[]>([]);
  const [citations, setCitations] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [sort, setSort] = useState<'recent' | 'relevance' | 'penalty' | 'oldest'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<CaseOrder[]>([]);
  const [total, setTotal] = useState(0);
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

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.searchCases({
        q: submitted,
        orderTypes,
        authorities,
        outcomes,
        bands,
        citations,
        years,
        sort,
        limit: 40,
      });
      setResults(r.results);
      setTotal(r.meta.total);
      setElapsed(r.meta.elapsedMs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [submitted, orderTypes, authorities, outcomes, bands, citations, years, sort]);

  useEffect(() => {
    run();
  }, [run]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const activeFilters =
    orderTypes.length + authorities.length + outcomes.length + bands.length +
    citations.length + years.length;

  function clearAll() {
    setOrderTypes([]);
    setAuthorities([]);
    setOutcomes([]);
    setBands([]);
    setCitations([]);
    setYears([]);
  }

  const topCitations = useMemo(() => (stats?.citations || []).slice(0, 14), [stats]);

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

              {stats && (
                <span className="ml-auto text-[11px] text-slate-400">
                  {stats.count} orders · {stats.range?.from}–{stats.range?.to}
                </span>
              )}
            </div>

            {showFilters && stats && (
              <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
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
                        {c.outcome}
                      </span>
                      {c.penaltyDetected && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <IndianRupee className="h-2.5 w-2.5" />
                          {inr(c.penalty).replace('₹', '')}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">{fmtPeriod(c.period)}</span>
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

                    {c.citations.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.citations.slice(0, 7).map((x) => (
                          <span
                            key={x}
                            className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500"
                          >
                            {x}
                          </span>
                        ))}
                        {c.citations.length > 7 && (
                          <span className="text-[10px] text-slate-400">
                            +{c.citations.length - 7}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            <Gavel className="mt-0.5 h-4 w-4 shrink-0" />
            Orders are SEBI&apos;s own published PDFs, with order type, penalty and citations
            extracted from the text by pattern rules — treat penalty figures as{' '}
            <b>detected, not certified</b>, and read the order before relying on it.
            {stats?.cappedWindows ? (
              <> {stats.cappedWindows} search window(s) hit SEBI&apos;s row cap, so a few orders may be missing.</>
            ) : null}
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
  const [full, setFull] = useState<CaseOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setFull(null);
      setShowText(false);
      setCopied(false);
      setAdded(null);
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
      const r = await api.createTask({
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
                {fmtPeriod(c.period)} · {c.pages} pages
              </span>
            </div>
            <h2 className="text-base font-semibold text-slate-900">
              {c.company || c.subject || 'Order'}
            </h2>
            <p className="mt-0.5 text-xs leading-snug text-slate-500">{c.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-4">
            <Fact label="Outcome" value={c.outcome} />
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
                {c.citations.map((x) => (
                  <span key={x} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {x}
                  </span>
                ))}
              </div>
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
