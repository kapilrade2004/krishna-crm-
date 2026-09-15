'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { imageUpload } = require('../middleware/upload');
const s3Service = require('../services/s3Service');
const logger = require('../config/logger');

// Accept field name 'image' or 'file'
const uploadMiddleware = (req, res, next) => {
  const handler = imageUpload.single('image');
  handler(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) {
      const fallbackHandler = imageUpload.single('file');
      return fallbackHandler(req, res, next);
    }
    next();
  });
};

/**
 * POST /api/upload/image
 * Uploads an image file to AWS S3 & local storage and returns its URLs
 */
router.post('/image', uploadMiddleware, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided. Please upload a file using form field "image" or "file".',
      });
    }

    const { filename, path: localPath, mimetype, size, originalname } = req.file;
    const fileBuffer = fs.readFileSync(localPath);
    const s3Key = `uploads/images/${filename}`;

    let s3Result = null;
    let presignedUrl = null;

    try {
      s3Result = await s3Service.uploadBuffer({
        buffer: fileBuffer,
        key: s3Key,
        contentType: mimetype,
        metadata: {
          originalName: originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      presignedUrl = await s3Service.getPresignedViewUrl({
        key: s3Key,
        expiresIn: 7 * 24 * 3600, // 7 days
      });
    } catch (s3Err) {
      logger.error('Failed to upload to S3, using local path:', s3Err.message);
    }

    const localUrl = `/uploads/images/${filename}`;
    const directUrl = s3Result?.url || localUrl;

    logger.info(`Image uploaded successfully: ${filename}`);

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: presignedUrl || directUrl,
        directUrl,
        presignedUrl,
        localUrl,
        s3Key,
        filename,
        originalName: originalname,
        mimeType: mimetype,
        size,
      },
    });
  } catch (err) {
    logger.error('Image upload controller error:', err);
    next(err);
  }
});

module.exports = router;
