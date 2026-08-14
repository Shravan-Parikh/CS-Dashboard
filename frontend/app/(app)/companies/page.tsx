'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Search,
  Loader2,
  Check,
  Plus,
  Trash2,
  Star,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import Topbar from '@/components/Topbar';
import CompanyPanel from '@/components/CompanyPanel';
import WatchlistStar from '@/components/WatchlistStar';
import * as api from '@/lib/api';
import { useWatchlist } from '@/lib/watchlist';
import type { Company } from '@/lib/types';

const CODE_RE = /^\d{4,8}$/;

export default function MyCompaniesPage() {
  const { companies: watched, add, remove, clear, loading, saving, error } = useWatchlist();

  const [indices, setIndices] = useState<string[]>(['All']);
  const [index, setIndex] = useState('Nifty50');
  const [available, setAvailable] = useState<Company[]>([]);
  const [query, setQuery] = useState('');
  const [customCodes, setCustomCodes] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const [panelScrip, setPanelScrip] = useState<string | null>(null);
  const [panelName, setPanelName] = useState<string | undefined>();

  useEffect(() => {
    api.getIndices().then((r) => setIndices(r.indices)).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getCompanies(index)
      .then((r) => setAvailable(r.companies))
      .catch(() => setAvailable([]));
  }, [index]);

  const watchedCodes = useMemo(
    () => new Set(watched.map((c) => c.scrip_code)),
    [watched],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (c) =>
        c.company.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.scrip_code.includes(q),
    );
  }, [available, query]);

  const notYetAdded = filtered.filter((c) => !watchedCodes.has(c.scrip_code));

  function addCustom() {
    setCustomError(null);
    const codes = customCodes
      .split(/[\s,]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (codes.length === 0) return;
    const bad = codes.filter((c) => !CODE_RE.test(c));
    if (bad.length > 0) {
      setCustomError(
        `Not valid BSE scrip codes: ${bad.slice(0, 4).join(', ')}${bad.length > 4 ? '…' : ''}`,
      );
      return;
    }
    // Fill in the real name where we know it; otherwise the code stands in until
    // the first fetch resolves it.
    const byCode = new Map(available.map((c) => [c.scrip_code, c]));
    add(
      codes.map((code) => {
        const known = byCode.get(code);
        return {
          scrip_code: code,
          company: known?.company || code,
          symbol: known?.symbol || '',
        };
      }),
    );
    setCustomCodes('');
  }

  return (
    <>
      <Topbar
        title="My Companies"
        subtitle="The companies you act for — their filings drive your dashboard"
      />

      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* ---------------- Currently following ---------------- */}
          <section className="card overflow-hidden">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Star className="h-4 w-4 text-amber-500" />
                Following
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {watched.length}
                </span>
              </h3>
              <div className="flex items-center gap-3">
                {saving && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Loader2 className="h-3 w-3 animate-spin" /> saving
                  </span>
                )}
                {!saving && watched.length > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> saved
                  </span>
                )}
                {watched.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Stop following all ${watched.length} companies?`)) clear();
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Clear all
                  </button>
                )}
              </div>
            </header>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your companies…
              </div>
            ) : watched.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">No companies yet</p>
                <p className="max-w-md text-xs leading-relaxed text-slate-400">
                  Add the companies you act for below. Their filings then appear on your
                  dashboard automatically, and you can star any company from the feed or a
                  search result too.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {watched.map((c) => (
                  <li
                    key={c.scrip_code}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60"
                  >
                    <WatchlistStar company={c} size="md" />
                    <button
                      onClick={() => {
                        setPanelScrip(c.scrip_code);
                        setPanelName(c.company);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-slate-800 hover:text-brand-600 hover:underline">
                        {c.company}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {c.symbol ? `${c.symbol} · ` : ''}BSE {c.scrip_code}
                      </span>
                    </button>
                    <button
                      onClick={() => remove(c.scrip_code)}
                      className="shrink-0 rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-600"
                      title="Stop following"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---------------- Add from an index ---------------- */}
          <section className="card overflow-hidden">
            <header className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <h3 className="text-sm font-semibold text-slate-700">Add companies</h3>
            </header>

            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <label className="label">From index</label>
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
                <div className="min-w-[200px] flex-1">
                  <label className="label">Search</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      className="input pl-9"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Company name, symbol or scrip code…"
                    />
                  </div>
                </div>
                {notYetAdded.length > 0 && (
                  <button
                    onClick={() =>
                      add(
                        notYetAdded.map((c) => ({
                          scrip_code: c.scrip_code,
                          company: c.company,
                          symbol: c.symbol,
                        })),
                      )
                    }
                    className="btn-secondary"
                  >
                    <Plus className="h-4 w-4" /> Add all {notYetAdded.length}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
                {filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-400">
                    No companies match “{query}”.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filtered.map((c) => {
                      const on = watchedCodes.has(c.scrip_code);
                      return (
                        <li
                          key={c.scrip_code}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-slate-800">
                              {c.company}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {c.symbol ? `${c.symbol} · ` : ''}
                              {c.scrip_code}
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              on
                                ? remove(c.scrip_code)
                                : add([
                                    {
                                      scrip_code: c.scrip_code,
                                      company: c.company,
                                      symbol: c.symbol,
                                    },
                                  ])
                            }
                            className={clsx(
                              'inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition',
                              on
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'border border-slate-200 text-slate-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700',
                            )}
                          >
                            {on ? (
                              <>
                                <Check className="h-3 w-3" /> Following
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" /> Follow
                              </>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Custom codes */}
              <div className="border-t border-slate-100 pt-4">
                <label className="label">Or paste BSE scrip codes</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="input flex-1 font-mono text-xs"
                    value={customCodes}
                    onChange={(e) => setCustomCodes(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                    placeholder="500325, 532540, 500180"
                  />
                  <button
                    onClick={addCustom}
                    className="btn-secondary"
                    disabled={!customCodes.trim()}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
                {customError ? (
                  <p className="mt-1.5 text-xs text-red-600">{customError}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-400">
                    Useful for unlisted-index or smaller companies not in the seed list.
                    Names resolve on the first fetch.
                  </p>
                )}
              </div>
            </div>
          </section>
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
