import mongoose, { Schema, Document } from 'mongoose';

export interface IJob extends Document {
  title: string;
  company: string;
  companyLogoUrl?: string;
  location?: string;
  category?: string;
  salaryRange?: {
    min?: number;
    max?: number;
  };
  jobType?: 'full-time' | 'part-time' | 'remote' | 'contract';
  description: string;
  requirements: string[];
  postedBy: mongoose.Types.ObjectId;
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    companyLogoUrl: { type: String },
    location: { type: String },
    category: { type: String },
    salaryRange: {
      min: { type: Number },
      max: { type: Number },
    },
    jobType: { 
      type: String, 
      enum: ['full-time', 'part-time', 'remote', 'contract'] 
    },
    description: { type: String, required: true },
    requirements: [{ type: String }],
    postedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deadline: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IJob>('Job', JobSchema);
