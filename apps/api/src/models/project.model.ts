import { Schema, model, type Document, type Types } from "mongoose";

export type ProjectStatus = "active" | "archived";

export interface ProjectDocument extends Document<Types.ObjectId> {
  organizationId: Types.ObjectId;
  name: string;
  slug: string;
  publicId: string;
  allowedOrigins: string[];
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<ProjectDocument>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true },
    publicId: { type: String, required: true, unique: true },
    allowedOrigins: { type: [String], default: [] },
    status: { type: String, enum: ["active", "archived"], default: "active", required: true },
  },
  { timestamps: true },
);

projectSchema.index({ organizationId: 1, slug: 1 }, { unique: true });

export const ProjectModel = model<ProjectDocument>("Project", projectSchema);
