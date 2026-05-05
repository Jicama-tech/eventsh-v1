import { PartialType } from "@nestjs/mapped-types";
import { CreateShopkeeperDto } from "./create-shopkeeper.dto";

export class UpdateShopkeeperDto extends PartialType(CreateShopkeeperDto) {}
