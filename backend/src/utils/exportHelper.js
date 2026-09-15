'use strict';

const XLSX = require('xlsx');
const PDFDocument = require('pdfkit-table');

/**
 * Clean string representation for PDF and text export
 */
function cleanText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).replace(/[\u20B9]/g, 'INR ');
}

/**
 * Universal export helper for sending tabular data as Excel (.xlsx), CSV (.csv), or PDF (.pdf).
 *
 * @param {Object} options
 * @param {import('express').Response} options.res - Express response
 * @param {string} options.title - Document title (e.g. 'Orders Export', 'Customers Export')
 * @param {string} options.filenameBase - Base filename without extension (e.g. 'orders_export')
 * @param {string} [options.format='xlsx'] - 'xlsx' | 'csv' | 'pdf'
 * @param {Array<{ key: string, label: string }>} options.columns - Array of column metadata
 * @param {Array<Object>} options.data - Array of row objects (keys matching column keys or labels)
 * @param {Object} [options.metadata] - Optional metadata (filters, generatedBy, period, etc.)
 */
async function sendExportResponse(options) {
  const {
    res,
    title = 'Export Report',
    filenameBase = 'export',
    format = 'xlsx',
    columns = [],
    data = [],
    metadata = {},
  } = options;

  const normalizedFormat = (format || 'xlsx').toLowerCase().trim();
  const timestamp = Date.now();

  // 1. CSV or Excel Export via SheetJS (XLSX)
  if (normalizedFormat === 'xlsx' || normalizedFormat === 'csv' || normalizedFormat === 'excel') {
    const isCsv = normalizedFormat === 'csv';

    // Map rows using column definitions for consistent headers
    const exportRows = data.map((item) => {
      const row = {};
      columns.forEach((col) => {
        const val = item[col.key] !== undefined ? item[col.key] : item[col.label];
        row[col.label] = cleanText(val);
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, title.substring(0, 31));

    if (isCsv) {
      const csvBuffer = XLSX.write(workbook, { bookType: 'csv', type: 'buffer' });
      const filename = `${filenameBase}_${timestamp}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvBuffer);
    } else {
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
      const filename = `${filenameBase}_${timestamp}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(excelBuffer);
    }
  }

  // 2. PDF Export via pdfkit-table
  if (normalizedFormat === 'pdf') {
    return new Promise(async (resolve, reject) => {
      try {
        const isWide = columns.length > 5;
        const doc = new PDFDocument({
          size: 'A4',
          layout: isWide ? 'landscape' : 'portrait',
          margin: 25,
          info: {
            Title: title,
            Author: 'Krishna CRM Platform',
            Subject: `${title} - Export Report`,
          },
        });

        const buffers = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          const filename = `${filenameBase}_${timestamp}.pdf`;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
          res.send(pdfBuffer);
          resolve();
        });
        doc.on('error', (err) => reject(err));

        // Header Branding
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(16).text('KRISHNA CRM', 25, 25);
        doc.fillColor('#d97706').font('Helvetica-Bold').fontSize(11).text(title.toUpperCase(), { align: 'right' });
        doc.moveDown(0.2);

        // Meta Subheader
        doc.fillColor('#475569').font('Helvetica').fontSize(8);
        const metaParts = [`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`];
        metaParts.push(`Total Records: ${data.length}`);
        if (metadata.period) metaParts.push(`Period: ${metadata.period}`);
        if (metadata.generatedBy) metaParts.push(`Staff: ${metadata.generatedBy}`);
        if (metadata.filters) metaParts.push(`Filters: ${metadata.filters}`);
        doc.text(metaParts.join('  |  '), 25, 45);

        // Subtle divider line
        const pageWidth = isWide ? 842 : 595;
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(25, 58).lineTo(pageWidth - 25, 58).stroke();
        doc.moveDown(1.5);

        // Prepare table headers and rows
        const tableHeaders = columns.map((c) => c.label);
        const tableRows = data.map((item) =>
          columns.map((c) => {
            const val = item[c.key] !== undefined ? item[c.key] : item[c.label];
            return cleanText(val);
          })
        );

        const tableData = {
          headers: tableHeaders,
          rows: tableRows,
        };

        // Calculate font sizes according to column count
        const headerFontSize = columns.length > 8 ? 7 : 8;
        const rowFontSize = columns.length > 8 ? 6.5 : 7.5;

        await doc.table(tableData, {
          width: pageWidth - 50,
          prepareHeader: () => doc.font('Helvetica-Bold').fontSize(headerFontSize).fillColor('#0f172a'),
          prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
            doc.font('Helvetica').fontSize(rowFontSize).fillColor('#1e293b');
          },
        });

        // Add footer on each page
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fillColor('#94a3b8').font('Helvetica').fontSize(7);
          const pageHeight = isWide ? 595 : 842;
          doc.text(
            `Krishna CRM · Confidential Enterprise Record · Page ${i + 1} of ${totalPages}`,
            25,
            pageHeight - 18,
            { align: 'center', width: pageWidth - 50 }
          );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Fallback for unrecognized format
  res.status(400).json({
    success: false,
    message: `Unsupported export format '${format}'. Valid formats are: excel (.xlsx), pdf (.pdf), csv (.csv).`,
  });
}

module.exports = {
  sendExportResponse,
  cleanText,
};
