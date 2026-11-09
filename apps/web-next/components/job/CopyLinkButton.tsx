'use client';

import { Check, Link2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Copies this page's address. The label change is announced politely. */
export function CopyLinkButton() {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2500);
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={copy}>
        {state === 'copied' ? <Check size={18} aria-hidden="true" /> : <Link2 size={18} aria-hidden="true" />}
        {state === 'copied' ? 'Link copied' : 'Copy link'}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {state === 'copied' ? 'Link copied to the clipboard' : state === 'failed' ? 'Could not copy the link' : ''}
      </span>
    </>
  );
}
