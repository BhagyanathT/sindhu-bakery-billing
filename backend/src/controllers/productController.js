// src/controllers/productController.js — Direct Mongoose queries. No persistenceEngine.
const Product = require('../models/Product');
const Category = require('../models/Category');
const AuditLog = require('../models/AuditLog');
const AppError = require('../utils/AppError');
const mongoose = require('mongoose');
const multer = require('multer');
const XLSX = require('xlsx');

// ── Multer Configuration ──────────────────────────────────────────────────────
const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('spreadsheet') || file.originalname.match(/\.(xls|xlsx)$/)) {
      cb(null, true);
    } else {
      cb(new AppError('Only Excel files are allowed.', 400), false);
    }
  },
});

// ── Unit normalizer ───────────────────────────────────────────────────────────
const VALID_UNITS = ['pcs', 'kg', 'g', 'l', 'ml', 'box', 'm', 'cm', 'dozen', 'pair'];
const normalizeUnit = (u) => {
  if (!u) return 'pcs';
  const s = String(u).toLowerCase().trim();
  if (s === 'dozens') return 'dozen';
  return VALID_UNITS.includes(s) ? s : 'pcs';
};

// ── Helpers ───────────────────────────────────────────────────────────────────
async function resolveOrCreateCategory(name, companyId) {
  if (!name) return null;
  const trimmedName = String(name).trim();
  try {
    let cat = await Category.findOne({ name: trimmedName, company: companyId }).lean();
    if (!cat) {
      cat = await Category.create({ name: trimmedName, company: companyId });
    }
    return cat._id;
  } catch (err) {
    return null;
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────

exports.getProducts = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, category, sort = '-createdAt', stock: stockFilter } = req.query;
    const query = { company: req.company._id, isActive: { $ne: false } };

    if (search) query.name = { $regex: search, $options: 'i' };

    if (category) {
      if (category === 'Uncategorized') {
        query.$or = [{ category: { $exists: false } }, { category: null }];
      } else if (mongoose.Types.ObjectId.isValid(category)) {
        query.category = category;
      } else {
        const catDoc = await Category.findOne({ name: category, company: req.company._id }).lean();
        query.category = catDoc ? catDoc._id : new mongoose.Types.ObjectId();
      }
    }

    // Stock filter — server-side
    if (stockFilter === 'low') {
      query.$expr = { $and: [{ $lte: ['$stock.current', '$stock.minLevel'] }, { $gt: ['$stock.current', 0] }] };
    } else if (stockFilter === 'out') {
      query['stock.current'] = 0;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(query).sort(sort).skip(skip).limit(limitNum).populate('category').lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        products,
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) { next(err); }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, company: req.company._id })
      .populate('category')
      .lean();
    if (!product) return next(new AppError('Product not found.', 404));
    res.json({ success: true, data: { product } });
  } catch (err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    let categoryId = req.body.category;
    if (typeof req.body.category === 'string' && !mongoose.Types.ObjectId.isValid(req.body.category)) {
      categoryId = await resolveOrCreateCategory(req.body.category, req.company._id);
    }

    const product = await Product.create({
      ...req.body,
      company: req.company._id,
      category: categoryId,
      unit: normalizeUnit(req.body.unit),
    });

    AuditLog.create({
      company: req.company._id, user: req.user._id, userName: req.user.name,
      action: 'CREATE', module: 'product', document: product._id,
      description: `Product created: ${product.name}`,
    }).catch(() => {});

    res.status(201).json({ success: true, data: { product } });
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    let updateData = { ...req.body };
    if (typeof req.body.category === 'string' && !mongoose.Types.ObjectId.isValid(req.body.category)) {
      updateData.category = await resolveOrCreateCategory(req.body.category, req.company._id);
    }
    if (req.body.unit) updateData.unit = normalizeUnit(req.body.unit);

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      updateData,
      { new: true, runValidators: true }
    ).populate('category');

    if (!product) return next(new AppError('Product not found.', 404));
    res.json({ success: true, data: { product } });
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({ _id: req.params.id, company: req.company._id });
    if (!product) return next(new AppError('Product not found.', 404));
    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) { next(err); }
};

exports.bulkDeleteProducts = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('No product IDs provided for bulk delete.', 400));
    }
    await Product.deleteMany({ company: req.company._id, _id: { $in: ids } });
    res.json({ success: true, message: `${ids.length} product(s) deleted.` });
  } catch (err) { next(err); }
};

exports.wipeAllProducts = async (req, res, next) => {
  try {
    await Product.deleteMany({ company: req.company._id });
    res.json({ success: true, message: 'All products deleted successfully.' });
  } catch (err) { next(err); }
};

