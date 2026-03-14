const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function generateReceiptPdf(receipt) {
  const dir = path.join(__dirname, '..', 'data', 'receipts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, `${receipt.receiptNumber}.pdf`);
  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(fs.createWriteStream(filePath));

  doc.fontSize(20).text('MediFlow City Hospital', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).text('Payment Receipt', { align: 'center' });
  doc.moveDown();

  doc.fontSize(11);
  doc.text(`Receipt No: ${receipt.receiptNumber}`);
  doc.text(`Date: ${new Date(receipt.paymentDate).toLocaleString()}`);
  doc.text(`Patient: ${receipt.patientName} (${receipt.patientId})`);
  doc.text(`Bill Ref: ${receipt.billId}`);
  doc.text(`Payment Mode: ${receipt.paymentMode}`);
  doc.text(`Status: ${receipt.paymentStatus}`);
  doc.moveDown();
  doc.text('Services Summary:');
  doc.text(receipt.servicesSummary);
  doc.moveDown();
  doc.fontSize(14).text(`Amount Paid: ₹${receipt.amountPaid.toFixed(2)}`);

  doc.end();

  return filePath;
}

module.exports = { generateReceiptPdf };
