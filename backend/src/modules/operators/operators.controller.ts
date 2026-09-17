import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { OperatorsService } from "./operators.service";
import { CreateOperatorDto } from "./dto/create-operator.dto";
import { UpdateOperatorDto } from "./dto/update-operator.dto";

@Controller("operators")
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  // Create operator for an Organizer
  @Post("create-by-organizer/:organizerId")
  createByOrganizer(
    @Param("organizerId") organizerId: string,
    @Body() createOperatorDto: CreateOperatorDto,
  ) {
    return this.operatorsService.createByOrganizer(
      createOperatorDto,
      organizerId,
    );
  }

  // Get all operators (admin)
  @Get()
  findAll() {
    return this.operatorsService.findAll();
  }

  // Get all operators by Organizer ID
  @Get("get-by-organizer/:organizerId")
  findByOrganizerId(@Param("organizerId") organizerId: string) {
    return this.operatorsService.findByOrganizerId(organizerId);
  }

  // The logged-in operator's own referral details, so the dashboard can tag
  // the event links it copies/shares with ?ref=CODE. Identity comes only
  // from the token (operatorId + parent organizer as userId) — organizer
  // owners and anyone whose token doesn't match a live operator of that
  // organizer get data: null. The code is withheld unless referralEnabled.
  @Get("me")
  @UseGuards(AuthGuard("jwt"))
  async me(@Request() req: any) {
    const operatorId = req.user?.operatorId;
    if (!operatorId) return { data: null };
    let operator: any;
    try {
      operator = (await this.operatorsService.findOne(String(operatorId)))
        .data;
    } catch {
      return { data: null };
    }
    if (
      !operator ||
      String(operator.organizerId) !== String(req.user?.userId || "")
    ) {
      return { data: null };
    }
    const referralEnabled = !!operator.referralEnabled;
    return {
      data: {
        operatorId: String(operator._id),
        name: operator.name,
        referralEnabled,
        referralCode: referralEnabled ? operator.referralCode || null : null,
      },
    };
  }

  // Get one operator by ID. Guarded — this now also returns the operator's
  // referral code, which shouldn't be readable by an unauthenticated caller
  // who merely knows/enumerates an operator ID.
  @Get("fetch/:id")
  @UseGuards(AuthGuard("jwt"))
  findOne(@Param("id") id: string) {
    return this.operatorsService.findOne(id);
  }

  // Regenerate an operator's referral code (invalidates the old one
  // immediately — links already shared with the old ?ref= stop attributing).
  // Guarded and ownership-checked in the service (only that operator's own
  // organizer, or an admin) — otherwise any authenticated caller who merely
  // knows/enumerates an operator ID could kill the attribution on every link
  // that operator has already shared.
  @Patch("regenerate-referral-code/:id")
  @UseGuards(AuthGuard("jwt"))
  regenerateReferralCode(@Param("id") id: string, @Request() req: any) {
    return this.operatorsService.regenerateReferralCode(id, req.user);
  }

  // Update operator by ID
  @Patch("update-operator/:id")
  update(
    @Param("id") id: string,
    @Body() updateOperatorDto: UpdateOperatorDto,
  ) {
    return this.operatorsService.update(id, updateOperatorDto);
  }

  // Delete operator by ID
  @Delete("delete-operator/:id")
  remove(@Param("id") id: string) {
    return this.operatorsService.remove(id);
  }
}
