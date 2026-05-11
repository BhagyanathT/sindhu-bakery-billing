const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getFilePath = (collection) => path.join(DATA_DIR, `${collection}.json`);

const load = (collection) => {
  const filePath = getFilePath(collection);
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error loading ${collection}:`, err);
    return [];
  }
};

const save = (collection, data) => {
  const filePath = getFilePath(collection);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error(`Error saving ${collection}:`, err);
    return false;
  }
};

// Seed data if empty
const init = () => {
  const products = load('products');
  if (products.length === 0) {
    const initialProducts = [
      { _id: 'local_1', name: 'Sourdough Bread', sku: 'BKR-001', category: 'Bakery', sellingPrice: 120, costPrice: 60, stock: { current: 50, minLevel: 10 }, unit: 'pcs', emoji: '🍞', isActive: true },
      { _id: 'local_2', name: 'Chocolate Cake', sku: 'BKR-002', category: 'Cakes', sellingPrice: 650, costPrice: 300, stock: { current: 8, minLevel: 5 }, unit: 'pcs', emoji: '🎂', isActive: true },
    ];
    save('products', initialProducts);
  }

  const categories = load('categories');
  if (categories.length === 0) {
    const initialCats = [
      { _id: 'cat_1', name: 'Bakery', color: '#f59e0b' },
      { _id: 'cat_2', name: 'Beverages', color: '#3b82f6' },
      { _id: 'cat_3', name: 'Snacks', color: '#10b981' },
      { _id: 'cat_4', name: 'Dairy', color: '#8b5cf6' },
    ];
    save('categories', initialCats);
  }
};

init();

module.exports = {
  load,
  save
};
