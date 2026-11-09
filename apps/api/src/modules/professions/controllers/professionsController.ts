import type { Request, Response } from 'express';
import { parse } from '../../../http/validate.ts';
import type { ProfessionsServices } from '../services/index.ts';
import { indexQuerySchema, detailParamsSchema } from '../schemas.ts';
export function createProfessionsController(services: ProfessionsServices) {
  return {
    list: async (req: Request, res: Response) => {
      const { region } = parse(indexQuerySchema, req.query);
      res.json(await services.list(region ?? null));
    },
    detail: async (req: Request, res: Response) => {
      const { code } = parse(detailParamsSchema, req.params);
      res.json(await services.detail(code));
    },
  };
}
