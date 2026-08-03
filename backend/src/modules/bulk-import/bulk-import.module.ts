import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BulkImportController } from "./bulk-import.controller";
import { BulkImportService } from "./bulk-import.service";
import { UserSchema } from "../users/schemas/user.schema";
import { Vendor, VendorSchema } from "../stalls/schemas/vendor.schema";
import { Stall, StallSchema } from "../stalls/entities/stall.entity";
import { Supplier, SupplierSchema } from "../suppliers/schemas/supplier.schema";
import { Sponsor, SponsorSchema } from "../sponsors/schemas/sponsor.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "User", schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
      // Read-only: lets the exhibitor export include vendors who joined via
      // the stall form (matched through their stall records).
      { name: Stall.name, schema: StallSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: Sponsor.name, schema: SponsorSchema },
    ]),
  ],
  controllers: [BulkImportController],
  providers: [BulkImportService],
})
export class BulkImportModule {}
