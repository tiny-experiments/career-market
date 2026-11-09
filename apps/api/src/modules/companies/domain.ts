import type { z } from 'zod';
import type { IsoDay } from '@cm/core/dates';
import type { CompanyDirectoryRow, CompanyMover } from '@cm/core/company';
import type { companiesQuerySchema } from './schemas.ts';
import type { Page } from '../../database/paging.ts';
export type CompaniesQuery = z.infer<typeof companiesQuerySchema>;
export type CompaniesPage = Page<CompanyDirectoryRow>;
export interface CompanyReaders {
  ramping(asOf: IsoDay, limit: number): Promise<CompanyMover[]>;
}
