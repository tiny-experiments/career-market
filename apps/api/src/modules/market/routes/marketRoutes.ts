import { Router } from 'express';
import { createMarketController } from '../controllers/marketController.ts';
import type { MarketServices } from '../services/index.ts';
export function marketRoutes(services: MarketServices) {
  const router = Router();
  const controller = createMarketController(services);
  router.get('/', controller.overview);
  return router;
}
