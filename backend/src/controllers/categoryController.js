// src/controllers/categoryController.js — Direct Mongoose queries. No persistenceEngine.
const Category = require('../models/Category');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({
      company: req.company._id,
      isActive: { $ne: false },
    }).sort({ name: 1 }).lean();
    res.json({ success: true, data: { categories } });
  } catch (err) { next(err); }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return next(new AppError('Category name is required', 400));
    const category = await Category.create({ name: name.trim(), company: req.company._id });
    res.status(201).json({ success: true, data: { category } });
  } catch (err) {
    if (err.code === 11000) return next(new AppError('A category with this name already exists', 400));
    next(err);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return next(new AppError('Category name is required', 400));

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, company: req.company._id },
      { name: name.trim() },
      { new: true, runValidators: true }
    );

    if (!category) return next(new AppError('Category not found', 404));
    res.json({ success: true, data: { category } });
  } catch (err) {
    if (err.code === 11000) return next(new AppError('A category with this name already exists', 400));
    next(err);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findOneAndDelete({
      _id: req.params.id,
      company: req.company._id,
    });
    if (!category) return next(new AppError('Category not found', 404));

    // Unlink products from deleted category
    await Product.updateMany(
      { category: req.params.id, company: req.company._id },
      { $unset: { category: '' } }
    );

    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};
