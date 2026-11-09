import type { Request, Response } from 'express';
import { parse } from '../../../http/validate.ts';
import type { CompaniesServices } from '../services/index.ts';
import { companiesQuerySchema, companyParamsSchema } from '../schemas.ts';
import { jobsQuerySchema } from '../../jobs/domain.ts';
export function createCompaniesController(services: CompaniesServices) {
  return {
    list: async (req: Request, res: Response) => {
      res.json(await services.list(parse(companiesQuerySchema, req.query)));
    },
    detail: async (req: Request, res: Response) => {
      const { slug } = parse(companyParamsSchema, req.params);
      res.json(await services.detail(slug));
    },
    jobs: async (req: Request, res: Response) => {
      const { slug } = parse(companyParamsSchema, req.params);
      res.json(await services.jobs(slug, parse(jobsQuerySchema, req.query)));
    },
  };
}
