import * as Flags from 'country-flag-icons/react/3x2';

type FlagComponent = (props: { title?: string; className?: string }) => React.ReactElement;

/** Small country flag; nothing when the code has no flag. Decorative: the name sits next to it. */
export function Flag({ code }: { code: string }) {
  const Component = (Flags as unknown as Record<string, FlagComponent | undefined>)[code];
  if (!Component) return <span className="flag flag-empty" aria-hidden="true" />;
  return (
    <span className="flag" aria-hidden="true">
      <Component />
    </span>
  );
}
