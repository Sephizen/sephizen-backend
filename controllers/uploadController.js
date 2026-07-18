import fs from 'node:fs/promises';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';
import { ensureUploadDir, isAllowedUpload, normalizeStoredFile, scanUploadedFile } from '../services/uploadService.js';
import { ApiError } from '../utils/apiError.js';

const uploadDir = ensureUploadDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const unique = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024
  },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedUpload(file)) {
      return cb(new ApiError(400, 'Unsupported file type'));
    }
    cb(null, true);
  }
});

export const uploadSingle = upload.single('file');

export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }

  try {
    await scanUploadedFile(req.file);
  } catch (error) {
    await fs.unlink(req.file.path).catch(() => {});
    throw error;
  }

  const file = normalizeStoredFile(req.file);

  res.json({
    success: true,
    data: file
  });
});
