import mongoose from 'mongoose';
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';

async function test() {
  await mongoose.connect('mongodb://localhost:27017/test_db');
  
  const auth = betterAuth({
    database: mongodbAdapter(mongoose.connection.db!),
    plugins: []
  });

  console.log('Adapter works?', !!auth);
  process.exit(0);
}
test().catch(console.error);
