import type { Queries } from '../../../database/client.ts';
import { notFound } from '../../../http/errors.ts';
import type { ProfessionRegionId } from '@cm/core/professions';
import { professionIndex, professionPage } from '../repository.ts';
export function createProfessionsServices(deps: { queries: Queries }) {
  return Object.freeze({
    list: (region: ProfessionRegionId | null = null) =>
      professionIndex(deps.queries, region),
    async detail(code: string) {
      const page = await professionPage(deps.queries, code);
      if (!page) throw notFound();
      return page;
    },
  });
}
export type ProfessionsServices = ReturnType<typeof createProfessionsServices>;
