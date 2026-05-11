// src/utils/seed.js - Sample data seeder
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

const User = require('../models/User');
const Company = require('../models/Company');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Expense = require('../models/Expense');
const Category = require('../models/Category');

const seed = async () => {
  await connectDB();
  console.log('🌱 Starting seed...');

  // Clear existing data
  await Promise.all([User.deleteMany(), Company.deleteMany(), Product.deleteMany(), Customer.deleteMany(), Invoice.deleteMany(), Expense.deleteMany(), Category.deleteMany()]);

  // Create company
  const company = await Company.create({
    name: 'Sindhu Bakery',
    gstin: '32ABCDE1234F1Z5',
    address: { line1: 'Main Road, Marayamuttam', city: 'Marayamuttam', state: 'Kerala', pincode: '695143' },
    phone: ['+91-9400000000'],
    email: 'sindhubakery@gmail.com',
    settings: {
      invoicePrefix: 'SBK',
      currentInvoiceNumber: 1,
      defaultTaxRate: 5,
      gstSlabs: [{ rate: 0, label: 'GST 0%' }, { rate: 5, label: 'GST 5%' }, { rate: 12, label: 'GST 12%' }, { rate: 18, label: 'GST 18%' }, { rate: 28, label: 'GST 28%' }],
    },
  });

  // Create admin user
  const admin = await User.create({
    name: 'Bhagyanath T',
    email: 'admin@sindhubakery.com',
    password: 'admin123',
    phone: '+91-9876543210',
    role: 'admin',
    company: company._id,
    permissions: { billing: true, inventory: true, customers: true, accounting: true, reports: true, settings: true },
  });

  const staff = await User.create({
    name: 'Ravi Staff',
    email: 'staff@bizflow.com',
    password: 'Staff@123',
    role: 'staff',
    company: company._id,
    permissions: { billing: true, inventory: true, customers: true, accounting: false, reports: false, settings: false },
  });

  company.owner = admin._id;
  await company.save();

  // Create categories
  const categories = await Category.insertMany([
    { company: company._id, name: 'Bakery', color: '#f59e0b', icon: '🍞' },
    { company: company._id, name: 'Beverages', color: '#3b82f6', icon: '☕' },
    { company: company._id, name: 'Snacks', color: '#10b981', icon: '🍪' },
    { company: company._id, name: 'Dairy', color: '#8b5cf6', icon: '🥛' },
  ]);

  // Create products — Sindhu Bakery items
  const products = await Product.insertMany([
    { company: company._id, name: 'Sourdough Bread', sku: 'BKR-001', sellingPrice: 120, costPrice: 60, tax: { gstRate: 0, hsn: '1905' }, stock: { current: 50, minLevel: 10 }, category: categories[0]._id, unit: 'pcs' },
    { company: company._id, name: 'Croissant', sku: 'BKR-002', sellingPrice: 60, costPrice: 25, tax: { gstRate: 0, hsn: '1905' }, stock: { current: 30, minLevel: 15 }, category: categories[0]._id, unit: 'pcs' },
    { company: company._id, name: 'Chocolate Cake (1kg)', sku: 'BKR-003', sellingPrice: 650, costPrice: 300, tax: { gstRate: 5, hsn: '1905' }, stock: { current: 8, minLevel: 5 }, category: categories[0]._id, unit: 'pcs' },
    { company: company._id, name: 'Muffin', sku: 'BKR-005', sellingPrice: 45, costPrice: 18, tax: { gstRate: 0, hsn: '1905' }, stock: { current: 24, minLevel: 10 }, category: categories[0]._id, unit: 'pcs' },
    { company: company._id, name: 'White Bread', sku: 'BKR-006', sellingPrice: 40, costPrice: 18, tax: { gstRate: 0, hsn: '1905' }, stock: { current: 60, minLevel: 15 }, category: categories[0]._id, unit: 'pcs' },
    { company: company._id, name: 'Banana Cake', sku: 'BKR-007', sellingPrice: 280, costPrice: 130, tax: { gstRate: 5, hsn: '1905' }, stock: { current: 10, minLevel: 5 }, category: categories[0]._id, unit: 'pcs' },
    { company: company._id, name: 'Plum Cake', sku: 'BKR-008', sellingPrice: 320, costPrice: 140, tax: { gstRate: 5, hsn: '1905' }, stock: { current: 15, minLevel: 5 }, category: categories[0]._id, unit: 'pcs' },
    { company: company._id, name: 'Cappuccino', sku: 'BEV-001', sellingPrice: 80, costPrice: 20, tax: { gstRate: 5, hsn: '2101' }, stock: { current: 100, minLevel: 20 }, category: categories[1]._id, unit: 'pcs' },
    { company: company._id, name: 'Fresh Juice (500ml)', sku: 'BEV-002', sellingPrice: 60, costPrice: 20, tax: { gstRate: 12, hsn: '2009' }, stock: { current: 40, minLevel: 10 }, category: categories[1]._id, unit: 'pcs' },
    { company: company._id, name: 'Tea', sku: 'BEV-003', sellingPrice: 15, costPrice: 5, tax: { gstRate: 5, hsn: '2101' }, stock: { current: 200, minLevel: 50 }, category: categories[1]._id, unit: 'pcs' },
    { company: company._id, name: 'Cookies Box (12pcs)', sku: 'SNK-001', sellingPrice: 350, costPrice: 150, tax: { gstRate: 12, hsn: '1905' }, stock: { current: 25, minLevel: 10 }, category: categories[2]._id, unit: 'box' },
    { company: company._id, name: 'Butter (500g)', sku: 'DAI-001', sellingPrice: 180, costPrice: 120, tax: { gstRate: 12, hsn: '0405' }, stock: { current: 3, minLevel: 5 }, category: categories[3]._id, unit: 'pcs' },
    { company: company._id, name: 'Milk (500ml)', sku: 'DAI-002', sellingPrice: 30, costPrice: 22, tax: { gstRate: 0, hsn: '0401' }, stock: { current: 80, minLevel: 20 }, category: categories[3]._id, unit: 'pcs' },
    { company: company._id, name: 'Cheese Cake', sku: 'BKR-004', sellingPrice: 450, costPrice: 200, tax: { gstRate: 5, hsn: '1905' }, stock: { current: 12, minLevel: 5 }, category: categories[0]._id, unit: 'pcs' },
  ]);

  // Create customers
  const customers = await Customer.insertMany([
    { company: company._id, name: 'Priya Sharma', phone: '9876543001', email: 'priya@example.com', creditBalance: 500, totalPurchase: 5000, totalPaid: 4500 },
    { company: company._id, name: 'Raju Kumar', phone: '9876543002', creditBalance: 1200, totalPurchase: 8000, totalPaid: 6800 },
    { company: company._id, name: 'Hotel Sunrise', phone: '9876543003', email: 'hotel@sunrise.com', gstin: '29AAAAA0000A1Z5', customerType: 'wholesale', creditLimit: 10000, totalPurchase: 25000, totalPaid: 25000 },
    { company: company._id, name: 'Meera Bakery Supplies', phone: '9876543004', customerType: 'distributor', creditLimit: 50000, totalPurchase: 45000, totalPaid: 45000 },
    { company: company._id, name: 'Vikram Singh', phone: '9876543005', creditBalance: 0, totalPurchase: 3200, totalPaid: 3200 },
  ]);

  // Create sample invoices for the last 30 days
  const invoiceSamples = [];
  for (let i = 0; i < 15; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const items = Array.from({ length: itemCount }, () => {
      const product = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 5) + 1;
      const taxAmount = (product.sellingPrice * qty * product.tax.gstRate) / 100;
      return {
        product: product._id, name: product.name, quantity: qty, rate: product.sellingPrice,
        taxRate: product.tax.gstRate, amount: product.sellingPrice * qty + taxAmount,
        taxAmount, cgst: taxAmount / 2, sgst: taxAmount / 2,
      };
    });
    const grandTotal = items.reduce((s, i) => s + i.amount, 0);
    const paid = Math.random() > 0.3 ? grandTotal : 0;
    invoiceSamples.push({
      company: company._id,
      invoiceNumber: `SBB-${String(i + 1).padStart(5, '0')}`,
      customer: customer._id, customerName: customer.name,
      items, subtotal: grandTotal, grandTotal,
      totalPaid: paid, paymentStatus: paid >= grandTotal ? 'paid' : paid > 0 ? 'partial' : 'unpaid',
      payments: paid > 0 ? [{ method: 'cash', amount: paid }] : [],
      createdBy: admin._id, date,
    });
  }
  await Invoice.insertMany(invoiceSamples);

  // Create sample expenses
  await Expense.insertMany([
    { company: company._id, title: 'Monthly Rent', amount: 25000, category: 'rent', date: new Date(), createdBy: admin._id },
    { company: company._id, title: 'Staff Salaries', amount: 45000, category: 'salary', date: new Date(), createdBy: admin._id },
    { company: company._id, title: 'Electricity Bill', amount: 3500, category: 'utilities', date: new Date(), createdBy: admin._id },
    { company: company._id, title: 'Oven Maintenance', amount: 2000, category: 'maintenance', date: new Date(), createdBy: admin._id },
    { company: company._id, title: 'Google Ads', amount: 5000, category: 'marketing', date: new Date(), createdBy: admin._id },
  ]);

  console.log('✅ Seed completed!');
  console.log('📧 Admin: admin@sindhubakery.com | Password: admin123');
  console.log('📧 Staff: staff@bizflow.com  | Password: Staff@123');
  process.exit(0);
};

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
