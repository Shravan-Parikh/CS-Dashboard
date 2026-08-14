'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { WatchlistProvider } from '@/lib/watchlist';
import Sidebar from '@/components/Sidebar';
import { MenuContext } from '@/components/Topbar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Close the drawer whenever the route changes, and on Escape.
  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <WatchlistProvider>
      <MenuContext.Provider value={{ openMenu: () => setMenuOpen(true) }}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
          {/* min-w-0 so wide tables scroll inside the pane instead of the page */}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </MenuContext.Provider>
    </WatchlistProvider>
  );
}
