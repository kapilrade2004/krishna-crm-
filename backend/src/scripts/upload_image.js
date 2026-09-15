'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const s3Service = require('../services/s3Service');
const logger = require('../config/logger');

const getMimeType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
};

async function uploadImage(imageFilePath, customKey = null) {
  if (!imageFilePath) {
    throw new Error('Image file path is required. Usage: node src/scripts/upload_image.js <path-to-image>');
  }

  const resolvedPath = path.resolve(imageFilePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found at path: ${resolvedPath}`);
  }

  const fileStats = fs.statSync(resolvedPath);
  const buffer = fs.readFileSync(resolvedPath);
  const contentType = getMimeType(resolvedPath);
  const ext = path.extname(resolvedPath);
  const baseName = path.basename(resolvedPath, ext);
  const timestamp = Date.now();

  const key = customKey || `uploads/images/${Date.now()}-${baseName.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;

  console.log(`\n========================================`);
  console.log(`📤 Uploading Image to S3`);
  console.log(`========================================`);
  console.log(`File:         ${resolvedPath}`);
  console.log(`Size:         ${(fileStats.size / 1024).toFixed(2)} KB`);
  console.log(`Content-Type: ${contentType}`);
  console.log(`S3 Key:       ${key}`);

  const uploadResult = await s3Service.uploadBuffer({
    buffer,
    key,
    contentType,
    metadata: {
      originalName: path.basename(resolvedPath),
      uploadedAt: new Date().toISOString(),
    },
  });

  const presignedUrl = await s3Service.getPresignedViewUrl({
    key,
    expiresIn: 7 * 24 * 3600, // 7 days expiry
  });

  console.log(`\n✅ Upload Successful!`);
  console.log(`----------------------------------------`);
  console.log(`Direct S3 URL:\n${uploadResult.url}`);
  console.log(`----------------------------------------`);
  console.log(`Presigned View URL (valid for 7 days):\n${presignedUrl}`);
  console.log(`========================================\n`);

  return {
    success: true,
    s3Key: key,
    directUrl: uploadResult.url,
    presignedUrl,
    size: fileStats.size,
    contentType,
  };
}

if (require.main === module) {
  const targetPath = process.argv[2] || path.join(__dirname, '../../uploads/whatsapp-media/sample.jpg');
  uploadImage(targetPath)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`❌ Upload failed:`, err.message);
      process.exit(1);
    });
}

module.exports = { uploadImage };
