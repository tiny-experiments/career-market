# UI rule book — `apps/web`

How we build the Career Market front end. A living document: add a rule when a decision repeats, instead of restating it in review.

**Read first, every time:**

1. `apps/web/src/index.css` — the tokens as they are. The file is the source of truth; this document explains it.
2. `/design` in the running app (development builds only: `pnpm web:dev`) — every token and component with realistic content, in both themes.
3. `apps/web/scripts/check-ui.mjs` — the rules a script can hold you to. `pnpm --filter @cm/web run check:ui` runs in CI.

The bar is CoinMarketCap, TradingView, Apple: full width, breathing room, bold where it matters, every figure explained on hover. Nothing here applies to `apps/web-next`, which is being replaced.

---

## 1. Non-negotiables

1. **No raw colour.** No hex, no `rgb()`, no Tailwind palette names (`bg-slate-800`, `text-red-500`) in app code. Only tokens: `bg-card`, `text-up`, `text-muted-foreground`.
2. **No magic numbers.** Spacing, radius and type come from the scales below. `p-[13px]` is a bug; name a token instead.
3. **One blue, one meaning.** `primary` is the single call to action on a page, the active underline and links. Up is green, down is red, warn is amber. Nothing else is coloured.
4. **shadcn first.** If shadcn/ui has it, we use it (vendored in `components/ui`). We change it through tokens and variants, never by hand-rolling a copy.
5. **Both themes, always.** The visitor's device picks the theme unless they choose one; every surface is checked in light before it is done.
6. **Never name the source.** No provider name, no table name, no pipeline word anywhere a visitor can read. The footer's line is the only sentence about where roles come from.
7. **Twice is a component.** The second time you write the same markup, extract it.
8. **Tokens > variants > className.** Change the token first, add a `cva` variant second, reach for a one-off `className` last.

---

## 2. Typography

Inter (variable, self-hosted) for everything; Geist Mono for codes (`SWE`, `AIML`) and formulas. Tabular figures are on for the whole body, so columns never jitter.

| Role        | Size / line | Weight | Tailwind                                           | Where                                |
| ----------- | ----------- | ------ | -------------------------------------------------- | ------------------------------------ |
| Display     | 38 / 42     | 800    | `text-display font-extrabold`                      | the headline figure on a detail page |
| H1          | 26 / 32     | 800    | `text-h1 font-extrabold`                           | page and section titles              |
| H2          | 18 / 24     | 700    | `text-h2 font-bold`                                | card and panel titles                |
| Body        | 15 / 22     | 400    | `text-body`                                        | prose, descriptions                  |
| Table       | 14 / 20     | 500    | `text-sm font-medium`                              | table cells, list rows               |
| Name        | 14 / 20     | 700    | `text-sm font-bold`                                | the name in a row                    |
| Small       | 13 / 18     | 400    | `text-small`                                       | secondary lines, footer              |
| Label       | 12 / 16     | 600    | `text-eyebrow font-semibold text-muted-foreground` | tile labels, table headers           |
| Code / mono | 12 / 16     | 600    | `font-mono text-eyebrow font-semibold`             | ticker codes, formulas               |

Rules:

- Headings are bold. The feedback was "scared to be bold": names are 700, titles 700–800, and size carries hierarchy.
- Each step carries its own line-height and tracking; `text-h1` is one class. New steps are tokens in `index.css`, registered in `lib/utils.ts` so `cn` can merge them.
- Prose caps at `max-w-2xl`. Tables and charts never do.
- Numbers always right-aligned; labels always left-aligned.

