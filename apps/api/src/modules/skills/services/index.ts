import type { Queries } from '../../../database/client.ts';
import { notFound } from '../../../http/errors.ts';
import { skillIndex, skillPage } from '../repository.ts';
export function createSkillsServices(deps: { queries: Queries }) {
  return Object.freeze({
    list: () => skillIndex(deps.queries),
    async detail(slug: string) {
      const page = await skillPage(deps.queries, slug);
      if (!page) throw notFound();
      return page;
    },
  });
}
export type SkillsServices = ReturnType<typeof createSkillsServices>;
