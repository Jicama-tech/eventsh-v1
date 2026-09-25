import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  OrganizerWhatsapp,
  OrganizerWhatsappSchema,
} from "./schemas/organizer-whatsapp.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { OperatorSchema } from "../operators/entities/operator.entity";
import { PlanSchema } from "../plans/entities/plan.entity";
import { OrganizerWhatsappService } from "./organizer-whatsapp.service";
import { OrganizerWhatsappController } from "./organizer-whatsapp.controller";
import { PlanAccessService } from "../../common/plan-access/plan-access.service";
import { TabsGuard } from "../../common/tabs/tabs.guard";

/**
 * Each organizer's own WhatsApp connection (Settings › Profile › WhatsApp).
 *
 * A LEAF module on purpose: it imports models only, never another feature
 * module. OtpModule imports this one to route attendee messages through the
 * organizer's number, and OtpModule is imported by a dozen feature modules —
 * so anything here that reached back into Organizers, Otp or Events would be
 * a circular import. It is a static module, so Nest creates it once: one
 * service instance, one sessions map, one socket per organizer.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganizerWhatsapp.name, schema: OrganizerWhatsappSchema },
      // PlanAccessService reads the organizer's plan; the test send reads
      // the organizer's country for numbers typed locally.
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Plan", schema: PlanSchema },
      // TabsGuard re-reads the operator on every request.
      { name: "Operator", schema: OperatorSchema },
    ]),
  ],
  controllers: [OrganizerWhatsappController],
  providers: [OrganizerWhatsappService, PlanAccessService, TabsGuard],
  exports: [OrganizerWhatsappService, PlanAccessService, TabsGuard, MongooseModule],
})
export class WhatsappModule {}
