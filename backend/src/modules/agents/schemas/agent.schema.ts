import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type AgentDocument = Agent & Document;

// Use a dedicated collection so eventsh agents stay isolated from kioscart's
// shared `agents` collection on the live MongoDB.
@Schema({ timestamps: true, collection: "eventsh_agents" })
export class Agent {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  whatsAppNumber: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  secondaryContact?: string;

  @Prop({ default: 0 })
  salesTarget: number;

  @Prop({ required: true, unique: true })
  referralCode: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);

AgentSchema.index({ whatsAppNumber: 1 });
AgentSchema.index({ referralCode: 1 });
AgentSchema.index({ email: 1 });
