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
import { SpeakerRequestSchema } from "../speaker-requests/entities/speaker-request.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: "Ticket", schema: TicketSchema },
      { name: "Plan", schema: PlanSchema },
      { name: "Operator", schema: OperatorSchema },
      { name: "Vendor", schema: VendorSchema },
      { name: "SpeakerRequest", schema: SpeakerRequestSchema },
    ]),
  ],
  controllers: [ChatbotController],
  providers: [ChatbotService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
