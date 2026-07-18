import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCredits, checkCredits } from '../controllers/creditsController.js';

const router = Router();

router.use(requireAuth);

router.get('/', getCredits);
router.post('/check', checkCredits);

export default router;
