import { describe, expect, it } from 'vitest';
import {
  companySignal,
  hasKrillFilter,
  isFiltered,
  parseScreenerQuery,
  screenerHref,
  skillSlug,
  slugify,
} from '../src/screener.ts';

describe('parseScreenerQuery', () => {
  it('defaults to the companies mode sorted by open roles', () => {
    const q = parseScreenerQuery(new URLSearchParams(''));
    expect(q).toMatchObject({ mode: 'companies', sort: 'open', dir: 'desc', jobSort: 'newest', cursor: null });
    expect(isFiltered(q.filters)).toBe(false);
  });

  it('keeps known values and drops unknown or malformed ones', () => {
    const q = parseScreenerQuery(
      new URLSearchParams('mode=skills&region=europe&country=de&workMode=remote&level=staff&family=ai-ml&skill=ml:pytorch&growth=freezing&salary=USD:200000&posted=7&sort=change1w&dir=asc'),
    );
    expect(q.mode).toBe('skills');
    expect(q.filters).toEqual({
      region: 'europe',
      country: 'DE',
      workMode: 'remote',
      level: 'staff',
      family: 'ai-ml',
      skill: 'ml:pytorch',
      growth: null,
      salary: { currency: 'USD', min: 200000 },
      postedWithin: 7,
    });
    expect(q.sort).toBe('change1w');
    expect(q.dir).toBe('asc');

    const bad = parseScreenerQuery(
      new URLSearchParams("mode=evil&region=mars&country=USA&workMode=sometimes&family=a b&skill=<script>&salary=XXX:5&posted=4&sort=nope&cursor=a b"),
    );
    expect(bad.mode).toBe('companies');
    expect(isFiltered(bad.filters)).toBe(false);
    expect(bad.sort).toBe('open');
    expect(bad.cursor).toBeNull();
  });

  it('takes the first value of a repeated parameter', () => {
    expect(parseScreenerQuery({ country: ['us', 'de'] }).filters.country).toBe('US');
  });

  it('round-trips through screenerHref and leaves defaults out', () => {
    const q = parseScreenerQuery(new URLSearchParams('mode=professions&workMode=hybrid&salary=EUR:100000&sort=remote&dir=asc&jobs=salary'));
    expect(screenerHref(q)).toBe('/screener?mode=professions&workMode=hybrid&salary=EUR%3A100000&sort=remote&dir=asc&jobs=salary');
    expect(parseScreenerQuery(new URL(`http://x${screenerHref(q)}`).searchParams)).toEqual(q);
    expect(screenerHref({})).toBe('/screener');
  });

  it('applies growth in Companies mode only', () => {
    expect(parseScreenerQuery(new URLSearchParams('growth=freezing')).filters.growth).toBe('freezing');
    expect(parseScreenerQuery(new URLSearchParams('mode=professions&growth=freezing')).filters.growth).toBeNull();
    expect(parseScreenerQuery(new URLSearchParams('mode=skills&growth=freezing')).filters.growth).toBeNull();
    const href = screenerHref({ mode: 'skills', filters: { growth: 'freezing', workMode: 'remote' } });
    expect(href).toBe('/screener?mode=skills&workMode=remote');
    expect(screenerHref({ filters: { growth: 'freezing' } })).toBe('/screener?growth=freezing');
  });

  it('counts growth as a read-model filter, not a krill one', () => {
    const q = parseScreenerQuery(new URLSearchParams('growth=ramping'));
    expect(isFiltered(q.filters)).toBe(true);
    expect(hasKrillFilter(q.filters)).toBe(false);
  });
});

describe('companySignal', () => {
  it('needs enough days', () => {
    expect(companySignal(0.2, 6)).toBeNull();
    expect(companySignal(null, 30)).toBeNull();
  });
  it('maps the net change to a state', () => {
    expect(companySignal(0.04, 7)).toBe('ramping');
    expect(companySignal(0.03, 7)).toBe('ramping');
    expect(companySignal(0.01, 30)).toBe('steady');
    expect(companySignal(-0.03, 30)).toBe('cooling');
    expect(companySignal(-0.1, 30)).toBe('freezing');
    expect(companySignal(-0.4, 30)).toBe('freezing');
  });
});

describe('slugs', () => {
  it('makes readable page slugs', () => {
    expect(slugify('NVIDIA Corp.')).toBe('nvidia-corp');
    expect(slugify('Procter & Gamble')).toBe('procter-and-gamble');
    expect(slugify('C++')).toBe('c-plus-plus');
    expect(skillSlug('ml:pytorch')).toBe('pytorch');
  });
  it('keeps the namespace when a bare slug is taken', () => {
    expect(skillSlug('domain:etl', new Set(['etl']))).toBe('domain-etl');
  });
});
