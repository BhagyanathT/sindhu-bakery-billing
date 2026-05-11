// src/utils/gstCalculator.js

const GST_SLABS = [0, 5, 12, 18, 28];

/**
 * Calculate GST breakdown for an invoice item
 * @param {number} rate - Unit price
 * @param {number} quantity - Quantity
 * @param {number} discount - Discount amount/percentage
 * @param {string} discountType - 'percentage' | 'fixed'
 * @param {number} gstRate - GST rate (0, 5, 12, 18, 28)
 * @param {string} taxType - 'inclusive' | 'exclusive'
 * @param {boolean} isInterState - IGST vs CGST/SGST
 */
const calculateGST = ({
  rate,
  quantity,
  discount = 0,
  discountType = 'percentage',
  gstRate = 18,
  taxType = 'exclusive',
  isInterState = false,
}) => {
  const grossAmount = rate * quantity;
  let discountAmount = 0;

  if (discountType === 'percentage') {
    discountAmount = (grossAmount * discount) / 100;
  } else {
    discountAmount = discount;
  }

  const preTaxAmount = grossAmount - discountAmount;
  let taxAmount = 0;
  let baseAmount = preTaxAmount;

  if (taxType === 'inclusive') {
    baseAmount = preTaxAmount / (1 + gstRate / 100);
    taxAmount = preTaxAmount - baseAmount;
  } else {
    taxAmount = (preTaxAmount * gstRate) / 100;
  }

  const cgst = isInterState ? 0 : taxAmount / 2;
  const sgst = isInterState ? 0 : taxAmount / 2;
  const igst = isInterState ? taxAmount : 0;

  return {
    grossAmount: parseFloat(grossAmount.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    baseAmount: parseFloat(baseAmount.toFixed(2)),
    taxAmount: parseFloat(taxAmount.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    igst: parseFloat(igst.toFixed(2)),
    total: parseFloat((baseAmount + taxAmount).toFixed(2)),
  };
};

/**
 * Calculate totals for all invoice items
 */
const calculateInvoiceTotals = (items, isInterState = false) => {
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  const processedItems = items.map((item) => {
    const calc = calculateGST({
      rate: item.rate,
      quantity: item.quantity,
      discount: item.discount || 0,
      discountType: item.discountType || 'percentage',
      gstRate: item.taxRate || 0,
      taxType: item.taxType || 'exclusive',
      isInterState,
    });

    subtotal += calc.grossAmount;
    totalDiscount += calc.discountAmount;
    totalTax += calc.taxAmount;
    cgstTotal += calc.cgst;
    sgstTotal += calc.sgst;
    igstTotal += calc.igst;

    return {
      ...item,
      amount: calc.total,
      taxAmount: calc.taxAmount,
      cgst: calc.cgst,
      sgst: calc.sgst,
      igst: calc.igst,
    };
  });

  const grandTotal = subtotal - totalDiscount + totalTax;
  const roundOff = Math.round(grandTotal) - grandTotal;

  return {
    items: processedItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalDiscount: parseFloat(totalDiscount.toFixed(2)),
    totalTax: parseFloat(totalTax.toFixed(2)),
    cgstTotal: parseFloat(cgstTotal.toFixed(2)),
    sgstTotal: parseFloat(sgstTotal.toFixed(2)),
    igstTotal: parseFloat(igstTotal.toFixed(2)),
    grandTotal: parseFloat((grandTotal + roundOff).toFixed(2)),
    roundOff: parseFloat(roundOff.toFixed(2)),
  };
};

const getGSTSlab = (rate) => {
  return GST_SLABS.find((slab) => slab === rate) ?? 18;
};

module.exports = { calculateGST, calculateInvoiceTotals, getGSTSlab, GST_SLABS };