## 3. Spacing — 4 px base

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 · 64` (Tailwind `1 2 3 4 5 6 8 12 16`).

- **Inside a tile:** 12–16. **Between tiles:** 8–12. **Between cards:** 16. **Between page sections:** 32–48 (`PageContainer` sets `gap-8 lg:gap-12`).
- Lay out with flex/grid and `gap`. Never margin-stack siblings.
- Breathing room is part of a component (`PageHeader`, `Panel`, `MarketCard` carry their own padding), so pages never fight over it.

## 4. Layout

| Token                   | Value    | Class                         | Use                                                                      |
| ----------------------- | -------- | ----------------------------- | ------------------------------------------------------------------------ |
| `--container-page`      | 1920 px  | `max-w-page`                  | the fluid page column                                                    |
| `--spacing-gutter`      | 24 px    | `px-gutter`                   | page gutters; 16 px on a phone (below `md`)                              |
| `--spacing-nav`         | 56 px    | `h-nav`                       | the top bar                                                              |
| `--spacing-row`         | 52 px    | `h-row`                       | a table row                                                              |
| `--spacing-row-compact` | 40 px    | `h-row-compact`               | a list row inside a card                                                 |
| `--spacing-rows-min`    | 5 rows   | `min-h-rows-min` (`-compact`) | a Market card's list on desktop: at least five rows, then as many as fit |
| `--spacing-control`     | 32 px    | `h-control`                   | every toolbar control (buttons, selects, chips)                          |
| `--spacing-touch`       | 40 px    | `touch-target`, `h-touch`     | the smallest touch area; see §7                                          |
| `--spacing-rail`        | 320 px   | `w-rail`                      | a detail page's sticky side rail                                         |
| `--spacing-spark`       | 120 × 34 | `w-spark h-spark-h`           | a sparkline                                                              |

- **Fluid to 1920 px.** No 1600 px cap, no centred narrow column. Tables run edge to edge of the column (`-mx-gutter` when inside a padded container).
- **One level of navigation** (`SiteHeader`): the five sections. There is no sub-navigation anywhere. A section's views are filters on the table they change (`TableFilter`), placed directly on that table.
- **Active navigation is ink plus a 2 px underline that slides** (`UnderlineIndicator`). No filled pills anywhere in navigation.
- **Two surface levels, never three.** A card on the page; flat tinted tiles inside the card. Never a card inside a card inside a card.
- Detail pages: header with the facts rail, a full-width chart panel, then three panels on one row, then full-width tables.
- Works at 360 px and at 1920 px. Columns that do not fit hide below a breakpoint (`Column.from`); the body never scrolls sideways. A long name wraps or truncates, and a button whose label carries a name (the apply button) wraps on a phone instead of pushing the page wider. `pnpm web:test-phone` holds every page to this at 360, 375, 390 and 414 px in both themes.
- **A phone gets mini versions, not stacked cards.** Below `md` (`useIsMobile`), a page's market cards turn into one sideways row of `MiniStat` tiles and one of `MiniList` short lists (`MiniRow`, snapping tile by tile), filter chips stay on one line that scrolls, and the table starts on the first screen. A table row on a phone is rank, logo, name with its code under it, and the figure with the week's change under it (`Column.phoneLine`, `Column.phoneHeader`). A detail page's stat rail is the same `MiniRow` with its desktop grid as `className`. From `md` up nothing changes.

## 5. Shape and elevation

| Class          | Size  | Use                          |
| -------------- | ----- | ---------------------------- |
| `rounded-sm`   | 4 px  | checkboxes, kbd, focus rings |
| `rounded-md`   | 6 px  | small controls               |
| `rounded-lg`   | 8 px  | controls, tiles, inputs      |
| `rounded-xl`   | 12 px | cards, hover cards, dialogs  |
| `rounded-full` |       | pills, logos, dots           |

Elevation is one token, two themes:

- `shadow-card` — a card on the page. Light: a soft double shadow and no border. Dark: a 1 px hairline (`--border`) and no shadow.
- `shadow-float` — hover cards, popovers, menus. Light: a deeper shadow. Dark: hairline plus shadow.
- Tiles inside a card are flat `bg-tile` with no border and no shadow.
- Never a border and a heavy shadow on the same element.

## 6. File structure

```
apps/web/src/
  components/
    ui/        shadcn primitives. Vendored (kebab-case). Edit via tokens and variants, not internals.
    layout/    SiteHeader, TopNav, SearchBox, GlobalSearch, ThemeToggle, Footer, TickerStrip, PageContainer, PageHeader
    data/      DataTable, Pager, Sparkline, AreaChart, ChartTooltip, Delta, SignalBadge, ShareBar, Logo, StatCard, KpiTile, SegmentBar, Legend, MarketCard, RankedList, Panel, TablePanel, BreakdownList, RangeTabs, ChangeCell, ListSearch, PagedRankedCard, TableFilter, MiniStat, MiniList, MiniRow
    market/    the Market and Professions pieces: MarketStatusCard, HiringIndexPanel, ProfessionListCard, CompaniesRampingCard, MarketMiniBoard, MarketRankedItems, ProfessionsBoard, ProfessionsTable, WhereJobsPanel, WorldMap
    professions/  the profession detail page: ProfessionHeader, ProfessionChartPanel, ProfessionPanels, ProfessionTables
    common/    EmptyState, ErrorState, NotFoundState, MetricHoverCard, Chip, ResourceView, PageSkeleton, RouteErrorPage, RouteFallback
    jobs/      JobsTable, RolesTable, JobsPulseStrip, JobsQuickFilters, JobFiltersRail, CompanyFilter, VerdictCard, TypicalWindowBar, JobView, JobPosting, JobRail panels, ClosedJob
    companies/ the Companies and Company pages' tables, market cards and panels
    skills/    the Skills and Skill pages' tables, market cards and panels
  content/     every customer-facing sentence: metrics (hover cards), phrasing, jobs, site (titles, About, footer), states
  hooks/       useResource, usePagedList, useListSearch, useListSort, useSiteSearch, usePrefetching, useSlidingIndicator, useElementWidth, useChartScrub, useDataDay, useIsMobile
  lib/         utils (cn), format, nav, logo, paging, charts, failure, listFilters, skillViews, redirects, prefetch
  lib/api/     client (request<T>, ApiError), resource (the shared cache), one file per API module, types
  layouts/     RootLayout
  pages/       route components: assembly only. pages/design holds the /design chapters.
  index.css    the tokens
  routes.ts    the page map: each page's address, chunk and the data it reads
  router.tsx   the route tree built from it, plus redirects from old addresses
