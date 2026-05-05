import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { ShopkeepersService } from "./shopkeepers.service";
import { CreateShopkeeperDto } from "./dto/create-shopkeeper.dto";
import { UpdateShopkeeperDto } from "./dto/update-shopkeeper.dto";

@Controller("shopkeepers")
export class ShopkeepersController {
  constructor(private readonly shopkeepersService: ShopkeepersService) {}

  @Post("create-shopkeeper-by-organizer/:organizerId")
  create(
    @Param("organizerId") organizerId: string,
    @Body() dto: CreateShopkeeperDto,
  ) {
    return this.shopkeepersService.createForOrganizer(organizerId, dto);
  }

  @Patch("update-shopkeeper-by-organizer/:organizerId/:vendorId")
  update(
    @Param("organizerId") organizerId: string,
    @Param("vendorId") vendorId: string,
    @Body() dto: UpdateShopkeeperDto,
  ) {
    return this.shopkeepersService.updateForOrganizer(
      organizerId,
      vendorId,
      dto,
    );
  }

  @Get("fetch-shopkeepers-by-organizer/:organizerId")
  fetch(@Param("organizerId") organizerId: string) {
    return this.shopkeepersService.fetchForOrganizer(organizerId);
  }
}
