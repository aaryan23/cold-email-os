import { Router } from 'express';
import { handleRetrieve } from './rag.controller';

const router = Router();

router.post('/:id/rag/retrieve', handleRetrieve);

export default router;
