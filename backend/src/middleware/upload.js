'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../utils/errors');

const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;

// Ensure upload directories exist
['csv', 'images', 'documents'].forEach((dir) => {
  fs.mkdirSync(path.join(UPLOAD_DIR, dir), { recursive: true });
});

// ─── CSV Storage ──────────────────────────────────────────────────────────────
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'csv')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const csvFilter = (req, file, cb) => {
  const allowed = ['.xlsx', '.xls', '.csv', '.tsv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new AppError('Only .xlsx, .xls, .csv, and .tsv files are supported.', 400), false);
  }
  cb(null, true);
};

const csvUpload = multer({
  storage: csvStorage,
  fileFilter: csvFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

// ─── Image Storage ─────────────────────────────────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'images')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const imageFilter = (req, file, cb) => {
  const allowed = /^image\/(jpeg|jpg|png|webp|gif)$/;
  if (!allowed.test(file.mimetype)) {
    return cb(new AppError('Only image files are allowed.', 400), false);
  }
  cb(null, true);
};

const imageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

// ─── Document Storage (SOW §3.6 — Employee Documents) ────────────────────────
const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const docDir = path.join(UPLOAD_DIR, 'documents');
    fs.mkdirSync(docDir, { recursive: true });
    cb(null, docDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const documentFilter = (req, file, cb) => {
  const allowed = [
    '.pdf', '.jpg', '.jpeg', '.png', '.webp',
    '.doc', '.docx', '.xls', '.xlsx',
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new AppError('Allowed: PDF, images, Word, Excel files only.', 400), false);
  }
  cb(null, true);
};

const documentUpload = multer({
  storage: documentStorage,
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

module.exports = { csvUpload, imageUpload, documentUpload };
