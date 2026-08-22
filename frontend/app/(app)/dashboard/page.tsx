'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  AlertTriangle,
  Radio,
  Star,
  Loader2,
  ArrowRight,
  FileText,
  ExternalLink,
  Search,
  Building2,
  RefreshCw,
  Clock,
  CheckSquare,
  Landmark,
  Plus,
  ListChecks,
} from 'lucide-react';
import clsx from 'clsx';
import Topbar from '@/components/Topbar';
import CompanyPanel from '@/components/CompanyPanel';
import WatchlistStar from '@/components/WatchlistStar';
import * as api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useWatchlist } from '@/lib/watchlist';
import type { BoardMeeting, ComplianceOccurrence, LatestRow, Task } from '@/lib/types';

/** Whole days between two YYYY-MM-DD dates — calendar-based, no TZ drift. */
function daysUntil(todayIso: string, dueIso: string) {
  const a = new Date(todayIso + 'T00:00:00');
  const b = new Date(dueIso + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function fmtDue(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const URGENCY: Record<string, string> = {
  overdue: 'bg-red-50 text-red-700 ring-red-200',
  today: 'bg-orange-50 text-orange-700 ring-orange-200',
  week: 'bg-amber-50 text-amber-700 ring-amber-200',
  month: 'bg-slate-100 text-slate-600 ring-slate-200',
};

function urgencyOf(n: number) {
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 7) return 'week';
  return 'month';
}

function urgencyLabel(n: number) {
  if (n < 0) return `${Math.abs(n)}d late`;
  if (n === 0) return 'Today';
  return `in ${n}d`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { companies: watched, loading: wlLoading } = useWatchlist();

  const [occurrences, setOccurrences] = useState<ComplianceOccurrence[] | null>(null);
  const [today, setToday] = useState('');
  const [compLoading, setCompLoading] = useState(true);

  const [feed, setFeed] = useState<LatestRow[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<BoardMeeting[]>([]);
  const [addedTask, setAddedTask] = useState<string | null>(null);

  const [panelScrip, setPanelScrip] = useState<string | null>(null);
  const [panelName, setPanelName] = useState<string | undefined>();
  const [reloadKey, setReloadKey] = useState(0);

  // Tasks and meetings — the "what do I have to do" half of the dashboard.
  useEffect(() => {
    let live = true;
    api.getTasks().then((r) => live && setTasks(r.tasks)).catch(() => {});
    api.getMeetings().then((r) => live && setMeetings(r.meetings)).catch(() => {});
    return () => {
      live = false;
    };
  }, [reloadKey]);

  // Compliance deadlines
  useEffect(() => {
    let live = true;
    setCompLoading(true);
    api
      .getCompliance({})
      .then((r) => {
        if (!live) return;
        setOccurrences(r.occurrences);
        setToday(r.meta.today);
      })
      .catch(() => live && setOccurrences([]))
      .finally(() => live && setCompLoading(false));
    return () => {
      live = false;
    };
  }, []);

  // Filings on followed companies. One market-wide sweep narrowed server-side to
  // the watchlist, rather than a BSE call per company.
  useEffect(() => {
    if (wlLoading) return;
    if (watched.length === 0) {
      setFeed([]);
      setFetchedAt(null);
      return;
    }
    let live = true;
    setFeedLoading(true);
    api
      .getLatest({
        days: 7,
        scrips: watched.map((c) => c.scrip_code),
        limit: 40,
      })
      .then((r) => {
        if (!live) return;
        setFeed(r.rows);
        setFetchedAt(r.meta.fetchedAt || null);
      })
      .catch(() => live && setFeed([]))
      .finally(() => live && setFeedLoading(false));
    return () => {
      live = false;
    };
  }, [watched, wlLoading, reloadKey]);

  const { next7, next30, overdue, upcoming } = useMemo(() => {
    if (!occurrences || !today) {
      return { next7: 0, next30: 0, overdue: 0, upcoming: [] as ComplianceOccurrence[] };
    }
    const withDays = occurrences.map((o) => ({ o, n: daysUntil(today, o.due) }));
    return {
      next7: withDays.filter((x) => x.n >= 0 && x.n <= 7).length,
      next30: withDays.filter((x) => x.n >= 0 && x.n <= 30).length,
      overdue: withDays.filter((x) => x.n < 0).length,
      upcoming: withDays
        .filter((x) => x.n >= 0 && x.n <= 30)
        .slice(0, 6)
        .map((x) => x.o),
    };
  }, [occurrences, today]);

  const openTasks = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const taskDue = useMemo(() => {
    const rank = (t: Task) => (t.due ? daysUntil(today || t.due, t.due) : 99999);
    return [...openTasks]
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 6);
  }, [openTasks, today]);
  const overdueTasks = useMemo(
    () => (today ? openTasks.filter((t) => t.due && daysUntil(today, t.due) < 0).length : 0),
    [openTasks, today],
  );
  const nextMeetings = useMemo(
    () =>
      [...meetings]
        .filter((m) => today && m.date >= today && m.status !== 'cancelled')
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4),
    [meetings, today],
  );

  /** Pull a statutory deadline onto the task list, citation attached. */
  async function deadlineToTask(o: ComplianceOccurrence) {
    try {
      const r = await api.createTask({
        title: o.title,
        due: o.due,
        priority: 'normal',
        source: `compliance:${o.ruleId}@${o.due}`,
        sourceLabel: o.reference,
      });
      setTasks(r.tasks);
      setAddedTask(r.duplicate ? `Already on your list: ${o.title}` : `Added: ${o.title}`);
      setTimeout(() => setAddedTask(null), 2500);
    } catch {
      setAddedTask('Could not add that to your tasks');
      setTimeout(() => setAddedTask(null), 2500);
    }
  }

  const firstName = (user?.name || '').split(' ')[0] || 'there';

  return (
    <>
      <Topbar title="Dashboard" subtitle="Your compliance and filings at a glance" />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Good day, {firstName}
            </h2>
            <p className="text-sm text-slate-500">
              {compLoading
                ? 'Loading your compliance position…'
                : overdue > 0
                  ? `${overdue} obligation${overdue === 1 ? '' : 's'} past due and ${next7} due this week.`
                  : next7 > 0
                    ? `${next7} obligation${next7 === 1 ? '' : 's'} due in the next 7 days.`
                    : 'Nothing due in the next 7 days.'}
            </p>
          </div>

          {addedTask && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
              <CheckSquare className="h-4 w-4 shrink-0" /> {addedTask}
            </div>
          )}

          {/* ---------------- Tiles ---------------- */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile
              icon={CalendarClock}
              tone="amber"
              value={compLoading ? null : next7}
              label="due in 7 days"
              href="/compliance"
            />
            <Tile
              icon={Clock}
              tone="brand"
              value={compLoading ? null : next30}
              label="due in 30 days"
              href="/compliance"
            />
            <Tile
              icon={AlertTriangle}
              tone="red"
              value={compLoading ? null : overdue}
              label="past due"
              href="/compliance"
            />
            <Tile
              icon={CheckSquare}
              tone={overdueTasks > 0 ? 'red' : 'emerald'}
              value={openTasks.length}
              label={overdueTasks > 0 ? `open tasks · ${overdueTasks} late` : 'open tasks'}
              href="/tasks"
            />
            <Tile
              icon={Star}
              tone="slate"
              value={wlLoading ? null : watched.length}
              label="companies followed"
              href="/companies"
            />
          </div>

          {/* ---------------- Quick actions ---------------- */}
          <div className="flex flex-wrap gap-2">
            <QuickAction href="/tasks" icon={CheckSquare} label="My tasks" />
            <QuickAction href="/meetings" icon={Landmark} label="Plan a meeting" />
            <QuickAction href="/announcements/latest" icon={Radio} label="Latest filings" />
            <QuickAction href="/compliance" icon={CalendarClock} label="Compliance calendar" />
            <QuickAction href="/announcements" icon={Search} label="Search a company" />
            <QuickAction href="/companies" icon={Building2} label="Manage my companies" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* ---------------- Upcoming deadlines ---------------- */}
            <section className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarClock className="h-4 w-4 text-slate-400" />
                  Upcoming deadlines
                </h3>
                <Link
                  href="/compliance"
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Full calendar <ArrowRight className="h-3 w-3" />
                </Link>
              </header>

              {compLoading ? (
                <Skeleton lines={5} />
              ) : upcoming.length === 0 ? (
                <Empty
                  icon={CalendarClock}
                  title="Nothing due in the next 30 days"
                  body="Statutory dates are computed from the rules — open the calendar to see the whole financial year."
                  action={{ href: '/compliance', label: 'Open calendar' }}
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcoming.map((o) => {
                    const n = daysUntil(today, o.due);
                    const key = urgencyOf(n);
                    return (
                      <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-slate-700">
                          {fmtDue(o.due)}
                        </span>
                        <span
                          className={clsx(
                            'w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ring-1',
                            URGENCY[key],
                          )}
                        >
                          {urgencyLabel(n)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">
                            {o.title}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {o.authority} · {o.reference}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* ---------------- Filings on followed companies ---------------- */}
            <section className="card overflow-hidden">
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Star className="h-4 w-4 text-slate-400" />
                  On your companies
                  <span className="font-normal text-slate-400">last 7 days</span>
                </h3>
                <div className="flex items-center gap-2">
                  {fetchedAt && (
                    <span className="hidden text-[11px] text-slate-400 sm:inline">
                      updated {fmtWhen(fetchedAt)}
                    </span>
                  )}
                  <button
                    onClick={() => setReloadKey((k) => k + 1)}
                    disabled={feedLoading || watched.length === 0}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
                    title="Refresh"
                  >
                    <RefreshCw className={clsx('h-3.5 w-3.5', feedLoading && 'animate-spin')} />
                  </button>
                </div>
              </header>

              {wlLoading || feedLoading ? (
                <Skeleton lines={5} />
              ) : watched.length === 0 ? (
                <Empty
                  icon={Star}
                  title="You're not following any companies yet"
                  body="Follow the companies you act for and their filings will land here — no searching required. Star a company anywhere you see one."
                  action={{ href: '/companies', label: 'Pick my companies' }}
                />
              ) : feed && feed.length === 0 ? (
                <Empty
                  icon={Radio}
                  title="No CS-relevant filings this week"
                  body={`Nothing filed by your ${watched.length} compan${watched.length === 1 ? 'y' : 'ies'} in the last 7 days. The market-wide feed shows everything.`}
                  action={{ href: '/announcements/latest', label: 'Open latest filings' }}
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(feed || []).slice(0, 8).map((r, i) => (
                    <li key={`${r.news_id}-${i}`} className="flex gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setPanelScrip(r.scrip_code);
                              setPanelName(r.company);
                            }}
                            className="truncate text-sm font-medium text-slate-800 hover:text-brand-600 hover:underline"
                          >
                            {r.company}
                          </button>
                          <span className="shrink-0 text-[11px] text-slate-400">
                            {fmtWhen(r.news_dt)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-slate-600">
                          {r.headline}
                        </p>
                        <span className="mt-1 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                          {r.bucketLabel}
                        </span>
                      </div>
                      {r.pdf_url && (
                        <a
                          href={api.pdfProxyUrl(r.pdf_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex h-7 shrink-0 items-center gap-1 self-start rounded-md border border-slate-200 px-2 text-[11px] font-medium text-brand-600 hover:bg-brand-50"
                        >
                          <FileText className="h-3 w-3" />
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ---------------- Tasks + meetings ---------------- */}
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ListChecks className="h-4 w-4 text-slate-400" />
                  My tasks
                  {openTasks.length > 0 && (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {openTasks.length}
                    </span>
                  )}
                </h3>
                <Link
                  href="/tasks"
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Open list <ArrowRight className="h-3 w-3" />
                </Link>
              </header>

              {taskDue.length === 0 ? (
                <Empty
                  icon={CheckSquare}
                  title="Nothing on your list"
                  body="Add a task, or send a statutory deadline or a meeting obligation here with the + button — each arrives with its citation."
                  action={{ href: '/tasks', label: 'Add a task' }}
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {taskDue.map((t) => {
                    const n = t.due && today ? daysUntil(today, t.due) : null;
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span
                          className={clsx(
                            'w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ring-1',
                            n === null
                              ? 'bg-slate-50 text-slate-400 ring-slate-200'
                              : URGENCY[urgencyOf(n)],
                          )}
                        >
                          {n === null ? 'no date' : urgencyLabel(n)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">
                            {t.title}
                          </span>
                          {(t.sourceLabel || t.companyName) && (
                            <span className="text-[11px] text-slate-400">
                              {[t.companyName, t.sourceLabel].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="card overflow-hidden">
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Landmark className="h-4 w-4 text-slate-400" />
                  Upcoming meetings
                </h3>
                <Link
                  href="/meetings"
                  className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Plan one <ArrowRight className="h-3 w-3" />
                </Link>
              </header>

              {nextMeetings.length === 0 ? (
                <Empty
                  icon={Landmark}
                  title="No meetings planned"
                  body="Add a board or general meeting date and the notice, intimation, outcome and minutes deadlines are worked out for you."
                  action={{ href: '/meetings', label: 'Plan a meeting' }}
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {nextMeetings.map((m) => {
                    const n = daysUntil(today, m.date);
                    const pending = m.timeline.filter(
                      (t) => !m.completed.includes(t.id),
                    ).length;
                    return (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-12 shrink-0 text-center">
                          <span className="block text-sm font-bold leading-none text-slate-900">
                            {m.date.slice(8, 10)}
                          </span>
                          <span className="text-[10px] uppercase text-slate-400">
                            {new Date(m.date + 'T00:00:00').toLocaleDateString('en-IN', {
                              month: 'short',
                            })}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-slate-800">
                            {m.title}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {n === 0 ? 'today' : `in ${n}d`}
                            {pending > 0 && ` · ${pending} obligation${pending === 1 ? '' : 's'} pending`}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* ---------------- Followed companies strip ---------------- */}
          {watched.length > 0 && (
            <section className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Following {watched.length}
                </h3>
                <Link
                  href="/companies"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Manage
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {watched.map((c) => (
                  <span
                    key={c.scrip_code}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-white py-0.5 pl-2 pr-0.5 text-xs text-slate-700"
                  >
                    <button
                      onClick={() => {
                        setPanelScrip(c.scrip_code);
                        setPanelName(c.company);
                      }}
                      className="max-w-[12rem] truncate hover:text-brand-600"
                    >
                      {c.symbol || c.company}
                    </button>
                    <WatchlistStar company={c} />
                  </span>
                ))}
              </div>
            </section>
          )}
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

// --- small presentational helpers ---

const TONES: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  slate: 'bg-slate-100 text-slate-500',
};

function Tile({
  icon: Icon,
  tone,
  value,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  value: number | null;
  label: string;
  href: string;
}) {
  return (
    <Link href={href} className="card flex items-center gap-3 p-3 transition hover:shadow-md sm:p-4">
      <div
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10',
          TONES[tone],
        )}
      >
        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight text-slate-900 sm:text-xl">
          {value === null ? <span className="text-slate-300">–</span> : value}
        </div>
        <div className="text-[11px] leading-tight text-slate-400 sm:text-xs">{label}</div>
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-12 shrink-0 animate-pulse rounded bg-slate-100" />
          <div className="h-3 flex-1 animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function Empty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="max-w-sm text-xs leading-relaxed text-slate-400">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-1 inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          {action.label} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
