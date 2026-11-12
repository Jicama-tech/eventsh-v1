import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { OrganizersModule } from "../organizers/organizers.module";
import { EventSchema } from "../events/schemas/event.schema";
import { TicketSchema } from "../tickets/entities/ticket.entity";
import { ComboxIntegrationController } from "./combox-integration.controller";

// Read-only feed for ComBox (the Events Module there). Additive: it adds
// routes under /combox-integration and touches nothing else.
@Module({
  imports: [
    forwardRef(() => OrganizersModule),
    MongooseModule.forFeature([
      { name: "Event", schema: EventSchema },
      { name: "Ticket", schema: TicketSchema },
    ]),
  ],
  controllers: [ComboxIntegrationController],
})
export class ComboxIntegrationModule {}
