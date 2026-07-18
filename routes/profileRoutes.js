import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { readProfile, writeProfile } from '../controllers/profileController.js';

const router = Router();

router.use(requireAuth);

router.get('/', readProfile);
router.put('/', writeProfile);
router.patch('/', writeProfile);

export default router;
