require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const hash = await bcrypt.hash('admin123', 12);
  const result = await mongoose.connection.db.collection('users').updateOne(
    { email: 'admin@sindhubakery.com' },
    { $set: { password: hash } }
  );
  console.log('✅ Password updated to: admin123  | Modified:', result.modifiedCount);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
