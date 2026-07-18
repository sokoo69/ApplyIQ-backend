import mongoose, { Schema, Document } from 'mongoose';

export interface IApplication extends Document {
  user: mongoose.Types.ObjectId;
  job: mongoose.Types.ObjectId;
  status: 'Saved' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';
  notes?: string;
  appliedAt?: Date;
  statusHistory: {
    status: 'Saved' | 'Applied' | 'Interview' | 'Offer' | 'Rejected';
    changedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const ApplicationSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    status: { 
      type: String, 
      enum: ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'], 
      required: true,
      default: 'Saved' 
    },
    notes: { type: String },
    appliedAt: { type: Date },
    statusHistory: [
      {
        status: { 
          type: String, 
          enum: ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'],
          required: true
        },
        changedAt: { type: Date, required: true, default: Date.now }
      }
    ]
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate tracking of the same job by the same user
ApplicationSchema.index({ user: 1, job: 1 }, { unique: true });

export default mongoose.model<IApplication>('Application', ApplicationSchema);
