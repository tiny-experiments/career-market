import type { Queries } from '../../../database/client.ts';
import type { CompanyReaders } from '../../companies/domain.ts';
import { marketOverview } from '../repository.ts';
export function createMarketServices(deps: {
  queries: Queries;
  companies: CompanyReaders;
}) {
  return Object.freeze({
    overview: () => marketOverview(deps.queries, deps.companies),
  });
}
export type MarketServices = ReturnType<typeof createMarketServices>;
