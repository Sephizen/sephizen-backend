import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import yauzl from 'yauzl';
import { env } from '../config/env.js';
import { ApiError } from '../utils/apiError.js';

const ALLOWED_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.php',
  '.html', '.css', '.json', '.md', '.txt', '.zip'
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'application/typescript',
  'text/typescript',
  'text/plain',
  'text/markdown',
  'application/markdown',
  'text/html',
  'text/css',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/octet-stream'
]);

const BLOCKED_ZIP_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bat', '.cmd', '.ps1', '.sh', '.msi', '.apk', '.jar', '.war', '.class', '.node'
]);

function toBytesFromMb(value) {
  return Number(value || 0) * 1024 * 1024;
}

function sanitizeZipEntryName(name) {
  return String(name || '').replace(/\\/g, '/');
}

function validateArchiveEntry(entry, stats) {
  const name = sanitizeZipEntryName(entry.fileName);
  const lower = name.toLowerCase();

  if (!name || name.startsWith('/') || name.includes('../') || name.includes('..\\') || name.includes('..//')) {
    throw new ApiError(400, `Unsafe path inside ZIP: ${name}`);
  }

  if (BLOCKED_ZIP_EXTENSIONS.has(path.extname(lower))) {
    throw new ApiError(400, `Executable files are not allowed inside ZIP uploads: ${name}`);
  }

  if (entry.uncompressedSize > toBytesFromMb(env.UPLOAD_ZIP_MAX_UNCOMPRESSED_MB)) {
    throw new ApiError(413, `ZIP entry is too large: ${name}`);
  }

  stats.entryCount += 1;
  stats.compressedBytes += Number(entry.compressedSize || 0);
  stats.uncompressedBytes += Number(entry.uncompressedSize || 0);

  if (stats.entryCount > env.UPLOAD_ZIP_MAX_ENTRIES) {
    throw new ApiError(413, 'ZIP archive contains too many files');
  }

  if (stats.uncompressedBytes > toBytesFromMb(env.UPLOAD_ZIP_MAX_UNCOMPRESSED_MB)) {
    throw new ApiError(413, 'ZIP archive is too large when unpacked');
  }

  const ratio = stats.uncompressedBytes / Math.max(stats.compressedBytes, 1);
  if (ratio > env.UPLOAD_ZIP_MAX_RATIO) {
    throw new ApiError(413, 'ZIP compression ratio is suspiciously high');
  }
}

async function scanZipFile(filePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, decodeStrings: true }, (error, zipfile) => {
      if (error) return reject(new ApiError(400, 'Unable to read ZIP archive'));
      if (!zipfile) return reject(new ApiError(400, 'Unable to read ZIP archive'));

      const stats = {
        entryCount: 0,
        compressedBytes: 0,
        uncompressedBytes: 0
      };

      const cleanup = (err) => {
        try {
          zipfile.close();
        } catch (_) {}
        reject(err);
      };

      zipfile.on('error', (err) => cleanup(new ApiError(400, err.message || 'Invalid ZIP archive')));
      zipfile.on('entry', (entry) => {
        try {
          const name = sanitizeZipEntryName(entry.fileName);
          validateArchiveEntry(entry, stats);

          if (name.endsWith('/')) {
            zipfile.readEntry();
            return;
          }

          if (name.toLowerCase().endsWith('.zip')) {
            throw new ApiError(400, 'Nested ZIP files are not allowed');
          }

          zipfile.readEntry();
        } catch (err) {
          cleanup(err instanceof ApiError ? err : new ApiError(400, 'Unsafe ZIP archive'));
        }
      });
      zipfile.on('end', () => {
        try {
          zipfile.close();
        } catch (_) {}
        resolve({
          entryCount: stats.entryCount,
          compressedBytes: stats.compressedBytes,
          uncompressedBytes: stats.uncompressedBytes
        });
      });

      zipfile.readEntry();
    });
  });
}

function looksBinary(buffer) {
  const sample = buffer.slice(0, 4096);
  let controlBytes = 0;

  for (const byte of sample) {
    if (byte === 0) return true;
    if (byte < 9 || (byte > 13 && byte < 32)) controlBytes += 1;
  }

  return controlBytes / Math.max(sample.length, 1) > 0.3;
}

async function scanTextFile(filePath, originalName) {
  const buffer = await fsp.readFile(filePath);
  if (looksBinary(buffer)) {
    throw new ApiError(400, `Binary content detected in ${originalName}`);
  }
}

async function scanWithArchiveRules(filePath, originalName) {
  const extension = path.extname(originalName || '').toLowerCase();
  if (extension === '.zip') {
    await scanZipFile(filePath);
    return;
  }

  await scanTextFile(filePath, originalName);
}

export function ensureUploadDir() {
  const dir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function isAllowedUpload(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) return false;

  if (extension === '.zip') {
    return true;
  }

  if (!file.mimetype) return true;
  return ALLOWED_MIME_TYPES.has(file.mimetype);
}

export async function scanUploadedFile(file) {
  if (!env.UPLOAD_ENABLE_SCANNING) {
    return { scanned: false };
  }

  await scanWithArchiveRules(file.path, file.originalname || file.filename);
  return { scanned: true };
}

export function normalizeStoredFile(file) {
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedAt: new Date().toISOString()
  };
}
