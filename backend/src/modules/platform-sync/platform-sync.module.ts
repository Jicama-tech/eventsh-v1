import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PlatformSyncService } from "./platform-sync.service";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { UserSchema } from "../users/schemas/user.schema";
import { OperatorSchema } from "../operators/entities/operator.entity";
import { VendorSchema } from "../stalls/schemas/vendor.schema";
import { Event, EventSchema } from "../events/schemas/event.schema";
import { Ticket, TicketSchema } from "../tickets/entities/ticket.entity";

// Sending side of the central instance registry — see
// PlatformSyncService for the no-op-unless-configured behaviour.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Organizer", schema: OrganizerSchema },
      { name: "User", schema: UserSchema },
      { name: "Operator", schema: OperatorSchema },
      { name: "Vendor", schema: VendorSchema },
      { name: Event.name, schema: EventSchema },
      { name: Ticket.name, schema: TicketSchema },
    ]),
  ],
  providers: [PlatformSyncService],
})
export class PlatformSyncModule {}
