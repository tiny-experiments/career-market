import { Link } from "react-router";
import { Panel } from "@/components/data";
import { Badge } from "@/components/ui/badge";
import type { JobPagePayload } from "@/lib/api";
import { JOB_PAGE, repostedTimes, sentence } from "@/content";
import { formatRelativeDays } from "@/lib/format";
import { parseJobText, type TextBlock } from "@/lib/jobText";

function Block({ block }: { readonly block: TextBlock }) {
  if (block.type === "heading") {
    return <h3 className="pt-2 text-h2 font-bold">{block.text}</h3>;
  }
  if (block.type === "list") {
    return (
      <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-subtle marker:text-muted-foreground">
        {block.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    );
  }
  return <p className="text-body text-subtle">{block.text}</p>;
}

function Skills({
  skills,
}: {
  readonly skills: JobPagePayload["job"]["skills"];
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-eyebrow font-semibold text-muted-foreground">
        Skills
      </h3>
      {/* On a touch screen each skill link gets a 40 px touch area; the taller row gap keeps them apart. */}
      <ul className="flex flex-wrap gap-2 max-md:gap-y-4">
        {skills.map((skill) => (
          <li key={skill.id}>
            {skill.slug === null ? (
              <Badge variant="flat" size="md">
                {skill.label}
              </Badge>
            ) : (
              <Badge
                asChild
                variant="flat"
                size="md"
                className="relative touch-target overflow-visible"
              >
                <Link to={`/skills/${skill.slug}`}>{skill.label}</Link>
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AtAGlance({
  job,
  professionName,
}: {
  readonly job: JobPagePayload["job"];
  readonly professionName: string | null;
}) {
  const facts = [
    {
      label: "Posted",
      value:
        job.ageDays === null ? null : sentence(formatRelativeDays(job.ageDays)),
    },
    {
      label: "Reposted",
      value: repostedTimes(job.repostCount),
    },
    { label: "Profession", value: professionName },
    {
      label: "Locations",
      value: job.moreLocations > 0 ? String(job.moreLocations + 1) : null,
    },
  ].filter((fact) => fact.value !== null);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-eyebrow font-semibold text-muted-foreground">
        {JOB_PAGE.atAGlance}
      </h3>
      <dl className="flex flex-col gap-2.5">
        {facts.map((fact) => (
          <div key={fact.label} className="flex justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="text-right font-semibold">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The employer's own words, set for reading, with the facts and skills beside them. */
export function JobPosting({
  job,
  professionName,
  className,
}: {
  readonly job: JobPagePayload["job"];
  readonly professionName: string | null;
  readonly className?: string;
}) {
  const blocks = job.description ? parseJobText(job.description) : [];
  return (
    <Panel
      title={JOB_PAGE.about}
      {...(className === undefined ? {} : { className })}
    >
      <div className="flex flex-col gap-8 xl:flex-row xl:gap-12">
        <div className="flex max-w-2xl min-w-0 flex-1 flex-col gap-4">
          {blocks.length > 0 ? (
            blocks.map((block, index) => <Block key={index} block={block} />)
          ) : (
            <p className="text-body text-muted-foreground">
              {JOB_PAGE.noDescription}
            </p>
          )}
        </div>
        <aside className="flex w-full shrink-0 flex-col gap-8 xl:w-64">
          <AtAGlance job={job} professionName={professionName} />
          {job.skills.length > 0 ? <Skills skills={job.skills} /> : null}
        </aside>
      </div>
    </Panel>
  );
}
