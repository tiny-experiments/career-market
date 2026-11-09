import { Router } from 'express';
import { createMetaController } from '../controllers/metaController.ts';
import type { MetaServices } from '../services/index.ts';
export function metaRoutes(services: MetaServices) {
  const router = Router();
  const controller = createMetaController(services);
  router.get('/', controller.overview);
  return router;
}
