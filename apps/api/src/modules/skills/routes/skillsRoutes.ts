import { Router } from 'express';
import { createSkillsController } from '../controllers/skillsController.ts';
import type { SkillsServices } from '../services/index.ts';
export function skillsRoutes(services: SkillsServices) {
  const router = Router();
  const controller = createSkillsController(services);
  router.get('/', controller.list);
  router.get('/:slug', controller.detail);
  return router;
}
