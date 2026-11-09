import { PageContainer, PageHeader } from "@/components/layout";
import { ABOUT, PAGES } from "@/content";

/** Two sentences on what Career Market is. Nothing about how it is made. */
export function AboutPage() {
  return (
    <PageContainer>
      <PageHeader title={PAGES.about.title} />
      <div className="flex max-w-2xl flex-col gap-4">
        {ABOUT.sentences.map((text) => (
          <p key={text} className="text-body text-muted-foreground">
            {text}
          </p>
        ))}
      </div>
    </PageContainer>
  );
}
