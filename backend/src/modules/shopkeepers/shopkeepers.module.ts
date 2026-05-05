import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ShopkeepersController } from "./shopkeepers.controller";
import { ShopkeepersService } from "./shopkeepers.service";
import { Vendor, VendorSchema } from "../stalls/schemas/vendor.schema";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Vendor.name, schema: VendorSchema }]),
  ],
  controllers: [ShopkeepersController],
  providers: [ShopkeepersService],
  exports: [ShopkeepersService],
})
export class ShopkeepersModule {}
