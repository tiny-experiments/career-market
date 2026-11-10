import { Link } from "react-router";
import { BrandLockup } from "@/components/layout/BrandMark";
import { FOOTER_LINE, SITE_NAME } from "@/content";
import { SECTIONS } from "@/lib/nav";

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-sm flex-col gap-3">
          <BrandLockup />
          <p className="text-small text-muted-foreground">{FOOTER_LINE}</p>
        </div>
        <nav
          aria-label="Footer"
          className="flex flex-wrap gap-x-6 gap-y-2 max-md:gap-y-0"
        >
          {SECTIONS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="relative touch-target text-small font-medium text-muted-foreground hover:text-foreground max-md:inline-flex max-md:min-h-touch max-md:items-center"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/about"
            className="relative touch-target text-small font-medium text-muted-foreground hover:text-foreground max-md:inline-flex max-md:min-h-touch max-md:items-center"
          >
            About
          </Link>
        </nav>
      </div>
      <div className="mx-auto w-full max-w-page px-gutter pb-8">
        <p className="text-xs text-muted-foreground">
          © {YEAR} {SITE_NAME}
        </p>
      </div>
    </footer>
  );
}
