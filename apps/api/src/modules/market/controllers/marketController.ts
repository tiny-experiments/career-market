import type { Request, Response } from 'express';
import { parse } from '../../../http/validate.ts';
import type { MarketServices } from '../services/index.ts';
import { indexQuerySchema } from '../schemas.ts';
export function createMarketController(services: MarketServices) {
  return {
    overview: async (req: Request, res: Response) => {
      parse(indexQuerySchema, req.query);
      res.json(await services.overview());
    },
  };
}
