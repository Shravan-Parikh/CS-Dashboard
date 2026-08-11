'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileSpreadsheet,
  FileDown,
  Zap,
  ScrollText,
} from 'lucide-react';
import clsx from 'clsx';
import Topbar from '@/components/Topbar';
import * as api from '@/lib/api';
import { exportComplianceCsv, exportComplianceXlsx } from '@/lib/export';
import type { ComplianceResponse, ComplianceOccurrence } from '@/lib/types';

const KIND_STYLES: Record<string, string> = {
  Filing: 'bg-brand-50 text-brand-700',
  Certificate: 'bg-violet-50 text-violet-700',
  Meeting: 'bg-emerald-50 text-emerald-700',
  Payment: 'bg-amber-50 text-amber-700',
  Disclosure: 'bg-sky-50 text-sky-700',
};

/** Whole days between two YYYY-MM-DD dates, calendar-based (no TZ drift). */
function daysBetween(fromIso: string, toIso: string) {
  const a = new Date(fromIso + 'T00:00:00');
  const b = new Date(toIso + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function fmtDue(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Urgency drives colour — an overdue Reg. 31 filing should not look calm. */
function urgency(due: string, today: string) {
  const n = daysBetween(today, due);
  if (n < 0) return { key: 'overdue', n, label: `${Math.abs(n)}d overdue` };
  if (n === 0) return { key: 'today', n, label: 'Due today' };
  if (n <= 7) return { key: 'week', n, label: `in ${n}d` };
  if (n <= 30) return { key: 'month', n, label: `in ${n}d` };
  return { key: 'later', n, label: `in ${n}d` };
}

const URGENCY_BADGE: Record<string, string> = {
  overdue: 'bg-red-50 text-red-700 ring-red-200',
  today: 'bg-orange-50 text-orange-700 ring-orange-200',
  week: 'bg-amber-50 text-amber-700 ring-amber-200',
  month: 'bg-slate-100 text-slate-600 ring-slate-200',
  later: 'bg-slate-50 text-slate-400 ring-slate-200',
};

const URGENCY_BAR: Record<string, string> = {
  overdue: 'bg-red-400',
  today: 'bg-orange-400',
  week: 'bg-amber-400',
  month: 'bg-slate-300',
  later: 'bg-slate-200',
};

export default function CompliancePage() {
  const now = new Date();
  const currentFy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const [fy, setFy] = useState(currentFy);
  const [agmDate, setAgmDate] = useState('');
  const [authority, setAuthority] = useState('All');
  const [hidePast, setHidePast] = useState(true);

  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    api
      .getCompliance({ fy, agmDate: agmDate || undefined })
      .then((r) => live && setData(r))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [fy, agmDate]);

  const today = data?.meta.today || '';

  const visible = useMemo(() => {
    if (!data) return [];
    return data.occurrences.filter((o) => {
      if (authority !== 'All' && o.authority !== authority) return false;
      if (hidePast && o.due < today) return false;
      return true;
    });
  }, [data, authority, hidePast, today]);

  // Group by month for a scannable calendar.
  const months = useMemo(() => {
    const out: { key: string; label: string; rows: ComplianceOccurrence[] }[] = [];
    for (const o of visible) {
      const key = o.due.slice(0, 7);
      const label = new Date(o.due + 'T00:00:00').toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
      });
      const last = out[out.length - 1];
      if (last && last.key === key) last.rows.push(o);
      else out.push({ key, label, rows: [o] });
    }
    return out;
  }, [visible]);

  const nextUp = useMemo(
    () => (data ? data.occurrences.filter((o) => o.due >= today).slice(0, 5) : []),
    [data, today],
  );

  const fyLabel = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  const fyChoices = [currentFy - 1, currentFy, currentFy + 1];

  return (
    <>
      <Topbar
        title="Compliance Calendar"
        subtitle="Statutory due dates for a listed company, computed from the rules"
      />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="space-y-5">
          {/* -------------------- Controls -------------------- */}
          <div className="card p-4">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <div>
                <label className="label">Financial year</label>
                <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
                  {fyChoices.map((y) => (
                    <button
                      key={y}
                      onClick={() => setFy(y)}
                      className={
                        'rounded-md px-3 py-1.5 text-sm font-medium transition ' +
                        (fy === y
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-slate-600 hover:bg-white')
                      }
                    >
                      FY {fyLabel(y)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-44">
                <label className="label">AGM date</label>
                <input
                  type="date"
                  className="input"
                  value={agmDate}
                  onChange={(e) => setAgmDate(e.target.value)}
                />
              </div>

              <div className="w-48">
                <label className="label">Authority</label>
                <select
                  className="input"
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                >
                  <option value="All">All authorities</option>
                  {(data?.meta.authorities || []).map((a) => (
                    <option key={a} value={a}>
                      {a}
                      {data?.meta.byAuthority[a] ? ` (${data.meta.byAuthority[a]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={hidePast}
                  onChange={(e) => setHidePast(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                />
                Hide past due dates
              </label>

              <div className="ml-auto flex gap-2">
                <button
                  onClick={() =>
                    exportComplianceXlsx(visible, `compliance_fy${fyLabel(fy)}.xlsx`)
                  }
                  className="btn-secondary"
                  disabled={visible.length === 0}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </button>
                <button
                  onClick={() => exportComplianceCsv(visible, `compliance_fy${fyLabel(fy)}.csv`)}
                  className="btn-secondary"
                  disabled={visible.length === 0}
                >
                  <FileDown className="h-4 w-4" /> CSV
                </button>
              </div>
            </div>

            {data?.meta.agmAssumed && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <Info className="h-3.5 w-3.5 shrink-0" />
                AOC-4, MGT-7 and Reg. 34(1) are computed from an assumed AGM on 30 September
                (the s.96 outer limit). Set the actual AGM date to correct them.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {loading && (
            <div className="card flex flex-col items-center gap-3 py-24 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <p className="text-sm">Computing due dates…</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* -------------------- Summary tiles -------------------- */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tile
                  icon={CalendarClock}
                  tone="brand"
                  value={data.meta.total}
                  label={`obligations in FY ${data.meta.scope.label}`}
                />
                <Tile
                  icon={Zap}
                  tone="amber"
                  value={
                    data.occurrences.filter((o) => {
                      const n = daysBetween(today, o.due);
                      return n >= 0 && n <= 30;
                    }).length
                  }
                  label="due in the next 30 days"
                />
                <Tile
                  icon={AlertTriangle}
                  tone="red"
                  value={data.meta.overdue}
                  label="already past due"
                />
                <Tile
                  icon={CheckCircle2}
                  tone="slate"
                  value={data.meta.ruleCount + data.meta.eventRuleCount}
                  label="rules tracked"
                />
              </div>

              {/* -------------------- Next up -------------------- */}
              {nextUp.length > 0 && (
                <div className="card p-4">
                  <p className="label">Next up</p>
                  <div className="space-y-2">
                    {nextUp.map((o) => {
                      const u = urgency(o.due, today);
                      return (
                        <div key={o.id} className="flex items-center gap-3">
                          <span
                            className={clsx(
                              'w-24 shrink-0 rounded-md px-2 py-1 text-center text-xs font-semibold ring-1',
                              URGENCY_BADGE[u.key],
                            )}
                          >
                            {u.label}
                          </span>
                          <span className="w-24 shrink-0 text-xs tabular-nums text-slate-400">
                            {fmtDue(o.due)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                            {o.title}
                          </span>
                          <span className="shrink-0 text-xs text-slate-400">{o.reference}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* -------------------- Calendar by month -------------------- */}
              {visible.length === 0 ? (
                <div className="card py-20 text-center text-sm text-slate-400">
                  Nothing matches these filters.
                </div>
              ) : (
                <div className="space-y-4">
                  {months.map((m) => (
                    <div key={m.key} className="card overflow-hidden">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                        <h3 className="text-sm font-semibold text-slate-700">{m.label}</h3>
                        <span className="text-xs text-slate-400">
                          {m.rows.length} obligation{m.rows.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <ul className="divide-y divide-slate-100">
                        {m.rows.map((o) => {
                          const u = urgency(o.due, today);
                          return (
                            <li key={o.id} className="flex gap-0 hover:bg-slate-50/60">
                              <div
                                className={clsx('w-1 shrink-0', URGENCY_BAR[u.key])}
                                aria-hidden
                              />
                              <div className="flex flex-1 flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                                <div className="w-24 shrink-0">
                                  <div className="text-sm font-semibold tabular-nums text-slate-800">
                                    {fmtDue(o.due).slice(0, 6)}
                                  </div>
                                  <div
                                    className={clsx(
                                      'mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1',
                                      URGENCY_BADGE[u.key],
                                    )}
                                  >
                                    {u.label}
                                  </div>
                                </div>

                                <div className="min-w-[16rem] flex-1">
                                  <p className="text-sm font-medium text-slate-800">{o.title}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={clsx(
                                        'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                                        KIND_STYLES[o.kind] || 'bg-slate-100 text-slate-600',
                                      )}
                                    >
                                      {o.kind}
                                    </span>
                                    <span className="text-[11px] font-medium text-slate-500">
                                      {o.authority}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {o.reference}
                                    </span>
                                    <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500">
                                      {o.period}
                                    </span>
                                  </div>
                                  {o.note && (
                                    <p className="mt-1.5 text-xs leading-snug text-slate-400">
                                      {o.note}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* -------------------- Event-driven obligations -------------------- */}
              <div className="card overflow-hidden">
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                  <ScrollText className="h-4 w-4 text-slate-400" />
                  <h3 className="text-sm font-semibold text-slate-700">
                    Event-driven obligations
                  </h3>
                  <span className="text-xs text-slate-400">
                    no fixed date — triggered by something happening
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {data.events.map((e) => (
                    <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-3">
                      <div className="min-w-[14rem] flex-1">
                        <p className="text-sm font-medium text-slate-800">{e.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-slate-500">
                            {e.authority}
                          </span>
                          <span className="text-[11px] text-slate-400">{e.reference}</span>
                        </div>
                      </div>
                      <div className="min-w-[12rem] flex-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-400">Trigger: </span>
                        {e.trigger}
                      </div>
                      <div className="min-w-[16rem] flex-[1.5] text-xs text-slate-600">
                        {e.deadline}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* -------------------- Disclaimer -------------------- */}
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{data.meta.disclaimer}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const TILE_TONES: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  slate: 'bg-slate-100 text-slate-500',
};

function Tile({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div
        className={clsx(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          TILE_TONES[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight text-slate-900">{value}</div>
        <div className="text-xs leading-tight text-slate-400">{label}</div>
      </div>
    </div>
  );
}
