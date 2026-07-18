const mongoose = require('mongoose');
require('dotenv').config();

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  try {
    console.log('Dropping old index...');
    await db.collection('applications').dropIndex('user_1_job_1');
    console.log('Dropped successfully.');
  } catch (e) {
    console.log('Error dropping index (might not exist):', e.message);
  }
  process.exit(0);
}
fix();
