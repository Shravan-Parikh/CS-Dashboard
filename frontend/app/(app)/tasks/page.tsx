'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Plus,
  Loader2,
  Trash2,
  AlertCircle,
  CalendarClock,
  Link2,
  Eraser,
  Flag,
} from 'lucide-react';
import clsx from 'clsx';
import Topbar from '@/components/Topbar';
import * as api from '@/lib/api';
import { useWatchlist } from '@/lib/watchlist';
import type { Task } from '@/lib/types';

const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-red-50 text-red-700 ring-red-200',
  normal: 'bg-slate-100 text-slate-600 ring-slate-200',
  low: 'bg-slate-50 text-slate-400 ring-slate-200',
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

function daysUntil(due: string) {
  if (!due) return null;
  const a = new Date(todayIso() + 'T00:00:00');
  const b = new Date(due + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function dueLabel(due: string) {
  const n = daysUntil(due);
  if (n === null) return '';
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n <= 30) return `in ${n}d`;
  return new Date(due + 'T00:00:00').toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function dueTone(due: string, done: boolean) {
  if (done) return 'text-slate-300';
  const n = daysUntil(due);
  if (n === null) return 'text-slate-400';
  if (n < 0) return 'text-red-600 font-semibold';
  if (n === 0) return 'text-orange-600 font-semibold';
  if (n <= 7) return 'text-amber-600';
  return 'text-slate-400';
}

type Filter = 'open' | 'today' | 'overdue' | 'done' | 'all';

export default function TasksPage() {
  const { companies } = useWatchlist();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('open');

  // New-task form
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [scrip, setScrip] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.getTasks();
      setTasks(r.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const picked = companies.find((c) => c.scrip_code === scrip);
      const r = await api.createTask({
        title: title.trim(),
        due,
        priority,
        companyScrip: scrip,
        companyName: picked?.company || '',
      });
      setTasks(r.tasks);
      setTitle('');
      setDue('');
      setPriority('normal');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that task');
    } finally {
      setAdding(false);
    }
  }

  async function toggle(t: Task) {
    setBusy(t.id);
    // Optimistic — a checkbox that lags feels broken.
    setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    try {
      const r = await api.updateTask(t.id, { done: !t.done });
      setTasks(r.tasks);
    } catch {
      setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, done: t.done } : x)));
      setError('Could not save that change');
    } finally {
      setBusy(null);
    }
  }

  async function remove(t: Task) {
    setBusy(t.id);
    try {
      const r = await api.deleteTask(t.id);
      setTasks(r.tasks);
    } catch {
      setError('Could not delete that task');
    } finally {
      setBusy(null);
    }
  }

  async function clearDone() {
    const n = tasks.filter((t) => t.done).length;
    if (n === 0 || !confirm(`Remove ${n} completed task${n === 1 ? '' : 's'}?`)) return;
    try {
      const r = await api.clearCompletedTasks();
      setTasks(r.tasks);
    } catch {
      setError('Could not clear completed tasks');
    }
  }

  const counts = useMemo(() => {
    const open = tasks.filter((t) => !t.done);
    return {
      open: open.length,
      today: open.filter((t) => daysUntil(t.due) === 0).length,
      overdue: open.filter((t) => (daysUntil(t.due) ?? 1) < 0).length,
      done: tasks.filter((t) => t.done).length,
      all: tasks.length,
    };
  }, [tasks]);

  const visible = useMemo(() => {
    const list = tasks.filter((t) => {
      if (filter === 'all') return true;
      if (filter === 'done') return t.done;
      if (t.done) return false;
      if (filter === 'today') return daysUntil(t.due) === 0;
      if (filter === 'overdue') return (daysUntil(t.due) ?? 1) < 0;
      return true; // 'open'
    });
    // Dated tasks first, soonest at the top; undated fall to the bottom.
    const rank = (t: Task) => (t.due ? daysUntil(t.due)! : 99999);
    const prio = { high: 0, normal: 1, low: 2 } as const;
    return list.sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        rank(a) - rank(b) ||
        prio[a.priority] - prio[b.priority],
    );
  }, [tasks, filter]);

  const FILTERS: { id: Filter; label: string; n: number }[] = [
    { id: 'open', label: 'Open', n: counts.open },
    { id: 'today', label: 'Today', n: counts.today },
    { id: 'overdue', label: 'Overdue', n: counts.overdue },
    { id: 'done', label: 'Done', n: counts.done },
    { id: 'all', label: 'All', n: counts.all },
  ];

  return (
    <>
      <Topbar title="Tasks" subtitle="Your working list — and anything you've pulled in from a deadline or a meeting" />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Add */}
          <form onSubmit={add} className="card p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[220px] flex-1">
                <label className="label">New task</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Circulate draft minutes to the board"
                  maxLength={300}
                />
              </div>
              <div className="w-36">
                <label className="label">Due</label>
                <input
                  type="date"
                  className="input"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </div>
              <div className="w-28">
                <label className="label">Priority</label>
                <select
                  className="input"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
                >
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
              {companies.length > 0 && (
                <div className="w-40">
                  <label className="label">Company</label>
                  <select
                    className="input"
                    value={scrip}
                    onChange={(e) => setScrip(e.target.value)}
                  >
                    <option value="">None</option>
                    {companies.map((c) => (
                      <option key={c.scrip_code} value={c.scrip_code}>
                        {c.symbol || c.company}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button type="submit" className="btn-primary" disabled={adding || !title.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add
              </button>
            </div>
          </form>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={clsx(
                  'rounded-full border px-3 py-1.5 text-xs font-medium transition',
                  filter === f.id
                    ? 'border-brand-200 bg-brand-50 text-brand-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                )}
              >
                {f.label}
                {f.n > 0 && (
                  <span
                    className={clsx(
                      'ml-1.5',
                      f.id === 'overdue' && f.n > 0 ? 'text-red-600' : 'text-slate-400',
                    )}
                  >
                    {f.n}
                  </span>
                )}
              </button>
            ))}
            {counts.done > 0 && (
              <button
                onClick={clearDone}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear completed
              </button>
            )}
          </div>

          {/* List */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your tasks…
              </div>
            ) : visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {filter === 'open' && tasks.length === 0
                    ? 'Nothing on your list'
                    : `No ${filter} tasks`}
                </p>
                <p className="max-w-sm text-xs leading-relaxed text-slate-400">
                  Add one above, or send one here from a compliance deadline or a board
                  meeting checklist — those arrive with their citation attached.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visible.map((t) => (
                  <li
                    key={t.id}
                    className={clsx('flex items-start gap-3 px-4 py-3', t.done && 'bg-slate-50/60')}
                  >
                    <button
                      onClick={() => toggle(t)}
                      disabled={busy === t.id}
                      className={clsx(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition',
                        t.done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-slate-300 hover:border-brand-500',
                      )}
                      aria-label={t.done ? 'Mark as not done' : 'Mark as done'}
                    >
                      {t.done && <CheckSquare className="h-3 w-3" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={clsx(
                          'text-sm',
                          t.done ? 'text-slate-400 line-through' : 'text-slate-800',
                        )}
                      >
                        {t.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        {t.due && (
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 text-[11px]',
                              dueTone(t.due, t.done),
                            )}
                          >
                            <CalendarClock className="h-3 w-3" /> {dueLabel(t.due)}
                          </span>
                        )}
                        {t.priority !== 'normal' && !t.done && (
                          <span
                            className={clsx(
                              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1',
                              PRIORITY_STYLE[t.priority],
                            )}
                          >
                            <Flag className="h-2.5 w-2.5" /> {t.priority}
                          </span>
                        )}
                        {t.companyName && (
                          <span className="text-[11px] text-slate-400">{t.companyName}</span>
                        )}
                        {t.sourceLabel && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-brand-600"
                            title={t.source}
                          >
                            <Link2 className="h-3 w-3" /> {t.sourceLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => remove(t)}
                      disabled={busy === t.id}
                      className="shrink-0 rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
