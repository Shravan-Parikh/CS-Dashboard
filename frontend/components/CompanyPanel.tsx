'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Loader2,
  AlertCircle,
  FileText,
  ExternalLink,
  Building2,
  ShieldCheck,
} from 'lucide-react';
import * as api from '@/lib/api';
import type { CompanyTimelineResponse } from '@/lib/types';

const MONTH_OPTIONS = [3, 6, 12, 24];

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Slide-over showing one company's full filing timeline. Opened from any row in
 * the feed or the company search — the whole point is that a company name is a
 * doorway, not a dead label.
 */
export default function CompanyPanel({
  scrip,
  fallbackName,
  onClose,
}: {
  scrip: string | null;
  fallbackName?: string;
  onClose: () => void;
}) {
  const [months, setMonths] = useState(12);
  const [data, setData] = useState<CompanyTimelineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onlyCs, setOnlyCs] = useState(false);

  // Close on Escape — a slide-over that traps you is worse than no slide-over.
  useEffect(() => {
    if (!scrip) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scrip, onClose]);

  useEffect(() => {
    if (!scrip) {
      setData(null);
      setError(null);
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    setData(null);
    api
      .getCompanyTimeline(scrip, months)
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [scrip, months]);

  if (!scrip) return null;

  const rows = data
    ? onlyCs
      ? data.rows.filter((r) => r.bucket)
      : data.rows
    : [];

  // Group by month so a year of filings reads as a timeline, not a wall.
  const groups: { key: string; label: string; rows: typeof rows }[] = [];
  for (const r of rows) {
    const d = new Date(r.news_dt);
    const key = isNaN(d.getTime())
      ? 'unknown'
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = isNaN(d.getTime())
      ? 'Undated'
      : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else groups.push({ key, label, rows: [r] });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />

      <aside className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-900">
                {data?.company.company || fallbackName || scrip}
              </h2>
              <p className="text-xs text-slate-400">
                {data?.company.symbol ? `${data.company.symbol} · ` : ''}
                BSE {scrip}
                {data && ` · ${data.meta.total} filings in ${data.meta.months} months`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
            {MONTH_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={
                  'rounded-md px-2.5 py-1 text-xs font-medium transition ' +
                  (months === m ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50')
                }
              >
                {m}m
              </button>
            ))}
          </div>

          {data && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={onlyCs}
                onChange={(e) => setOnlyCs(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
              />
              CS-relevant only ({data.meta.csRelevant})
            </label>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-24 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <p className="text-sm">Loading {months} months of filings…</p>
            </div>
          )}

          {error && (
            <div className="m-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {data && !loading && (
            <>
              {/* Bucket mix */}
              {Object.keys(data.meta.byBucket).length > 0 && (
                <div className="border-b border-slate-100 px-5 py-4">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> CS-relevant mix
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(data.meta.byBucket)
                      .sort((a, b) => b[1] - a[1])
                      .map(([id, n]) => {
                        const label =
                          data.rows.find((r) => r.bucket === id)?.bucketLabel || id;
                        return (
                          <span
                            key={id}
                            className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700"
                          >
                            {label} <span className="text-brand-400">{n}</span>
                          </span>
                        );
                      })}
                  </div>
                </div>
              )}

              {rows.length === 0 ? (
                <div className="py-24 text-center text-sm text-slate-400">
                  {onlyCs
                    ? 'No CS-relevant filings in this window.'
                    : 'No filings found in this window.'}
                </div>
              ) : (
                groups.map((g) => (
                  <div key={g.key}>
                    <div className="sticky top-0 z-10 border-y border-slate-100 bg-slate-50/95 px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur">
                      {g.label} · {g.rows.length}
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {g.rows.map((r, i) => (
                        <li
                          key={`${r.news_id}-${i}`}
                          className="flex gap-3 px-5 py-3 hover:bg-slate-50/60"
                        >
                          <div className="w-14 shrink-0 pt-0.5 text-[11px] leading-tight text-slate-400">
                            <div className="font-medium text-slate-600">
                              {fmtDate(r.news_dt).slice(0, 6)}
                            </div>
                            <div>{fmtTime(r.news_dt)}</div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {r.bucketLabel ? (
                                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                                  {r.bucketLabel}
                                </span>
                              ) : null}
                              <span className="text-[11px] text-slate-400">
                                {r.subcategory || r.category}
                              </span>
                            </div>
                            <p className="text-[13px] leading-snug text-slate-700">
                              {r.headline || <span className="text-slate-300">No headline</span>}
                            </p>
                          </div>
                          {r.pdf_url && (
                            <a
                              href={api.pdfProxyUrl(r.pdf_url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1 self-start rounded-md border border-slate-200 px-2 text-[11px] font-medium text-brand-600 hover:bg-brand-50"
                            >
                              <FileText className="h-3 w-3" /> PDF
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
