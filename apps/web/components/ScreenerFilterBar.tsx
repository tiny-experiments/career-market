'use client';

import {
  GROWTH_LABEL,
  GROWTH_STATES,
  LEVEL_GROUPS,
  POSTED_WITHIN_DAYS,
  REGIONS,
  SALARY_CURRENCIES,
  SALARY_STEPS,
  WORK_MODES,
  WORK_MODE_LABEL,
  type ScreenerFilters,
  type ScreenerMode,
  type ScreenerOptions,
} from '@cm/core/screener';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

const POSTED_LABEL: Record<number, string> = { 1: 'Last day', 3: 'Last 3 days', 7: 'Last week', 14: 'Last 2 weeks', 30: 'Last 30 days' };
const CURRENCY_SYMBOL: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
const kfmt = (n: number) => `${n / 1000}K`;

function Pill({
  name,
  label,
  value,
  width,
  disabledReason,
  children,
}: {
  name: string;
  label: string;
  value: string;
  /** Width in px, so the bar keeps one row whatever the longest option is. */
  width: number;
  /** When set, the control is disabled and this explains why. */
  disabledReason?: string;
  children: React.ReactNode;
}) {
  const hintId = disabledReason ? `${name}-hint` : undefined;
  return (
    <label className={`pill-select${value ? ' is-set' : ''}`} title={disabledReason}>
      <span className="sr-only">{label}</span>
      {disabledReason && (
        <span id={hintId} className="sr-only">
          {disabledReason}
        </span>
      )}
      <select name={name} defaultValue={value} aria-label={label} aria-describedby={hintId} disabled={disabledReason !== undefined} style={{ width }}>
        <option value="">{label}</option>
        {children}
      </select>
      <ChevronDown size={15} aria-hidden="true" />
    </label>
  );
}

/**
 * The Screener's filter pills. Each is a native select inside a GET form, so the
 * bar works with the keyboard and without JavaScript (the Apply button then
 * shows); with JavaScript a change applies at once.
 */
export function ScreenerFilterBar({
  mode,
  filters,
  options,
  keep,
}: {
  mode: ScreenerMode;
  filters: ScreenerFilters;
  options: ScreenerOptions;
  /** Query parameters the form keeps (sort, direction, job sort). */
  keep: Record<string, string>;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);

  function apply() {
    if (!form.current) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form.current).entries()) {
      if (typeof v === 'string' && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `/screener?${qs}` : '/screener');
  }

  const resetHref = mode === 'companies' ? '/screener' : `/screener?mode=${mode}`;
  const salaryValue = filters.salary ? `${filters.salary.currency}:${filters.salary.min}` : '';

  return (
    <form ref={form} method="get" action="/screener" className="filter-bar" role="search" aria-label="Screener filters" onChange={apply} onSubmit={(e) => { e.preventDefault(); apply(); }}>
      {mode !== 'companies' && <input type="hidden" name="mode" value={mode} />}
      {Object.entries(keep).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Pill width={100} name="region" label="Region" value={filters.region ?? ''}>
        {REGIONS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </Pill>
      <Pill width={104} name="country" label="Country" value={filters.country ?? ''}>
        {options.countries.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </Pill>
      <Pill width={126} name="workMode" label="Work mode" value={filters.workMode ?? ''}>
        {WORK_MODES.map((m) => (
          <option key={m} value={m}>
            {WORK_MODE_LABEL[m]}
          </option>
        ))}
      </Pill>
      <Pill width={104} name="level" label="Seniority" value={filters.level ?? ''}>
        {LEVEL_GROUPS.map((g) => (
          <option key={g.key} value={g.key}>
            {g.label}
          </option>
        ))}
      </Pill>
      <Pill width={120} name="family" label="Profession" value={filters.family ?? ''}>
        {options.families.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Pill>
      <Pill width={140} name="skill" label="Skill or stack" value={filters.skill ?? ''}>
        {options.skills.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Pill>
      <Pill
        width={106}
        name="growth"
        label="Growth"
        value={filters.growth ?? ''}
        disabledReason={mode === 'companies' ? undefined : 'Growth signals exist for companies only. Switch to Companies to use this filter.'}
      >
        {GROWTH_STATES.map((g) => (
          <option key={g} value={g}>
            {GROWTH_LABEL[g]}
          </option>
        ))}
      </Pill>
      <Pill width={116} name="salary" label="Salary min" value={salaryValue}>
        {SALARY_CURRENCIES.map((cur) => (
          <optgroup key={cur} label={cur}>
            {(SALARY_STEPS[cur] ?? []).map((n) => (
              <option key={n} value={`${cur}:${n}`}>
                {CURRENCY_SYMBOL[cur]}
                {kfmt(n)}+
              </option>
            ))}
          </optgroup>
        ))}
      </Pill>
      <Pill width={138} name="posted" label="Posted within" value={filters.postedWithin ? String(filters.postedWithin) : ''}>
        {POSTED_WITHIN_DAYS.map((d) => (
          <option key={d} value={d}>
            {POSTED_LABEL[d]}
          </option>
        ))}
      </Pill>
      <noscript>
        <button type="submit" className="filter-apply">
          Apply
        </button>
      </noscript>
      <Link href={resetHref} className="filter-reset" scroll={false}>
        Reset
      </Link>
    </form>
  );
}
