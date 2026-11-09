import { Router } from 'express';
import { createJobsController } from '../controllers/jobsController.ts';
import type { JobsServices } from '../services/index.ts';
export function jobsRoutes(services: JobsServices) {
  const router = Router();
  const controller = createJobsController(services);
  router.get('/', controller.list);
  router.get('/facets', controller.facets);
  router.get('/:id', controller.detail);
  return router;
}
