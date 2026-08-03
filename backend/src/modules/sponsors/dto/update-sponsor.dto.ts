import { PartialType } from "@nestjs/mapped-types";
import { CreateSponsorDto } from "./create-sponsor.dto";

/** Every CRM field is optional on update. */
export class UpdateSponsorDto extends PartialType(CreateSponsorDto) {}
