import { Router } from 'express';
import { getPreview, commitImport } from '../controllers/import.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authMiddleware to secure importer endpoints
router.post('/:groupId/import-csv/preview', authMiddleware, getPreview);
router.post('/:groupId/import-csv/commit', authMiddleware, commitImport);

export default router;
