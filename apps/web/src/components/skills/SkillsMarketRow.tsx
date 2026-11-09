import { DIRECTORY_COPY } from "@/content";
import { PagedRankedCard } from "@/components/data";
import {
  growingItems,
  paidItems,
  pairedItems,
} from "@/components/skills/SkillRankedItems";
import type { SkillIndexRow } from "@/lib/api";
import { sortSkills } from "@/lib/skillViews";

const CARD_ROWS = 15;

/** Three doors into the Skills tabs: what is growing, what pays, what goes together. */
export function SkillsMarketRow({
  skills,
}: {
  readonly skills: readonly SkillIndexRow[];
}) {
  const growing = sortSkills(
    skills.filter((row) => row.change !== null),
    "change30d",
    "desc",
  ).slice(0, CARD_ROWS);
  const paid = sortSkills(
    skills.filter((row) => row.pay !== null),
    "pay",
    "desc",
  ).slice(0, CARD_ROWS);
  const paired = sortSkills(
    skills.filter((row) => row.topPair !== null),
    "pair",
    "desc",
  ).slice(0, CARD_ROWS);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <PagedRankedCard
        title={DIRECTORY_COPY.fastestGrowing}
        to="/skills?view=growing"
        items={growingItems(growing)}
        empty={DIRECTORY_COPY.noMovers}
      />
      <PagedRankedCard
        title={DIRECTORY_COPY.bestPaid}
        to="/skills?view=best-paid"
        items={paidItems(paid)}
        empty={DIRECTORY_COPY.noMovers}
      />
      <PagedRankedCard
        title={DIRECTORY_COPY.mostPaired}
        to="/skills?view=paired"
        items={pairedItems(paired)}
        empty={DIRECTORY_COPY.noMovers}
      />
    </div>
  );
}
