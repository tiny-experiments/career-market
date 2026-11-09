import type { Request, Response } from 'express';
import { parse } from '../../../http/validate.ts';
import type { SkillsServices } from '../services/index.ts';
import { indexQuerySchema, detailParamsSchema } from '../schemas.ts';
export function createSkillsController(services: SkillsServices) {
  return {
    list: async (req: Request, res: Response) => {
      parse(indexQuerySchema, req.query);
      res.json(await services.list());
    },
    detail: async (req: Request, res: Response) => {
      const { slug } = parse(detailParamsSchema, req.params);
      res.json(await services.detail(slug));
    },
  };
}
