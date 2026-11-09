import { useParams } from "react-router";
import { NotFoundState, PageSkeleton, ResourceView } from "@/components/common";
import { PageContainer } from "@/components/layout";
import {
  ProfessionChartPanel,
  ProfessionHeader,
  ProfessionPanels,
  ProfessionTables,
} from "@/components/professions";
import { ERROR } from "@/content";
import { useResource } from "@/hooks";
import { professionDetail } from "@/lib/api";

export function ProfessionPage() {
  const { code = "" } = useParams();
  const profession = useResource(professionDetail(code));

  return (
    <PageContainer>
      <ResourceView
        state={profession}
        skeleton={<PageSkeleton variant="detail" />}
        errorTitle={ERROR.profession.title}
        notFound={<NotFoundState />}
      >
        {(page) => (
          <>
            <ProfessionHeader page={page} />
            <ProfessionChartPanel page={page} />
            <ProfessionPanels page={page} />
            <ProfessionTables page={page} />
          </>
        )}
      </ResourceView>
    </PageContainer>
  );
}
