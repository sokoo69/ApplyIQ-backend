import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './config/db';

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await connectDB();
    
    const { default: app } = await import('./app');

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
