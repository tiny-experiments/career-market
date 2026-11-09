import type { CountValue } from '@cm/core/company';
import { fmtInt } from '@/lib/format';

const R = 52;
const C = 2 * Math.PI * R;

/** Donut of open roles by level. Server-rendered SVG; the legend beside it carries the numbers. */
export function SeniorityDonut({ levels, seniorPlus }: { levels: CountValue[]; seniorPlus: number }) {
  const total = levels.reduce((n, l) => n + l.count, 0);
  if (total === 0) return null;
  const gap = levels.length > 1 ? 1.2 : 0;
  let offset = 0;
  const summary = `Open roles by level: ${levels.map((l) => `${l.label} ${fmtInt(l.count)}`).join(', ')}. ${Math.round((seniorPlus / total) * 100)}% are senior or above.`;
  return (
    <div className="co-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={summary}>
        <g transform="rotate(-90 70 70)" fill="none" strokeWidth="17">
          <circle cx="70" cy="70" r={R} className="co-donut-track" />
          {levels.map((l) => {
            const len = (l.count / total) * C;
            const el = (
              <circle
                key={l.value}
                cx="70"
                cy="70"
                r={R}
                stroke={`var(--lv-${l.value})`}
                strokeDasharray={`${Math.max(0, len - gap)} ${C - Math.max(0, len - gap)}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      <p className="co-donut-center" aria-hidden="true">
        <strong className="num">{Math.round((seniorPlus / total) * 100)}%</strong>
        <span>Senior+</span>
        <span className="num">({fmtInt(seniorPlus)})</span>
      </p>
    </div>
  );
}
