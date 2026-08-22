'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  Plus,
  Loader2,
  AlertCircle,
  Trash2,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Check,
  ListChecks,
  AlertTriangle,
  X,
  Video,
  MapPin,
  CheckSquare,
} from 'lucide-react';
import clsx from 'clsx';
import Topbar from '@/components/Topbar';
import * as api from '@/lib/api';
import { useWatchlist } from '@/lib/watchlist';
import type { BoardMeeting, MeetingType, TimelineItem } from '@/lib/types';

const STATUS_STYLE: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-600',
  'notice-sent': 'bg-amber-50 text-amber-700',
  held: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
};

const PHASE_LABEL: Record<string, string> = {
  before: 'Before the meeting',
  during: 'On the day',
  after: 'After the meeting',
};

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

const daysUntil = (iso: string) =>
  Math.round(
    (new Date(iso + 'T00:00:00').getTime() - new Date(todayIso() + 'T00:00:00').getTime()) /
      86_400_000,
  );

const fmt = (iso: string) =>
  iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

export default function MeetingsPage() {
  const { companies } = useWatchlist();

  const [meetings, setMeetings] = useState<BoardMeeting[]>([]);
  const [types, setTypes] = useState<MeetingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [type, setType] = useState('board');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [mode, setMode] = useState<'physical' | 'vc' | 'hybrid'>('physical');
  const [venue, setVenue] = useState('');
  const [scrip, setScrip] = useState('');
  const [listed, setListed] = useState(true);
  const [hasResults, setHasResults] = useState(false);
  const [agendaText, setAgendaText] = useState('');
  const [preview, setPreview] = useState<TimelineItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t] = await Promise.all([api.getMeetings(), api.getMeetingTypes()]);
      setMeetings(m.meetings);
      setTypes(t.types);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Show the statutory consequences of the chosen date before saving.
  useEffect(() => {
    if (!date) {
      setPreview([]);
      return;
    }
    let live = true;
    api
      .previewTimeline({ date, type, hasResults, listed })
      .then((r) => live && setPreview(r.timeline))
      .catch(() => live && setPreview([]));
    return () => {
      live = false;
    };
  }, [date, type, hasResults, listed]);

  function resetForm() {
    setType('board');
    setTitle('');
    setDate('');
    setTime('');
    setMode('physical');
    setVenue('');
    setScrip('');
    setListed(true);
    setHasResults(false);
    setAgendaText('');
    setPreview([]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    setError(null);
    try {
      const picked = companies.find((c) => c.scrip_code === scrip);
      const agenda = agendaText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((item, i) => ({ id: `a${i + 1}`, item, done: false }));

      await api.createMeeting({
        type,
        title: title.trim(),
        date,
        time,
        mode,
        venue: venue.trim(),
        companyScrip: scrip,
        companyName: picked?.company || '',
        listed,
        hasResults,
        agenda,
        status: 'planned',
      });
      await load();
      resetForm();
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the meeting');
    } finally {
      setSaving(false);
    }
  }

  async function patch(m: BoardMeeting, input: api.MeetingInput) {
    try {
      const r = await api.updateMeeting(m.id, input);
      setMeetings((cur) => cur.map((x) => (x.id === m.id ? r.meeting : x)));
    } catch {
      setError('Could not save that change');
    }
  }

  async function remove(m: BoardMeeting) {
    if (!confirm(`Delete “${m.title}” on ${fmt(m.date)}?`)) return;
    try {
      await api.deleteMeeting(m.id);
      setMeetings((cur) => cur.filter((x) => x.id !== m.id));
    } catch {
      setError('Could not delete that meeting');
    }
  }

  /** Send a timeline obligation to the task list, citation attached. */
  async function toTask(m: BoardMeeting, item: TimelineItem) {
    try {
      const r = await api.createTask({
        title: `${item.label} — ${m.title}`,
        due: item.due,
        priority: item.phase === 'during' ? 'high' : 'normal',
        companyScrip: m.companyScrip,
        companyName: m.companyName,
        source: `meeting:${m.id}:${item.id}`,
        sourceLabel: item.reference,
      });
      setError(r.duplicate ? 'That one is already on your task list.' : null);
    } catch {
      setError('Could not add that to your tasks');
    }
  }

  const { upcoming, past } = useMemo(() => {
    const up: BoardMeeting[] = [];
    const pa: BoardMeeting[] = [];
    for (const m of meetings) (daysUntil(m.date) >= 0 ? up : pa).push(m);
    up.sort((a, b) => a.date.localeCompare(b.date));
    return { upcoming: up, past: pa };
  }, [meetings]);

  return (
    <>
      <Topbar
        title="Board Meetings"
        subtitle="Plan a meeting and get the statutory timeline that hangs off the date"
      />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Plan a meeting
            </button>
          ) : (
            <form onSubmit={save} className="card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Plan a meeting</h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="w-48">
                  <label className="label">Type</label>
                  <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-40">
                  <label className="label">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="w-28">
                  <label className="label">Time</label>
                  <input
                    type="time"
                    className="input"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
                <div className="min-w-[180px] flex-1">
                  <label className="label">Title</label>
                  <input
                    className="input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={types.find((t) => t.id === type)?.label || 'Meeting'}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-3">
                {companies.length > 0 && (
                  <div className="w-48">
                    <label className="label">Company</label>
                    <select className="input" value={scrip} onChange={(e) => setScrip(e.target.value)}>
                      <option value="">None</option>
                      {companies.map((c) => (
                        <option key={c.scrip_code} value={c.scrip_code}>
                          {c.symbol || c.company}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="w-32">
                  <label className="label">Mode</label>
                  <select
                    className="input"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as 'physical' | 'vc' | 'hybrid')}
                  >
                    <option value="physical">Physical</option>
                    <option value="vc">Video</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div className="min-w-[180px] flex-1">
                  <label className="label">Venue / link</label>
                  <input
                    className="input"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Registered office, or meeting link"
                  />
                </div>
              </div>

              <div className="mt-3">
                <label className="label">Agenda — one item per line</label>
                <textarea
                  className="input h-20 resize-y"
                  value={agendaText}
                  onChange={(e) => setAgendaText(e.target.value)}
                  placeholder={'Approve unaudited financial results for Q2\nConsider interim dividend'}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={listed}
                    onChange={(e) => setListed(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                  />
                  Listed company
                  <span className="text-xs text-slate-400">(adds the SEBI LODR items)</span>
                </label>
                {type === 'board' && (
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={hasResults}
                      onChange={(e) => setHasResults(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                    />
                    Financial results on the agenda
                    <span className="text-xs text-slate-400">(Reg. 29 — 5 clear days)</span>
                  </label>
                )}
              </div>

              {/* Consequences of the chosen date, before committing */}
              {preview.length > 0 && (
                <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                    <ListChecks className="h-3.5 w-3.5" />
                    This date creates {preview.length} obligation
                    {preview.length === 1 ? '' : 's'}
                  </p>
                  <ul className="space-y-1">
                    {preview.map((t) => (
                      <li key={t.id} className="flex items-baseline gap-2 text-xs">
                        <span className="w-20 shrink-0 font-medium tabular-nums text-slate-700">
                          {fmt(t.due).slice(0, 6)}
                        </span>
                        <span className="text-slate-600">{t.label}</span>
                        <span className="text-slate-400">{t.reference}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button type="submit" className="btn-primary" disabled={saving || !date}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save meeting
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="card flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading meetings…
            </div>
          ) : meetings.length === 0 ? (
            <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Landmark className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">No meetings planned</p>
              <p className="max-w-md text-xs leading-relaxed text-slate-400">
                Add a meeting date and the notice, intimation, outcome and minutes
                deadlines are worked out for you — each citing its provision, and each
                sendable to your task list.
              </p>
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <Section
                  label="Upcoming"
                  meetings={upcoming}
                  openId={openId}
                  setOpenId={setOpenId}
                  types={types}
                  onPatch={patch}
                  onRemove={remove}
                  onToTask={toTask}
                />
              )}
              {past.length > 0 && (
                <Section
                  label="Past"
                  meetings={past}
                  openId={openId}
                  setOpenId={setOpenId}
                  types={types}
                  onPatch={patch}
                  onRemove={remove}
                  onToTask={toTask}
                />
              )}
            </>
          )}

          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Dates are computed as calendar days. Where a provision says{' '}
            <b>clear days</b> or <b>working days</b> the item says so — check those
            against the calendar, since the difference decides whether a filing is late.
          </p>
        </div>
      </div>
    </>
  );
}

function Section({
  label,
  meetings,
  openId,
  setOpenId,
  types,
  onPatch,
  onRemove,
  onToTask,
}: {
  label: string;
  meetings: BoardMeeting[];
  openId: string | null;
  setOpenId: (v: string | null) => void;
  types: MeetingType[];
  onPatch: (m: BoardMeeting, input: api.MeetingInput) => void;
  onRemove: (m: BoardMeeting) => void;
  onToTask: (m: BoardMeeting, item: TimelineItem) => void;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label} · {meetings.length}
      </h3>
      {meetings.map((m) => {
        const open = openId === m.id;
        const n = daysUntil(m.date);
        const typeLabel = types.find((t) => t.id === m.type)?.label || m.type;
        const doneCount = m.timeline.filter((t) => m.completed.includes(t.id)).length;

        return (
          <div key={m.id} className="card overflow-hidden">
            <div className="flex flex-wrap items-start gap-3 p-4">
              <div className="w-16 shrink-0 text-center">
                <div className="text-lg font-bold leading-none text-slate-900">
                  {m.date.slice(8, 10)}
                </div>
                <div className="text-[11px] uppercase text-slate-400">
                  {new Date(m.date + 'T00:00:00').toLocaleDateString('en-IN', {
                    month: 'short',
                  })}
                </div>
                {n >= 0 && (
                  <div className="mt-1 text-[10px] font-semibold text-brand-600">
                    {n === 0 ? 'today' : `in ${n}d`}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">{m.title}</p>
                  <span
                    className={clsx(
                      'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                      STATUS_STYLE[m.status],
                    )}
                  >
                    {m.status.replace('-', ' ')}
                  </span>
                  {!m.listed && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                      unlisted
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-400">
                  <span>{typeLabel}</span>
                  {m.time && <span>{m.time}</span>}
                  <span className="inline-flex items-center gap-1">
                    {m.mode === 'vc' ? (
                      <Video className="h-3 w-3" />
                    ) : (
                      <MapPin className="h-3 w-3" />
                    )}
                    {m.mode === 'vc' ? 'Video' : m.mode === 'hybrid' ? 'Hybrid' : 'Physical'}
                  </span>
                  {m.companyName && <span>{m.companyName}</span>}
                  {m.agenda.length > 0 && <span>{m.agenda.length} agenda items</span>}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <select
                  value={m.status}
                  onChange={(e) => onPatch(m, { status: e.target.value as BoardMeeting['status'] })}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
                >
                  <option value="planned">Planned</option>
                  <option value="notice-sent">Notice sent</option>
                  <option value="held">Held</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  onClick={() => onRemove(m)}
                  className="rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <button
              onClick={() => setOpenId(open ? null : m.id)}
              className="flex w-full items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-left"
            >
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <ListChecks className="h-3.5 w-3.5 text-slate-400" />
                Statutory timeline · {doneCount}/{m.timeline.length} done
              </span>
              {open ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {open && (
              <div className="divide-y divide-slate-100">
                {m.agenda.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Agenda
                    </p>
                    <ul className="space-y-1">
                      {m.agenda.map((a) => (
                        <li key={a.id} className="flex items-start gap-2 text-[13px] text-slate-700">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                          {a.item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(['before', 'during', 'after'] as const).map((phase) => {
                  const items = m.timeline.filter((t) => t.phase === phase);
                  if (items.length === 0) return null;
                  return (
                    <div key={phase} className="px-4 py-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {PHASE_LABEL[phase]}
                      </p>
                      <ul className="space-y-2">
                        {items.map((t) => {
                          const ticked = m.completed.includes(t.id);
                          const overdue = !ticked && daysUntil(t.due) < 0;
                          return (
                            <li key={t.id} className="flex items-start gap-2.5">
                              <button
                                onClick={() =>
                                  onPatch(m, {
                                    completed: ticked
                                      ? m.completed.filter((c) => c !== t.id)
                                      : [...m.completed, t.id],
                                  })
                                }
                                className={clsx(
                                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition',
                                  ticked
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-slate-300 hover:border-brand-500',
                                )}
                                aria-label={ticked ? 'Mark as not done' : 'Mark as done'}
                              >
                                {ticked && <CheckSquare className="h-2.5 w-2.5" />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2">
                                  <span
                                    className={clsx(
                                      'text-[13px]',
                                      ticked
                                        ? 'text-slate-400 line-through'
                                        : 'text-slate-800',
                                    )}
                                  >
                                    {t.label}
                                  </span>
                                  {t.conditional && (
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                      if applicable
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span
                                    className={clsx(
                                      'inline-flex items-center gap-1 text-[11px]',
                                      ticked
                                        ? 'text-slate-300'
                                        : overdue
                                          ? 'font-semibold text-red-600'
                                          : 'text-slate-500',
                                    )}
                                  >
                                    <CalendarClock className="h-3 w-3" />
                                    {fmt(t.due)}
                                    {overdue && ' · overdue'}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    {t.authority} · {t.reference}
                                  </span>
                                  {!ticked && (
                                    <button
                                      onClick={() => onToTask(m, t)}
                                      className="text-[11px] font-medium text-brand-600 hover:text-brand-700"
                                    >
                                      + add to tasks
                                    </button>
                                  )}
                                </div>
                                {t.caution && (
                                  <p className="mt-0.5 text-[11px] text-amber-700">
                                    {t.caution}
                                  </p>
                                )}
                                {t.note && !t.caution && (
                                  <p className="mt-0.5 text-[11px] text-slate-400">{t.note}</p>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
