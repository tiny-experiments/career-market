import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { JobFiltersState } from "@/hooks";
import type { JobFacet } from "@/lib/api";
import { formatCount } from "@/lib/format";
import {
  COUNTRY_TOP,
  countryName,
  facetsOf,
  POSTED_OPTIONS,
  REGION_OPTIONS,
  SENIORITY_OPTIONS,
  toggled,
  WORK_MODE_OPTIONS,
} from "@/lib/jobFilters";
import { cn } from "@/lib/utils";
import { CompanyFilter } from "./CompanyFilter";

const TYPING_PAUSE_MS = 350;
const PROFESSIONS_SHOWN = 6;
const ANYWHERE = "anywhere";

function Group({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-eyebrow font-semibold text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  );
}

function CheckRow({
  id,
  label,
  count,
  checked,
  onToggle,
}: {
  readonly id: string;
  readonly label: string;
  readonly count?: number | undefined;
  readonly checked: boolean;
  readonly onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={onToggle} />
      <Label htmlFor={id} className="min-w-0 flex-1 truncate font-normal">
        {label}
      </Label>
      {count === undefined ? null : (
        <span className="text-xs text-muted-foreground">
          {formatCount(count)}
        </span>
      )}
    </div>
  );
}

/** A text box whose value reaches the address once the typing pauses. */
function PausedInput({
  value,
  onCommit,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  readonly value: string;
  readonly onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [committed, setCommitted] = useState(value);
  // The address moved on its own (a cleared chip, the back button): follow it.
  if (value !== committed) {
    setCommitted(value);
    setDraft(value);
  }
  useEffect(() => {
    if (draft === committed) return;
    const timer = setTimeout(() => onCommit(draft), TYPING_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [draft, committed, onCommit]);

  return (
    <Input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

/** Every way to narrow the list. All of it lives in the address. */
export function JobFiltersRail({
  filters,
  facets,
  companyName,
  className,
}: {
  readonly filters: JobFiltersState;
  readonly facets: readonly JobFacet[] | undefined;
  readonly companyName: string | null;
  readonly className?: string;
}) {
  const { params, update } = filters;
  const [allProfessions, setAllProfessions] = useState(false);

  const families = facetsOf(facets, "family");
  const countries = facetsOf(facets, "country").slice(0, COUNTRY_TOP);
  const chosenFamilies = (params.get("family") ?? "").split(",");
  const chosenModes = (params.get("mode") ?? "").split(",");
  const chosenLevels = (params.get("level") ?? "").split(",");
  // A chosen profession is never tucked away behind "Show all".
  const chosenLower = families
    .slice(PROFESSIONS_SHOWN)
    .some((family) => chosenFamilies.includes(family.value));
  const shownFamilies =
    allProfessions || chosenLower
      ? families
      : families.slice(0, PROFESSIONS_SHOWN);

  const region = params.get("region");
  const country = params.get("country");
  const place = region
    ? `region:${region}`
    : country
      ? `country:${country}`
      : ANYWHERE;
  const posted = params.get("posted");

  return (
    <Card className={cn("py-4", className)}>
      <CardContent className="flex flex-col gap-5">
        <Group title="Keyword">
          <PausedInput
            aria-label="Job title or keyword"
            placeholder="Title or keyword"
            maxLength={80}
            value={params.get("q") ?? ""}
            onCommit={(value) => update({ q: value.trim() || null })}
          />
        </Group>

        <Group title="Company">
          <CompanyFilter
            value={params.get("company")}
            label={companyName}
            onChange={(company) => update({ company })}
          />
        </Group>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="jobs-remote" className="font-medium">
              Remote only
            </Label>
            <Switch
              id="jobs-remote"
              checked={params.get("mode") === "remote"}
              onCheckedChange={(on) => update({ mode: on ? "remote" : null })}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="jobs-pay" className="font-medium">
              Pay listed
            </Label>
            <Switch
              id="jobs-pay"
              checked={params.get("pay") === "listed"}
              onCheckedChange={(on) => update({ pay: on ? "listed" : null })}
            />
          </div>
        </div>

        <Group title="Profession">
          {shownFamilies.map((family) => (
            <CheckRow
              key={family.value}
              id={`jobs-family-${family.value}`}
              label={family.label ?? family.value}
              count={family.count}
              checked={chosenFamilies.includes(family.value)}
              onToggle={() =>
                update({ family: toggled(params.get("family"), family.value) })
              }
            />
          ))}
          {families.length > PROFESSIONS_SHOWN && !chosenLower ? (
            <Button
              variant="ghost"
              size="xs"
              className="-ml-2 w-fit text-muted-foreground"
              onClick={() => setAllProfessions((all) => !all)}
            >
              {allProfessions ? "Show fewer" : `Show all ${families.length}`}
            </Button>
          ) : null}
        </Group>

        <Group title="Location">
          <Select
            value={place}
            onValueChange={(value) => {
              const [kind, code] = value.split(":");
              update({
                region: kind === "region" ? (code ?? null) : null,
                country: kind === "country" ? (code ?? null) : null,
              });
            }}
          >
            <SelectTrigger aria-label="Location" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANYWHERE}>Anywhere</SelectItem>
              <SelectGroup>
                <SelectLabel>Regions</SelectLabel>
                {REGION_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={`region:${option.value}`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              {countries.length > 0 ? (
                <SelectGroup>
                  <SelectLabel>Countries</SelectLabel>
                  {countries.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={`country:${option.value}`}
                    >
                      {countryName(option.value)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : null}
            </SelectContent>
          </Select>
        </Group>

        <Group title="Work mode">
          {WORK_MODE_OPTIONS.map((option) => (
            <CheckRow
              key={option.value}
              id={`jobs-mode-${option.value}`}
              label={option.label}
              checked={chosenModes.includes(option.value)}
              onToggle={() =>
                update({ mode: toggled(params.get("mode"), option.value) })
              }
            />
          ))}
        </Group>

        <Group title="Seniority">
          {SENIORITY_OPTIONS.map((option) => (
            <CheckRow
              key={option.value}
              id={`jobs-level-${option.value}`}
              label={option.label}
              checked={chosenLevels.includes(option.value)}
              onToggle={() =>
                update({ level: toggled(params.get("level"), option.value) })
              }
            />
          ))}
        </Group>

        <Group title="Posted within">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            className="w-full"
            value={posted ?? ""}
            onValueChange={(value) => update({ posted: value || null })}
          >
            {POSTED_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={option.name}
                className="flex-1"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Group>

        <Group title="Salary from">
          <PausedInput
            aria-label="Lowest yearly salary, in US dollars"
            inputMode="numeric"
            placeholder="$150,000"
            value={params.get("salary") ?? ""}
            onCommit={(value) => {
              const amount = value.replace(/[^\d]/g, "");
              update({ salary: amount || null });
            }}
          />
        </Group>
      </CardContent>
    </Card>
  );
}
