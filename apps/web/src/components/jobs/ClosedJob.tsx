import { Archive } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/common";
import { PageHeader } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClosedJobPayload } from "@/lib/api";
import { EMPTY, closedDetail, seeOpenRoles } from "@/content";

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** A role that has gone: said plainly, with the way back to what is open. */
export function ClosedJob({ job }: { readonly job: ClosedJobPayload }) {
  const openFor =
    job.openedAt === null ? null : daysBetween(job.openedAt, job.closedAt);
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Jobs", to: "/jobs" }]}
        title={EMPTY.closedJob.title}
      />
      <Card>
        <EmptyState
          icon={Archive}
          title={EMPTY.closedJob.title}
          description={closedDetail(openFor)}
          action={
            <Button asChild>
              <Link to={job.family ? `/jobs?family=${job.family}` : "/jobs"}>
                {seeOpenRoles(job.familyName)}
              </Link>
            </Button>
          }
        />
      </Card>
    </>
  );
}
