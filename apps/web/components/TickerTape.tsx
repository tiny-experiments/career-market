import type { TickerItem } from '@cm/core/types';
import Link from 'next/link';
import { ChangeText } from './ChangePill';
import { fmtInt } from '@/lib/format';

function Item({ item, decorative = false }: { item: TickerItem; decorative?: boolean }) {
  return (
    <li className="ticker-item" title={item.note ? `${item.name}. ${item.note}` : item.name}>
      {item.href ? (
        <Link href={item.href} className="ticker-code" tabIndex={decorative ? -1 : undefined}>
          {item.code}
        </Link>
      ) : (
        <span className="ticker-code">{item.code}</span>
      )}
      <span className="ticker-count num">{fmtInt(item.open)}</span>
      {item.change ? <ChangeText change={item.change} window="1W" /> : <span className="chg chg-flat" aria-hidden="true">—</span>}
    </li>
  );
}

/** Thin strip across the top: family and company tickers with open roles and 1W change. Scrolls; pauses on hover. */
export function TickerTape({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return <div className="ticker" aria-hidden="true" />;
  return (
    <section className="ticker" aria-label="Market ticker: open roles and one-week change">
      <div className="ticker-track">
        <ul className="ticker-list">
          {items.map((item) => (
            <Item key={item.code} item={item} />
          ))}
        </ul>
        {/* Second copy makes the scroll seamless; hidden from assistive tech. */}
        <ul className="ticker-list" aria-hidden="true">
          {items.map((item) => (
            <Item key={`dup-${item.code}`} item={item} decorative />
          ))}
        </ul>
      </div>
    </section>
  );
}
