import Link from 'next/link';
import { fmtInt } from '@/lib/format';

export function Footer({ boards }: { boards: number | null }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <p className="footer-lead">
          Open tech jobs from {boards ? fmtInt(boards) : 'thousands of'} company career boards, refreshed daily. Data by{' '}
          <a href="https://krill.kurso.sh" rel="noreferrer">
            krill
          </a>
          .
        </p>
        <nav aria-label="Footer" className="footer-links">
          <Link href="/methodology">Methodology</Link>
          <Link href="/data">Data</Link>
          <Link href="/about">About</Link>
        </nav>
        <span className="footer-divider" aria-hidden="true" />
        <p className="footer-note">Not a job board. Applications happen on the employer&apos;s site.</p>
      </div>
    </footer>
  );
}
