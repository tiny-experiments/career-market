'use client';

import type { CountValue } from '@cm/core/company';
import { ChevronDown } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

/** Profession, country and remote filters of the Current roles list. The URL holds them, so the list is shareable and works without client state. */
export function RoleFilters({
  professions,
  countries,
  remoteCount,
  value,
}: {
  professions: CountValue[];
  countries: CountValue[];
  remoteCount: number | null;
  value: { profession: string; country: string; remote: boolean };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (next: Partial<typeof value>) => {
    const merged = { ...value, ...next };
    const q = new URLSearchParams();
    if (merged.profession) q.set('profession', merged.profession);
    if (merged.country) q.set('country', merged.country);
    if (merged.remote) q.set('remote', '1');
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return (
    <form className="co-filters" role="search" aria-label="Filter current roles" onSubmit={(e) => e.preventDefault()}>
      <label className="co-select">
        <span className="sr-only">Profession</span>
        <select name="profession" value={value.profession} onChange={(e) => go({ profession: e.target.value })}>
          <option value="">Profession</option>
          {professions.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label} ({p.count})
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
      <label className="co-select">
        <span className="sr-only">Country</span>
        <select name="country" value={value.country} onChange={(e) => go({ country: e.target.value })}>
          <option value="">Country</option>
          {countries.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label} ({c.count})
            </option>
          ))}
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
      <label className="co-select">
        <span className="sr-only">Work mode</span>
        <select name="remote" value={value.remote ? 'remote' : ''} onChange={(e) => go({ remote: e.target.value === 'remote' })}>
          <option value="">Remote</option>
          <option value="remote">Remote only{remoteCount !== null ? ` (${remoteCount})` : ''}</option>
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>
    </form>
  );
}
