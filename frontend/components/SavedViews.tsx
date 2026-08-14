'use client';

import { useEffect, useState } from 'react';
import { Bookmark, BookmarkPlus, Trash2, Loader2, Check, X } from 'lucide-react';
import * as api from '@/lib/api';
import type { SavedView } from '@/lib/api';

/**
 * Save and recall a set of filters. Persisted per user in Firestore, so a CS who
 * runs the same query every quarter doesn't rebuild it each time.
 */
export default function SavedViews<T extends Record<string, unknown>>({
  current,
  onApply,
}: {
  current: T;
  onApply: (filters: T) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getSavedViews()
      .then((r) => live && setViews(r.views))
      .catch(() => live && setError('Could not load saved views'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.saveView(trimmed, current);
      setViews(r.views);
      setName('');
      setNaming(false);
    } catch {
      setError('Could not save this view');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const r = await api.deleteView(id);
      setViews(r.views);
    } catch {
      setError('Could not delete that view');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Bookmark className="h-3.5 w-3.5" /> Saved views
        </span>

        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />
        ) : views.length === 0 ? (
          <span className="text-xs text-slate-400">
            None yet — save the filters you reuse each quarter.
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {views.map((v) => (
              <span
                key={v.id}
                className="group flex items-center gap-0.5 rounded-full border border-slate-200 bg-white py-0.5 pl-2.5 pr-0.5 text-xs text-slate-700"
              >
                <button
                  onClick={() => onApply(v.filters as T)}
                  className="max-w-[14rem] truncate font-medium hover:text-brand-600"
                  title="Apply this view"
                >
                  {v.name}
                </button>
                <button
                  onClick={() => remove(v.id)}
                  disabled={busy}
                  className="rounded-full p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"
                  title="Delete this view"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto">
          {naming ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                  if (e.key === 'Escape') {
                    setNaming(false);
                    setName('');
                  }
                }}
                placeholder="Name this view…"
                maxLength={80}
                className="w-44 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                onClick={save}
                disabled={busy || !name.trim()}
                className="rounded-md bg-brand-600 p-1.5 text-white hover:bg-brand-700 disabled:opacity-40"
                title="Save"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                onClick={() => {
                  setNaming(false);
                  setName('');
                }}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setNaming(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              <BookmarkPlus className="h-3.5 w-3.5" /> Save current filters
            </button>
          )}
        </div>
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
