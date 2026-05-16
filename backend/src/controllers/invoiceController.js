// src/controllers/invoiceController.js — Direct Mongoose queries. No mock data.
const mongoose = require('mongoose');
const pdfService = require('../services/pdfService');
const crypto = require('crypto');
const Invoice = require('../models/Invoice');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const AuditLog = require('../models/AuditLog');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { calculateInvoiceTotals } = require('../utils/gstCalculator');

// ── Invoice Number Generator ──────────────────────────────────────────────────
const getNextInvoiceNumber = async (company) => {
  const prefix = company.settings?.invoicePrefix || 'INV';
  // Find the highest existing number to start from
  const lastInvoice = await Invoice.findOne({
    company: company._id,
    invoiceNumber: { $regex: `^${prefix}-` }
  }).sort({ createdAt: -1 }).select('invoiceNumber').lean();

  let num = company.settings?.currentInvoiceNumber || 1;
  if (lastInvoice?.invoiceNumber) {
    const match = lastInvoice.invoiceNumber.match(/(\d+)$/);
    if (match) num = Math.max(num, parseInt(match[1]) + 1);
  }
  // Keep incrementing until we find a number not already in the DB
  while (await Invoice.exists({ company: company._id, invoiceNumber: `${prefix}-${String(num).padStart(5,'0')}` })) {
    num++;
  }
  await Company.findByIdAndUpdate(company._id, { 'settings.currentInvoiceNumber': num + 1 });
  return `${prefix}-${String(num).padStart(5, '0')}`;
};

// ── Create Invoice ────────────────────────────────────────────────────────────
exports.createInvoice = async (req, res, next) => {
  try {
    const { items, customerId, isInterState = false, payments = [], discount = 0 } = req.body;
    let { customerName, customerPhone } = req.body;
    const company = req.company;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('Invoice must have at least one item.', 400));
    }

    const totals = calculateInvoiceTotals(items, isInterState);

    // Apply bill-level discount to grand total
    const grandTotalAfterDiscount = Math.max(0, totals.grandTotal - (discount || 0));

    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paymentStatus = totalPaid >= grandTotalAfterDiscount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
    const invoiceNumber = await getNextInvoiceNumber(company);

    // Handle customer
    let customerData = {};
    if (customerId) {
      const customer = await Customer.findById(customerId).lean();
      if (customer) {
        customerData = {
          customer: customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerGstin: customer.gstin,
        };
        await Customer.findByIdAndUpdate(customerId, {
          $inc: {
            totalPurchase: grandTotalAfterDiscount,
            totalPaid: totalPaid,
            creditBalance: grandTotalAfterDiscount - totalPaid,
          },
          lastTransactionDate: new Date(),
        });
      }
    } else if (customerName) {
      customerData = { customerName, customerPhone };
    } else {
      const guestCount = await Invoice.countDocuments({ company: company._id, customerName: /^Customer / });
      customerData = { customerName: `Customer ${guestCount + 1}` };
    }

    // ✅ Build invoice from calculated values only — never spread req.body to avoid overwrites
    const invoice = await Invoice.create({
      company: company._id,
      invoiceNumber,
      ...customerData,
      items: totals.items,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount + (discount || 0),
      totalTax: totals.totalTax,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      grandTotal: grandTotalAfterDiscount,
      roundOff: totals.roundOff,
      payments,
      totalPaid,
      paymentStatus,
      isInterState,
      createdBy: req.user._id,
      notes: req.body.notes,
      terms: req.body.terms,
      type: req.body.type || 'sale',
    });

    // Deduct stock — update each sold product's current stock and salesCount
    for (const item of totals.items) {
      if (item.product) {
        const product = await Product.findById(item.product);
        if (product) {
          const newStock = Math.max(0, product.stock.current - item.quantity);
          await Product.findByIdAndUpdate(item.product, {
            $set: { 'stock.current': newStock },
            $inc: { salesCount: item.quantity },
          });
        }
      }
    }

    AuditLog.create({
      company: company._id,
      user: req.user._id,
      action: 'CREATE',
      module: 'invoice',
      description: `Invoice ${invoiceNumber} created for ${customerData.customerName}`,
      document: invoice._id,
    }).catch(() => {});

    // ── Auto-send WhatsApp invoice via automationService (fire-and-forget) ──────
    const automationService = require('../services/automationService');
    automationService.onBillCreated(
      { ...invoice.toObject(), ...customerData, invoiceNumber },
      req.company,
      req.user._id,
      null  // pdfLink — null for normal auto-send (no PDF in auto mode)
    );

    const populated = await invoice.populate(['customer', 'items.product']);
    res.status(201).json({ success: true, data: { invoice: populated } });
  } catch (err) { next(err); }
};


