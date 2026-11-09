import type { Change } from '@cm/core/types';
import { changeSentence, changeWindow, fmtPct, isUp } from '@/lib/format';

/** Green or red change pill ("▲ 2.1% this week"); a neutral dash when no change exists yet. */
export function ChangePill({
  change,
  window,
  size = 'sm',
  showWindow = false,
  emptyLabel = '—',
  emptyTitle = 'Change appears after enough comparable days',
}: {
  change: Change | null;
  /** Full window name, e.g. "this week" or "7D". */
  window: string;
  size?: 'sm' | 'lg';
  showWindow?: boolean;
  emptyLabel?: string;
  emptyTitle?: string;
}) {
  if (!change) {
    return (
      <span className={`pill pill-${size} pill-flat`} title={emptyTitle}>
        <span aria-hidden="true">{emptyLabel}</span>
        <span className="sr-only">{emptyTitle}</span>
      </span>
    );
  }
  const up = isUp(change);
  const label = changeWindow(change, window);
  return (
    <span className={`pill pill-${size} ${up ? 'pill-up' : 'pill-down'}`} title={changeSentence(change, window)}>
      <span aria-hidden="true">
        {up ? '▲' : '▼'} {fmtPct(change.value)}
        {showWindow ? ` ${label}` : change.partial || change.estimated ? '*' : ''}
      </span>
      <span className="sr-only">{changeSentence(change, window)}</span>
    </span>
  );
}

/** Plain colored change text with an arrow, for tables and the ticker. */
export function ChangeText({ change, window }: { change: Change | null; window: string }) {
  if (!change) {
    return (
      <span className="chg chg-flat" title="Change appears after enough comparable days">
        <span aria-hidden="true">—</span>
        <span className="sr-only">no change yet</span>
      </span>
    );
  }
  const up = isUp(change);
  return (
    <span className={`chg ${up ? 'chg-up' : 'chg-down'}`} title={changeSentence(change, window)}>
      <span aria-hidden="true">
        {up ? '▲' : '▼'} {fmtPct(change.value)}
        {change.partial || change.estimated ? '*' : ''}
      </span>
      <span className="sr-only">{changeSentence(change, window)}</span>
    </span>
  );
}
