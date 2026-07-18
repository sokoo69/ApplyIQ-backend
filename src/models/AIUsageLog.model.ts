import mongoose, { Schema, Document } from 'mongoose';

export interface IAIUsageLog extends Document {
  user: mongoose.Types.ObjectId;
  endpoint: string;
  date: string; // YYYY-MM-DD format
  count: number;
}

const AIUsageLogSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true },
    date: { type: String, required: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Compound index to quickly find a user's usage for a specific endpoint on a specific day
AIUsageLogSchema.index({ user: 1, endpoint: 1, date: 1 }, { unique: true });

export default mongoose.model<IAIUsageLog>('AIUsageLog', AIUsageLogSchema);