// ── Quick Invoice (Flash Billing) ────────────────────────────────────────────
exports.createQuickInvoice = async (req, res, next) => {
  try {
    const { total, note, paymentMethod = 'cash' } = req.body;
    const company = req.company;

    if (!total || Number(total) <= 0) {
      return next(new AppError('Invalid amount. Please enter a valid total.', 400));
    }

    const grandTotal = Number(total);

    // Generate QB invoice number — retry until we find a free slot
    const lastQB = await Invoice.findOne({ company: company._id, invoiceNumber: { $regex: '^QB-' } })
      .sort({ createdAt: -1 })
      .select('invoiceNumber')
      .lean();

    let qbNum = 1;
    if (lastQB?.invoiceNumber) {
      const match = lastQB.invoiceNumber.match(/(\d+)$/);
      if (match) qbNum = parseInt(match[1]) + 1;
    }
    // Skip any that already exist (in case of gaps or imports)
    while (await Invoice.exists({ company: company._id, invoiceNumber: `QB-${String(qbNum).padStart(4,'0')}` })) {
      qbNum++;
    }
    const invoiceNumber = `QB-${String(qbNum).padStart(4, '0')}`;

    const invoice = await Invoice.create({
      company: company._id,
      invoiceNumber,
      customerName: 'Walk-in',
      items: [],
      subtotal: grandTotal,
      totalDiscount: 0,
      totalTax: 0,
      grandTotal,
      payments: [{ method: paymentMethod, amount: grandTotal }],
      totalPaid: grandTotal,
      paymentStatus: 'paid',
      billingMode: 'quick',
      quickNote: note || '',
      notes: note || '',
      createdBy: req.user._id,
      type: 'sale',
      status: 'confirmed',
    });

    res.status(201).json({ success: true, data: { invoice } });
  } catch (err) { next(err); }
};

// ── Get Invoices (paginated) ──────────────────────────────────────────────────
exports.getInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type = 'sale', status, paymentMethod, startDate, endDate, search, customerId, billingMode } = req.query;
    const query = { company: req.company._id, type };

    if (status) query.paymentStatus = status;
    if (paymentMethod) query['payments.method'] = paymentMethod.toLowerCase();
    if (customerId) query.customer = customerId;
    if (billingMode) query.billingMode = billingMode;
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        const s = new Date(`${startDate.split('T')[0]}T00:00:00+05:30`);
        if (!isNaN(s.getTime())) dateFilter.$gte = s;
      }
      if (endDate) {
        const e = new Date(`${endDate.split('T')[0]}T23:59:59+05:30`);
        if (!isNaN(e.getTime())) dateFilter.$lte = e;
      }
      query.date = dateFilter;
    }
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .populate('customer', 'name phone')
        .sort({ date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Invoice.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: { invoices, total, page: pageNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) { next(err); }
};

// ── Get Single Invoice ────────────────────────────────────────────────────────
exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.company._id })
      .populate('customer')
      .populate('items.product')
      .populate('createdBy', 'name email');
    if (!invoice) return next(new AppError('Invoice not found.', 404));
    res.json({ success: true, data: { invoice } });
  } catch (err) { next(err); }
};

