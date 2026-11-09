import { PageContainer, PageHeader } from "@/components/layout";
import { PageBodyPlaceholder } from "./PageBodyPlaceholder";

export function AboutPage() {
  return (
    <PageContainer>
      <PageHeader
        title="About"
        description="What Career Market is and who it is for."
      />
      <PageBodyPlaceholder />
    </PageContainer>
  );
}
