import 'server-only';
import { loadConfig } from '@cm/core/config';

/**
 * Context.dev Logo Link, as Kurso builds it. The client id is public by design
 * (it ships in the page); without one, or without a company domain, the page
 * draws a monogram tile instead.
 */
export function logoUrl(domain: string | null): string | null {
  const clientId = loadConfig().web.contextDevClientId;
  if (!domain || !clientId) return null;
  const url = new URL('https://logos.context.dev/');
  url.searchParams.set('publicClientId', clientId);
  url.searchParams.set('domain', domain);
  return url.toString();
}
