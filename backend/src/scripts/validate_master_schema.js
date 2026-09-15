'use strict';

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '../../migrations/001_complete_schema.sql');
const content = fs.readFileSync(schemaPath, 'utf8');

console.log('Validating 001_complete_schema.sql...');
console.log(`Total file size: ${(content.length / 1024).toFixed(2)} KB`);

// Check table count
const createTableMatches = content.match(/CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)/gi);
if (createTableMatches) {
  console.log(`Found ${createTableMatches.length} tables:`);
  createTableMatches.forEach((m, idx) => {
    const tableName = m.replace(/CREATE TABLE IF NOT EXISTS\s+/i, '').trim();
    console.log(`  ${idx + 1}. ${tableName}`);
  });
} else {
  console.error('No CREATE TABLE statements found!');
  process.exit(1);
}

// Check inserts
const insertMatches = content.match(/INSERT IGNORE INTO\s+([a-zA-Z0-9_]+)/gi);
if (insertMatches) {
  console.log(`Found ${insertMatches.length} INSERT blocks:`);
  insertMatches.forEach((m, idx) => {
    const tableName = m.replace(/INSERT IGNORE INTO\s+/i, '').trim();
    console.log(`  ${idx + 1}. ${tableName}`);
  });
}

console.log('✅ Schema file validation succeeded!');
