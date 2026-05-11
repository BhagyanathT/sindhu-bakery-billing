// src/services/pdfService.js — Professional PDF invoice generation using pdfkit
const path   = require('path');
const fs     = require('fs');
const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

// ── Ensure output directory exists ────────────────────────────────────────────
const PDF_DIR = path.join(__dirname, '../../public/pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  primary:   '#d97706', // amber-600
  dark:      '#1c1917', // stone-900
  mid:       '#57534e', // stone-600
  light:     '#f5f5f4', // stone-100
  border:    '#e7e5e4', // stone-200
  white:     '#ffffff',
  green:     '#16a34a',
  paid:      '#bbf7d0',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) => `Rs.${(Number(n) || 0).toFixed(2)}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * Generate a professional PDF invoice.
 */
const generateInvoicePdf = async (invoice, company, shortId) => {
  const fileName = `${shortId}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 48, info: {
        Title: `Invoice ${invoice.invoiceNumber || 'New'}`,
        Author: company.name || 'Sindhu Bakery',
      }});

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const W = doc.page.width - 96; // usable width
      const L = 48; // left margin
      const pageBottom = doc.page.height - 70;

      const drawHeader = () => {
        doc.rect(0, 0, doc.page.width, 90).fill(C.primary);
        const logoPath = path.join(__dirname, '../../public/logo.jpg');
        
        let headerTextX = L;
        try {
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, L, 15, { height: 60 });
            headerTextX = L + 70;
          }
        } catch (e) { logger.warn('Logo load failed in PDF'); }

        doc.fillColor(C.white).fontSize(20).font('Helvetica-Bold')
           .text(company.name || 'Sindhu Bakery', headerTextX, 22, { width: W / 2 - 20 });

        doc.fontSize(8).font('Helvetica')
           .text(company.address?.line1 || '', headerTextX, 48)
           .text([company.address?.city, company.address?.state, company.address?.pincode].filter(Boolean).join(', '), headerTextX, 58)
           .text(company.phone ? `Ph: ${company.phone}` : '', headerTextX, 68);

        // INVOICE label (right side)
        doc.fontSize(28).font('Helvetica-Bold').fillColor(C.white)
           .text('INVOICE', L + W / 2, 24, { width: W / 2, align: 'right' });

        doc.fillColor(C.white).fontSize(9).font('Helvetica')
           .text(`No: ${invoice.invoiceNumber || 'New'}`, L + W / 2, 56, { width: W / 2, align: 'right' })
           .text(`Date: ${fmtDate(invoice.date || invoice.createdAt)}`, L + W / 2, 68, { width: W / 2, align: 'right' });
      };

      drawHeader();

      // ── Bill To / Info Boxes ──────────────────────────────────────────────────
      let y = 110;
      doc.roundedRect(L, y, W / 2 - 8, 70, 6).fill(C.light);
      doc.fillColor(C.primary).fontSize(8).font('Helvetica-Bold').text('BILL TO', L + 10, y + 10);
      doc.fillColor(C.dark).fontSize(11).font('Helvetica-Bold').text(invoice.customerName || 'Walk-in Customer', L + 10, y + 24, { width: W / 2 - 28 });
      if (invoice.customerPhone) {
        doc.fontSize(9).font('Helvetica').fillColor(C.mid).text(`Ph: ${invoice.customerPhone}`, L + 10, y + 42);
      }
      if (invoice.customerGstin) {
        doc.fontSize(8).fillColor(C.mid).text(`GSTIN: ${invoice.customerGstin}`, L + 10, y + 55);
      }

      const statusColor = invoice.paymentStatus === 'paid' ? C.green : C.primary;
      const statusLabel = invoice.paymentStatus === 'paid' ? 'PAID' : invoice.paymentStatus === 'partial' ? 'PARTIAL' : 'UNPAID';
      doc.roundedRect(L + W / 2 + 8, y, W / 2 - 8, 70, 6).fill(C.light);
      doc.fillColor(statusColor).fontSize(14).font('Helvetica-Bold').text(statusLabel, L + W / 2 + 18, y + 24);
      doc.fillColor(C.mid).fontSize(9).font('Helvetica')
         .text(`Payment: ${(invoice.payments?.[0]?.method || 'cash').toUpperCase()}`, L + W / 2 + 18, y + 44)
         .text(`Total Paid: ${fmt(invoice.totalPaid)}`, L + W / 2 + 18, y + 56);

      // ── Table Header ──────────────────────────────────────────────────────────
      y = 200;
      doc.rect(L, y, W, 22).fill(C.dark);
      const cols = { name: L + 8, qty: L + W * 0.44, rate: L + W * 0.54, mrp: L + W * 0.64, disc: L + W * 0.75, amount: L + W * 0.88 };

      doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold');
      doc.text('ITEM', cols.name, y + 7);
      doc.text('QTY', cols.qty, y + 7);
      doc.text('RATE', cols.rate, y + 7);
      doc.text('MRP', cols.mrp, y + 7);
      doc.text('DISC', cols.disc, y + 7);
      doc.text('AMOUNT', cols.amount, y + 7, { align: 'right', width: W * 0.12 - 8 });

      // ── Rows with Auto-Paging ─────────────────────────────────────────────────
      y += 22;
      const items = invoice.items || [];
      let totalItemQty = 0;
      let totalMrpSavings = 0;
      items.forEach((item, i) => {
        const rowH = 24;
        if (y + rowH > pageBottom) {
          doc.addPage();
          y = 48; // reset Y to top (below margin)
          // Re-draw table header on new page
          doc.rect(L, y, W, 22).fill(C.dark);
          doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold');
          doc.text('ITEM', cols.name, y + 7);
          doc.text('QTY', cols.qty, y + 7);
          doc.text('RATE', cols.rate, y + 7);
          doc.text('MRP', cols.mrp, y + 7);
          doc.text('DISC', cols.disc, y + 7);
          doc.text('AMOUNT', cols.amount, y + 7, { align: 'right', width: W * 0.12 - 8 });
          y += 22;
        }

        totalItemQty += (item.quantity || 0);
        // MRP savings per item
        const itemMrp = item.mrp || 0;
        if (itemMrp > 0 && itemMrp > item.rate) {
          totalMrpSavings += (itemMrp - item.rate) * item.quantity;
        }

        // Compute auto-discount % from mrp vs rate if not set
        const discPct = item.discount
          ? item.discount
          : (itemMrp > 0 && item.rate > 0 ? Math.round(((itemMrp - item.rate) / itemMrp) * 100) : 0);

        if (i % 2 === 0) doc.rect(L, y, W, rowH).fill(C.light);
        doc.fillColor(C.dark).fontSize(9).font('Helvetica-Bold')
           .text(item.name || 'Item', cols.name, y + 7, { width: W * 0.42, ellipsis: true });
        doc.font('Helvetica').fillColor(C.mid)
           .text(`${item.quantity} ${item.unit || 'pcs'}`, cols.qty, y + 7)
           .text(fmt(item.rate), cols.rate, y + 7)
           .text(itemMrp > 0 ? fmt(itemMrp) : '-', cols.mrp, y + 7)
           .text(discPct > 0 ? `${discPct}%` : '-', cols.disc, y + 7)
           .text(fmt(item.amount), cols.amount, y + 7, { align: 'right', width: W * 0.12 - 8 });
        y += rowH;
      });

      // ── Totals ────────────────────────────────────────────────────────────────
      y += 12;
      if (y + 120 > pageBottom) { doc.addPage(); y = 48; }
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor(C.border).stroke();
      y += 10;

      const totalsX = L + W * 0.6;
      const totalsW = W * 0.4;
      const addTotalRow = (label, value, bold = false, highlight = false) => {
        if (highlight) {
          doc.rect(totalsX - 8, y - 4, totalsW + 8, 26).fill(C.primary);
          doc.fillColor(C.white);
        } else {
          doc.fillColor(bold ? C.dark : C.mid);
        }
        doc.fontSize(bold ? 11 : 9).font(bold ? 'Helvetica-Bold' : 'Helvetica')
           .text(label, totalsX, y, { width: totalsW * 0.55 })
           .text(value, totalsX + totalsW * 0.55, y, { width: totalsW * 0.45, align: 'right' });
        y += highlight ? 26 : 20;
      };

      addTotalRow(`Subtotal (${totalItemQty} items)`, fmt(invoice.subtotal));
      if (totalMrpSavings > 0) addTotalRow('MRP Savings', `- ${fmt(totalMrpSavings)}`);
      if (invoice.totalDiscount > 0) addTotalRow('Bill Discount', `- ${fmt(invoice.totalDiscount)}`);
      if (invoice.cgstTotal > 0) addTotalRow('CGST', fmt(invoice.cgstTotal));
      if (invoice.sgstTotal > 0) addTotalRow('SGST', fmt(invoice.sgstTotal));
      if (invoice.roundOff)      addTotalRow('Round Off', fmt(invoice.roundOff));
      y += 4;
      addTotalRow('GRAND TOTAL', fmt(invoice.grandTotal), true, true);

      // ── You Saved banner ─────────────────────────────────────────────────────
      const totalYouSaved = totalMrpSavings + (invoice.totalDiscount || 0);
      if (totalYouSaved > 0) {
        y += 8;
        if (y + 28 > pageBottom) { doc.addPage(); y = 48; }
        doc.rect(totalsX - 8, y - 4, totalsW + 8, 28).fill('#d1fae5'); // green-100
        doc.fillColor('#065f46').fontSize(10).font('Helvetica-Bold')  // green-800
           .text('You Saved', totalsX, y + 3, { width: totalsW * 0.55 })
           .text(fmt(totalYouSaved), totalsX + totalsW * 0.55, y + 3, { width: totalsW * 0.45, align: 'right' });
        y += 28;
      }

      if (invoice.notes) {
        y += 15;
        doc.fontSize(8).fillColor(C.mid).font('Helvetica-Bold').text('Notes:', L, y);
        doc.font('Helvetica').text(invoice.notes, L, y + 12, { width: W });
      }

      // ── Sticky Footer on Every Page? No, just last page ──
      const pageH = doc.page.height;
      doc.rect(0, pageH - 50, doc.page.width, 50).fill(C.dark);
      doc.fillColor(C.white).fontSize(8).font('Helvetica')
         .text('Thank you for your business!', L, pageH - 35, { width: W, align: 'center' })
         .text(`${company.name || 'Sindhu Bakery'} · ${new Date().toLocaleString('en-IN')}`, L, pageH - 20, { width: W, align: 'center' });

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) { reject(err); }
  });
};

module.exports = { generateInvoicePdf, PDF_DIR };
