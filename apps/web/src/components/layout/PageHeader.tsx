import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Crumb {
  readonly label: string;
  readonly to: string;
}

export interface PageHeaderProps {
  readonly crumbs?: readonly Crumb[];
  /** A line above the name: the employer a job belongs to. */
  readonly eyebrow?: ReactNode;
  readonly logo?: ReactNode;
  readonly title: string;
  /** The ticker-style code after the name: SWE, AIML. */
  readonly code?: string;
  /** The big figure under the name, its unit, and the change beside it. */
  readonly headline?: {
    readonly value: string;
    readonly label: string;
    readonly change?: ReactNode;
  };
  /** A row of small pills or facts under the headline. */
  readonly facts?: ReactNode;
  /** Whatever sits to the right: a stat rail, a primary action. */
  readonly aside?: ReactNode;
  readonly description?: string;
  readonly className?: string;
}

/**
 * A detail or list page's top: crumbs, name with its code, the headline
 * figure with its change in words, and a rail beside it. Breathing room is
 * part of the component, so pages never fight over it.
 */
export function PageHeader({
  crumbs,
  eyebrow,
  logo,
  title,
  code,
  headline,
  facts,
  aside,
  description,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-6 max-md:gap-4 xl:flex-row xl:items-end xl:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-4">
        {crumbs && crumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb) => (
                <Fragment key={crumb.to}>
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <Link to={crumb.to} className="relative touch-target">
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              ))}
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        ) : null}
        {eyebrow}
        <div className="flex items-center gap-3">
          {logo}
          {/* The code follows the name and drops under it when the name wraps, never stranded at the far edge. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-h1 font-extrabold wrap-break-word">
              {title}
            </h1>
            {code === undefined ? null : <Badge variant="code">{code}</Badge>}
          </div>
        </div>
        {description === undefined ? null : (
          <p className="max-w-2xl text-body text-muted-foreground max-md:text-small">
            {description}
          </p>
        )}
        {headline ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <span className="text-display font-extrabold">
              {headline.value}
            </span>
            <span className="text-body font-medium text-muted-foreground">
              {headline.label}
            </span>
            {headline.change}
          </div>
        ) : null}
        {facts ? <div className="flex flex-wrap gap-2">{facts}</div> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}
