import Link from 'next/link';

/** Placeholder for pages that later pull requests build. */
export function ComingSoon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card prose-card" aria-labelledby="soon-title">
      <p className="eyebrow">Coming soon</p>
      <h1 id="soon-title">{title}</h1>
      <p>{children}</p>
      <p>
        <Link href="/" className="link">
          ← Back to the Market overview
        </Link>
      </p>
    </section>
  );
}
