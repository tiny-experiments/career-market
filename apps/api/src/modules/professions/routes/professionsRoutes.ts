import { Router } from 'express';
import { createProfessionsController } from '../controllers/professionsController.ts';
import type { ProfessionsServices } from '../services/index.ts';
export function professionsRoutes(services: ProfessionsServices) {
  const router = Router();
  const controller = createProfessionsController(services);
  router.get('/', controller.list);
  router.get('/:code', controller.detail);
  return router;
}
