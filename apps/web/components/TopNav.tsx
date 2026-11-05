import Link from 'next/link';
import { formatDayLong } from '@cm/core/dates';
import { LogoMark } from './Logo';
import { NavTabs } from './NavTabs';
import { SearchBox } from './SearchBox';
import { ThemeToggle } from './ThemeToggle';

export function TopNav({ asOf }: { asOf: string | null }) {
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="wordmark" aria-label="Career Market home">
          <LogoMark />
          <span>Career Market</span>
        </Link>
        <NavTabs />
        <div className="topnav-right">
          <SearchBox />
          <ThemeToggle />
          <p className="asof">
            {asOf ? (
              <>
                Data as of <time dateTime={asOf}>{formatDayLong(asOf)}</time> · updated daily
              </>
            ) : (
              'Data loading · updated daily'
            )}
          </p>
        </div>
      </div>
    </header>
  );
}
