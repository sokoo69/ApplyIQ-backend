import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface IChatSession extends Document {
  user: mongoose.Types.ObjectId;
  job?: mongoose.Types.ObjectId | null;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now, required: true }
  },
  { _id: false }
);

const ChatSessionSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job', default: null },
    messages: [ChatMessageSchema],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
