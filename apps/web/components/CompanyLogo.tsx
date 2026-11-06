/** Rounded-square company logo. The initial sits underneath, so a logo that does not load leaves the initial showing. */
export function CompanyLogo({ name, src, size = 22 }: { name: string; src: string | null; size?: number }) {
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  return (
    <span className="co-logo" style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }} aria-hidden="true">
      <span className="co-logo-initial">{initial}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- remote logo service, sized by the box
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      )}
    </span>
  );
}