// ── Generate PDF ──────────────────────────────────────────────────────────────
exports.generatePdf = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.company._id })
      .populate('customer')
      .lean();
    if (!invoice) return next(new AppError('Invoice not found', 404));

    const company = await Company.findById(req.company._id).lean();
    const shortId = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    
    const filePath = await pdfService.generateInvoicePdf(invoice, company, shortId);
    
    // Sanitize filename for Windows/Linux
    const safeName = (invoice.invoiceNumber || 'Invoice').replace(/[/\\?%*:|"<>]/g, '-');
    res.download(filePath, `Invoice-${safeName}.pdf`);
  } catch (err) {
    logger.error('PDF Generation Error:', err);
    next(err);
  }
};

// ── Delete Invoice ──────────────────────────────────────────────────────────
exports.deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.company._id });
    if (!invoice) return next(new AppError('Invoice not found.', 404));

    // Restore stock for all items
    for (const item of invoice.items) {
      if (item.product) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { 'stock.current': item.quantity, salesCount: -item.quantity }
        });
      }
    }

    // Restore customer balances if tied to a customer
    if (invoice.customer) {
      await Customer.findByIdAndUpdate(invoice.customer, {
        $inc: {
          totalPurchase: -invoice.grandTotal,
          totalPaid: -invoice.totalPaid,
          creditBalance: -(invoice.grandTotal - invoice.totalPaid),
        }
      });
    }

    // Log deletion
    await AuditLog.create({
      company: req.company._id,
      user: req.user._id,
      action: 'DELETE',
      module: 'invoice',
      description: `Invoice ${invoice.invoiceNumber} deleted`,
    }).catch(() => {});

    await Invoice.deleteOne({ _id: invoice._id });

    res.json({ success: true, message: 'Invoice deleted and stock restored.' });
  } catch (err) { next(err); }
};

// ── Update Invoice ──────────────────────────────────────────────────────────
exports.updateInvoice = async (req, res, next) => {
  try {
    const { items, customerId, isInterState = false, payments = [], discount = 0, customerName, customerPhone } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.company._id });

    if (!invoice) return next(new AppError('Invoice not found.', 404));

    if (!items || !Array.isArray(items) || items.length === 0) {
      return next(new AppError('Invoice must have at least one item.', 400));
    }

    // 1. Revert Old Stock & Customer Balances
    for (const oldItem of invoice.items) {
      if (oldItem.product) {
        await Product.findByIdAndUpdate(oldItem.product, {
          $inc: { 'stock.current': oldItem.quantity, salesCount: -oldItem.quantity }
        });
      }
    }

    if (invoice.customer) {
      await Customer.findByIdAndUpdate(invoice.customer, {
        $inc: {
          totalPurchase: -invoice.grandTotal,
          totalPaid: -invoice.totalPaid,
          creditBalance: -(invoice.grandTotal - invoice.totalPaid),
        }
      });
    }

    // 2. Calculate New Totals
    const totals = calculateInvoiceTotals(items, isInterState);
    const grandTotalAfterDiscount = Math.max(0, totals.grandTotal - (discount || 0));
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paymentStatus = totalPaid >= grandTotalAfterDiscount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';

    // 3. Update Customer logic
    let customerData = { customerName: invoice.customerName, customerPhone: invoice.customerPhone }; // Default to existing
    
    if (customerId) {
      const customer = await Customer.findById(customerId).lean();
      if (customer) {
        customerData = {
          customer: customerId,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerGstin: customer.gstin,
        };
        await Customer.findByIdAndUpdate(customerId, {
          $inc: {
            totalPurchase: grandTotalAfterDiscount,
            totalPaid: totalPaid,
            creditBalance: grandTotalAfterDiscount - totalPaid,
          },
          lastTransactionDate: new Date(),
        });
      }
    } else if (customerName) {
      customerData = { customerName, customerPhone };
    }

    // 4. Deduct New Stock
    for (const item of totals.items) {
      if (item.product) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { 'stock.current': -item.quantity, salesCount: item.quantity }
        });
      }
    }

    // 5. Update Invoice Document
    Object.assign(invoice, {
      ...customerData,
      items: totals.items,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount + (discount || 0),
      totalTax: totals.totalTax,
      cgstTotal: totals.cgstTotal,
      sgstTotal: totals.sgstTotal,
      igstTotal: totals.igstTotal,
      grandTotal: grandTotalAfterDiscount,
      roundOff: totals.roundOff,
      payments,
      totalPaid,
      paymentStatus,
      isInterState,
    });

    await invoice.save();

    await AuditLog.create({
      company: req.company._id,
      user: req.user._id,
      action: 'UPDATE',
      module: 'invoice',
      description: `Invoice ${invoice.invoiceNumber} updated`,
    }).catch(() => {});

    res.json({ success: true, data: { invoice } });
  } catch (err) { next(err); }
};

