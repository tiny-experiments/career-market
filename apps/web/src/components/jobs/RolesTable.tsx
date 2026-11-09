import { DataTable, type Column } from "@/components/data/DataTable";
import { Logo } from "@/components/data/Logo";
import {
  DIRECTORY_COPY,
  levelLabel,
  NO_FIGURE,
  workModeLabel,
} from "@/content";

export interface RoleRow {
  readonly id: string;
  readonly title: string;
  /** Shown when the table spans several employers. */
  readonly company?: { readonly name: string; readonly domain: string | null };
  readonly location: string | null;
  readonly workMode?: string | null;
  readonly level?: string | null;
  readonly pay: string | null;
  readonly posted: string;
  /** Our own job page. */
  readonly href: string;
}

const muted = (text: string | null | undefined) =>
  text ? (
    <span className="text-muted-foreground">{text}</span>
  ) : (
    <span className="text-subtle">{NO_FIGURE}</span>
  );

/** Open roles as a table; a row opens our job page, never the employer's. */
export function RolesTable({
  roles,
  caption,
}: {
  readonly roles: readonly RoleRow[];
  readonly caption: string;
}) {
  const hasCompany = roles.some((role) => role.company !== undefined);
  const hasDetail = roles.some((role) => role.workMode !== undefined);
  const columns: Column<RoleRow>[] = [
    {
      key: "title",
      header: DIRECTORY_COPY.columns.role,
      // Takes the spare width and truncates, so a long title never pushes pay off the row.
      className: "w-full max-w-0",
      cell: (role) => (
        <span className="block truncate font-bold">{role.title}</span>
      ),
    },
    ...(hasCompany
      ? [
          {
            key: "company",
            header: DIRECTORY_COPY.columns.company,
            from: "md",
            cell: (role) =>
              role.company ? (
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Logo
                    name={role.company.name}
                    domain={role.company.domain}
                    size="sm"
                  />
                  {role.company.name}
                </span>
              ) : null,
          } satisfies Column<RoleRow>,
        ]
      : []),
    {
      key: "location",
      header: DIRECTORY_COPY.columns.location,
      from: "md",
      cell: (role) => muted(role.location),
    },
    ...(hasDetail
      ? [
          {
            key: "mode",
            header: DIRECTORY_COPY.columns.workMode,
            from: "lg",
            cell: (role) => muted(workModeLabel(role.workMode)),
          } satisfies Column<RoleRow>,
          {
            key: "level",
            header: DIRECTORY_COPY.columns.seniority,
            from: "lg",
            cell: (role) => muted(levelLabel(role.level)),
          } satisfies Column<RoleRow>,
        ]
      : []),
    {
      key: "pay",
      header: DIRECTORY_COPY.columns.pay,
      align: "right",
      from: "sm",
      cell: (role) =>
        role.pay ?? <span className="text-subtle">{NO_FIGURE}</span>,
    },
    {
      key: "posted",
      header: DIRECTORY_COPY.columns.posted,
      align: "right",
      cell: (role) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {role.posted}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={roles}
      rowKey={(role) => role.id}
      rowHref={(role) => role.href}
      rowLabel={(role) => role.title}
      caption={caption}
      inset="card"
    />
  );
}
