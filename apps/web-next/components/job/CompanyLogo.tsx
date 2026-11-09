'use client';

import { useState } from 'react';

/** Rounded-square company logo. Falls back to the company's initials when there is no logo or it fails to load. */
export function CompanyLogo({ name, src, size = 'md' }: { name: string; src: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  return (
    <span className={`co-logo co-logo-${size}`} aria-hidden="true">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <span className="co-logo-initials">{initials || '?'}</span>
      )}
    </span>
  );
}
