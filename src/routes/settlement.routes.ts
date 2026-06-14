import { Router } from 'express';
import {
  recordSettlement,
  getSettlements,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../controllers/settlement.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware
router.use(authMiddleware);

router.post('/groups/:groupId/settlements', recordSettlement);
router.get('/groups/:groupId/settlements', getSettlements);
router.post('/groups/:groupId/settlements/razorpay-order', createRazorpayOrder);
router.post('/groups/:groupId/settlements/razorpay-verify', verifyRazorpayPayment);

export default router;

