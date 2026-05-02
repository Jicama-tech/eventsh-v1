import { Module } from "@nestjs/common";
import { VenueDesignerController } from "./venue-designer.controller";
import { VenueDesignerService } from "./venue-designer.service";

@Module({
  controllers: [VenueDesignerController],
  providers: [VenueDesignerService],
})
export class VenueDesignerModule {}
