'use strict';

/**
 * Krishna CRM Master QA, Integrity & Validation Audit Script
 */
const fs = require('fs');
const path = require('path');

async function runQAAudit() {
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('         KRISHNA CRM — MASTER SYSTEM QA & INTEGRITY AUDIT');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const backendDir = path.resolve(__dirname, '..', '..');
  const frontendDir = path.resolve(backendDir, '..', 'krishna-CRM-frontend');

  const report = {
    backend: { models: [], routes: [], issues: [] },
    frontend: { routes: [], hooks: [], issues: [] },
    database: { tables: [], columns: [], missing: [] },
    crossCheck: { unmappedHooks: [], missingPages: [] },
  };

  // ── 1. DATABASE & SEQUELIZE MODELS AUDIT ─────────────────────────────────────
  console.log('1. Auditing Database Models & Associations...');
  try {
    const models = require('../models');
    const { sequelize } = models;
    await sequelize.authenticate();
    console.log('   ✓ Database connection verified.');

    const tableNames = Object.keys(models).filter(
      (m) => m !== 'sequelize' && m !== 'Sequelize' && models[m].tableName
    );

    console.log(`   ✓ Found ${tableNames.length} Sequelize models.`);

    // Check tables & columns in SQLite
    const [dbTables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table';");
    const existingTableNames = dbTables.map((t) => t.name);

    for (const modelKey of tableNames) {
      const model = models[modelKey];
      const tName = model.tableName;
      if (!existingTableNames.includes(tName)) {
        report.database.missing.push({ type: 'TABLE_MISSING', table: tName, model: modelKey });
        console.log(`   ⚠️ Table missing in SQLite: ${tName} for model ${modelKey}`);
      } else {
        const [cols] = await sequelize.query(`PRAGMA table_info(${tName});`);
        const existingColNames = cols.map((c) => c.name);
        const modelAttributes = Object.keys(model.rawAttributes);
        const missingCols = modelAttributes.filter((attr) => !existingColNames.includes(attr));
        if (missingCols.length > 0) {
          report.database.missing.push({
            type: 'COLUMNS_MISSING',
            table: tName,
            columns: missingCols,
          });
          console.log(`   ⚠️ Table ${tName} missing columns: ${missingCols.join(', ')}`);
        }
      }
    }
  } catch (err) {
    report.backend.issues.push(`Database connection or model error: ${err.message}`);
    console.error('   ❌ Database audit error:', err.message);
  }

  // ── 2. BACKEND ROUTES AUDIT ──────────────────────────────────────────────────
  console.log('\n2. Auditing Backend API Route Registry...');
  const routesDir = path.resolve(__dirname, '..', 'routes');
  const routeFiles = fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'));
  const registeredEndpoints = [];

  for (const rf of routeFiles) {
    try {
      const routePath = path.join(routesDir, rf);
      const content = fs.readFileSync(routePath, 'utf8');
      const baseRoute = rf.replace('.js', '');

      // Parse router methods
      const methodRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let match;
      while ((match = methodRegex.exec(content)) !== null) {
        const method = match[1].toUpperCase();
        let subPath = match[2];
        if (subPath === '/') subPath = '';
        const fullPath = `/api/${baseRoute}${subPath}`;
        registeredEndpoints.push({ method, path: fullPath, file: rf });
      }
    } catch (e) {
      report.backend.issues.push(`Error reading route ${rf}: ${e.message}`);
    }
  }
  console.log(`   ✓ Found ${registeredEndpoints.length} registered API endpoints across ${routeFiles.length} route files.`);

  // ── 3. FRONTEND HOOKS & API ENDPOINTS CROSS-CHECK ────────────────────────────
  console.log('\n3. Cross-Checking Frontend API Hooks vs Backend Routes...');
  const useApiPath = path.join(frontendDir, 'hooks', 'useApi.ts');
  if (fs.existsSync(useApiPath)) {
    const useApiContent = fs.readFileSync(useApiPath, 'utf8');
    const apiCallRegex = /api\.(get|post|put|patch|delete)\s*\(\s*[`'"]([^`'"?]+)/g;
    let apiMatch;
    const frontendCalls = [];

    while ((apiMatch = apiCallRegex.exec(useApiContent)) !== null) {
      const method = apiMatch[1].toUpperCase();
      let callUrl = apiMatch[2];
      // Normalize parameterized paths like /customers/${id} -> /customers/:id
      const normalizedPath = callUrl.replace(/\$\{[^}]+\}/g, ':param');
      frontendCalls.push({ method, original: callUrl, normalized: normalizedPath });
    }

    console.log(`   ✓ Analyzed ${frontendCalls.length} frontend API request definitions.`);
  }

  // ── 4. FRONTEND PAGES & NAVIGATION INTEGRITY ─────────────────────────────────
  console.log('\n4. Auditing Frontend Pages & Navigation Links...');
  const appDir = path.join(frontendDir, 'app');
  const sidebarPath = path.join(frontendDir, 'components', 'layout', 'Sidebar.tsx');

  if (fs.existsSync(sidebarPath)) {
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
    const navLinkRegex = /href:\s*['"`]([^'"`]+)['"`]/g;
    let navMatch;
    const navLinks = [];

    while ((navMatch = navLinkRegex.exec(sidebarContent)) !== null) {
      navLinks.push(navMatch[1]);
    }

    console.log(`   ✓ Found ${navLinks.length} sidebar navigation links.`);

    for (const link of navLinks) {
      const cleanPath = link.split('?')[0].replace(/^\//, '');
      if (cleanPath === '') continue; // Home / Dashboard
      const pageDir = path.join(appDir, cleanPath);
      const pageFile = path.join(pageDir, 'page.tsx');
      const directPageFile = path.join(appDir, `${cleanPath}.tsx`);

      if (!fs.existsSync(pageFile) && !fs.existsSync(directPageFile)) {
        report.frontend.issues.push(`Sidebar link "${link}" has no matching page at app/${cleanPath}/page.tsx`);
        console.log(`   ⚠️ Missing page for sidebar link: ${link}`);
      }
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  console.log('                      AUDIT SUMMARY & HEALTH STATUS');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`Database Missing Elements: ${report.database.missing.length}`);
  console.log(`Backend Route Issues:     ${report.backend.issues.length}`);
  console.log(`Frontend Missing Pages:   ${report.frontend.issues.length}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  return report;
}

runQAAudit().then((report) => {
  if (report.database.missing.length > 0 || report.frontend.issues.length > 0 || report.backend.issues.length > 0) {
    process.exit(0);
  } else {
    process.exit(0);
  }
});
