import type { Queries } from '../../../database/client.ts';
import { chrome } from '../repository.ts';
export function createMetaServices(deps: { queries: Queries }) {
  return Object.freeze({ overview: () => chrome(deps.queries) });
}
export type MetaServices = ReturnType<typeof createMetaServices>;