```

- One component per file, PascalCase, named after the component. Barrel `index.ts` per folder.
- Pages assemble; they do not style. Layout Tailwind beyond a little belongs in a component.
- Formatters live in `lib/format.ts`. Never format a number inline.
- A page reads through `useResource(read)` or `usePagedList(list, filters)` and draws the result with `ResourceView`. A read a page needs goes in its `data` in `routes.ts` too, with the same arguments, so it starts with the chunk and on hover.
- Tests live in `apps/web/test`, mirroring `src`; `test/support/renderWithRouter.tsx` gives a component the router and providers the shell gives it.

## 7. Component rules

- **Props speak the domain.** `<SignalBadge signal="ramping" />`, not `<Badge variant="up">Ramping</Badge>` in a page.
- **Never wrap a primitive just to set defaults.** No `PrimaryButton`. Add a variant to `buttonVariants`.
- **Variants use `cva`**, typed with `VariantProps`. Colour decisions live in the variant map.
- **Presentational by default.** Components take data and callbacks; fetching lives in hooks and pages.
- **`asChild`** for composition (`<Button asChild><Link/></Button>`).
- Every reusable component accepts `className` and merges it with `cn()`.
- Interactive elements have a visible focus ring (the primary ring), an accessible name that contains their visible text, and a hit area of at least 24 px (`MetricHoverCard`'s (i) grows its own with a negative margin).
- **On a touch screen every control is at least 40 px to hit.** `touch-target` (in `index.css`) adds an invisible 40 px `::before` centred on a smaller control under `pointer: coarse`, so nothing moves and a mouse sees no change; the control must be `relative`. `Button`, `Toggle`, `TabsTrigger`, `SelectTrigger` and `MetricHoverCard` carry it already; add it to a small text link. Stacked rows on a phone are tall enough on their own (`h-row-compact`), and a chip row that scrolls keeps 4 px above and below so the touch areas are not clipped (`PHONE_CHIP_ROW`).
- Never nest one control in another: a hover trigger sits beside a link, not inside it.
- `index.css` ends with a `prefers-reduced-motion` rule that settles every transition and animation at once; nothing needs its own.
- **Never write `cursor-pointer` by hand.** The base rule in `index.css` gives the hand to every enabled control by role.

### When to use which

| Need                                             | Use                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Move between the five sections                   | `TopNav` (from `SECTIONS`); never add a sixth                                                                                        |
| Filter a section's main table (growing, remote…) | `TableFilter` on the table, labels in plain words, one line saying what it shows; the choice is a query parameter (`useTableFilter`) |
| Tabs inside a page (Chart · Companies · Skills)  | `Tabs` with `TabsList variant="underline"`                                                                                           |
| A chart's range (1W 1M 3M 1Y All)                | `RangeTabs` (segmented)                                                                                                              |
| Toggle several filters above a table             | `Chip` row, or `ToggleGroup variant="chip"`; the chosen chip is the one blue tint                                                    |
| A filter rail's controls                         | `Input`, `Select`, `Checkbox`, `RadioGroup`, `ToggleGroup`, `Switch`                                                                 |
| A change that may not exist yet in a table cell  | `ChangeCell` (the figure, or a quiet dash)                                                                                           |
| A ranked list of things with their change        | `DataTable` (full width, 52 px rows) or `RankedList` inside a card                                                                   |
| Many pages of rows                               | `Pager`, 50 a page, every control a link                                                                                             |
| A home-page door into a section                  | `MarketCard` (header is the link, optional pager)                                                                                    |
| A section of a detail page                       | `Panel`                                                                                                                              |
| A full-width table on a detail page              | `TablePanel` around a `DataTable`                                                                                                    |
| The parts of something, with a bar each          | `BreakdownList`                                                                                                                      |
| A fact on a detail page's rail                   | `StatCard`                                                                                                                           |
| A small fact inside a market card                | `KpiTile`                                                                                                                            |
| A card's headline, shrunk for a phone            | `MiniStat` in a `MiniRow` (label, figure, small change or caption, the (i) beside it)                                                |
| A ranked card shrunk for a phone                 | `MiniList` in a `MiniRow`: the title opens the full list, three rows under it                                                        |
| A change                                         | `Delta` (text in a cell, pill beside a headline)                                                                                     |
| A company's hiring signal                        | `SignalBadge`                                                                                                                        |
| A share of a whole                               | `ShareBar` under the percentage; `SegmentBar` for parts                                                                              |
| Explain what a figure means                      | `MetricHoverCard` (the only explanation surface)                                                                                     |
| Name an icon                                     | `Tooltip`                                                                                                                            |
| A company, skill or profession mark              | `Logo` (round for companies, square for the rest)                                                                                    |
| Nothing to show / something broke / loading      | `EmptyState` / `ErrorState` / `Skeleton` rows                                                                                        |
| A job's read                                     | `VerdictCard` first, one `Button size="lg"` to apply                                                                                 |
| A list of jobs anywhere on the site              | `JobsTable`, fed through `lib/jobRows`                                                                                               |

## 8. Using shadcn

shadcn owns **behaviour**: overlays, focus, keyboard, portals, form controls. We own the market pieces that are plain markup and SVG: tables' row links, sparklines, charts, the ticker.

- Vendored files import `cn` from `@/lib/utils`, never from the `cn` package directly: only ours knows the type and layout tokens.
- `shadcn add --overwrite` clobbers local edits. Patched for this repo: `card.tsx` (`shadow-card`, bold `CardTitle`), `hover-card.tsx` (320 wide, 14 px padding, arrow, instant), `tabs.tsx` (`underline` list variant), `badge.tsx` (`up` `down` `flat` `warn` `code` variants and a `md` size), `button.tsx` (`chip` variant, `relative touch-target`), `progress.tsx` (`indicatorClassName`), `sonner.tsx` (strict TS), `toggle.tsx` (`chip` variant, `relative touch-target`), `tabs.tsx` and `select.tsx` triggers (`touch-target`). Re-add any of them and re-apply.
- Arbitrary values inside `components/ui` are shadcn's own and are allow-listed in `scripts/check-ui.allowlist.json`; ours are not.
- shadcn Charts (Recharts) are not used: sparklines, area and segment charts are hand-drawn SVG (`lib/charts.ts`), smaller and under our control.

## 9. Data display and copy

The feedback that shaped these rules: "1.3% since November 3" sounds machine-written, footnotes and method text clutter the page, and a visitor should hover to learn how a number is made.

- **A change is a caret, a number and the comparison in words**: `▲ 1.3% this week`. Never a date as a qualifier ("since 3 Nov"), never an asterisk, never a footnote.
- **The method lives in the hover card, in one sentence, about what the number is**: "How much open roles have grown or shrunk compared with a week ago." Never a formula, never how the data is gathered, never where it comes from, never how often it refreshes, never how long we have had it.
- **No timestamps in the chrome.** No "Updated 06:14 UTC", no "as of", no refresh rhythm. The footer's line is the only sentence about freshness.
- **A change names a real window.** A 7-day or 30-day figure shows only once its window nearly covers that span (`fullWindow` in `@cm/core/changes`); until then the cell is a dash.
- **Never state the total number of companies.** Per-profession and per-signal counts are fine; a grand total is not.
- **A series is one solid line.** No estimated-history styling and no caveat sentence under the chart.
- **Every trend chart reads its day and value on hover or tap**, through `ChartTooltip` and `useChartScrub`; `AreaChart` also carries a labelled value axis. A sparkline is dated by passing `end`, the site's day from `useDataDay`, so a page that draws one loads `siteMeta()` in its route data.
- **Pay is a range**, `$144K–$157K`, and its method ("the middle half of listed pay for senior roles in the United States") is a hover card. No "estimated base pay" labels.
- **Whole figures with separators** (`99,923`), **percentages with one decimal** for changes and none for shares, **units after numbers** (`38 days`).
- **The row is the link.** A name in a table is bold text inside the row link, never a bare blue link. The link is named by what it shows (no `aria-label` that drops the visible words), and a `Logo` is hidden from assistive tech because the name beside it does the naming. A job row opens our job page; the only outbound link on the site is the apply button.
- **Links say where they go in words**: "See all 1,240 jobs", not "See all rows in screener".
- **A company-scoped Jobs link carries the company's slug**, which no other company shares (`/jobs?company=acme`); the name is a fallback only for a company with no slug. The chip reads the name from `filterCompany` in the `/api/jobs` response.
- **Empty states say what to do**: "No jobs match these filters. Try widening the region." **Error states say what broke and offer a retry**: "Companies could not be loaded." Never an API code.
- **Every status carries a word**, never a bare coloured dot.
- **Words live in `src/content`.** Hover-card sentences (`METRICS`), comparisons (`describeChange`, `changeSuffix`), counts and links (`seeAll`, `showing`), page titles and meta (`PAGES`), empty and error states (`EMPTY`, `ERROR`), the verdict (`verdictSummary`) and the About page (`ABOUT`). A page imports a sentence; it never writes one inline.
- **Retired words.** `check:ui` fails on `krill` anywhere in `src`, and on `survival`, `back-cast`, `estimated` or `bootstrap` in any string literal, JSX text or `index.html`. They describe the method; say what the figure is instead.

## 10. Definition of done

- [ ] Dark and light both checked, on `/design` (`pnpm web:dev`) if a component is new
- [ ] No hex, no palette names, no arbitrary values, no provider names (`check:ui` clean)
- [ ] Works at 360 px and at 1920 px; no sideways scroll (`pnpm web:test-phone`); every control 40 px to hit on a touch screen
- [ ] Keyboard reachable, focus visible, every control named
- [ ] Loading, empty and error states exist
- [ ] Figures through `lib/format.ts`; changes through `Delta`; explanations through `MetricHoverCard`
- [ ] Nothing duplicated that should be a component; nothing hand-rolled that shadcn provides
- [ ] `pnpm --filter @cm/web run typecheck && pnpm --filter @cm/web run lint && pnpm --filter @cm/web run test && pnpm --filter @cm/web run check:ui` clean

---

## Changelog

- **2026-11-09** — First version, with the design system: tokens in `index.css` (dark default, light), shadcn/ui vendored and customised through variants, the shell (`SiteHeader` with sliding underline, `SubBar` from route handles, `SearchBox`, `Footer`, `TickerStrip`), the market components (`DataTable`, `MarketCard`, `KpiTile`, `Gauge`, `RankedList`, `Sparkline`, `AreaChart`, `Delta`, `SignalBadge`, `MetricHoverCard`, `Logo`, `Pager`, `StatCard`, `Panel`), `/design`, and `check:ui`.
- **2026-11-09** — Market and Professions pages. `AreaChart` follows the pointer when given `formatValue`; `RankedList` has a `comfortable` density and an optional `trend`; `DataTable` reports row hover; sub-bar tabs carry `region` along.
- **2026-11-09** — Jobs, job page and search built; `DataTable` columns can hide below `2xl`; `PageHeader` takes an `eyebrow`; `--spacing-chrome` and `--spacing-rail-h` size a sticky rail under the nav.
- **2026-11-09** — `/design` is development builds only; a series is one solid line (estimated-history styling removed).
- **2026-11-09** — Copy module `src/content` (hover-card sentences, comparison phrasing, page titles and meta, states, About, footer line); time and money formatters in `lib/format.ts`; `check:ui` gains the retired-word rule.
- **2026-11-09** — Companies and Skills pages: `BreakdownList`, `ChangeCell`, `ListSearch`, `PagedRankedCard`, `RolesTable`, and `DataTable`'s `inset` for tables inside cards.
- **2026-11-09** — Final review: AA contrast for `muted-foreground`, `up`, `down`, `warn` in both themes; reduced-motion rule; row links named by their content and `Logo` decorative; 24 px hover-card triggers; `PageSkeleton` `market` variant; ranked-card sparklines only from `xl`; Jobs company links carry the company's slug (its name only when it has none) and the filter chip shows the name the API returns as `filterCompany`.
- **2026-11-10** — Feedback round 1: the sub-bar is gone; each section's views are `TableFilter` chips on its own table, labelled in plain words with a line saying what they show (old `?view=` and `?signal=` addresses still open the matching filter). `Gauge` removed: the Tech Hiring Index is the figure, its week change and a 30-day line (`HiringIndexPanel`); Hiring signals is a sentence and a hiring-more against hiring-less bar. `KpiTile` takes a `caption` and a small picture. GDPR and other compliance items are never listed as skills (`NON_TECHNICAL_SKILLS` in `@cm/core/codes`).
- **2026-11-10** — Every trend chart reads its day and value on hover or tap: `ChartTooltip` and `useChartScrub` are shared by `AreaChart`, `Sparkline` and the market flow bars; `AreaChart` gains a value axis; sparklines are dated from the site's day (`useDataDay`, `daysEndingOn` and `datedSeries` in `lib/charts.ts`). Before and after shots are in `docs/screenshots/charts-1`.
- **2026-11-10** — Theme follows the visitor's device by default (live when the device switches); the `ThemeToggle` menu has Light, Dark and System, and only an explicit Light or Dark pick is stored. Rule 5 no longer calls dark the default.
- **2026-11-10** — Mobile: below `md` the cards turn into mini versions (`MiniStat`, `MiniList`, `MiniRow`, `useIsMobile`) on Market, Professions, Companies, Skills, Jobs and the job page; detail stat rails slide sideways; filter chips stay on one scrolling line; table rows are rank, logo, name over code, figure over the week's change (`Column.phoneLine`, `phoneHeader`); 16 px gutters on a phone. Tablet and desktop unchanged.
- **2026-11-10** — Phone QA: the job page's apply button no longer pushes the page sideways (it takes the row and wraps on a phone); `touch-target` and `--spacing-touch` give every small control a 40 px touch area; detail titles keep their code beside or under the name; `pnpm web:test-phone` (Playwright, recorded API fixtures, in CI) fails when any page is wider than a 360, 375, 390 or 414 px screen. Before and after shots are in `docs/screenshots/mobile-qa-1`.
