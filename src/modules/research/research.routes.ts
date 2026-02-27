import { Router } from 'express';
import { handleGetReport, handleRun } from './research.controller';

const router = Router();

router.get('/:id/research/report', handleGetReport);
router.post('/:id/research/run', handleRun);

export default router;
