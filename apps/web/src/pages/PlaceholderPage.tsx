import { Hourglass } from "lucide-react";
import { EmptyState } from "@/components/common";
import { PageContainer, PageHeader } from "@/components/layout";

export interface PlaceholderPageProps {
  readonly title: string;
  readonly description: string;
}

/** A section whose page is not built yet: its name, one line, and nothing to click. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Hourglass}
        title="This page is on its way"
        description="It will open here as soon as it is ready."
        className="rounded-xl bg-card shadow-card"
      />
    </PageContainer>
  );
}
