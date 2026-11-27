import { Schema, model, type Document, type Types } from "mongoose";

export type MemberRole = "owner" | "admin" | "support_agent";
export type MemberStatus = "invited" | "active" | "revoked";

export interface OrganizationMemberDocument extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MemberRole;
  status: MemberStatus;
  createdAt: Date;
  updatedAt: Date;
}

const organizationMemberSchema = new Schema<OrganizationMemberDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "admin", "support_agent"], required: true },
    status: { type: String, enum: ["invited", "active", "revoked"], default: "active", required: true },
  },
  { timestamps: true },
);

organizationMemberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });

export const OrganizationMemberModel = model<OrganizationMemberDocument>(
  "OrganizationMember",
  organizationMemberSchema,
);
