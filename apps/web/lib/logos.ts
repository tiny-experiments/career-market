import 'server-only';
import { loadConfig } from '@cm/core/config';

const LOGO_LINK_BASE_URL = 'https://logos.context.dev/';

/**
 * The Context.dev Logo Link for a website, as Kurso builds it. Null without a
 * public client id or a domain; the page then shows a neutral mark.
 */
export function logoSrc(domain: string | null | undefined): string | null {
  const clientId = loadConfig().web.contextDevClientId;
  if (!domain || !clientId) return null;
  const url = new URL(LOGO_LINK_BASE_URL);
  url.searchParams.set('publicClientId', clientId);
  url.searchParams.set('domain', domain);
  return url.toString();
}
