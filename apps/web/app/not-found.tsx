import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="card prose-card">
      <h1>Page not found</h1>
      <p>
        <Link href="/" className="link">
          ← Back to the Market overview
        </Link>
      </p>
    </section>
  );
}
