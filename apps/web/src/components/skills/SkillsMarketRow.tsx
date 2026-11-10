import { DIRECTORY_COPY } from "@/content";
import { MiniList, MiniRow, PagedRankedCard } from "@/components/data";
import { useIsMobile } from "@/hooks";
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

  const mobile = useIsMobile();
  const lists = [
    {
      title: DIRECTORY_COPY.fastestGrowing,
      to: "/skills?view=growing",
      items: growingItems(growing),
    },
    {
      title: DIRECTORY_COPY.bestPaid,
      to: "/skills?view=best-paid",
      items: paidItems(paid),
    },
    {
      title: DIRECTORY_COPY.mostPaired,
      to: "/skills?view=paired",
      items: pairedItems(paired),
    },
  ];

  // On a phone each card shrinks to its top three in a row that slides sideways.
  if (mobile) {
    return (
      <MiniRow label={DIRECTORY_COPY.skillMovers}>
        {lists.map((list) => (
          <MiniList
            key={list.title}
            {...list}
            empty={DIRECTORY_COPY.noMovers}
          />
        ))}
      </MiniRow>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {lists.map((list) => (
        <PagedRankedCard
          key={list.title}
          {...list}
          empty={DIRECTORY_COPY.noMovers}
        />
      ))}
    </div>
  );
}
