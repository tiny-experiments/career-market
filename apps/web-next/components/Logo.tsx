/** Career Market wordmark icon: a rising mountain chart. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 0.7)} viewBox="0 0 40 28" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cm-logo-a" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2a5bd7" />
          <stop offset="1" stopColor="#6aa2ff" />
        </linearGradient>
      </defs>
      <path d="M1 27 L12 11 L18 18 L27 4 L39 27 Z" fill="url(#cm-logo-a)" opacity="0.95" />
      <path d="M1 27 L12 11 L18 18 L27 4 L39 27" fill="none" stroke="#9cc2ff" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M27 4 L31 2 L30 6" fill="none" stroke="#9cc2ff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
