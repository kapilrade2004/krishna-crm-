'use strict';

const fs = require('fs');
const path = require('path');
const models = require('../models'); // Load all Sequelize models
const { sequelize } = models;

// Parse 001_complete_schema.sql to extract tables and columns
function parseSQLSchema(sqlFilePath) {
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
  
  // Normalize whitespaces and remove comments
  const lines = sqlContent.split('\n');
  const cleanLines = [];
  let inMultilineComment = false;
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('--')) continue;
    if (line.startsWith('/*')) {
      inMultilineComment = true;
      continue;
    }
    if (line.endsWith('*/')) {
      inMultilineComment = false;
      continue;
    }
    if (inMultilineComment) continue;
    cleanLines.push(line);
  }

  const cleanSql = cleanLines.join(' ');
  
  // Regex to extract CREATE TABLE statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.*?)\)\s*(?:ENGINE|DEFAULT|CHARSET|COLLATE|$)/gi;
  const tables = {};
  
  let match;
  while ((match = createTableRegex.exec(cleanSql)) !== null) {
    const tableName = match[1].toLowerCase();
    const tableBody = match[2];
    
    // Split columns and constraints
    const parts = [];
    let currentPart = '';
    let parenDepth = 0;
    
    for (let i = 0; i < tableBody.length; i++) {
      const char = tableBody[i];
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;
      
      if (char === ',' && parenDepth === 0) {
        parts.push(currentPart.trim());
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    const columns = {};
    const constraints = [];
    const indexes = [];
    
    for (const part of parts) {
      const upperPart = part.toUpperCase();
      if (
        upperPart.startsWith('PRIMARY KEY') ||
        upperPart.startsWith('FOREIGN KEY') ||
        upperPart.startsWith('UNIQUE KEY') ||
        upperPart.startsWith('CONSTRAINT') ||
        upperPart.startsWith('INDEX') ||
        upperPart.startsWith('KEY')
      ) {
        constraints.push(part);
      } else {
        // It's a column definition
        // e.g. "id CHAR(36) NOT NULL"
        const colMatch = part.match(/^(\w+)\s+([\w()]+)(.*)$/i);
        if (colMatch) {
          const colName = colMatch[1].toLowerCase();
          const colType = colMatch[2].toLowerCase();
          const colProps = colMatch[3].toUpperCase();
          
          columns[colName] = {
            name: colMatch[1],
            type: colType,
            nullable: !colProps.includes('NOT NULL'),
            default: colProps.includes('DEFAULT') ? extractDefault(colProps) : null
          };
        }
      }
    }
    
    tables[tableName] = {
      tableName,
      columns,
      constraints
    };
  }
  
  return tables;
}

function extractDefault(propsStr) {
  const match = propsStr.match(/DEFAULT\s+([^ ]+)/i);
  return match ? match[1].replace(/['"]/g, '') : null;
}

async function runAudit() {
  const sqlPath = path.join(__dirname, '..', '..', 'migrations', '001_complete_schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(`Error: Canonical schema file not found at ${sqlPath}`);
    process.exit(1);
  }

  const sqlTables = parseSQLSchema(sqlPath);
  const sequelizeModels = sequelize.models;

  const results = {
    sqlTableCount: Object.keys(sqlTables).length,
    sequelizeModelCount: Object.keys(sequelizeModels).length,
    tablesOnlyInSQL: [],
    tablesOnlyInSequelize: [],
    tableDifferences: {}
  };

  // Compare tables
  const sqlTableNames = Object.keys(sqlTables);
  const seqTableNames = Object.values(sequelizeModels).map(m => m.tableName.toLowerCase());
  const seqModelMap = {};
  Object.values(sequelizeModels).forEach(m => {
    seqModelMap[m.tableName.toLowerCase()] = m;
  });

  for (const name of sqlTableNames) {
    if (!seqTableNames.includes(name)) {
      results.tablesOnlyInSQL.push(name);
    }
  }

  for (const name of seqTableNames) {
    if (!sqlTableNames.includes(name)) {
      results.tablesOnlyInSequelize.push(name);
    }
  }

  // Column level comparison for matching tables
  for (const tableName of sqlTableNames) {
    if (seqTableNames.includes(tableName)) {
      const sqlTable = sqlTables[tableName];
      const seqModel = seqModelMap[tableName];
      const seqAttributes = seqModel.rawAttributes;

      const diffs = {
        missingInSequelize: [],
        extraInSequelize: [],
        typeMismatches: [],
        nullabilityMismatches: []
      };

      // Check for columns present in SQL but missing or mismatching in Sequelize
      for (const colName of Object.keys(sqlTable.columns)) {
        const sqlCol = sqlTable.columns[colName];
        const seqCol = Object.values(seqAttributes).find(attr => attr.field?.toLowerCase() === colName || attr.name?.toLowerCase() === colName);

        if (!seqCol) {
          diffs.missingInSequelize.push({ column: colName, type: sqlCol.type });
        } else {
          // Compare type (basic text compare)
          const seqType = seqCol.type.toString().toLowerCase();
          const sqlType = sqlCol.type;
          
          let typeMismatch = false;
          if (sqlType.startsWith('char') && !seqType.includes('char')) typeMismatch = true;
          if (sqlType.startsWith('varchar') && !seqType.includes('varchar') && !seqType.includes('string')) typeMismatch = true;
          if (sqlType.startsWith('int') && !seqType.includes('int')) typeMismatch = true;
          if (sqlType.startsWith('tinyint') && !seqType.includes('tinyint') && !seqType.includes('boolean')) typeMismatch = true;
          if (sqlType.startsWith('decimal') && !seqType.includes('decimal') && !seqType.includes('float')) typeMismatch = true;
          if (sqlType.startsWith('datetime') && !seqType.includes('date') && !seqType.includes('timestamp')) typeMismatch = true;
          
          if (typeMismatch) {
            diffs.typeMismatches.push({
              column: colName,
              sqlType,
              seqType
            });
          }

          // Compare nullability
          const sqlNullable = sqlCol.nullable;
          const seqNullable = seqCol.allowNull !== false;
          if (sqlNullable !== seqNullable) {
            diffs.nullabilityMismatches.push({
              column: colName,
              sqlNullable,
              seqNullable
            });
          }
        }
      }

      // Check for columns in Sequelize but missing in SQL
      for (const seqColKey of Object.keys(seqAttributes)) {
        const seqCol = seqAttributes[seqColKey];
        const seqColName = (seqCol.field || seqCol.name).toLowerCase();
        
        if (!sqlTable.columns[seqColName]) {
          diffs.extraInSequelize.push({
            column: seqColName,
            type: seqCol.type.toString()
          });
        }
      }

      if (
        diffs.missingInSequelize.length > 0 ||
        diffs.extraInSequelize.length > 0 ||
        diffs.typeMismatches.length > 0 ||
        diffs.nullabilityMismatches.length > 0
      ) {
        results.tableDifferences[tableName] = diffs;
      }
    }
  }

  // Print findings in a structured layout
  console.log('AUDIT RESULTS:\n');
  console.log(`A. SQL Schema Table Count: ${results.sqlTableCount}`);
  console.log(`B. Sequelize Model Table Count: ${results.sequelizeModelCount}`);
  console.log(`C. Tables only in SQL Schema:`, results.tablesOnlyInSQL);
  console.log(`D. Tables only in Sequelize:`, results.tablesOnlyInSequelize);
  console.log('\n--- COLUMN LEVEL MISMATCHES IN MATCHING TABLES ---');
  
  for (const [table, diff] of Object.entries(results.tableDifferences)) {
    console.log(`\nTable: [${table}]`);
    if (diff.missingInSequelize.length > 0) {
      console.log('  ⚠️ Columns missing in Sequelize (exists in SQL):');
      diff.missingInSequelize.forEach(c => console.log(`    - ${c.column} (${c.type})`));
    }
    if (diff.extraInSequelize.length > 0) {
      console.log('  ⚠️ Columns extra in Sequelize (missing in SQL):');
      diff.extraInSequelize.forEach(c => console.log(`    - ${c.column} (${c.type})`));
    }
    if (diff.typeMismatches.length > 0) {
      console.log('  ⚠️ Type Mismatches:');
      diff.typeMismatches.forEach(c => console.log(`    - ${c.column}: SQL=${c.sqlType} vs Seq=${c.seqType}`));
    }
    if (diff.nullabilityMismatches.length > 0) {
      console.log('  ⚠️ Nullability Mismatches:');
      diff.nullabilityMismatches.forEach(c => console.log(`    - ${c.column}: SQL Nullable=${c.sqlNullable} vs Seq Nullable=${c.seqNullable}`));
    }
  }

  console.log('\n======================================================================');
  console.log('✅ SCHEMA COMPARATOR AUDIT COMPLETE');
  console.log('======================================================================\n');
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
