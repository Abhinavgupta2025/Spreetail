import { Router } from 'express';
import {
  createExpense,
  getExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expense.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all expense routes
router.use(authMiddleware);

router.post('/groups/:groupId/expenses', createExpense);
router.get('/groups/:groupId/expenses', getExpenses);
router.get('/expenses/:id', getExpense);
router.patch('/expenses/:id', updateExpense);
router.delete('/expenses/:id', deleteExpense);

export default router;
