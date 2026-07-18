import mongoose, { Schema, Document } from 'mongoose';

export interface IAgentTraceStep {
  stepName: string;
  input: any;
  output: any;
  timestamp: Date;
}

export interface IAgentTrace extends Document {
  user: mongoose.Types.ObjectId;
  job: mongoose.Types.ObjectId;
  steps: IAgentTraceStep[];
  missingSkills: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AgentTraceStepSchema: Schema = new Schema({
  stepName: { type: String, required: true },
  input: { type: Schema.Types.Mixed, required: true },
  output: { type: Schema.Types.Mixed, required: true },
  timestamp: { type: Date, default: Date.now }
});

const AgentTraceSchema: Schema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    steps: { type: [AgentTraceStepSchema], default: [] },
    missingSkills: { type: [String], default: [] },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IAgentTrace>('AgentTrace', AgentTraceSchema);
