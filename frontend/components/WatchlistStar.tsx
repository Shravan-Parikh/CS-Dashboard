'use client';

import { Star } from 'lucide-react';
import clsx from 'clsx';
import { useWatchlist } from '@/lib/watchlist';
import type { WatchlistCompany } from '@/lib/api';

/**
 * Follow/unfollow toggle. Appears anywhere a company does, so following is a
 * one-click act from wherever the CS happens to notice the company.
 */
export default function WatchlistStar({
  company,
  size = 'sm',
  className,
}: {
  company: WatchlistCompany;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { isFollowed, toggle } = useWatchlist();
  const on = isFollowed(company.scrip_code);
  const dim = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(company);
      }}
      aria-pressed={on}
      title={on ? 'Following — click to unfollow' : 'Follow this company'}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded transition',
        size === 'md' ? 'h-7 w-7' : 'h-6 w-6',
        on
          ? 'text-amber-500 hover:text-amber-600'
          : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500',
        className,
      )}
    >
      <Star className={dim} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
