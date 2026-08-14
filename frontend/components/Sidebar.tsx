'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  ShieldCheck,
  Megaphone,
  CalendarClock,
  Scale,
  FileText,
  Landmark,
  Users,
  Settings,
  Lock,
  Radio,
  LayoutDashboard,
  Building2,
  X,
} from 'lucide-react';
import { useWatchlist } from '@/lib/watchlist';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  /** Renders a live count badge (currently only the watchlist). */
  badge?: 'watchlist';
}

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Latest Filings', href: '/announcements/latest', icon: Radio },
  { label: 'Announcements', href: '/announcements', icon: Megaphone },
  { label: 'Compliance Calendar', href: '/compliance', icon: CalendarClock },
  { label: 'My Companies', href: '/companies', icon: Building2, badge: 'watchlist' },
  { label: 'Laws & Circulars', href: '#', icon: Scale, soon: true },
  { label: 'Resolutions & Templates', href: '#', icon: FileText, soon: true },
  { label: 'Board & Committees', href: '#', icon: Landmark, soon: true },
];

/**
 * On desktop this is a permanent 16rem column; below `lg` it becomes an overlay
 * drawer driven by `open`/`onClose` from the app shell.
 */
export default function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { companies } = useWatchlist();

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={clsx(
          'fixed inset-0 z-30 bg-slate-900/40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200',
          'lg:static lg:z-auto lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold text-slate-900">CS Dashboard</div>
            <div className="text-[11px] text-slate-400">Company Secretary suite</div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </p>
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            const count = item.badge === 'watchlist' ? companies.length : 0;
            const content = (
              <div
                className={clsx(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : item.soon
                      ? 'text-slate-400'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.soon ? (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    <Lock className="h-3 w-3" /> Soon
                  </span>
                ) : count > 0 ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {count}
                  </span>
                ) : null}
              </div>
            );
            return item.soon ? (
              <div key={item.label} className="cursor-not-allowed" title="Coming soon">
                {content}
              </div>
            ) : (
              <Link key={item.label} href={item.href} onClick={onClose}>
                {content}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400">
            <Settings className="h-[18px] w-[18px]" />
            Settings
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              Soon
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
