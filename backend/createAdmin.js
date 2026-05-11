// createAdmin.js — Direct MongoDB insert bypassing Mongoose middleware issues
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const EMAIL = 'admin@sindhubakery.com';
const PASSWORD = 'admin123';
const NAME = 'Bhagyanath T';

async function createAdmin() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected!\n');

  const db = mongoose.connection.db;
  const usersCol = db.collection('users');
  const companiesCol = db.collection('companies');

  // Check if user already exists
  const existing = await usersCol.findOne({ email: EMAIL });
  if (existing) {
    const company = await companiesCol.findOne({ _id: existing.company });
    console.log(`⚠️  User already exists: ${existing.email}`);
    console.log(`   Company: ${company?.name || 'N/A'}`);
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║        LOGIN CREDENTIALS             ║');
    console.log('╠══════════════════════════════════════╣');
    console.log(`║  Email   : ${EMAIL.padEnd(26)}║`);
    console.log(`║  Password: ${PASSWORD.padEnd(26)}║`);
    console.log('║  URL     : http://localhost:3000     ║');
    console.log('╚══════════════════════════════════════╝');
    await mongoose.disconnect();
    return;
  }

  // Check / create company
  let company = await companiesCol.findOne({ name: 'Sindhu Bakery' });
  if (!company) {
    const companyId = new mongoose.Types.ObjectId();
    await companiesCol.insertOne({
      _id: companyId,
      name: 'Sindhu Bakery',
      gstin: '32ABCDE1234F1Z5',
      email: 'sindhubakery@gmail.com',
      phone: '9876543210',
      address: { line1: 'Marayamuttam', city: 'Marayamuttam', state: 'Kerala', pincode: '695143' },
      settings: {
        currency: 'INR', currencySymbol: '₹', taxEnabled: true,
        invoicePrefix: 'INV', currentInvoiceNumber: 1,
        gstSlabs: [
          { rate: 0, label: 'GST 0%' }, { rate: 5, label: 'GST 5%' },
          { rate: 12, label: 'GST 12%' }, { rate: 18, label: 'GST 18%' }, { rate: 28, label: 'GST 28%' },
        ],
      },
      createdAt: new Date(), updatedAt: new Date(),
    });
    company = await companiesCol.findOne({ _id: companyId });
    console.log(`✅ Company created: Sindhu Bakery (${company._id})`);
  } else {
    console.log(`✅ Company found: ${company.name} (${company._id})`);
  }

  // Hash password directly
  const hashedPassword = await bcrypt.hash(PASSWORD, 12);
  const userId = new mongoose.Types.ObjectId();

  await usersCol.insertOne({
    _id: userId,
    name: NAME,
    email: EMAIL,
    password: hashedPassword,
    phone: '9876543210',
    role: 'admin',
    company: company._id,
    isActive: true,
    permissions: { billing: true, inventory: true, customers: true, accounting: true, reports: true, settings: true },
    createdAt: new Date(), updatedAt: new Date(),
  });

  // Link user as company owner
  await companiesCol.updateOne({ _id: company._id }, { $set: { owner: userId } });

  console.log(`✅ Admin user created: ${NAME} (${userId})`);
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║        LOGIN CREDENTIALS             ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Email   : ${EMAIL.padEnd(26)}║`);
  console.log(`║  Password: ${PASSWORD.padEnd(26)}║`);
  console.log('║  URL     : http://localhost:3000     ║');
  console.log('╚══════════════════════════════════════╝');

  await mongoose.disconnect();
  console.log('\n✅ Done! You can now log in at http://localhost:3000');
}

createAdmin().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
