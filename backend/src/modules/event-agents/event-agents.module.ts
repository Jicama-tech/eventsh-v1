import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EventAgent, EventAgentSchema } from "./schemas/event-agent.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import {
  OrganizerStore,
  OrganizerStoreSchema,
} from "../organizer-stores/entities/organizer-store.entity";
import { OperatorSchema } from "../operators/entities/operator.entity";
import { MailModule } from "../roles/mail.module";
import { OtpModule } from "../otp/otp.module";
import { WhatsappModule } from "../whatsapp/whatsapp.module";
import { EventAgentsController } from "./event-agents.controller";
import { EventAgentsPublicController } from "./event-agents-public.controller";
import { EventAgentsService } from "./event-agents.service";

/**
 * Per-event agents and their referral links (the event form's Agents tab).
 *
 * Imports models plus the two leaf-ish modules it sends through: MailModule
 * for the email and OtpModule for WhatsApp (routed through the organizer's
 * own linked number). WhatsappModule supplies TabsGuard. Booking attribution
 * does NOT go through this module: OperatorsService.resolveReferral reads the
 * event_agents collection directly, so the booking services need no new
 * import.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EventAgent.name, schema: EventAgentSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
      { name: "OrganizerStore", schema: OrganizerStoreSchema },
      { name: "Operator", schema: OperatorSchema },
    ]),
    MailModule,
    OtpModule,
    WhatsappModule,
  ],
  // The public contact lookup is registered FIRST so its fixed `contact`
  // segment is matched before anything else under the same prefix.
  controllers: [EventAgentsPublicController, EventAgentsController],
  providers: [EventAgentsService],
  exports: [EventAgentsService],
})
export class EventAgentsModule {}
