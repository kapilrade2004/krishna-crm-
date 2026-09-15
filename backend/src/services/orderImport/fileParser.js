'use strict';

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

class FileParser {
  /**
   * Parses uploaded file (buffer or filepath) of format .xlsx, .xls, .csv, .tsv
   * Returns an array of raw row objects with string-keyed properties.
   *
   * @param {Object} params
   * @param {string} [params.filePath]
   * @param {Buffer} [params.buffer]
   * @param {string} [params.originalName]
   * @returns {Promise<Array<Object>>}
   */
  static async parse({ filePath = null, buffer = null, originalName = '' }) {
    let fileBuffer = buffer;

    if (!fileBuffer && filePath) {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist: ${filePath}`);
      }
      fileBuffer = fs.readFileSync(filePath);
    }

    if (!fileBuffer) {
      throw new Error('FileParser requires either a valid filePath or buffer');
    }

    const filename = (originalName || filePath || '').toLowerCase();
    const ext = path.extname(filename);

    const supportedExts = ['.xlsx', '.xls', '.csv', '.tsv'];
    if (ext && !supportedExts.includes(ext)) {
      throw new Error(`Unsupported file extension "${ext}". Supported: ${supportedExts.join(', ')}`);
    }

    let workbook;
    if (ext === '.csv' || ext === '.tsv') {
      let rawText;
      if (fileBuffer.length >= 2 && fileBuffer[0] === 0xff && fileBuffer[1] === 0xfe) {
        rawText = fileBuffer.toString('utf16le');
      } else if (fileBuffer.length >= 2 && fileBuffer[0] === 0xfe && fileBuffer[1] === 0xff) {
        rawText = fileBuffer.toString('utf16be');
      } else {
        rawText = fileBuffer.toString('utf-8');
      }
      // Strip UTF-8 BOM if present
      if (rawText.charCodeAt(0) === 0xfeff) {
        rawText = rawText.slice(1);
      }
      // Strip any leading BOM or encoding artifact characters
      rawText = rawText.replace(/^[\uFEFF\uFFFE\u00EF\u00BB\u00BF\u00FF\u00FEÿþ]+/, '');
      // Strip null bytes
      rawText = rawText.replace(/\0/g, '');
      workbook = XLSX.read(rawText, { type: 'string', raw: false, dateNF: 'yyyy-mm-dd' });
    } else {
      workbook = XLSX.read(fileBuffer, { type: 'buffer', raw: false, cellDates: true });
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Spreadsheet contains no sheets or readable data.');
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Read all rows as 2D array first to discover real header row
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false });
    if (!matrix || matrix.length === 0) {
      throw new Error('Spreadsheet sheet is empty. No rows found to import.');
    }

    // Known keywords likely present in order headers across all channels
    const KEYWORDS = [
      'order', 'buyer', 'customer', 'phone', 'mobile', 'sku', 'product', 'item',
      'price', 'amount', 'date', 'address', 'city', 'state', 'pincode', 'fsn',
      'asin', 'query', 'inquiry', 'lead', 'name', 'title', 'quantity', 'qty',
      'contact', 'recipient', 'invoice', 'status', 'total', 'bill', 'ship'
    ];

    let headerRowIndex = 0;
    let maxMatchCount = 0;

    for (let r = 0; r < Math.min(matrix.length, 10); r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;
      const matchCount = row.filter((cell) => {
        const str = String(cell || '').toLowerCase().trim();
        return KEYWORDS.some((k) => str.includes(k));
      }).length;

      if (matchCount > maxMatchCount) {
        maxMatchCount = matchCount;
        headerRowIndex = r;
      }
    }

    const rawHeaders = Array.isArray(matrix[headerRowIndex]) ? matrix[headerRowIndex] : [];
    const headerRow = rawHeaders.map((h, idx) => {
      const clean = String(h || '').replace(/^[^a-zA-Z0-9_\-#@]+/, '').trim();
      return clean || `col_${idx}`;
    });

    const dataRows = matrix.slice(headerRowIndex + 1);
    const sanitizedRows = [];

    for (const r of dataRows) {
      if (!Array.isArray(r) || r.every((cell) => cell === '' || cell === null || cell === undefined)) {
        continue;
      }
      const obj = {};
      let hasMeaningfulData = false;
      headerRow.forEach((colName, idx) => {
        const val = r[idx] !== undefined && r[idx] !== null ? r[idx] : '';
        obj[colName] = val;
        if (String(val).trim() !== '') {
          hasMeaningfulData = true;
        }
      });
      if (hasMeaningfulData) {
        sanitizedRows.push(obj);
      }
    }

    if (sanitizedRows.length === 0) {
      throw new Error('No data rows found under detected headers in the uploaded file.');
    }

    return sanitizedRows;
  }
}

module.exports = FileParser;
