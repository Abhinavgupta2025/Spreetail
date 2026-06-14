import { Router } from 'express';
import { getMessages, postMessage } from '../controllers/message.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply auth middleware
router.use(authMiddleware);

router.get('/expenses/:id/messages', getMessages);
router.post('/expenses/:id/messages', postMessage);

export default router;
