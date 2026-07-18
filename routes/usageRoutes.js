import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listUsageLogs } from '../controllers/usageController.js';

const router = Router();

router.use(requireAuth);

router.get('/', listUsageLogs);

export default router;
