import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Supplier.name, schema: SupplierSchema },
      { name: SupplierRequest.name, schema: SupplierRequestSchema },
      { name: SupplierEventConfig.name, schema: SupplierEventConfigSchema },
      { name: "Event", schema: EventSchema },
      { name: "Organizer", schema: OrganizerSchema },
    ]),
  ],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
