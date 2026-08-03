import { PartialType } from "@nestjs/mapped-types";
import { CreateSupplierDto } from "./create-supplier.dto";

/**
 * Organizer-side update of a Supplier identity — every field optional
 * (mirrors UpdateShopkeeperDto for exhibitors).
 */
export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
