import { Router } from 'express';
import { createCompaniesController } from '../controllers/companiesController.ts';
import type { CompaniesServices } from '../services/index.ts';
export function companiesRoutes(services: CompaniesServices) {
  const router = Router();
  const controller = createCompaniesController(services);
  router.get('/', controller.list);
  router.get('/:slug/jobs', controller.jobs);
  router.get('/:slug', controller.detail);
  return router;
}
