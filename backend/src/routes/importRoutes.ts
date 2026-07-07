import { Router } from 'express';
import multer from 'multer';
import { handleImport } from '../controllers/importController';

const router = Router();

// Configure multer to store uploaded files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file limit
  },
  fileFilter: (_req, file, cb) => {
    // Only accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are supported.'));
    }
  },
});

// Define import routes
router.post('/', upload.single('file'), handleImport);

export default router;
