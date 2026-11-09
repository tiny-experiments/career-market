import type { CountryRow } from '@cm/core/types';
import { geoCentroid, geoNaturalEarth1, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import countries from 'i18n-iso-countries';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';

const WIDTH = 640;
const HEIGHT = 300;

/** Where to put a country's glow when its centroid falls somewhere odd (overseas territories). */
const ANCHORS: Record<string, [number, number]> = {
  US: [-98, 39],
  CA: [-100, 56],
  FR: [2.4, 46.6],
  NL: [5.3, 52.2],
  NO: [9, 61],
  RU: [60, 56],
  GB: [-1.8, 52.8],
  IN: [79, 22],
  CN: [104, 34],
};

type Topo = Topology<{ countries: GeometryCollection<{ name: string }> }>;

const topo = world as unknown as Topo;
const shapes = feature(topo, topo.objects.countries).features.filter((f) => f.id !== '010'); // no Antarctica
const projection = geoNaturalEarth1().fitExtent(
  [
    [4, 4],
    [WIDTH - 4, HEIGHT - 4],
  ],
  { type: 'FeatureCollection', features: shapes } as GeoPermissibleObjects,
);
const pathFor = geoPath(projection);
const shapePaths = shapes.map((f) => ({ id: String(f.id), d: pathFor(f) ?? '', geo: f }));

/** World map shaded by open roles, with a glow on the leading countries. Server-rendered SVG. */
export function WorldMap({ rows, highlight }: { rows: CountryRow[]; highlight: number }) {
  const byNumeric = new Map<string, CountryRow>();
  for (const r of rows) {
    const numeric = countries.alpha2ToNumeric(r.code);
    if (numeric) byNumeric.set(numeric, r);
  }
  const max = Math.max(1, ...rows.map((r) => r.open));
  const level = (open: number) => Math.min(1, Math.sqrt(open / max));

  const glows = rows.slice(0, highlight).flatMap((r, i) => {
    const numeric = countries.alpha2ToNumeric(r.code);
    const shape = shapePaths.find((s) => s.id === numeric);
    const lonLat = ANCHORS[r.code] ?? (shape ? geoCentroid(shape.geo) : null);
    const xy = lonLat ? projection(lonLat as [number, number]) : null;
    if (!xy) return [];
    const radius = 3 + 9 * Math.sqrt(r.open / max);
    return [{ code: r.code, x: xy[0], y: xy[1], r: radius, rank: i }];
  });

  const top = rows.slice(0, highlight).map((r) => r.name).join(', ');
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="worldmap" role="img" aria-label={`World map of open tech roles. Most roles: ${top}.`}>
      <defs>
        <radialGradient id="map-glow">
          <stop offset="0" stopColor="var(--map-glow)" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="var(--map-glow)" stopOpacity="0.45" />
          <stop offset="1" stopColor="var(--map-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="map-land">
        {shapePaths.map((s) => {
          const row = byNumeric.get(s.id);
          return (
            <path key={s.id} d={s.d} style={row ? { fillOpacity: 0.12 + 0.78 * level(row.open) } : undefined} className={row ? 'has-roles' : undefined}>
              {row && <title>{`${row.name}: ${row.open.toLocaleString('en-US')} open roles`}</title>}
            </path>
          );
        })}
      </g>
      <g className="map-glows" aria-hidden="true">
        {glows.map((g) => (
          <g key={g.code}>
            <circle cx={g.x} cy={g.y} r={g.r * 2.6} fill="url(#map-glow)" />
            <circle cx={g.x} cy={g.y} r={Math.max(2.5, g.r * 0.42)} className="map-dot" />
          </g>
        ))}
      </g>
    </svg>
  );
}
