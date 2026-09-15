'use strict';

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

let s3ClientInstance = null;

const getS3Config = () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1',
  bucket: process.env.AWS_S3_BUCKET || 'krishna-crm',
});

const isConfigured = () => {
  const config = getS3Config();
  return !!(config.accessKeyId && config.secretAccessKey && config.bucket);
};

const getS3Client = () => {
  if (!isConfigured()) return null;
  if (!s3ClientInstance) {
    const config = getS3Config();
    s3ClientInstance = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3ClientInstance;
};

/**
 * Upload binary buffer to AWS S3 bucket
 * @param {Object} params
 * @param {Buffer} params.buffer - File buffer
 * @param {string} params.key - S3 key/path
 * @param {string} params.contentType - MIME type
 * @param {Object} [params.metadata] - Optional metadata key-values
 * @returns {Promise<{ success: boolean, key: string, bucket: string, url: string }>}
 */
const uploadBuffer = async ({ buffer, key, contentType = 'application/octet-stream', metadata = {} }) => {
  const config = getS3Config();
  const client = getS3Client();

  const cleanKey = key.startsWith('/') ? key.slice(1) : key;

  // Always write local disk backup so local development and offline environments can serve the file
  try {
    const localUploadRoot = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
    const localFilePath = path.join(localUploadRoot, cleanKey);
    const localDir = path.dirname(localFilePath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.writeFileSync(localFilePath, buffer);
  } catch (fsErr) {
    logger.warn(`Could not save local disk backup for ${cleanKey}: ${fsErr.message}`);
  }

  if (!client) {
    logger.warn('AWS S3 is not configured. Falling back to local storage path.');
    return { success: false, key: cleanKey, bucket: null, url: `/uploads/${cleanKey}`, isFallback: true };
  }

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: cleanKey,
    Body: buffer,
    ContentType: contentType,
    Metadata: metadata,
  });

  await client.send(command);

  const directUrl = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${cleanKey}`;
  logger.info(`Successfully uploaded object to S3: s3://${config.bucket}/${cleanKey}`);

  return {
    success: true,
    key: cleanKey,
    bucket: config.bucket,
    url: directUrl,
  };
};

/**
 * Generate a short-lived presigned GET URL for viewing private S3 objects
 * @param {Object} params
 * @param {string} params.key - S3 object key or relative url
 * @param {number} [params.expiresIn=3600] - Expiry in seconds (default 1 hour)
 * @returns {Promise<string|null>}
 */
const getPresignedViewUrl = async ({ key, expiresIn = 86400 }) => {
  if (!key) return null;

  // If already a signed S3 URL with AWS signature params, return as is
  if (key.includes('X-Amz-Signature') || key.includes('X-Amz-Algorithm')) {
    return key;
  }

  // If already a full http(s) URL
  if (key.startsWith('http://') || key.startsWith('https://')) {
    const config = getS3Config();
    const s3HostPrefix = `${config.bucket}.s3.${config.region}.amazonaws.com/`;
    const s3AltPrefix = `${config.bucket}.s3.amazonaws.com/`;
    const pathStylePrefix = `amazonaws.com/${config.bucket}/`;
    if (key.includes(s3HostPrefix)) {
      key = key.split(s3HostPrefix)[1].split('?')[0];
    } else if (key.includes(s3AltPrefix)) {
      key = key.split(s3AltPrefix)[1].split('?')[0];
    } else if (key.includes(pathStylePrefix)) {
      key = key.split(pathStylePrefix)[1].split('?')[0];
    } else {
      return key; // return external URL as is
    }
  }

  const client = getS3Client();
  const config = getS3Config();
  let cleanKey = (key.startsWith('/') ? key.slice(1) : key).split('?')[0];

  if (!client) {
    // If S3 not configured, return local path format with uploads/ prefix
    const localRel = cleanKey.startsWith('uploads/') ? cleanKey : `uploads/${cleanKey}`;
    return `/${localRel}`;
  }

  try {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: cleanKey,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn });
    return presignedUrl;
  } catch (err) {
    logger.error(`Failed to generate presigned S3 URL for key ${cleanKey}:`, err.message);
    const localRel = cleanKey.startsWith('uploads/') ? cleanKey : `uploads/${cleanKey}`;
    return `/${localRel}`;
  }
};

/**
 * Delete an object from AWS S3
 * @param {Object} params
 * @param {string} params.key
 * @returns {Promise<boolean>}
 */
const deleteObject = async ({ key }) => {
  const client = getS3Client();
  const config = getS3Config();
  if (!client || !key) return false;

  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: cleanKey,
    });
    await client.send(command);
    logger.info(`Deleted object from S3: s3://${config.bucket}/${cleanKey}`);
    return true;
  } catch (err) {
    logger.error(`Failed to delete S3 object ${cleanKey}:`, err.message);
    return false;
  }
};

module.exports = {
  isConfigured,
  getS3Config,
  getS3Client,
  uploadBuffer,
  getPresignedViewUrl,
  deleteObject,
};
