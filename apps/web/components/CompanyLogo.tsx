'use client';

import { useState } from 'react';

/** Small rounded-square company logo. Falls back to a monogram when there is no logo or it fails to load. */
export function CompanyLogo({ name, src, size = 28 }: { name: string; src: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = (name.match(/[A-Za-z0-9]+/g) ?? ['?'])
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) };
  if (!src || failed) {
    return (
      <span className="logo-tile logo-mono" style={style} aria-hidden="true">
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="logo-tile" style={style} src={src} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />
  );
}