// ── Add Payment ───────────────────────────────────────────────────────────────
exports.addPayment = async (req, res, next) => {
  try {
    const { amount, method, reference, note } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, company: req.company._id });
    if (!invoice) return next(new AppError('Invoice not found.', 404));

    invoice.payments.push({ amount, method, reference, note, date: new Date() });
    invoice.totalPaid = (invoice.totalPaid || 0) + amount;
    invoice.paymentStatus = invoice.totalPaid >= invoice.grandTotal ? 'paid' : 'partial';

    if (invoice.customer) {
      await Customer.findByIdAndUpdate(invoice.customer, {
        $inc: { totalPaid: amount, creditBalance: -amount },
      });
    }

    await invoice.save();
    res.json({ success: true, data: { invoice } });
  } catch (err) { next(err); }
};

// ── Dashboard Stats ───────────────────────────────────────────────────────────
exports.getDashboardStats = async (req, res, next) => {
  try {
    // ✅ Must cast to ObjectId for aggregation $match to work correctly
    const company = new mongoose.Types.ObjectId(req.company._id);
    const now = new Date();

    // Use UTC midnight boundaries (MongoDB stores dates in UTC)
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

    const [todaySales, monthlySales, yearlySales, unpaidInvoices, totalCustomers, paymentMix] = await Promise.all([
      Invoice.aggregate([
        { $match: { company, type: 'sale', date: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { company, type: 'sale', date: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { company, type: 'sale', date: { $gte: startOfYear } } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } },
      ]),
      Invoice.aggregate([
        { $match: { company, type: 'sale', paymentStatus: { $in: ['unpaid', 'partial'] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$grandTotal', '$totalPaid'] } }, count: { $sum: 1 } } },
      ]),
      Customer.countDocuments({ company: req.company._id }),
      Invoice.aggregate([
        { $match: { company, type: 'sale', date: { $gte: startOfMonth } } },
        { $unwind: '$payments' },
        { $group: { _id: '$payments.method', count: { $sum: 1 } } },
      ]),
    ]);

    // Format payment mix for pie chart
    const totalPayments = paymentMix.reduce((sum, p) => sum + p.count, 0);
    const paymentData = paymentMix.map(p => ({
      name: p._id.toUpperCase(),
      value: totalPayments > 0 ? Math.round((p.count / totalPayments) * 100) : 0,
      color: p._id === 'cash' ? '#d97706' : p._id === 'upi' ? '#10b981' : p._id === 'card' ? '#6366f1' : '#ef4444',
    }));

    res.json({
      success: true,
      data: {
        today: { sales: todaySales[0]?.total || 0, invoices: todaySales[0]?.count || 0 },
        month: { sales: monthlySales[0]?.total || 0, invoices: monthlySales[0]?.count || 0 },
        year: { sales: yearlySales[0]?.total || 0 },
        unpaid: { amount: unpaidInvoices[0]?.total || 0, count: unpaidInvoices[0]?.count || 0 },
        totalCustomers,
        paymentMix: paymentData.length > 0 ? paymentData : [
          { name: 'CASH', value: 0, color: '#d97706' },
          { name: 'UPI', value: 0, color: '#10b981' },
          { name: 'CARD', value: 0, color: '#6366f1' },
          { name: 'CREDIT', value: 0, color: '#ef4444' },
        ],
      },
    });
  } catch (err) { next(err); }
};

// ── Sales Chart ───────────────────────────────────────────────────────────────
exports.getSalesChart = async (req, res, next) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;
    // ✅ Cast to ObjectId for aggregation
    const company = new mongoose.Types.ObjectId(req.company._id);

    let groupBy, dateFilter;
    if (period === 'daily') {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);
      dateFilter = { $gte: startOfWeek };
      groupBy = { day: { $dayOfMonth: '$date' }, month: { $month: '$date' } };
    } else if (period === 'monthly') {
      dateFilter = { $gte: new Date(Date.UTC(parseInt(year), 0, 1)), $lte: new Date(Date.UTC(parseInt(year), 11, 31, 23, 59, 59)) };
      groupBy = { month: { $month: '$date' } };
    } else {
      dateFilter = { $gte: new Date(Date.UTC(parseInt(year) - 2, 0, 1)) };
      groupBy = { year: { $year: '$date' } };
    }

    const data = await Invoice.aggregate([
      { $match: { company, type: 'sale', date: dateFilter } },
      { $group: { _id: groupBy, sales: { $sum: '$grandTotal' }, invoices: { $sum: 1 } } },
      { $sort: { '_id.month': 1, '_id.day': 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// ── Period Stats (for Orders page filter summary) ─────────────────────────────
exports.getPeriodStats = async (req, res, next) => {
  try {
    const { startDate, endDate, paymentMethod, billingMode, type = 'sale' } = req.query;
    const company = new mongoose.Types.ObjectId(req.company._id);
    const dateFilter = {};
    if (startDate) {
      const s = new Date(`${startDate.split('T')[0]}T00:00:00+05:30`);
      if (!isNaN(s.getTime())) dateFilter.$gte = s;
    }
    if (endDate) {
      const e = new Date(`${endDate.split('T')[0]}T23:59:59+05:30`);
      if (!isNaN(e.getTime())) dateFilter.$lte = e;
    }

    const matchQuery = { company, type };
    if (startDate || endDate) matchQuery.date = dateFilter;
    if (paymentMethod) matchQuery['payments.method'] = paymentMethod.toLowerCase();
    if (billingMode) matchQuery.billingMode = billingMode;

    const [stats, paymentBreakdown] = await Promise.all([
      Invoice.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$grandTotal' },
            totalOrders: { $sum: 1 },
            totalDiscount: { $sum: '$totalDiscount' },
            totalTax: { $sum: '$totalTax' },
            avgOrderValue: { $avg: '$grandTotal' },
          }
        }
      ]),
      Invoice.aggregate([
        { $match: matchQuery },
        { $unwind: { path: '$payments', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$payments.method',
            count: { $sum: 1 },
            amount: { $sum: '$payments.amount' }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        totalAmount: stats[0]?.totalAmount || 0,
        totalOrders: stats[0]?.totalOrders || 0,
        totalDiscount: stats[0]?.totalDiscount || 0,
        totalTax: stats[0]?.totalTax || 0,
        avgOrderValue: Math.round(stats[0]?.avgOrderValue || 0),
        paymentBreakdown,
      }
    });
  } catch (err) { next(err); }
};

// ── Bulk Import old orders (admin only) ───────────────────────────────────────
exports.bulkImport = async (req, res, next) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
      return next(new AppError('orders array is required', 400));
    }

    const created = [];
    const errors  = [];

    for (let i = 0; i < orders.length; i++) {
      const raw = orders[i];
      try {
        // Normalise: accept BOTH camelCase (API) AND Excel headers from our own export
        // Our export columns: 'Grand Total','Bill No','Customer','Phone','Payment',
        //                     'Subtotal','Discount','GST','Date','Time','Items Count','Status'
        const norm = {
          grandTotal:    raw['Grand Total']  ?? raw.grandTotal    ?? raw.total         ?? raw['Total']         ?? 0,
          invoiceNumber: raw['Bill No']      ?? raw.invoiceNumber ?? raw.orderId       ?? raw['Order ID']      ?? '',
          customerName:  raw['Customer']     ?? raw.customerName  ?? raw.customer      ?? raw['Customer Name'] ?? 'Walk-in Customer',
          customerPhone: raw['Phone']        ?? raw.customerPhone ?? raw.phone         ?? '',
          paymentMethod: raw['Payment']      ?? raw.paymentMethod ?? raw.payment       ?? 'cash',
          subtotal:      raw['Subtotal']     ?? raw.subtotal      ?? 0,
          discount:      raw['Discount']     ?? raw.discount      ?? raw.totalDiscount ?? 0,
          gst:           raw['GST']          ?? raw.gst           ?? raw.tax           ?? raw.totalTax         ?? 0,
          date:          raw['Date']         ?? raw.date          ?? null,
          items:         raw.items           ?? [],
        };

        const grandTotal = parseFloat(norm.grandTotal) || 0;
        // Skip the TOTAL summary row that Excel export appends at the bottom
        if (!grandTotal || String(norm.invoiceNumber).startsWith('TOTAL')) {
          continue; // silently skip, not an error
        }

        // Parse date — handle en-IN format DD/MM/YYYY and ISO formats
        let parsedDate = new Date();
        if (norm.date) {
          const d = String(norm.date).trim();
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) {
            const [dd, mm, yyyy] = d.split('/');
            parsedDate = new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`);
          } else {
            parsedDate = new Date(d);
          }
          if (isNaN(parsedDate.getTime())) parsedDate = new Date();
        }

        const method = String(norm.paymentMethod).toLowerCase().replace(/[^a-z]/g,'') || 'cash';

          // Generate unique invoice number — use provided one, or generate with index+random to avoid collisions
          let invoiceNumber = norm.invoiceNumber
            ? String(norm.invoiceNumber).trim()
            : `IMP-${Date.now()}-${i}-${Math.random().toString(36).slice(2,6)}`;

          // If provided invoiceNumber already exists, append suffix rather than fail
          const exists = await Invoice.exists({ company: req.company._id, invoiceNumber });
          if (exists) {
            invoiceNumber = `${invoiceNumber}-R${i}`;
          }

          const inv = await Invoice.create({
          company:       req.company._id,
          invoiceNumber,
          customerName:  norm.customerName,
          customerPhone: norm.customerPhone,
          items: Array.isArray(norm.items) ? norm.items.map(it => ({
            name:     it.name     || 'Item',
            quantity: parseFloat(it.qty || it.quantity || 1),
            rate:     parseFloat(it.rate || it.price   || 0),
            amount:   parseFloat(it.total|| it.amount  || 0),
            taxRate:  0,
          })) : [],
          subtotal:      parseFloat(norm.subtotal) || grandTotal,
          totalDiscount: parseFloat(norm.discount) || 0,
          totalTax:      parseFloat(norm.gst)      || 0,
          grandTotal,
          payments:      [{ method, amount: grandTotal }],
          totalPaid:     grandTotal,
          paymentStatus: 'paid',
          type:          'sale',
          status:        'confirmed',
          date:          parsedDate,
          createdBy:     req.user._id,
        });
        created.push(inv._id);
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }

    res.json({
      success: true,
      data: {
        imported: created.length,
        failed:   errors.length,
        total:    orders.length,
        errors:   errors.slice(0, 20),
      }
    });
  } catch (err) { next(err); }
};
