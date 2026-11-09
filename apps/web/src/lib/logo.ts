/**
 * Logos are served by a logo CDN keyed by the company's domain. Without the
 * public client id or a domain there is no request, and the monogram shows.
 */
const LOGO_ORIGIN = "https://logos.context.dev/";

export function logoUrl(
  domain: string | null | undefined,
  theme: "light" | "dark",
  clientId: string | undefined = import.meta.env.VITE_LOGO_LINK_ID || undefined,
): string | null {
  if (!clientId || !domain) return null;
  const url = new URL(LOGO_ORIGIN);
  url.searchParams.set("publicClientId", clientId);
  url.searchParams.set("domain", domain);
  url.searchParams.set("theme", theme);
  url.searchParams.set("type", "icon");
  return url.toString();
}
