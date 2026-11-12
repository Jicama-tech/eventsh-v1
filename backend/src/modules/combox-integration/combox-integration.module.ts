import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtService } from "@nestjs/jwt";
import { OrganizersModule } from "../organizers/organizers.module";
import { EventSchema } from "../events/schemas/event.schema";
import { TicketSchema } from "../tickets/entities/ticket.entity";
import { ComboxIntegrationController } from "./combox-integration.controller";
import { ComboxKeyController } from "./combox-key.controller";
import { ComboxKeyService } from "./combox-key.service";
import { ComboxKeyGuard } from "./combox-key.guard";
import { ComboxApiKeySchema } from "./schemas/combox-api-key.schema";

// Read-only feed for ComBox (the Events Module there). Additive: it adds
// routes under /combox-integration and touches nothing else.
@Module({
  imports: [
    forwardRef(() => OrganizersModule),
    MongooseModule.forFeature([
      { name: "Event", schema: EventSchema },
      { name: "Ticket", schema: TicketSchema },
      { name: "ComboxApiKey", schema: ComboxApiKeySchema },
    ]),
  ],
  controllers: [ComboxIntegrationController, ComboxKeyController],
  // JwtAuthGuard (the key controller) injects JwtService, as in otp.module
  providers: [ComboxKeyService, ComboxKeyGuard, JwtService],
})
export class ComboxIntegrationModule {}
