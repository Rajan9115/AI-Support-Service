import { Schema, model, type Document, type Types } from "mongoose";

export type OrganizationPlan = "free" | "starter" | "pro" | "enterprise";
export type OrganizationStatus = "active" | "suspended";

export interface OrganizationDocument extends Document<Types.ObjectId> {
  name: string;
  slug: string;
  plan: OrganizationPlan;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<OrganizationDocument>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    plan: {
      type: String,
      enum: ["free", "starter", "pro", "enterprise"],
      default: "free",
      required: true,
    },
    status: { type: String, enum: ["active", "suspended"], default: "active", required: true },
  },
  { timestamps: true },
);

export const OrganizationModel = model<OrganizationDocument>("Organization", organizationSchema);
