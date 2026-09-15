'use strict';

require('dotenv').config();
const { CustomerImage, Order } = require('../models');
const s3Service = require('../services/s3Service');
const orderController = require('../controllers/orderController');

(async () => {
  console.log('=== TESTING CUSTOMER IMAGE LINK PIPELINE ===\n');

  // 1. Test s3Service.getPresignedViewUrl
  console.log('1. Testing s3Service.getPresignedViewUrl:');
  const sampleKey = 'customer_images/test_order_123/sample.jpg';
  const presigned = await s3Service.getPresignedViewUrl({ key: sampleKey });
  console.log('   Presigned URL:', presigned?.slice(0, 100) + '...');
  if (presigned && presigned.includes('X-Amz-Signature')) {
    console.log('   ✅ Presigned S3 URL generated successfully');
  } else {
    console.log('   ⚠️ Presigned URL fallback:', presigned);
  }

  // 2. Test already signed URL passthrough
  const alreadySigned = presigned;
  const reSigned = await s3Service.getPresignedViewUrl({ key: alreadySigned });
  console.log('   Already signed passthrough identical:', alreadySigned === reSigned ? '✅ PASS' : '❌ FAIL');

  // 3. Test direct unsigned S3 URL key extraction
  const directS3 = 'https://krishna-crm.s3.ap-south-1.amazonaws.com/customer_images/test_order_123/sample.jpg';
  const fromDirect = await s3Service.getPresignedViewUrl({ key: directS3 });
  console.log('   From direct S3 URL presigned:', fromDirect?.includes('X-Amz-Signature') ? '✅ PASS' : '❌ FAIL');

  // 4. Test enrichCustomerImages via viewCustomerImage
  console.log('\n2. Testing orderController viewCustomerImage:');
  const realImg = await CustomerImage.findOne({ order: [['created_at', 'DESC']] });
  if (realImg) {
    console.log('   Found real CustomerImage in DB:', realImg.id, 's3_key:', realImg.s3_key);
    const mockReq = { params: { imageId: realImg.id } };
    let redirectedUrl = null;
    const testRes = {
      redirect: (status, url) => { redirectedUrl = url; console.log('   viewCustomerImage redirected (status ' + status + ') to:', url?.slice(0, 80) + '...'); },
      setHeader: () => {},
      status: () => testRes,
      send: (msg) => { console.log('   viewCustomerImage send:', msg); }
    };
    await orderController.viewCustomerImage(mockReq, testRes, () => {});
    if (redirectedUrl && redirectedUrl.includes('X-Amz-Signature')) {
      console.log('   ✅ viewCustomerImage successfully redirected to live signed S3 URL');
    }
  }

  // 5. Test frontend getMediaUrl logic
  console.log('\n3. Testing frontend getMediaUrl logic:');
  const getMediaUrlLogic = (filePath, apiBase = 'http://localhost:5000') => {
    if (!filePath) return '';
    if (/^https?:\/\//i.test(filePath)) {
      if (filePath.includes('.amazonaws.com/customer_images/') && !filePath.includes('X-Amz-Signature')) {
        const key = filePath.split('.amazonaws.com/')[1];
        return `${apiBase}/uploads/${key}`;
      }
      return filePath;
    }
    const uploadsIdx = filePath.indexOf('uploads');
    if (uploadsIdx !== -1) {
      const rel = filePath.substring(uploadsIdx).replace(/\\/g, '/');
      return `${apiBase}/${rel}`;
    }
    const clean = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (clean.startsWith('customer_images/')) {
      return `${apiBase}/uploads/${clean}`;
    }
    return `${apiBase}/${clean}`;
  };

  const testCases = [
    { input: presigned, desc: 'Presigned S3 URL' },
    { input: directS3, desc: 'Direct Unsigned S3 URL (403 fix)' },
    { input: '/uploads/customer_images/abc.jpg', desc: 'Relative uploads path' },
    { input: 'customer_images/abc.jpg', desc: 'Relative customer_images path' },
    { input: '/customer_images/abc.jpg', desc: 'Slash-prefixed customer_images path' },
  ];

  for (const tc of testCases) {
    const res = getMediaUrlLogic(tc.input);
    console.log(`   [${tc.desc}] -> ${res?.slice(0, 75)}...`);
  }

  console.log('\n=== PIPELINE TESTS COMPLETE ===');
  process.exit(0);
})();
