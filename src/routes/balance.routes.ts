import { Router } from 'express';
import { getGroupBalances, getUserBalances } from '../controllers/balance.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware
router.use(authMiddleware);

router.get('/groups/:groupId/balances', getGroupBalances);
router.get('/users/me/balances', getUserBalances);

export default router;
