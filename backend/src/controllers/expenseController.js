// src/controllers/expenseController.js — Direct Mongoose queries. No demo fallback.
const Expense = require('../models/Expense');
const AppError = require('../utils/AppError');
const xlsx = require('xlsx');

exports.getExpenses = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, startDate, endDate } = req.query;
    const query = { company: req.company._id };

    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const [expenses, total, totals] = await Promise.all([
      Expense.find(query)
        .populate('createdBy', 'name')
        .sort({ date: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Expense.countDocuments(query),
      Expense.aggregate([{ $match: query }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    res.json({
      success: true,
      data: { expenses, total, totalAmount: totals[0]?.total || 0 },
    });
  } catch (err) { next(err); }
};

exports.createExpense = async (req, res, next) => {
  try {
    const expense = await Expense.create({
      ...req.body,
      company: req.company._id,
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, data: { expense } });
  } catch (err) { next(err); }
};

exports.updateExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!expense) return next(new AppError('Expense not found.', 404));
    res.json({ success: true, data: { expense } });
  } catch (err) { next(err); }
};

exports.deleteExpense = async (req, res, next) => {
  try {
    const expense = await Expense.findOneAndDelete({
      _id: req.params.id,
      company: req.company._id,
    });
    if (!expense) return next(new AppError('Expense not found.', 404));
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (err) { next(err); }
};

exports.exportExpenses = async (req, res, next) => {
  try {
    const expenses = await Expense.find({ company: req.company._id }).lean();
    const data = expenses.map(e => ({
      Title: e.title,
      Amount: e.amount,
      Category: e.category,
      Date: new Date(e.date).toLocaleDateString('en-IN'),
      'Payment Method': e.paymentMethod,
      Reference: e.reference || '',
      Notes: e.notes || '',
      Tax: e.tax || 0,
      'Is Recurring': e.isRecurring ? 'Yes' : 'No',
      'Recurring Interval': e.recurringInterval || ''
    }));

    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Expenses');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="expenses_backup.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) { next(err); }
};

exports.importExpenses = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('Please upload an excel file.', 400));
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    let importedCount = 0;

    for (const row of data) {
      if (!row.Title || !row.Amount) continue; 

      let parsedDate = new Date();
      if (row.Date) {
        const d = String(row.Date).trim();
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) {
          const [dd, mm, yyyy] = d.split('/');
          parsedDate = new Date(`${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`);
        } else {
          parsedDate = new Date(d);
        }
        if (isNaN(parsedDate.getTime())) parsedDate = new Date();
      }

      await Expense.create({
        company: req.company._id,
        title: row.Title,
        amount: parseFloat(row.Amount) || 0,
        category: ['rent', 'salary', 'utilities', 'marketing', 'travel', 'office', 'equipment', 'maintenance', 'taxes', 'other'].includes(row.Category?.toLowerCase()) ? row.Category.toLowerCase() : 'other',
        date: parsedDate,
        paymentMethod: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'].includes(row['Payment Method']?.toLowerCase()) ? row['Payment Method'].toLowerCase() : 'cash',
        reference: row.Reference || '',
        notes: row.Notes || '',
        tax: parseFloat(row.Tax) || 0,
        isRecurring: String(row['Is Recurring']).toLowerCase() === 'yes',
        recurringInterval: ['daily', 'weekly', 'monthly', 'yearly'].includes(row['Recurring Interval']?.toLowerCase()) ? row['Recurring Interval'].toLowerCase() : undefined,
        createdBy: req.user._id,
      });
      importedCount++;
    }

    res.json({
      success: true,
      message: `Successfully imported ${importedCount} expenses.`
    });
  } catch (err) {
    next(err);
  }
};

