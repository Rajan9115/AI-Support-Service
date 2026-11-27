import { Schema, model, type Document, type Types } from "mongoose";

export interface ApiKeyDocument extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const apiKeySchema = new Schema<ApiKeyDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true, trim: true },
    keyPrefix: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true },
    scopes: { type: [String], default: ["runtime:read", "runtime:write"] },
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

apiKeySchema.index({ organizationId: 1, projectId: 1, revokedAt: 1 });

export const ApiKeyModel = model<ApiKeyDocument>("ApiKey", apiKeySchema);
