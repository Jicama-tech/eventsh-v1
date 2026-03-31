import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type EventDocument = Event & Document;

class VenueConfig {
  @Prop()
  venueConfigId: string;

  @Prop()
  width: number;

  @Prop()
  height: number;

  @Prop()
  scale: number;

  @Prop()
  gridSize: number;

  @Prop()
  showGrid: boolean;

  @Prop()
  hasMainStage: boolean;

  @Prop()
  totalRows?: number;
}

class SpeakerSlotTemplate {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  @Prop() startTime: string;
  @Prop() endTime: string;
  @Prop({ default: false }) isMainStage: boolean;
  @Prop({ default: 200 }) width: number;
  @Prop({ default: 100 }) height: number;
  @Prop({ default: 0 }) slotPrice: number;
  @Prop({ default: 1 }) maxSpeakers: number;
  @Prop({ default: 0 }) maxVisitors: number;
  @Prop() description: string;
  @Prop() assignedSpeakerId: string;
  @Prop() assignedSpeakerName: string;
  @Prop({ default: true }) openForApplications: boolean;
}

class PositionedSpeakerZone {
  @Prop({ required: true }) positionId: string;
  @Prop({ required: true }) templateId: string;
  @Prop({ required: true }) name: string;
  @Prop() startTime: string;
  @Prop() endTime: string;
  @Prop({ default: false }) isMainStage: boolean;
  @Prop() width: number;
  @Prop() height: number;
  @Prop() x: number;
  @Prop() y: number;
  @Prop({ default: 0 }) rotation: number;
  @Prop({ default: true }) isPlaced: boolean;
  @Prop() venueConfigId: string;
  @Prop() assignedSpeakerId: string;
  @Prop() assignedSpeakerName: string;
}

class VisitorFeatureAccess {
  @Prop() food: boolean;
  @Prop() parking: boolean;
  @Prop() wifi: boolean;
  @Prop() photography: boolean;
  @Prop() security: boolean;
  @Prop() accessibility: boolean;
}

class VisitorType {
  @Prop() id: string;
  @Prop() name: string;
  @Prop() price: number;
  @Prop() maxCount?: number;
  @Prop() description?: string;
  @Prop({ type: Object }) featureAccess: VisitorFeatureAccess;
  @Prop({ default: true }) isActive: boolean;
}

class SpeakerSlot {
  @Prop({ required: true })
  topic: string;

  @Prop()
  startTime: string;

  @Prop()
  endTime: string;

  @Prop()
  description: string;
}

class Speaker {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  title: string;

  @Prop()
  organization: string;

  @Prop()
  bio: string;

  @Prop()
  image: string;

  @Prop()
  email: string;

  @Prop({
    type: Object,
    default: { linkedin: "", twitter: "", website: "" },
  })
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    website?: string;
  };

  @Prop({ type: [Object], default: [] })
  slots: SpeakerSlot[];

  @Prop({ default: false })
  isKeynote: boolean;

  @Prop({ default: 0 })
  order: number;
}

class RoundTableTemplate {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true, min: 2, max: 20 }) numberOfChairs: number;
  @Prop({ required: true, enum: ["table", "chair"] }) sellingMode: string;
  @Prop({ default: 0 }) tablePrice: number;
  @Prop({ default: 0 }) chairPrice: number;
  @Prop({ default: "Standard" }) category: string;
  @Prop({ default: "#8B5CF6" }) color: string;
  @Prop({ default: 120 }) tableDiameter: number;
}

class PositionedRoundTable {
  @Prop({ required: true }) positionId: string;
  @Prop({ required: true }) templateId: string;
  @Prop({ required: true }) name: string;
  @Prop({ required: true }) numberOfChairs: number;
  @Prop({ required: true, enum: ["table", "chair"] }) sellingMode: string;
  @Prop({ default: 0 }) tablePrice: number;
  @Prop({ default: 0 }) chairPrice: number;
  @Prop({ default: "Standard" }) category: string;
  @Prop({ default: "#8B5CF6" }) color: string;
  @Prop({ default: 120 }) tableDiameter: number;
  @Prop() x: number;
  @Prop() y: number;
  @Prop({ default: 0 }) rotation: number;
  @Prop({ default: true }) isPlaced: boolean;
  @Prop() venueConfigId: string;
  @Prop({ type: [Number], default: [] }) bookedChairs: number[];
  @Prop({ default: false }) isFullyBooked: boolean;
}

