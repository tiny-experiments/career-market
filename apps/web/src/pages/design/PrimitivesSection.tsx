import { Bell, Download, Inbox, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Chip,
  EmptyState,
  ErrorState,
  MetricHoverCard,
} from "@/components/common";
import { Delta, Pager, RangeTabs, SignalBadge } from "@/components/data";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DesignSection, Example } from "@/pages/design/DesignSection";

const RANGES = [
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "All" },
] as const;

type Range = (typeof RANGES)[number]["value"];

const CHIPS = [
  "All",
  "Gaining",
  "Cooling",
  "Remote-friendly",
  "Best paid",
] as const;

export function PrimitivesSection() {
  const [range, setRange] = useState<Range>("3m");
  const [chip, setChip] = useState<(typeof CHIPS)[number]>("All");
  const [posted, setPosted] = useState("7d");

  return (
    <DesignSection
      id="primitives"
      title="Controls and states"
      description="shadcn/ui primitives on our tokens: one primary per page, 32 px controls, 8 px radius, underlines for navigation and tiles for segments. Loading, empty and error are designed states."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <Example
          title="Buttons"
          note="The blue is for the one call to action on a page. Everything else is outline or ghost."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">Apply on company site</Button>
            <Button>Default</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="outline" size="sm">
              <Download />
              Export
            </Button>
            <Button variant="ghost" size="icon" aria-label="Alerts">
              <Bell />
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Example>

        <Example
          title="Badges, deltas and signals"
          note="A change is a caret, a number and the comparison in words. A signal is a word in its colour."
        >
          <div className="flex flex-wrap items-center gap-3">
            <Delta value={0.013} suffix="this week" variant="pill" />
            <Delta value={-0.049} variant="pill" />
            <Delta value={0} variant="pill" />
            <Delta value={0.037} />
            <Delta value={-0.007} />
            <Delta value={0} />
            <SignalBadge signal="ramping" />
            <SignalBadge signal="steady" />
            <SignalBadge signal="cooling" />
            <SignalBadge signal="freezing" />
            <Badge variant="code">SWE</Badge>
            <Badge variant="code">AIML</Badge>
            <Badge variant="outline">Remote</Badge>
            <Badge variant="secondary">Senior</Badge>
          </div>
        </Example>

        <Example
          title="Filter chips and segmented ranges"
          note="Chips filter a table; the segmented control picks a chart's range."
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((label) => (
                <Chip
                  key={label}
                  pressed={chip === label}
                  onClick={() => setChip(label)}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <RangeTabs value={range} onChange={setRange} options={RANGES} />
              <ToggleGroup
                type="single"
                variant="outline"
                spacing={0}
                value={posted}
                onValueChange={(value) => value && setPosted(value)}
                aria-label="Posted within"
              >
                <ToggleGroupItem value="1d">1d</ToggleGroupItem>
                <ToggleGroupItem value="7d">7d</ToggleGroupItem>
                <ToggleGroupItem value="14d">14d</ToggleGroupItem>
                <ToggleGroupItem value="30d">30d</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </Example>

        <Example
          title="Page tabs"
          note="Underline variant of shadcn Tabs for tabs inside a page; the sub-bar above uses the same line."
        >
          <Tabs defaultValue="chart">
            <TabsList variant="underline">
              <TabsTrigger value="chart">Open roles</TabsTrigger>
              <TabsTrigger value="companies">Companies</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="jobs">Latest jobs</TabsTrigger>
            </TabsList>
            <TabsContent
              value="chart"
              className="pt-3 text-small text-muted-foreground"
            >
              The chart with its range control sits here.
            </TabsContent>
            <TabsContent
              value="companies"
              className="pt-3 text-small text-muted-foreground"
            >
              The companies table sits here.
            </TabsContent>
            <TabsContent
              value="skills"
              className="pt-3 text-small text-muted-foreground"
            >
              The skills table sits here.
            </TabsContent>
            <TabsContent
              value="jobs"
              className="pt-3 text-small text-muted-foreground"
            >
              The latest jobs sit here.
            </TabsContent>
          </Tabs>
        </Example>

        <Example
          title="Filter rail controls"
          note="Everything a Jobs filter needs: field, select, checkboxes, radios, a switch."
        >
          <div className="grid gap-4 rounded-xl bg-card p-4 shadow-card sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ds-company">Company</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="ds-company"
                  placeholder="Type a company name"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ds-region">Region</Label>
              <Select defaultValue="worldwide">
                <SelectTrigger id="ds-region" className="w-full">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="worldwide">Worldwide</SelectItem>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="eu">Europe</SelectItem>
                  <SelectItem value="in">India</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <fieldset className="grid gap-2.5">
              <legend className="mb-2 text-sm font-medium">Work mode</legend>
              {["Remote", "Hybrid", "On-site"].map((mode, index) => (
                <div key={mode} className="flex items-center gap-2.5">
                  <Checkbox
                    id={`ds-mode-${mode}`}
                    defaultChecked={index === 0}
                  />
                  <Label htmlFor={`ds-mode-${mode}`} className="font-normal">
                    {mode}
                  </Label>
                </div>
              ))}
            </fieldset>
            <fieldset className="grid gap-2.5">
              <legend className="mb-2 text-sm font-medium">Seniority</legend>
              <RadioGroup defaultValue="senior">
                {["Any", "Mid", "Senior", "Staff and above"].map((level) => (
                  <div key={level} className="flex items-center gap-2.5">
                    <RadioGroupItem
                      id={`ds-level-${level}`}
                      value={level.toLowerCase()}
                    />
                    <Label
                      htmlFor={`ds-level-${level}`}
                      className="font-normal"
                    >
                      {level}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </fieldset>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch id="ds-pay" defaultChecked />
              <Label htmlFor="ds-pay" className="font-normal">
                Only roles that list pay
              </Label>
            </div>
          </div>
        </Example>

        <Example
          title="Hover card and tooltip"
          note="A hover card explains a figure in one sentence. A tooltip only names an icon."
        >
          <div className="flex flex-wrap items-center gap-6 rounded-xl bg-card p-4 shadow-card">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              7-day change
              <MetricHoverCard
                title="7-day change"
                formula="open roles now ÷ open roles a week ago − 1"
              >
                Change in open roles compared with a week ago.
              </MetricHoverCard>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              Pay range
              <MetricHoverCard title="Pay range (US)">
                The middle half of listed pay for senior roles in the United
                States.
              </MetricHoverCard>
            </span>
            <MetricHoverCard
              title="Open roles"
              trigger={
                <span className="text-sm font-medium underline decoration-dotted underline-offset-4">
                  Hover the label itself
                </span>
              }
            >
              Open tech roles across 48,000+ company career pages.
            </MetricHoverCard>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Alerts">
                  <Bell />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Alerts</TooltipContent>
            </Tooltip>
            <span className="text-small text-muted-foreground">
              Press <Kbd>/</Kbd> to search
            </span>
          </div>
        </Example>

        <Example
          title="Pager and crumbs"
          note="Every control a real link; 50 a page."
        >
          <div className="flex flex-col gap-4 rounded-xl bg-card p-4 shadow-card">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/professions">
                    Professions
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Software Engineering</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <Pager
              page={2}
              pageCount={366}
              hrefFor={(page) => `/companies?page=${page}`}
            />
          </div>
        </Example>

        <Example
          title="Loading, empty, error, notice"
          note="Skeletons match the real geometry; empty says what to do; error says what broke and offers a retry."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-card">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            <Alert>
              <Inbox />
              <AlertTitle>Pay is shown where the posting lists it</AlertTitle>
              <AlertDescription>
                Roles without a listed range still count towards open roles.
              </AlertDescription>
            </Alert>
            <EmptyState
              icon={Inbox}
              title="No jobs match these filters"
              description="Try widening the region or clearing a work mode."
              action={
                <Button variant="outline" size="sm">
                  Clear filters
                </Button>
              }
              className="rounded-xl bg-card shadow-card"
            />
            <ErrorState
              title="Companies could not be loaded"
              onRetry={() => toast.success("Link copied")}
              className="rounded-xl bg-card shadow-card"
            />
          </div>
        </Example>
      </div>
    </DesignSection>
  );
}
