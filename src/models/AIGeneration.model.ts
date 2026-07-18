import mongoose, { Schema, Document } from 'mongoose';

export interface IAIGeneration extends Document {
  user: mongoose.Types.ObjectId;
  job?: mongoose.Types.ObjectId;
  application?: mongoose.Types.ObjectId;
  type: 'cover_letter' | 'resume_bullets';
  inputPrompt: string;
  outputText: string;
  tone?: string;
  length?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AIGenerationSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job' },
    application: { type: Schema.Types.ObjectId, ref: 'Application' },
    type: { type: String, enum: ['cover_letter', 'resume_bullets'], required: true },
    inputPrompt: { type: String, required: true },
    outputText: { type: String, required: true },
    tone: { type: String },
    length: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IAIGeneration>('AIGeneration', AIGenerationSchema);
