'use client';

import { Briefcase, Layers, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TypeaheadHit, TypeaheadResponse } from '@/app/api/search/route';
import { fmtInt } from '@/lib/format';
import '@/styles/search.css';

const KIND_ICON = { profession: Layers, company: Briefcase, skill: Sparkles } as const;

function countLabel(h: TypeaheadHit): string {
  return h.kind === 'skill' ? `${fmtInt(h.open)} roles` : `${fmtInt(h.open)} open`;
}

type State = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: TypeaheadResponse };

/**
 * Global search: a combobox with grouped results (professions, companies,
 * skills). Arrow keys move through results, Enter opens one (or the full
 * results page when none is highlighted), Escape closes.
 */
export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState<State>({ status: 'idle' });
  const root = useRef<HTMLFormElement>(null);
  const listId = useId();

  const flat = useMemo(() => (state.status === 'ok' ? state.data.groups.flatMap((g) => g.hits) : []), [state]);

  useEffect(() => {
    const term = q.trim();
    if (term === '') {
      setState({ status: 'idle' });
      return;
    }
    setState((s) => (s.status === 'ok' ? s : { status: 'loading' }));
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setState({ status: 'ok', data: (await res.json()) as TypeaheadResponse });
        setActive(-1);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setState({ status: 'error' });
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const showPanel = open && q.trim() !== '';
  const fullHref = `/search?q=${encodeURIComponent(q.trim())}`;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (flat.length === 0) return;
      e.preventDefault();
      setOpen(true);
      const n = flat.length;
      setActive((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  let optionIndex = -1;
  const status = state.status === 'ok' ? (flat.length === 0 ? 'No matches' : `${flat.length} results`) : '';

  return (
    <form
      ref={root}
      role="search"
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        const hit = active >= 0 ? flat[active] : undefined;
        if (hit) go(hit.href);
        else if (q.trim()) go(fullHref);
      }}
    >
      <Search className="search-icon" size={16} aria-hidden="true" />
      <label htmlFor="site-search" className="sr-only">
        Search a profession, company, skill or role
      </label>
      <input
        id="site-search"
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search professions, companies, skills..."
        autoComplete="off"
        spellCheck={false}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {status}
      </span>
      {showPanel && (
        <div id={listId} role="listbox" aria-label="Search results" className="search-panel">
          {state.status === 'loading' && <p className="search-empty">Searching…</p>}
          {state.status === 'error' && <p className="search-empty">Search is not available right now.</p>}
          {state.status === 'ok' && flat.length === 0 && <p className="search-empty">No profession, company or skill matches “{q.trim()}”.</p>}
          {state.status === 'ok' &&
            state.data.groups.map((g) => (
              <div key={g.kind} role="group" aria-labelledby={`${listId}-${g.kind}`} className="search-group">
                <p id={`${listId}-${g.kind}`} className="search-group-title">
                  {g.title}
                </p>
                {g.hits.map((h) => {
                  optionIndex += 1;
                  const i = optionIndex;
                  const Icon = KIND_ICON[h.kind];
                  return (
                    <Link
                      key={`${h.kind}-${h.id}`}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={active === i}
                      href={h.href}
                      tabIndex={-1}
                      className={`search-hit${active === i ? ' is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => setOpen(false)}
                    >
                      <span className="search-hit-icon" aria-hidden="true">
                        {h.kind === 'company' ? (
                          <span className="co-logo" style={{ width: 20, height: 20, fontSize: 10 }}>
                            <span className="co-logo-initial">{h.label.charAt(0).toUpperCase()}</span>
                            {h.logo && (
                              // eslint-disable-next-line @next/next/no-img-element -- remote logo service
                              <img src={h.logo} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" />
                            )}
                          </span>
                        ) : (
                          <Icon size={16} />
                        )}
                      </span>
                      <span className="search-hit-label">
                        {h.label}
                        {h.sublabel && <span className="search-hit-sub"> {h.sublabel}</span>}
                      </span>
                      <span className="search-hit-count num">{countLabel(h)}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          {q.trim() !== '' && (
            <Link href={fullHref} role="option" aria-selected="false" tabIndex={-1} className="search-all" onClick={() => setOpen(false)}>
              See all results for “{q.trim()}” <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
    </form>
  );
}
