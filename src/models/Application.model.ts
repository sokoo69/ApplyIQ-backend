import mongoose, { Schema, Document } from 'mongoose';

export interface IApplication extends Document {
  user: mongoose.Types.ObjectId;
  job?: mongoose.Types.ObjectId;
  
  // Custom fields for manual tracking
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  priority?: 'Low' | 'Medium' | 'High';
  deadline?: Date;
  imageUrl?: string;

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
    job: { type: Schema.Types.ObjectId, ref: 'Job' },
    
    // Custom fields for manual tracking
    title: { type: String },
    shortDescription: { type: String },
    fullDescription: { type: String },
    priority: { type: String, enum: ['Low', 'Medium', 'High'] },
    deadline: { type: Date },
    imageUrl: { type: String },

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

// Compound index to prevent duplicate tracking of the same public job by the same user.
// Uses partialFilterExpression to allow multiple manually tracked jobs (which have no job id).
ApplicationSchema.index(
  { user: 1, job: 1 }, 
  { unique: true, partialFilterExpression: { job: { $exists: true, $type: 'objectId' } } }
);

export default mongoose.model<IApplication>('Application', ApplicationSchema);
