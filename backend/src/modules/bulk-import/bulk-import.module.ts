import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { BulkImportController } from "./bulk-import.controller";
import { BulkImportService } from "./bulk-import.service";
import { UserSchema } from "../users/schemas/user.schema";
import { Vendor, VendorSchema } from "../stalls/schemas/vendor.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "User", schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
    ]),
  ],
  controllers: [BulkImportController],
  providers: [BulkImportService],
})
export class BulkImportModule {}
