import { Schema, model, type Document, type Types } from "mongoose";

export type UserStatus = "active" | "suspended";

export interface UserDocument extends Document<Types.ObjectId> {
  email: string;
  passwordHash: string;
  name: string;
  status: UserStatus;
  emailVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], default: "active", required: true },
    emailVerifiedAt: { type: Date },
  },
  { timestamps: true },
);

export const UserModel = model<UserDocument>("User", userSchema);
