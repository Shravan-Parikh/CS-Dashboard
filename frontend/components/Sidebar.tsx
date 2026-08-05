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
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { label: 'Announcements', href: '/announcements', icon: Megaphone },
  { label: 'Compliance Calendar', href: '#', icon: CalendarClock, soon: true },
  { label: 'Laws & Circulars', href: '#', icon: Scale, soon: true },
  { label: 'Resolutions & Templates', href: '#', icon: FileText, soon: true },
  { label: 'Board & Committees', href: '#', icon: Landmark, soon: true },
  { label: 'Clients', href: '#', icon: Users, soon: true },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-slate-900">CS Dashboard</div>
          <div className="text-[11px] text-slate-400">Company Secretary suite</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </p>
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
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
              <Icon className="h-[18px] w-[18px]" />
              <span className="flex-1">{item.label}</span>
              {item.soon && (
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  <Lock className="h-3 w-3" /> Soon
                </span>
              )}
            </div>
          );
          return item.soon ? (
            <div key={item.label} className="cursor-not-allowed" title="Coming soon">
              {content}
            </div>
          ) : (
            <Link key={item.label} href={item.href}>
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400">
          <Settings className="h-[18px] w-[18px]" />
          Settings
          <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            Soon
          </span>
        </div>
      </div>
    </aside>
  );
}
