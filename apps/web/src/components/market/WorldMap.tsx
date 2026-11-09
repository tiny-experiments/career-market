import { useMemo, useState } from "react";
import { formatCount, formatShare } from "@/lib/format";
import {
  WORLD_MAP_HEIGHT,
  WORLD_MAP_PATHS,
  WORLD_MAP_WIDTH,
} from "@/lib/worldMapPaths";
import { cn } from "@/lib/utils";

export interface MapCountry {
  readonly code: string;
  readonly name: string;
  readonly open: number;
  readonly share: number;
}

export interface WorldMapProps {
  readonly countries: readonly MapCountry[];
  /** The country lit from outside the map, e.g. its row in a table. */
  readonly highlight?: string | null;
  readonly className?: string;
}

/** Depth of shade, compressed so the US does not wash everyone else out. */
function shade(open: number, max: number): number {
  return 0.14 + 0.86 * Math.sqrt(open / max);
}

/** Open roles by country on a flat map; pointing at a country names it. */
export function WorldMap({ countries, highlight, className }: WorldMapProps) {
  const [point, setPoint] = useState<{
    readonly code: string;
    readonly x: number;
    readonly y: number;
  } | null>(null);
  const byCode = useMemo(
    () => new Map(countries.map((c) => [c.code, c])),
    [countries],
  );
  const max = Math.max(1, ...countries.map((c) => c.open));
  const active = point ? byCode.get(point.code) : undefined;
  const lit = point?.code ?? highlight ?? null;

  return (
    <div
      className={cn("relative", className)}
      onPointerLeave={() => setPoint(null)}
    >
      <svg
        viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
        role="img"
        aria-label={`World map of open tech roles. Most roles: ${countries
          .slice(0, 5)
          .map((c) => c.name)
          .join(", ")}.`}
        className="block h-auto w-full"
      >
        {Object.entries(WORLD_MAP_PATHS).map(([code, d]) => {
          const country = byCode.get(code);
          return (
            <path
              key={code}
              d={d}
              onPointerMove={(event) => {
                if (!country) return;
                const box =
                  event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                if (!box) return;
                setPoint({
                  code,
                  x: event.clientX - box.left,
                  y: event.clientY - box.top,
                });
              }}
              onPointerLeave={() => setPoint(null)}
              className={cn(
                "stroke-card transition-colors",
                country ? "fill-primary" : "fill-tile",
                lit === code && "fill-foreground",
              )}
              strokeWidth={0.5}
              style={
                country && lit !== code
                  ? { fillOpacity: shade(country.open, max) }
                  : undefined
              }
            />
          );
        })}
      </svg>
      {active && point ? (
        <div
          role="status"
          className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col gap-0.5 rounded-lg bg-popover px-3 py-2 text-small shadow-float"
          style={{ left: point.x, top: point.y - 12 }}
        >
          <span className="font-semibold">{active.name}</span>
          <span className="text-muted-foreground">
            {formatCount(active.open)} open roles · {formatShare(active.share)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
