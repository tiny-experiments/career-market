import { MetricHoverCard } from "@/components/common/MetricHoverCard";
import { Delta } from "@/components/data/Delta";
import { Badge } from "@/components/ui/badge";

/** A short window's change as a labelled pill: "1D ▲ 0.4%". The pill explains itself on hover. */
export function ChangePill({
  label,
  value,
  hint,
}: {
  readonly label: string;
  readonly value: number;
  readonly hint: { readonly title: string; readonly text: string };
}) {
  return (
    <MetricHoverCard
      title={hint.title}
      trigger={
        <Badge variant="flat" size="md" className="gap-1.5">
          <span className="text-muted-foreground">{label}</span>
          <Delta value={value} size="sm" />
        </Badge>
      }
    >
      {hint.text}
    </MetricHoverCard>
  );
}
