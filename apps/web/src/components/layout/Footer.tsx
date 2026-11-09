import { Link } from "react-router";
import { BrandLockup } from "@/components/layout/BrandMark";
import { SECTIONS } from "@/lib/nav";

/** The approved line and the sections; nothing about where the data comes from. */
export const FOOTER_LINE =
  "Open roles from 48,000+ company career pages, updated through the day.";

const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex max-w-sm flex-col gap-3">
          <BrandLockup />
          <p className="text-small text-muted-foreground">{FOOTER_LINE}</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {SECTIONS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="text-small font-medium text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/about"
            className="text-small font-medium text-muted-foreground hover:text-foreground"
          >
            About
          </Link>
        </nav>
      </div>
      <div className="mx-auto w-full max-w-page px-gutter pb-8">
        <p className="text-xs text-muted-foreground">© {YEAR} Career Market</p>
      </div>
    </footer>
  );
}
