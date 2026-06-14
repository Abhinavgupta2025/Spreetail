import { Router } from 'express';
import {
  createGroup,
  getGroups,
  getGroup,
  updateGroup,
  deleteGroup,
  addMember,
  removeMember,
} from '../controllers/group.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all group routes
router.use(authMiddleware);

router.post('/', createGroup);
router.get('/', getGroups);
router.get('/:id', getGroup);
router.patch('/:id', updateGroup);
router.delete('/:id', deleteGroup);

router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);

export default router;
