'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState } from 'react';

/** A card whose body can be collapsed with a button in the header (open by default). */
export function CollapsePanel({ header, label, children }: { header: React.ReactNode; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const id = useId();
  return (
    <section className="card jobs-card" aria-label={label}>
      <div className="jobs-head">
        {header}
        <button type="button" className="jobs-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
          <ChevronDown size={20} aria-hidden="true" className={open ? 'is-open' : undefined} />
          <span className="sr-only">{open ? `Hide ${label}` : `Show ${label}`}</span>
        </button>
      </div>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
