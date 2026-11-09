'use client';

import { Box, Braces, Cloud, Cpu, Database, Layers } from 'lucide-react';
import { useState } from 'react';

/** A rounded logo tile: the brand logo when one loads, else a neutral mark (or the company's initial). */
export function BrandMark({
  src,
  name,
  size = 28,
  kind = 'company',
  namespace = '',
}: {
  src: string | null;
  name: string;
  size?: number;
  kind?: 'company' | 'skill';
  /** Skill namespace, picks the fallback icon. */
  namespace?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (src && !failed) {
    return (
      <span className="brand-mark" style={style} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" width={size} height={size} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      </span>
    );
  }
  const Icon = kind === 'skill' ? ICONS[namespace] ?? Layers : null;
  return (
    <span className="brand-mark brand-mark-fallback" style={style} aria-hidden="true">
      {Icon ? <Icon size={Math.round(size * 0.55)} /> : <span style={{ fontSize: Math.round(size * 0.46) }}>{name.trim().charAt(0).toUpperCase()}</span>}
    </span>
  );
}

const ICONS: Record<string, typeof Layers> = {
  lang: Braces,
  ml: Cpu,
  cloud: Cloud,
  store: Database,
  infra: Box,
};
