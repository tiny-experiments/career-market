import type { Request, Response } from 'express';
import { parse } from '../../../http/validate.ts';
import type { SearchServices } from '../services/index.ts';
import { searchQuerySchema } from '../schemas.ts';
export function createSearchController(services: SearchServices) {
  return {
    search: async (req: Request, res: Response) => {
      res.json(await services.search(parse(searchQuerySchema, req.query)));
    },
  };
}
