import { Logo } from "@/components/data";
import { SearchBox } from "@/components/layout";
import { DesignSection, Example } from "@/pages/design/DesignSection";
import {
  COMPANIES,
  SEARCH_GROUPS,
  SKILLS_RISING,
} from "@/pages/design/sampleData";

export function LogosSection() {
  return (
    <DesignSection
      id="logos"
      title="Logos and search"
      description="One Logo component for companies, professions and skills: round for a company, square for the rest, a monogram on a tinted tile when there is no mark. Search is a command dialog grouped by kind."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Example
          title="Companies"
          note="Real marks when the domain is known; the monogram otherwise."
        >
          <div className="flex flex-wrap items-center gap-5 rounded-xl bg-card p-4 shadow-card">
            {COMPANIES.map((company) => (
              <div
                key={company.slug}
                className="flex flex-col items-center gap-1.5"
              >
                <Logo name={company.name} domain={company.domain} size="lg" />
                <span className="text-xs text-muted-foreground">
                  {company.name}
                </span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <Logo name="Northwind Labs" size="lg" />
              <span className="text-xs text-muted-foreground">No domain</span>
            </div>
          </div>
        </Example>
        <Example
          title="Skills and professions"
          note="Square tiles at the three sizes."
        >
          <div className="flex flex-wrap items-end gap-5 rounded-xl bg-card p-4 shadow-card">
            {SKILLS_RISING.map((skill) => (
              <div
                key={skill.slug}
                className="flex flex-col items-center gap-1.5"
              >
                <Logo
                  name={skill.name}
                  domain={skill.domain}
                  shape="square"
                  size="lg"
                />
                <span className="text-xs text-muted-foreground">
                  {skill.name}
                </span>
              </div>
            ))}
            <Logo name="Platform & Infra" shape="square" size="md" />
            <Logo name="Data" shape="square" size="sm" />
          </div>
        </Example>
        <Example
          title="Search"
          note="Press / anywhere. Results come grouped: professions, companies, skills, jobs."
          className="lg:col-span-2"
        >
          <div className="max-w-md">
            <SearchBox groups={SEARCH_GROUPS} />
          </div>
        </Example>
      </div>
    </DesignSection>
  );
}