class termsAndConditionsforStalls {
  @Prop()
  termsAndConditionsforStalls: string;

  @Prop()
  isMandatory: boolean;
}

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop()
  category?: string;

  @Prop()
  startDate: Date;

  @Prop()
  time?: string;

  @Prop()
  endDate?: Date;

  @Prop()
  endTime?: string;

  @Prop({ type: Types.ObjectId, ref: "Organizer", required: true })
  organizer: Types.ObjectId;

  @Prop()
  location?: string;

  @Prop()
  address?: string;

  @Prop()
  ticketPrice?: string;

  @Prop()
  totalTickets?: number;

  @Prop()
  originalTotalTickets?: number;

  @Prop({ enum: ["public", "private", "unlisted"], default: "public" })
  visibility: string;

  @Prop()
  inviteLink?: string;

  @Prop([String])
  tags: string[];

  @Prop({
    type: Object,
    default: {
      food: false,
      parking: false,
      wifi: false,
      photography: false,
      security: false,
      accessibility: false,
    },
  })
  features: {
    food: boolean;
    parking: boolean;
    wifi: boolean;
    photography: boolean;
    security: boolean;
    accessibility: boolean;
  };

  @Prop()
  ageRestriction?: string;

  @Prop()
  dresscode?: string;

  @Prop()
  specialInstructions?: string;

  @Prop()
  refundPolicy?: string;

  @Prop()
  termsAndConditions?: string;

  @Prop()
  setupTime?: string;

  @Prop()
  breakdownTime?: string;

  // Media fields
  @Prop()
  image?: string;

  @Prop([String])
  gallery?: string[];

  @Prop({
    type: Object,
    default: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
  })
  socialMedia?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };

  // Exhibition/Venue fields with ROW-BASED PRICING
  @Prop({ type: Array, default: [] })
  tableTemplates: {
    id: string;
    name: string;
    type: "Straight";
    width: number;
    height: number;
    rowNumber?: number; // NEW: Row number for pricing
    tablePrice: number; // NEW: Full table rental price
    bookingPrice: number; // NEW: Partial payment (must be <= tablePrice)
    depositPrice: number;
    color?: string;
    forSale?: boolean;
    isBooked: boolean;
    bookedBy?: string;
    customDimensions?: boolean;
  }[];

  @Prop({ type: Array, default: [] })
  venueTables: {
    venueConfigId: string;
    tableName: string;
    positionId: string;
    id: string;
    name: string;
    type: "Straight";
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
    isPlaced: boolean;
    rowNumber?: number;
    tablePrice: number;
    bookingPrice: number;
    depositPrice: number;
    color?: string;
    forSale?: boolean;
    isBooked: boolean;
    bookedBy?: string;
  }[];

  @Prop({ type: Array, default: [] })
  addOnItems: {
    id: string;
    name: string;
    price: number;
    description: string;
    addOnImage?: string;
  }[];

  @Prop({
    type: [Object],
    default: [
      {
        venueConfigId: "venueConfig1",
        width: 800,
        height: 500,
        scale: 0.75,
        gridSize: 20,
        showGrid: true,
        hasMainStage: true,
        totalRows: 3,
      },
    ],
  })
  venueConfig: VenueConfig[];

  @Prop({ enum: ["draft", "published", "cancelled"], default: "draft" })
  status: string;

  @Prop({ default: false })
  featured: boolean;

  @Prop({ type: [Object], default: [] })
  speakerSlotTemplates: SpeakerSlotTemplate[];

  @Prop({ type: [Object], default: [] })
  venueSpeakerZones: PositionedSpeakerZone[];

  @Prop({ type: [Object], default: [] })
  visitorTypes: VisitorType[];

  @Prop({ type: [Object], default: [] })
  speakers: Speaker[];

  @Prop({ type: [Object], default: [] })
  termsAndConditionsforStalls?: termsAndConditionsforStalls[];

  // Round Table Seating (charity dinners, galas, etc.)
  @Prop({ type: Array, default: [] })
  roundTableTemplates: RoundTableTemplate[];

  @Prop({ type: Array, default: [] })
  venueRoundTables: PositionedRoundTable[];

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const EventSchema = SchemaFactory.createForClass(Event);
