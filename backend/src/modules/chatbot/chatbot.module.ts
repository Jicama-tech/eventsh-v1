import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ChatbotController } from "./chatbot.controller";
import { ChatbotService } from "./chatbot.service";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { TicketSchema } from "../tickets/entities/ticket.entity";
import { PlanSchema } from "../plans/entities/plan.entity";
import { OperatorSchema } from "../operators/entities/operator.entity";
import { VendorSchema } from "../stalls/schemas/vendor.schema";
import { StallSchema } from "../stalls/entities/stall.entity";
import { SpeakerRequestSchema } from "../speaker-requests/entities/speaker-request.entity";
import { RoundTableBookingSchema } from "../round-table-bookings/entities/round-table-booking.entity";
import { TemplateSchema } from "../templates/schemas/template.schema";
import { UserSchema } from "../users/schemas/user.schema";
import { RsvpSchema } from "../rsvp/schemas/rsvp.schema";
import {
  OrganizerStore,
  OrganizerStoreSchema,
} from "../organizer-stores/entities/organizer-store.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: "Ticket", schema: TicketSchema },
      { name: "Plan", schema: PlanSchema },
      { name: "Operator", schema: OperatorSchema },
      { name: "Vendor", schema: VendorSchema },
      { name: "Stall", schema: StallSchema },
      { name: "SpeakerRequest", schema: SpeakerRequestSchema },
      { name: "RoundTableBooking", schema: RoundTableBookingSchema },
      { name: "Template", schema: TemplateSchema },
      { name: "User", schema: UserSchema },
      // Guest RSVPs for Personal / Marriage events — so the Individual
      // "participants" chatbot flow can count wedding guests, not just tickets.
      { name: "Rsvp", schema: RsvpSchema },
      // For producing store-scoped public URLs (/{slug}/events/{id}) in
      // the Individual "My events" chatbot responses.
      { name: OrganizerStore.name, schema: OrganizerStoreSchema },
    ]),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
