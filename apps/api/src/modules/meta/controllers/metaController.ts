import type { Request, Response } from 'express';
import { parse } from '../../../http/validate.ts';
import type { MetaServices } from '../services/index.ts';
import { indexQuerySchema } from '../schemas.ts';
export function createMetaController(services: MetaServices) {
  return {
    overview: async (req: Request, res: Response) => {
      parse(indexQuerySchema, req.query);
      res.json(await services.overview());
    },
  };
}
