// src/controllers/customerController.js — Direct Mongoose queries. No demo fallback.
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const AppError = require('../utils/AppError');
const AuditLog = require('../models/AuditLog');
const xlsx = require('xlsx');

exports.getCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, hasCredit, sort = '-createdAt' } = req.query;
    const query = { company: req.company._id, isActive: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }
    if (hasCredit === 'true') query.creditBalance = { $gt: 0 };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [customers, total, creditAgg] = await Promise.all([
      Customer.find(query).sort(sort).skip(skip).limit(limitNum).lean(),
      Customer.countDocuments(query),
      Customer.aggregate([
        { $match: { company: req.company._id, isActive: true, creditBalance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$creditBalance' } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        customers,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        totalCredit: creditAgg[0]?.total || 0,
      },
    });
  } catch (err) { next(err); }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, company: req.company._id });
    if (!customer) return next(new AppError('Customer not found.', 404));
    res.json({ success: true, data: { customer } });
  } catch (err) { next(err); }
};

exports.createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create({ ...req.body, company: req.company._id });
    res.status(201).json({ success: true, data: { customer } });
  } catch (err) { next(err); }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!customer) return next(new AppError('Customer not found.', 404));
    res.json({ success: true, data: { customer } });
  } catch (err) { next(err); }
};

exports.getCustomerTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const [invoices, total] = await Promise.all([
      Invoice.find({ customer: req.params.id, company: req.company._id })
        .sort({ date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select('invoiceNumber date grandTotal totalPaid paymentStatus type')
        .lean(),
      Invoice.countDocuments({ customer: req.params.id, company: req.company._id }),
    ]);
    res.json({ success: true, data: { invoices, total } });
  } catch (err) { next(err); }
};

exports.getTopCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find({ company: req.company._id })
      .sort({ totalPurchase: -1 })
      .limit(10)
      .select('name phone totalPurchase totalPaid creditBalance')
      .lean();
    res.json({ success: true, data: { customers } });
  } catch (err) { next(err); }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      { isActive: false },
      { new: true }
    );
    if (!customer) return next(new AppError('Customer not found.', 404));
    res.json({ success: true, message: 'Customer deleted.' });
  } catch (err) { next(err); }
};

exports.bulkDeleteCustomers = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('Please select customers to delete.', 400));
    }
    
    await Customer.updateMany(
      { _id: { $in: ids }, company: req.company._id },
      { isActive: false }
    );
    
    res.json({ success: true, message: `${ids.length} customers deleted.` });
  } catch (err) { next(err); }
};


exports.exportCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find({ company: req.company._id, isActive: true })
      .select('name phone email gstin customerType address creditLimit creditBalance totalPurchase totalPaid notes tags')
      .lean();

    const data = customers.map(c => ({
      Name: c.name,
      Phone: c.phone || '',
      Email: c.email || '',
      GSTIN: c.gstin || '',
      Type: c.customerType,
      'Address Line 1': c.address?.line1 || '',
      'Address Line 2': c.address?.line2 || '',
      City: c.address?.city || '',
      State: c.address?.state || '',
      Pincode: c.address?.pincode || '',
      'Credit Limit': c.creditLimit || 0,
      'Credit Balance': c.creditBalance || 0,
      'Total Purchase': c.totalPurchase || 0,
      'Total Paid': c.totalPaid || 0,
      Notes: c.notes || '',
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Customers');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="customers_backup.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
};

exports.importCustomers = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please upload an excel file.', 400));
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let importedCount = 0;
    let updatedCount = 0;

    for (const row of data) {
      if (!row.Name) continue; // Name is required

      const customerData = {
        company: req.company._id,
        name: row.Name,
        phone: row.Phone?.toString() || '',
        email: row.Email || '',
        gstin: row.GSTIN || '',
        customerType: ['retail', 'wholesale', 'distributor'].includes(row.Type?.toLowerCase()) ? row.Type.toLowerCase() : 'retail',
        address: {
          line1: row['Address Line 1'] || '',
          line2: row['Address Line 2'] || '',
          city: row.City || '',
          state: row.State || '',
          pincode: row.Pincode?.toString() || '',
        },
        creditLimit: parseFloat(row['Credit Limit']) || 0,
        notes: row.Notes || '',
      };

      let existing = null;
      if (customerData.phone) {
        existing = await Customer.findOne({ company: req.company._id, phone: customerData.phone });
      }
      if (!existing && customerData.email) {
        existing = await Customer.findOne({ company: req.company._id, email: customerData.email });
      }
      if (!existing) {
        existing = await Customer.findOne({ company: req.company._id, name: customerData.name });
      }

      if (existing) {
        if (row['Credit Balance'] !== undefined) customerData.creditBalance = parseFloat(row['Credit Balance']) || 0;
        if (row['Total Purchase'] !== undefined) customerData.totalPurchase = parseFloat(row['Total Purchase']) || 0;
        if (row['Total Paid'] !== undefined) customerData.totalPaid = parseFloat(row['Total Paid']) || 0;

        await Customer.findByIdAndUpdate(existing._id, customerData);
        updatedCount++;
      } else {
        if (row['Credit Balance'] !== undefined) customerData.creditBalance = parseFloat(row['Credit Balance']) || 0;
        if (row['Total Purchase'] !== undefined) customerData.totalPurchase = parseFloat(row['Total Purchase']) || 0;
        if (row['Total Paid'] !== undefined) customerData.totalPaid = parseFloat(row['Total Paid']) || 0;
        
        await Customer.create(customerData);
        importedCount++;
      }
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedCount} and updated ${updatedCount} customers.`
    });
  } catch (err) {
    next(err);
  }
};
