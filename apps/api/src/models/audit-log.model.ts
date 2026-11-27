import { Schema, model, type Document, type Types } from "mongoose";

export type AuditActorType = "user" | "api_key" | "system";

export interface AuditLogDocument extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  projectId?: Types.ObjectId;
  actorType: AuditActorType;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  requestId: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    actorType: { type: String, enum: ["user", "api_key", "system"], required: true },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
    requestId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });

export const AuditLogModel = model<AuditLogDocument>("AuditLog", auditLogSchema);