exports.adjustStock = async (req, res, next) => {
  try {
    const { quantity, type, reason } = req.body;
    if (!quantity || !type) return next(new AppError('Quantity and type are required.', 400));

    const p = await Product.findOne({ _id: req.params.id, company: req.company._id }).lean();
    if (!p) return next(new AppError('Product not found.', 404));

    const newStock = type === 'add'
      ? p.stock.current + quantity
      : p.stock.current - quantity;
    if (newStock < 0) return next(new AppError('Cannot reduce stock below zero.', 400));

    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { 'stock.current': newStock },
      { new: true }
    );

    res.json({ success: true, data: { product: updated } });
  } catch (err) { next(err); }
};

exports.getLowStockAlerts = async (req, res, next) => {
  try {
    const products = await Product.find({
      company: req.company._id,
      isActive: { $ne: false },
      $expr: { $lte: ['$stock.current', '$stock.minLevel'] },
    }).populate('category').lean();
    res.json({ success: true, data: { products, count: products.length } });
  } catch (err) { next(err); }
};

exports.getInventoryStats = async (req, res, next) => {
  try {
    const products = await Product.find({
      company: req.company._id,
      isActive: { $ne: false },
    }).populate('category').lean();

    const totalProducts = products.length;

    // Robust checks — handle null/undefined stock values
    const outOfStockCount = products.filter(p => {
      const cur = Number(p.stock?.current ?? 0);
      return cur <= 0;
    }).length;

    const lowStockCount = products.filter(p => {
      const cur = Number(p.stock?.current ?? 0);
      const min = Number(p.stock?.minLevel ?? 5);
      return cur > 0 && cur <= min;
    }).length;

    // Use costPrice if available, else fallback to sellingPrice
    const totalStockValue = products.reduce((acc, p) => {
      const cur = Number(p.stock?.current ?? 0);
      const price = Number(p.costPrice || 0) > 0 ? Number(p.costPrice) : Number(p.sellingPrice || 0);
      return acc + cur * price;
    }, 0);

    const potentialRevenue = products.reduce((acc, p) => {
      const cur = Number(p.stock?.current ?? 0);
      return acc + cur * Number(p.sellingPrice || 0);
    }, 0);

    const categoryDistribution = {};
    products.forEach(p => {
      const catName = p.category?.name || 'Uncategorized';
      categoryDistribution[catName] = (categoryDistribution[catName] || 0) + 1;
    });

    res.json({
      success: true,
      data: {
        totalProducts, lowStockCount, outOfStockCount,
        totalStockValue, potentialRevenue,
        categoryDistribution: Object.entries(categoryDistribution).map(([name, value]) => ({ name, value })),
      },
    });
  } catch (err) { next(err); }
};

// ── Excel Import ──────────────────────────────────────────────────────────────
exports.xlsxUpload = xlsxUpload;

exports.importProducts = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No file uploaded.', 400));

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const importResult = {
      imported: 0, skipped: 0, skippedItems: [],
      categoriesCreated: 0, categoriesReused: 0, products: [],
    };

    const productsToCreate = [];
    for (const item of data) {
      const name = item['Item name*'] || item.Name || item.name;
      if (!name) {
        importResult.skipped++;
        importResult.skippedItems.push({ name: 'Unknown', reason: 'Missing item name' });
        continue;
      }

      const catName = String(item.Category || item.category || 'Bakery').trim();
      const categoryId = await resolveOrCreateCategory(catName, req.company._id);

      const sellingPrice = Number(item['Sale price'] || item['Selling Price'] || item.sellingPrice || 0);
      const mrp = Number(item.MRP || item.mrp || item['Max Retail Price'] || 0);
      const discountFromSheet = Number(item.Discount || item.discount || 0);
      const autoDiscount = mrp > 0 && sellingPrice > 0 && discountFromSheet === 0
        ? Math.round(((mrp - sellingPrice) / mrp) * 100)
        : discountFromSheet;

      productsToCreate.push({
        company: req.company._id,
        name: String(name).trim(),
        sku: item.SKU || item.sku || '',
        barcode: String(item.Barcode || item.barcode || '').trim(),
        sellingPrice,
        mrp,
        discount: autoDiscount,
        costPrice: Number(item['Cost Price'] || item.costPrice || 0),
        stock: {
          current: Number(item['Current stock quantity'] || item.Stock || item.stock || 0),
          minLevel: Number(item['Min Level'] || 5),
        },
        category: categoryId,
        unit: normalizeUnit(item.Unit || item.unit),
        isActive: true,
        emoji: item.Emoji || item.emoji || '📦',
      });
      importResult.imported++;
    }

    if (productsToCreate.length > 0) {
      const created = await Product.insertMany(productsToCreate, { ordered: false });
      importResult.products = created;
    }

    res.json({ success: true, data: importResult });
  } catch (err) {
    console.error('Import Error:', err);
    next(new AppError(`Import failed: ${err.message}`, 500));
  }
};
