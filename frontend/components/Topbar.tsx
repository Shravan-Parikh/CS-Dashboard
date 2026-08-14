'use client';

import { createContext, useContext, useState } from 'react';
import { LogOut, ChevronDown, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth';

/** Lets the Topbar open the app shell's mobile drawer without prop-drilling. */
export const MenuContext = createContext<{ openMenu: () => void } | null>(null);

export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user, logout } = useAuth();
  const menu = useContext(MenuContext);
  const [open, setOpen] = useState(false);
  const initials = (user?.name || user?.email || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {menu && (
          <button
            onClick={menu.openMenu}
            className="-ml-1 rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
            {title}
          </h1>
          {subtitle && (
            <p className="hidden truncate text-xs text-slate-400 sm:block">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="relative shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <div className="text-sm font-medium text-slate-800">{user?.name}</div>
            <div className="text-[11px] text-slate-400">{user?.email}</div>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 px-4 py-2.5 sm:hidden">
              <div className="truncate text-sm font-medium text-slate-800">{user?.name}</div>
              <div className="truncate text-[11px] text-slate-400">{user?.email}</div>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
