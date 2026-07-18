import { Router } from 'express';
import { getMetrics } from '../controllers/metricsController.js';

const router = Router();

router.get('/', getMetrics);

export default router;
