import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { readSettings, writeSettings } from '../controllers/settingsController.js';

const router = Router();

router.use(requireAuth);

router.get('/', readSettings);
router.put('/', writeSettings);
router.patch('/', writeSettings);

export default router;
