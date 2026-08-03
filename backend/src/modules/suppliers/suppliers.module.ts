import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { SuppliersService } from "./suppliers.service";
import { SuppliersController } from "./suppliers.controller";
import { Supplier, SupplierSchema } from "./schemas/supplier.schema";
import {
  SupplierEventConfig,
  SupplierEventConfigSchema,
} from "./schemas/supplier-event-config.schema";
import {
  SupplierRequest,
  SupplierRequestSchema,
} from "./entities/supplier-request.entity";
import { EventSchema } from "../events/schemas/event.schema";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import {
  OrganizerStore,
  OrganizerStoreSchema,
} from "../organizer-stores/entities/organizer-store.entity";
import { Stall, StallSchema } from "../stalls/entities/stall.entity";
import { OperatorSchema } from "../operators/entities/operator.entity";
import { MailModule } from "../roles/mail.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
      { name: SupplierRequest.name, schema: SupplierRequestSchema },
      { name: SupplierEventConfig.name, schema: SupplierEventConfigSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
      // Store lookup for the organizer's public slug, used to build the
      // event-front-style supplier link.
      { name: OrganizerStore.name, schema: OrganizerStoreSchema },
      // Read-only: totals up sold spaces + add-ons for requirement suggestions.
      { name: "Stall", schema: StallSchema },
      // Operator team — only those with allowEmails get notified.
      { name: "Operator", schema: OperatorSchema },
    ]),
    // Lifecycle notifications go out from the organizer's SMTP when set.
    MailModule,
    // JwtAuthGuard injects JwtService; it verifies with JWT_ACCESS_SECRET.
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
