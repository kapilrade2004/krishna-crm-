'use strict';

const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allFiles = getFiles(path.resolve(__dirname, '..'));
let issues = [];

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const requireRegex = /require\(['"](\.[^'"]+)['"]\)/g;
  let match;
  while ((match = requireRegex.exec(content)) !== null) {
    const reqPath = match[1];
    const resolvedDir = path.dirname(file);
    const target = path.resolve(resolvedDir, reqPath);

    let found = false;

    // Check direct file with .js or .json or exact
    for (const ext of ['', '.js', '.json']) {
      const candidate = target + ext;
      if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
        found = true;
        const candidateDir = path.dirname(candidate);
        const candidateBase = path.basename(candidate);
        const dirEntries = fs.readdirSync(candidateDir);
        if (!dirEntries.includes(candidateBase)) {
          issues.push({
            file: path.relative(process.cwd(), file),
            reqPath,
            error: `Casing mismatch: expected '${candidateBase}' in ${candidateDir}`
          });
        }
        break;
      }
    }

    if (!found) {
      const indexCandidate = path.join(target, 'index.js');
      if (fs.existsSync(indexCandidate)) {
        found = true;
        const parentDir = path.dirname(target);
        const targetBase = path.basename(target);
        const dirEntries = fs.readdirSync(parentDir);
        if (!dirEntries.includes(targetBase)) {
          issues.push({
            file: path.relative(process.cwd(), file),
            reqPath,
            error: `Directory casing mismatch: expected '${targetBase}' in ${parentDir}`
          });
        }
      }
    }

    if (!found) {
      issues.push({
        file: path.relative(process.cwd(), file),
        reqPath,
        error: 'MODULE_NOT_FOUND (File does not exist on disk)'
      });
    }
  }
});

console.log('Total files checked:', allFiles.length);
console.log('Issues found:', issues.length);
issues.forEach(i => console.log(JSON.stringify(i, null, 2)));
process.exit(issues.length > 0 ? 1 : 0);
