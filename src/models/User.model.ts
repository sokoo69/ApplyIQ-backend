import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash?: string | null;
  avatarUrl?: string;
  role: 'job_seeker' | 'admin';
  resumeText?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, default: null },
    avatarUrl: { type: String },
    role: { type: String, enum: ['job_seeker', 'admin'], default: 'job_seeker' },
    resumeText: { type: String },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUser>('User', UserSchema);
