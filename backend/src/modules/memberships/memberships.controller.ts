import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { MembershipsService } from "./memberships.service";
import {
  CreateMembershipPlanDto,
  UpdateMembershipPlanDto,
} from "./dto/membership-plan.dto";
import {
  ConfirmMembershipDto,
  LookupMembershipExhibitorDto,
  RegisterMembershipPurchaseDto,
  RejectMembershipDto,
} from "./dto/exhibitor-membership.dto";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  OrganizerStore,
  OrganizerStoreDocument,
} from "../organizer-stores/entities/organizer-store.entity";

@Controller()
export class MembershipsController {
  constructor(
    private readonly service: MembershipsService,
    @InjectModel(OrganizerStore.name)
    private readonly storeModel: Model<OrganizerStoreDocument>,
  ) {}

  // ────────────────────────────────────────────────────────────────────
  // ORGANIZER-FACING — Plan CRUD (JWT required)
  // ────────────────────────────────────────────────────────────────────

  @Get("membership-plans")
  @UseGuards(AuthGuard("jwt"))
  list(@Req() req: any) {
    return this.service.listPlansForOrganizer(req.user.userId);
  }

  @Post("membership-plans")
  @UseGuards(AuthGuard("jwt"))
  create(@Req() req: any, @Body() dto: CreateMembershipPlanDto) {
    return this.service.createPlan(req.user.userId, dto);
  }

  @Patch("membership-plans/:id")
  @UseGuards(AuthGuard("jwt"))
  update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: UpdateMembershipPlanDto,
  ) {
    return this.service.updatePlan(req.user.userId, id, dto);
  }

  @Delete("membership-plans/:id")
  @UseGuards(AuthGuard("jwt"))
  archive(@Req() req: any, @Param("id") id: string) {
    return this.service.archivePlan(req.user.userId, id);
  }

  // ────────────────────────────────────────────────────────────────────
  // ORGANIZER-FACING — Exhibitor memberships (verification, list, summary)
  // ────────────────────────────────────────────────────────────────────

  @Get("exhibitor-memberships")
  @UseGuards(AuthGuard("jwt"))
  listMemberships(@Req() req: any, @Query("status") status?: string) {
    return this.service.listMembershipsForOrganizer(req.user.userId, { status });
  }

  @Get("exhibitor-memberships/summary")
  @UseGuards(AuthGuard("jwt"))
  summary(@Req() req: any) {
    return this.service.getSummaryForOrganizer(req.user.userId);
  }

  // Used by the eventfront at booking time to look up the current
  // member status of the logged-in exhibitor for this organizer. Email
  // is in the path (legacy); WhatsApp can be passed as `?whatsapp=`
  // for cases where the vendor's email drifted from what was captured
  // at purchase time. Either field is enough to find the membership.
  @Get("exhibitor-memberships/by-email/:email")
  byEmail(
    @Req() req: any,
    @Param("email") email: string,
    @Query("organizerId") organizerIdQS?: string,
    @Query("whatsapp") whatsapp?: string,
  ) {
    const organizerId = req.user?.userId || organizerIdQS;
    if (!organizerId) return null;
    return this.service.getActiveMembership(organizerId, email, whatsapp);
  }

  @Post("exhibitor-memberships/:id/confirm")
  @UseGuards(AuthGuard("jwt"))
  confirm(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: ConfirmMembershipDto,
  ) {
    return this.service.confirmMembership(req.user.userId, id, dto);
  }

  @Post("exhibitor-memberships/:id/reject")
  @UseGuards(AuthGuard("jwt"))
  reject(
    @Req() req: any,
    @Param("id") id: string,
    @Body() dto: RejectMembershipDto,
  ) {
    return this.service.rejectMembership(req.user.userId, id, dto);
  }

  // ────────────────────────────────────────────────────────────────────
  // PUBLIC STOREFRONT — by slug, no JWT
  // ────────────────────────────────────────────────────────────────────

  @Get("storefront/:slug/membership-plans")
  async storefrontPlans(@Param("slug") slug: string) {
    const store = await this.storeModel.findOne({ slug }).lean();
    if (!store) return [];
    return this.service.listPublishedPlansForOrganizer(
      String((store as any).organizerId),
    );
  }

  // Public — by organizer id (used by the eventfront member dialog,
  // which knows the organizer directly without going through the
  // storefront slug). Mirrors storefrontPlans output.
  @Get("public/membership-plans/by-organizer/:organizerId")
  async plansByOrganizer(@Param("organizerId") organizerId: string) {
    return this.service.listPublishedPlansForOrganizer(organizerId);
  }

  // Public — organizer payment info (UEN / payNowId / static QR) by
  // organizer id. Eventfront Member dialog uses this to build a dynamic
  // PayNow QR like the storefront flow does.
  @Get("public/membership/payment-info/by-organizer/:organizerId")
  async paymentInfoByOrganizer(@Param("organizerId") organizerId: string) {
    return this.service.getPaymentInfoForOrganizer(organizerId);
  }

  // Public — register a membership purchase against an organizer id
  // (no storefront slug). Body identical to the storefront version.
  @Post("public/membership/register/by-organizer/:organizerId")
  async registerByOrganizer(
    @Param("organizerId") organizerId: string,
    @Body() dto: RegisterMembershipPurchaseDto,
  ) {
    return this.service.registerPurchase(organizerId, dto);
  }

  // Returns the organizer's PayNow / UPI payment hooks so the storefront
  // membership dialog can build a dynamic QR (same as the tickets / stalls
  // payment pages) instead of relying solely on the static paymentURL
  // image. Exposes only the fields the QR builder needs — never bank
  // account details or other PII.
  @Get("storefront/:slug/membership/payment-info")
  async storefrontPaymentInfo(@Param("slug") slug: string) {
    return this.service.getStorefrontPaymentInfo(slug);
  }

  @Post("storefront/:slug/membership/lookup")
  async storefrontLookup(
    @Param("slug") slug: string,
    @Body() dto: LookupMembershipExhibitorDto,
  ) {
    const store = await this.storeModel.findOne({ slug }).lean();
    // Always return the same envelope shape so the storefront dialog
    // doesn't have to special-case empty responses.
    if (!store) return { vendor: null, activeMembership: null };
    return this.service.lookupExhibitor(
      String((store as any).organizerId),
      dto.whatsapp,
    );
  }

  @Post("storefront/:slug/membership/register")
  async storefrontRegister(
    @Param("slug") slug: string,
    @Body() dto: RegisterMembershipPurchaseDto,
  ) {
    const store = await this.storeModel.findOne({ slug }).lean();
    if (!store) throw new Error("Storefront not found");
    return this.service.registerPurchase(
      String((store as any).organizerId),
      dto,
    );
  }
}
