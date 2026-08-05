'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import clsx from 'clsx';

interface Option {
  value: string;
  label: string;
  sub?: string;
}

export default function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Choose…',
  emptyLabel = 'All in index',
}: {
  options: Option[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      o.value.includes(query),
  );

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between text-left"
      >
        <span className={clsx('truncate', selected.length === 0 && 'text-slate-400')}>
          {selected.length === 0
            ? emptyLabel
            : `${selected.length} selected`}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.slice(0, 6).map((v) => {
            const opt = options.find((o) => o.value === v);
            return (
              <span
                key={v}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
              >
                {opt?.label || v}
                <button onClick={() => toggle(v)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {selected.length > 6 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              +{selected.length - 6} more
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input
              autoFocus
              className="input py-1.5 text-sm"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-slate-400">No matches</div>
            )}
            {filtered.map((o) => {
              const isSel = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span
                    className={clsx(
                      'flex h-4 w-4 items-center justify-center rounded border',
                      isSel
                        ? 'border-brand-600 bg-brand-600 text-white'
                        : 'border-slate-300',
                    )}
                  >
                    {isSel && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 truncate text-slate-700">{o.label}</span>
                  {o.sub && <span className="text-xs text-slate-400">{o.sub}</span>}
                </button>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-slate-100 p-2">
              <button
                onClick={() => onChange([])}
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
