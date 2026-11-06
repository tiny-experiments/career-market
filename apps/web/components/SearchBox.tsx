'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Search box UI. Typeahead over professions, companies, skills and roles arrives with those pages. */
export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState('');
  return (
    <form
      role="search"
      className="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="search-icon" size={16} aria-hidden="true" />
      <label htmlFor="site-search" className="sr-only">
        Search a profession, company, skill or role
      </label>
      <input
        id="site-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search professions, companies, skills..."
        autoComplete="off"
      />
    </form>
  );
}
