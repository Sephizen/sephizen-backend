import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadSingle, uploadFile } from '../controllers/uploadController.js';

const router = Router();

router.use(requireAuth);

router.post('/', uploadSingle, uploadFile);

export default router;
