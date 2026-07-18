import mongoose, { Schema, Document } from 'mongoose';

export interface IMatchFeedback extends Document {
  user: mongoose.Types.ObjectId;
  job: mongoose.Types.ObjectId;
  signal: 'applied' | 'rejected' | 'not_interested' | 'saved';
  matchScoreAtTime: number;
  createdAt: Date;
  updatedAt: Date;
}

const MatchFeedbackSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    signal: { 
      type: String, 
      enum: ['applied', 'rejected', 'not_interested', 'saved'], 
      required: true 
    },
    matchScoreAtTime: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IMatchFeedback>('MatchFeedback', MatchFeedbackSchema);
