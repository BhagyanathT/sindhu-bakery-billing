require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB. Updating users...');
  const res = await User.updateMany(
    {}, 
    { $set: { "permissions.inventory": true } }
  );
  console.log('Update complete:', res);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
