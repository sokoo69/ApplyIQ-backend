import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  adminUser: mongoose.Types.ObjectId | string;
  action: 'create_job' | 'update_job' | 'delete_job';
  targetJobId: string;
  changesSummary: string;
  timestamp: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    adminUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ['create_job', 'update_job', 'delete_job'], required: true },
    targetJobId: { type: String, required: true },
    changesSummary: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // We have a timestamp field, but Mongoose timestamps give createdAt/updatedAt
  }
);

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
