import multer from 'multer';
import fs from 'fs';
import { getProfileUploadsDir } from '../utils/uploadPaths.js';

function ensureUploadDirectory() {
  const uploadsDir = getProfileUploadsDir();
  fs.mkdirSync(uploadsDir, { recursive: true });
  return uploadsDir;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const uploadsDir = ensureUploadDirectory();
      cb(null, uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (_req, file, cb) => {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
    return;
  }
  cb(new Error('Only image uploads are allowed.'));
}

export const uploadProfileImageMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single('image');


