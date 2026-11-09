import { Router } from 'express';
import { createSearchController } from '../controllers/searchController.ts';
import type { SearchServices } from '../services/index.ts';
export function searchRoutes(services: SearchServices) {
  const router = Router();
  const controller = createSearchController(services);
  router.get('/', controller.search);
  return router;
}
