import { Router } from 'express';
import { handleListGenerations, handleGenerate } from './generation.controller';

const router = Router();

router.get('/:id/generations', handleListGenerations);
router.post('/:id/generate', handleGenerate);

export default router;
