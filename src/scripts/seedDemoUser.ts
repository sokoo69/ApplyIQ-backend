import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User.model';
import Job from '../models/Job.model';
import Application from '../models/Application.model';

dotenv.config();

const seedDemoUser = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is missing');
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB for seeding...');

    // Clear existing demo user to avoid duplicates if run multiple times
    await User.deleteOne({ email: 'demo@applyiq.com' });
    
    // Create fixed known password
    const passwordHash = await bcrypt.hash('DemoPassword123!', 10);

    const demoUser = await User.create({
      name: 'Demo User',
      email: 'demo@applyiq.com',
      passwordHash,
      role: 'job_seeker',
      resumeText: 'I am a software engineer with 5 years of experience in React and Node.js.',
    });

    console.log('Demo user created:', demoUser.email);

    // Create a dummy job to link applications
    const demoJob = await Job.create({
      title: 'Frontend Developer',
      company: 'Tech Corp',
      description: 'We need a React expert.',
      requirements: ['React', 'TypeScript'],
      postedBy: demoUser._id, // Just using demo user for simplicity in this script
    });

    // Create sample applications
    await Application.create([
      {
        user: demoUser._id,
        job: demoJob._id,
        status: 'Applied',
        notes: 'Applied through company portal.',
        appliedAt: new Date(),
        statusHistory: [{ status: 'Applied', changedAt: new Date() }]
      }
    ]);

    console.log('Sample applications created.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seedDemoUser();
