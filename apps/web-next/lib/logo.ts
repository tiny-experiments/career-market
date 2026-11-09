import 'server-only';
import { loadConfig } from '@cm/core/config';

/**
 * Company logo through Context.dev Logo Link (public client id), as Kurso does.
 * null when no domain is known or no client id is configured: the page then
 * shows the company's initial instead.
 */
export function logoUrl(domain: string | null | undefined): string | null {
  const id = loadConfig().web.contextDevClientId;
  if (!domain || !id) return null;
  return `https://logos.context.dev/?publicClientId=${encodeURIComponent(id)}&domain=${encodeURIComponent(domain)}`;
}
