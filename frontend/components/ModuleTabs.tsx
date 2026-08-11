'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

export interface Tab {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

/** Sub-navigation inside a module, so related views share one shell. */
export default function ModuleTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-6">
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              '-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition',
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
