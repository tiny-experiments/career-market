import { PageContainer, ThemeToggle } from "@/components/layout";
import { DetailSection } from "@/pages/design/DetailSection";
import { LogosSection } from "@/pages/design/LogosSection";
import { MarketSection } from "@/pages/design/MarketSection";
import { PrimitivesSection } from "@/pages/design/PrimitivesSection";
import { TablesSection } from "@/pages/design/TablesSection";
import { TokensSection } from "@/pages/design/TokensSection";

const CHAPTERS = [
  { id: "tokens", label: "Tokens" },
  { id: "primitives", label: "Controls and states" },
  { id: "market", label: "Market components" },
  { id: "tables", label: "The market table" },
  { id: "detail", label: "Detail page" },
  { id: "logos", label: "Logos and search" },
] as const;

/**
 * The living reference: every token and component with realistic content,
 * in whichever theme is on. Switch the theme in the nav to check the other.
 */
export function DesignSystemPage() {
  return (
    <PageContainer className="gap-10">
      <header className="flex flex-col gap-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <p className="text-eyebrow font-semibold text-muted-foreground">
              Career Market
            </p>
            <h1 className="text-display font-extrabold">Design system</h1>
            <p className="max-w-2xl text-body text-muted-foreground">
              shadcn/ui on our tokens. Full width, breathing room, one blue,
              bold names, right-aligned numbers, and a hover card for every
              figure. The rules are in docs/UI-RULEBOOK.md.
            </p>
          </div>
          <ThemeToggle />
        </div>
        <nav aria-label="Chapters" className="flex flex-wrap gap-x-5 gap-y-2">
          {CHAPTERS.map((chapter) => (
            <a
              key={chapter.id}
              href={`#${chapter.id}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {chapter.label}
            </a>
          ))}
        </nav>
      </header>
      <TokensSection />
      <PrimitivesSection />
      <MarketSection />
      <TablesSection />
      <DetailSection />
      <LogosSection />
    </PageContainer>
  );
}
