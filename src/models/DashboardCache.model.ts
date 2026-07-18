import mongoose, { Schema, Document } from 'mongoose';

export interface IDashboardCache extends Document {
  user: mongoose.Types.ObjectId;
  lastTraceCount: number;
  skillGapCommentary: string;
  updatedAt: Date;
}

const DashboardCacheSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    lastTraceCount: { type: Number, required: true, default: 0 },
    skillGapCommentary: { type: String, required: true },
  },
  {
    timestamps: true, // we only care about updatedAt, but timestamps gives us createdAt too
  }
);

export default mongoose.model<IDashboardCache>('DashboardCache', DashboardCacheSchema);
