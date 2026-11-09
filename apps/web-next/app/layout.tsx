import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Footer } from '@/components/Footer';
import { TickerTape } from '@/components/TickerTape';
import { TopNav } from '@/components/TopNav';
import { getChrome } from '@/lib/readApi';
import './globals.css';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

// Render per request: the read API's responses are cached (and tag-revalidated) in
// Next's data cache, so an outage page is never frozen into the route cache.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Career Market — Tech Hiring Intelligence', template: '%s — Career Market' },
  description: 'Tech careers charted like market instruments, from daily job-board data collected by krill.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0e14' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
};

/** Applies the saved theme before first paint (dark is the default). */
const THEME_SCRIPT = `try{var t=localStorage.getItem('cm-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const chrome = await getChrome();
  const data = chrome.ok ? chrome.data : null;
  return (
    <html lang="en" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <TickerTape items={data?.ticker ?? []} />
        <TopNav asOf={data?.asOf ?? null} />
        <main id="main" className="page">
          {children}
        </main>
        <Footer boards={data?.boards ?? null} />
      </body>
    </html>
  );
}
