import type { IsoDay } from '@cm/core/dates';
import type { Logger } from '@cm/core/logger';
import { krillJobPageSchema, type KrillJob } from '@cm/core/krillJob';
import type { Params } from './krill/client.ts';
import type { KrillApi } from './krill/api.ts';
import { computePayBands, toPaySample, type PayBandRow, type PaySample } from './compute/payBand.ts';

export const PAY_COUNTRY = 'US';
export const PAY_CURRENCY = 'USD';
/** Pages of 100 roles per profession (the newest roles that list pay). 5 pages = 500 roles. */
export const PAY_SAMPLE_PAGES = 5;
const PAGE_SIZE = 100;

export interface PulledPay {
  samples: number;
  bands: PayBandRow[];
}

/**
 * Samples the newest US roles that list USD pay, per profession, and computes
 * the pay bands. A profession whose pages fail on a krill error is skipped and
 * logged; the other professions still get their bands.
 */
export async function pullPayBands(api: KrillApi, families: readonly string[], log: Logger, pages = PAY_SAMPLE_PAGES): Promise<PulledPay> {
  const samples: PaySample[] = [];
  for (const family of families) {
    try {
      for (const job of await fetchPayJobs(api, family, pages)) {
        const s = toPaySample(job);
        if (s) samples.push(s);
      }
    } catch (err) {
      log.warn({ family, err: String(err) }, 'pay sample failed for profession; it gets no band today');
    }
  }
  const bands = computePayBands(samples);
  log.info({ samples: samples.length, bands: bands.length }, 'pay bands computed');
  return { samples: samples.length, bands };
}

async function fetchPayJobs(api: KrillApi, family: string, pages: number): Promise<KrillJob[]> {
  const params: Params = {
    family,
    country: PAY_COUNTRY,
    currency: PAY_CURRENCY,
    salaryMin: 1,
    sort: 'newest',
    pageSize: PAGE_SIZE,
  };
  const out: KrillJob[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < pages; page++) {
    // krill wants the filters again with every cursor.
    const res = (await api.client.get('/v1/jobs', { ...params, cursor }, krillJobPageSchema)).data;
    out.push(...res.items);
    if (!res.nextCursor || res.items.length === 0) break;
    cursor = res.nextCursor;
  }
  return out;
}

export function payBandRows(date: IsoDay, bands: readonly PayBandRow[]) {
  return bands.map((b) => ({
    date,
    family: b.family,
    specialty: b.specialty,
    level: b.level,
    country: PAY_COUNTRY,
    currency: PAY_CURRENCY,
    n: b.n,
    p25: b.p25,
    p50: b.p50,
    p75: b.p75,
  }));
}
