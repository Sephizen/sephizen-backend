import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createSession,
  listSessions,
  readSession,
  updateSessionTitle,
  removeSession,
  readMessages,
  sendMessage
} from '../controllers/chatController.js';

const router = Router();

router.use(requireAuth);

router.get('/sessions', listSessions);
router.post('/sessions', createSession);
router.get('/sessions/:sessionId', readSession);
router.patch('/sessions/:sessionId', updateSessionTitle);
router.delete('/sessions/:sessionId', removeSession);
router.get('/sessions/:sessionId/messages', readMessages);
router.post('/sessions/:sessionId/messages', sendMessage);

export default router;
