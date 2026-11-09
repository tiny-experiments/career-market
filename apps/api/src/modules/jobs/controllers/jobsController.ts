import type { Request, Response } from 'express';
import { parse } from '../../../http/validate.ts';
import type { JobsServices } from '../services/index.ts';
import { jobsQuerySchema, jobParamsSchema } from '../schemas.ts';
import { z } from 'zod';
export function createJobsController(services: JobsServices) {
  return {
    list: async (req: Request, res: Response) => {
      res.json(await services.list(parse(jobsQuerySchema, req.query)));
    },
    facets: async (req: Request, res: Response) => {
      parse(z.strictObject({}), req.query);
      res.json(await services.facets());
    },
    detail: async (req: Request, res: Response) => {
      const { id } = parse(jobParamsSchema, req.params);
      const result = await services.detail(id);
      res.status(result.kind === 'closed' ? 410 : 200).json(result.payload);
    },
  };
}
