'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Market' },
  { href: '/professions', label: 'Professions' },
  { href: '/companies', label: 'Companies' },
  { href: '/skills', label: 'Skills' },
  { href: '/screener', label: 'Screener' },
] as const;

export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="nav-tabs">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
          // A posting belongs to no single tab; the mockup keeps Market lit on the Job page.
          const lit = active || (tab.href === '/' && pathname.startsWith('/job/'));
          return (
            <li key={tab.href}>
              <Link href={tab.href} className={`nav-tab${lit ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
