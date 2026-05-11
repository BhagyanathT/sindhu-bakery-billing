// src/controllers/reportController.js — Direct Mongoose queries. No mock data.
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');

exports.getProfitLoss = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    // ✅ Cast to ObjectId for aggregation pipeline
    const company = new mongoose.Types.ObjectId(req.company._id);
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    const filter = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const [salesData, expenseData] = await Promise.all([
      Invoice.aggregate([
        { $match: { company, type: 'sale', ...filter } },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$grandTotal' },
            totalDiscount: { $sum: '$totalDiscount' },
            totalTax: { $sum: '$totalTax' },
            invoiceCount: { $sum: 1 },
          },
        },
      ]),
      Expense.aggregate([
        { $match: { company, ...filter } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalRevenue = salesData[0]?.totalSales || 0;
    const totalExpense = expenseData.reduce((s, e) => s + e.total, 0);
    const netProfit = totalRevenue - totalExpense;
    const profitMargin = totalRevenue > 0 ? parseFloat(((netProfit / totalRevenue) * 100).toFixed(2)) : 0;

    res.json({
      success: true,
      data: {
        revenue: {
          total: totalRevenue,
          discounts: salesData[0]?.totalDiscount || 0,
          tax: salesData[0]?.totalTax || 0,
          invoices: salesData[0]?.invoiceCount || 0,
        },
        expenses: { total: totalExpense, breakdown: expenseData },
        netProfit,
        profitMargin,
      },
    });
  } catch (err) { next(err); }
};

exports.getGSTReport = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const company = new mongoose.Types.ObjectId(req.company._id);
    const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
    const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59));

    const invoices = await Invoice.aggregate([
      { $match: { company, type: 'sale', date: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$grandTotal' },
          totalCGST: { $sum: '$cgstTotal' },
          totalSGST: { $sum: '$sgstTotal' },
          totalIGST: { $sum: '$igstTotal' },
          totalTax: { $sum: '$totalTax' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]);

    const data = invoices[0] || {
      totalSales: 0, totalCGST: 0, totalSGST: 0,
      totalIGST: 0, totalTax: 0, invoiceCount: 0,
    };
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getCashFlow = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const company = new mongoose.Types.ObjectId(req.company._id);
    const startDate = new Date(Date.UTC(parseInt(year), 0, 1));
    const endDate = new Date(Date.UTC(parseInt(year), 11, 31, 23, 59, 59));

    const [income, expenses] = await Promise.all([
      Invoice.aggregate([
        { $match: { company, type: 'sale', date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { month: { $month: '$date' } }, total: { $sum: '$grandTotal' } } },
        { $sort: { '_id.month': 1 } },
      ]),
      Expense.aggregate([
        { $match: { company, date: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { month: { $month: '$date' } }, total: { $sum: '$amount' } } },
        { $sort: { '_id.month': 1 } },
      ]),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: income.find(d => d._id.month === i + 1)?.total || 0,
      expense: expenses.find(d => d._id.month === i + 1)?.total || 0,
    })).map(m => ({ ...m, netFlow: m.income - m.expense }));

    res.json({ success: true, data: { months } });
  } catch (err) { next(err); }
};

exports.getBusinessInsights = async (req, res, next) => {
  try {
    const company = new mongoose.Types.ObjectId(req.company._id);
    const thisMonth = new Date();
    thisMonth.setUTCDate(1);
    thisMonth.setUTCHours(0, 0, 0, 0);

    const [topProducts, lowStock, overdueCustomers, monthlyTrend] = await Promise.all([
      Product.find({ company: req.company._id }).sort({ salesCount: -1 }).limit(5)
        .select('name salesCount sellingPrice stock').lean(),
      Product.countDocuments({ company: req.company._id, $expr: { $lte: ['$stock.current', '$stock.minLevel'] } }),
      Customer.find({ company: req.company._id, creditBalance: { $gt: 0 } })
        .sort({ creditBalance: -1 }).limit(5)
        .select('name phone creditBalance').lean(),
      Invoice.aggregate([
        { $match: { company, type: 'sale', date: { $gte: thisMonth } } },
        { $group: { _id: { $dayOfMonth: '$date' }, sales: { $sum: '$grandTotal' } } },
        { $sort: { '_id': 1 } },
      ]),
    ]);

    const insights = [];
    if (lowStock > 0) insights.push({ type: 'warning', message: `${lowStock} products are running low on stock`, action: '/inventory?filter=lowstock' });
    if (overdueCustomers.length > 0) insights.push({ type: 'alert', message: `${overdueCustomers.length} customers have outstanding credit`, action: '/customers?filter=credit' });
    if (monthlyTrend.length > 1) {
      const last = monthlyTrend[monthlyTrend.length - 1]?.sales || 0;
      const prev = monthlyTrend[monthlyTrend.length - 2]?.sales || 0;
      if (last > prev * 1.2) insights.push({ type: 'success', message: 'Sales trending up! Today is 20%+ better than yesterday', action: '/analytics' });
    }

    res.json({ success: true, data: { topProducts, lowStock, overdueCustomers, monthlyTrend, insights } });
  } catch (err) { next(err); }
};
