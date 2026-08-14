'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as api from './api';
import type { WatchlistCompany } from './api';
import { useAuth } from './auth';

interface WatchlistState {
  companies: WatchlistCompany[];
  codes: Set<string>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  isFollowed: (scrip: string) => boolean;
  toggle: (company: WatchlistCompany) => void;
  add: (companies: WatchlistCompany[]) => void;
  remove: (scrip: string) => void;
  clear: () => void;
}

const WatchlistContext = createContext<WatchlistState | undefined>(undefined);

/**
 * The watchlist lives in Firestore (one doc per user) but is edited from
 * everywhere — a star on a feed row, the Company 360 panel, the manage page. So
 * it's held once here, updated optimistically, and flushed on a short debounce
 * rather than writing on every click.
 */
export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<WatchlistCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // What's on screen, so the debounced flush always writes the newest state
  // rather than whatever was current when the timer was set.
  const pending = useRef<WatchlistCompany[] | null>(null);

  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    api
      .getWatchlist()
      .then((r) => live && setCompanies(r.companies))
      .catch(() => live && setError('Could not load your companies'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [user]);

  const flush = useCallback(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaving(true);
    api
      .saveWatchlist(next)
      .then((r) => setCompanies(r.companies))
      .catch(() => setError('Could not save — your change may not persist'))
      .finally(() => setSaving(false));
  }, []);

  const commit = useCallback(
    (next: WatchlistCompany[]) => {
      setCompanies(next); // optimistic
      setError(null);
      pending.current = next;
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, 600);
    },
    [flush],
  );

  // Don't lose an in-flight edit if the tab closes mid-debounce.
  useEffect(() => {
    const onHide = () => {
      if (pending.current) flush();
    };
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, [flush]);

  const codes = useMemo(() => new Set(companies.map((c) => c.scrip_code)), [companies]);

  const toggle = useCallback(
    (company: WatchlistCompany) => {
      const has = companies.some((c) => c.scrip_code === company.scrip_code);
      commit(
        has
          ? companies.filter((c) => c.scrip_code !== company.scrip_code)
          : [...companies, company],
      );
    },
    [companies, commit],
  );

  const add = useCallback(
    (incoming: WatchlistCompany[]) => {
      const seen = new Set(companies.map((c) => c.scrip_code));
      const fresh = incoming.filter((c) => c.scrip_code && !seen.has(c.scrip_code));
      if (fresh.length === 0) return;
      commit([...companies, ...fresh]);
    },
    [companies, commit],
  );

  const remove = useCallback(
    (scrip: string) => commit(companies.filter((c) => c.scrip_code !== scrip)),
    [companies, commit],
  );

  const clear = useCallback(() => commit([]), [commit]);

  const value = useMemo(
    () => ({
      companies,
      codes,
      loading,
      saving,
      error,
      isFollowed: (scrip: string) => codes.has(scrip),
      toggle,
      add,
      remove,
      clear,
    }),
    [companies, codes, loading, saving, error, toggle, add, remove, clear],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider');
  return ctx;
}
