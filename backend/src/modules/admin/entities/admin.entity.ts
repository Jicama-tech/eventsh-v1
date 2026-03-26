// admin.schema.ts
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type AdminDocument = Admin & Document;

@Schema({ timestamps: true })
export class Admin {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: ["admin"] })
  role: string[];

  // Reference to the admin who created this one
  @Prop({ type: Types.ObjectId, ref: "Admin", default: null })
  createdBy: Types.ObjectId | null;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
