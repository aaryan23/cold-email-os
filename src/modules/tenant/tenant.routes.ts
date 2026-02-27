import { Router } from 'express';
import { handleList, handleCreate, handleGet, handleUpdateStatus, handleDelete } from './tenant.controller';

const router = Router();

router.get('/', handleList);
router.post('/', handleCreate);
router.get('/:id', handleGet);
router.patch('/:id/status', handleUpdateStatus);
router.delete('/:id', handleDelete);

export default router;
