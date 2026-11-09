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

/** Mounted beside `/api/companies`, where the word could never be read as a company's slug. */
export function companySignalsRoutes(services: CompaniesServices) {
  const router = Router();
  router.get('/', createCompaniesController(services).signals);
  return router;
}
