import { Router } from 'express';
import multer from 'multer';
import { handleUpload } from './kb.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

router.post('/:id/kb/upload', upload.single('file'), handleUpload);

export default router;
