import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  eventHasEnded,
  EVENT_ENDED_MESSAGE,
} from "../../common/event-timing.util";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";
import * as puppeteer from "puppeteer";
import { UpsertFormDraftDto } from "./dto/upsert-form-draft.dto";
import { CreateStallDto } from "./dto/create-stall.dto";
import { SelectTablesAndAddOnsDto } from "./dto/tableSelect.dto";
import { OrganizerEditStallDto } from "./dto/organizer-edit-stall.dto";
import { EditStallDetailsDto } from "./dto/edit-stall-details.dto";
import {
  AmendStallDto,
  AmendPaymentDto,
  ConfirmAmendmentDto,
  CancellationDecisionDto,
} from "./dto/amend-stall.dto";
import { UpdatePaymentStatusDto } from "./dto/paymentStatus.dto";
import { UpdateStatusDto } from "./dto/updateStatus.dto";
import { Stall, StallDocument } from "./entities/stall.entity";
import { StallFormDraft } from "./schemas/stall-form-draft.schema";
import { OtpService } from "../otp/otp.service";
import { CouponService } from "../coupon/coupon.service";
import { CreateCouponDto } from "../coupon/dto/create-coupon.dto";
import { FeedbackService } from "../feedback/feedback.service";
import { MailService } from "../roles/mail.service";
import { formatMoney } from "../../common/currency.util";

// Parse a JSON-encoded string[] (multipart sends arrays as a string). Falls
// back to a single legacy value when the array form isn't present, so older
// single-preference clients keep working.
function parsePreferredArray(json?: string, legacy?: string): string[] {
  if (json) {
    try {
      const a = JSON.parse(json);
      if (Array.isArray(a)) return a.map((x) => String(x)).filter(Boolean);
    } catch {
      // not JSON — fall through and treat as a single bare value
    }
    return [String(json)].filter(Boolean);
  }
  return legacy ? [String(legacy)] : [];
}

function formatCurrency(amount: number, country?: string): string {
  if (country === "SG") {
    // Singapore uses $ but we explicitly want SG$ to distinguish from other
    // dollar currencies (USD, AUD, etc.).
    return `SG$${amount.toFixed(2)}`;
  }
  // Default to Indian Rupee when no country or unknown country
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
}

@Injectable()
export class StallsService {
  private readonly logger = new Logger(StallsService.name);

  constructor(
    @InjectModel(Stall.name) private stallModel: Model<StallDocument>,
    @InjectModel("Vendor") private vendorModel: Model<any>,
    @InjectModel("Event") private eventModel: Model<any>,
    @InjectModel("Organizer") private organizerModel: Model<any>,
    @InjectModel("Operator") private operatorModel: Model<any>,
    @InjectModel("OrganizerStore") private organizerStoreModel: Model<any>,
    @InjectModel(StallFormDraft.name)
    private stallFormDraftModel: Model<any>,
    private otpService: OtpService,
    private couponService: CouponService,
    private feedbackService: FeedbackService,
    private mailService: MailService,
  ) {
    // Ensure upload directory exists
    const qrDir = path.join(process.cwd(), "uploads", "stallQRs");
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

    const ticketsDir = path.join(process.cwd(), "uploads", "stallTickets");
    if (!fs.existsSync(ticketsDir))
      fs.mkdirSync(ticketsDir, { recursive: true });
  }

  /**
   * Build the booking-summary message body (WhatsApp text + email HTML) for
   * the stall confirmation / ticket delivery. Shared by the auto-delivery and
   * the manual resend path so both show the same rich detail.
   */
  private buildBookingSummaryMessage(
    stall: any,
    vendor: any,
    eventObj: any,
    country: string,
    headingText: string,
    coupon?: any,
    isReissue?: boolean,
  ): string {
    const eventDate = eventObj?.startDate
      ? new Date(eventObj.startDate).toLocaleDateString()
      : "TBA";
    return (
      `🎉 *${headingText}*\n\n` +
      (isReissue
        ? `✏️ Your booking was updated and approved — here's your *new* ticket.\n\n`
        : "") +
      `🎪 *Event:* ${eventObj?.title || "Event"}\n` +
      `👤 *Business:* ${vendor.businessName || vendor.shopName || vendor.brandName || stall.brandName || vendor.name || "—"}\n` +
      `📅 *Date:* ${eventDate}\n` +
      `📍 *Venue:* ${eventObj?.location || "TBA"}\n\n` +
      `📊 *Booking Summary:*\n` +
      `📦 *Spaces Booked:*\n` +
      (stall.selectedTables || [])
        .filter(Boolean)
        .map(
          (t: any) =>
            `  • ${t.name || t.tableName}${t.layoutName ? ` (${t.layoutName})` : ""} - ${formatCurrency(t.price || 0, country)}${(t.depositAmount ?? 0) > 0 ? ` (Deposit: ${formatCurrency(t.depositAmount, country)})` : ""}`,
        )
        .join("\n") +
      `\n` +
      `🛍️ *Add-ons Selected:*\n` +
      (stall.selectedAddOns?.length > 0
        ? (stall.selectedAddOns || [])
            .filter(Boolean)
            .map(
              (a: any) =>
                `  • ${a.name} x${a.quantity} - ${formatCurrency(a.price * a.quantity, country)}`,
            )
            .join("\n")
        : "  None") +
      `\n` +
      `• Total: ${formatCurrency(stall.grandTotal, country)}\n` +
      (coupon && coupon.code
        ? `\n🎟️ *Coupon:* ${coupon.code} (${stall.noOfOperators} free entries)\n`
        : "") +
      (isReissue
        ? `\n⚠️ This new QR replaces your previous one — the *old QR is no longer valid*.`
        : `\n⚠️ Your stall ticket PDF is attached. Present the QR code at the event entrance.`)
    );
  }

  /**
   * The coupon to surface on a stall's ticket / QR / detail view, honoring the
   * event's live `autoGenerateVendorCoupon` toggle. A coupon generated earlier
   * stays stored on the stall (couponCodeAssigned), but flipping the event
   * toggle OFF suppresses it everywhere the vendor sees it — the PDF coupon box,
   * the share/summary message, the download and the resend. Flipping it back ON
   * restores it; nothing is deleted or invalidated (the code still redeems if
   * scanned directly — this is a display/share gate, not a void).
   */
  private effectiveStallCoupon(
    stall: any,
    event: any,
  ): { code: string } | null {
    if (!stall?.couponCodeAssigned) return null;
    if (event?.autoGenerateVendorCoupon === false) return null;
    return { code: stall.couponCodeAssigned };
  }

  // ============ FORM DRAFTS (cross-device resume) ============
  // One draft per (event, email). Public + email-keyed like the rest of the
  // stall flow. Deleted on successful registration; TTL cleans up the rest.

  async getFormDraft(eventId: string, email: string) {
    if (!Types.ObjectId.isValid(eventId) || !email) return null;
    return this.stallFormDraftModel
      .findOne({ eventId, email: email.toLowerCase().trim() })
      .lean();
  }

  async upsertFormDraft(dto: UpsertFormDraftDto) {
    const update: Record<string, any> = {
      subStep: dto.subStep,
      form: dto.form,
    };
    if (dto.emailVerified !== undefined)
      update.emailVerified = dto.emailVerified;
    // termsAcceptedAt is write-once: set when the vendor accepts the gate,
    // never cleared by later autosaves that omit the flag.
    if (dto.termsAccepted) update.termsAcceptedAt = new Date();
    return this.stallFormDraftModel
      .findOneAndUpdate(
        { eventId: dto.eventId, email: dto.email.toLowerCase().trim() },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .lean();
  }

  async deleteFormDraft(eventId: string, email: string) {
    if (!Types.ObjectId.isValid(eventId) || !email) return { deleted: false };
    const res = await this.stallFormDraftModel.deleteOne({
      eventId,
      email: email.toLowerCase().trim(),
    });
    return { deleted: res.deletedCount > 0 };
  }

  // ============ PHASE 1: CREATE STALL REQUEST ============

  async createStallRequest(createStallDto: CreateStallDto) {
    try {
      const event = await this.eventModel.findById(createStallDto.eventId);
      if (!event) {
        throw new NotFoundException("Event not found");
      }
      // Past events accept no new stall bookings.
      if (eventHasEnded(event)) {
        throw new BadRequestException(EVENT_ENDED_MESSAGE);
      }

      // GST verification (India) — cached on the vendor so returning exhibitors
      // aren't re-verified. gstDetails arrives JSON-encoded via multipart.
      const gstVerified =
        (createStallDto as any).isGSTVerified === true ||
        (createStallDto as any).isGSTVerified === "true";
      let gstDetailsObj: Record<string, any> | undefined;
      if (createStallDto.gstDetails) {
        try {
          gstDetailsObj =
            typeof createStallDto.gstDetails === "string"
              ? JSON.parse(createStallDto.gstDetails)
              : (createStallDto.gstDetails as any);
        } catch {
          gstDetailsObj = undefined;
        }
      }

      // UEN verification (Singapore) — same caching pattern as GST.
      const uenVerified =
        (createStallDto as any).isUENVerified === true ||
        (createStallDto as any).isUENVerified === "true";
      let uenDetailsObj: Record<string, any> | undefined;
      if (createStallDto.uenDetails) {
        try {
          uenDetailsObj =
            typeof createStallDto.uenDetails === "string"
              ? JSON.parse(createStallDto.uenDetails)
              : (createStallDto.uenDetails as any);
        } catch {
          uenDetailsObj = undefined;
        }
      }

      let shopkeeperId: Types.ObjectId;

      if (createStallDto.shopkeeperId) {
        const existingVendor = await this.vendorModel.findById(
          createStallDto.shopkeeperId,
        );
        if (!existingVendor) {
          throw new NotFoundException("Vendor not found");
        }

        // Update vendor with latest form details
        const updateFields: Record<string, any> = {};
        if (createStallDto.brandName)
          updateFields.brandName = createStallDto.brandName;
        if (createStallDto.displayName)
          updateFields.displayName = createStallDto.displayName;
        if (createStallDto.nameOfApplicant)
          updateFields.nameOfApplicant = createStallDto.nameOfApplicant;
        if (createStallDto.businessOwnerNationality)
          updateFields.businessOwnerNationality =
            createStallDto.businessOwnerNationality;
        if (createStallDto.registrationNumber)
          updateFields.registrationNumber = createStallDto.registrationNumber;
        if (createStallDto.residency)
          updateFields.residency = createStallDto.residency;
        if (createStallDto.companyLogo)
          updateFields.companyLogo = createStallDto.companyLogo;
        if (createStallDto.faceBookLink)
          updateFields.faceBookLink = createStallDto.faceBookLink;
        if (createStallDto.instagramLink)
          updateFields.instagramLink = createStallDto.instagramLink;
        if (createStallDto.productDescription)
          updateFields.productDescription = createStallDto.productDescription;
        if (createStallDto.productImage)
          updateFields.productImage = createStallDto.productImage;
        if (createStallDto.registrationImage)
          updateFields.registrationImage = createStallDto.registrationImage;
        if (createStallDto.refundPaymentDescription)
          updateFields.refundPaymentDescription =
            createStallDto.refundPaymentDescription;
        if (createStallDto.noOfOperators)
          updateFields.noOfOperators = createStallDto.noOfOperators;
        if (createStallDto.businessCategory)
          updateFields.businessCategory = createStallDto.businessCategory;
        if (createStallDto.businessType) {
          updateFields.businessType = createStallDto.businessType;
          if (!createStallDto.businessCategory)
            updateFields.businessCategory = createStallDto.businessType;
        }
        // Persist edits to the core contact/profile fields too, so changing
        // anything on the stall form reflects back into the vendors collection
        // (not just the new-schema fields above). Each is guarded so a missing
        // value never wipes existing data.
        if (createStallDto.shopkeeperName)
          updateFields.name = createStallDto.shopkeeperName;
        if (createStallDto.shopkeeperEmail)
          updateFields.email = createStallDto.shopkeeperEmail;
        if (createStallDto.shopkeeperBusinessEmail)
          updateFields.businessEmail = createStallDto.shopkeeperBusinessEmail;
        if (createStallDto.shopkeeperWhatsAppNumber)
          updateFields.whatsAppNumber = createStallDto.shopkeeperWhatsAppNumber;
        if (createStallDto.shopkeeperPhoneNumber)
          updateFields.phoneNumber = createStallDto.shopkeeperPhoneNumber;
        if (createStallDto.businessName)
          updateFields.businessName = createStallDto.businessName;
        if (createStallDto.businessAddress)
          updateFields.address = createStallDto.businessAddress;
        // Backfill the owning organizer if this vendor never had one (e.g.
        // created by an older stall flow), so they surface in the CRM/export.
        if (!(existingVendor as any).organizerId) {
          updateFields.organizerId = new Types.ObjectId(
            createStallDto.organizerId,
          );
        }
        // Cache a fresh GST verification onto the vendor. Never clear an
        // already-verified GST if this submission didn't re-verify.
        if (gstVerified) {
          updateFields.isGSTVerified = true;
          if (gstDetailsObj) updateFields.gstDetails = gstDetailsObj;
          updateFields.gstVerifiedAt = new Date();
        }
        if (uenVerified) {
          updateFields.isUENVerified = true;
          if (uenDetailsObj) updateFields.uenDetails = uenDetailsObj;
          updateFields.uenVerifiedAt = new Date();
        }

        if (Object.keys(updateFields).length > 0) {
          await this.vendorModel.findByIdAndUpdate(
            createStallDto.shopkeeperId,
            { $set: updateFields },
          );
        }

        shopkeeperId = new Types.ObjectId(createStallDto.shopkeeperId);
      } else {
        let vendor = null;

        // "Register a new request" (linked accounts) forces a brand-new vendor
        // even when one with the same email/WhatsApp exists — so the reuse
        // lookup is skipped. Multipart sends the flag as a string, so coerce.
        const forceNew =
          (createStallDto as any).forceNewVendor === true ||
          (createStallDto as any).forceNewVendor === "true";

        if (
          !forceNew &&
          (createStallDto.shopkeeperWhatsAppNumber ||
            createStallDto.shopkeeperEmail)
        ) {
          vendor = await this.vendorModel.findOne({
            $or: [
              ...(createStallDto.shopkeeperWhatsAppNumber
                ? [{ whatsAppNumber: createStallDto.shopkeeperWhatsAppNumber }]
                : []),
              ...(createStallDto.shopkeeperEmail
                ? [{ email: createStallDto.shopkeeperEmail }]
                : []),
            ],
          });
        }

        if (vendor) {
          shopkeeperId = new Types.ObjectId(vendor._id);
        } else {
          if (
            !createStallDto.shopkeeperName ||
            !createStallDto.shopkeeperEmail ||
            !createStallDto.shopkeeperWhatsAppNumber
          ) {
            throw new BadRequestException(
              "Vendor name, email, and WhatsApp number are required for new registration",
            );
          }

          const newVendor = await this.vendorModel.create({
            // Stamp the owning organizer so this exhibitor shows up in the
            // organizer's CRM list, export, and membership lookups — not just
            // via their stall record.
            organizerId: new Types.ObjectId(createStallDto.organizerId),
            name: createStallDto.shopkeeperName,
            email: createStallDto.shopkeeperEmail,
            // Save the second email too so stall updates go to both inboxes.
            businessEmail: createStallDto.shopkeeperBusinessEmail,
            whatsAppNumber: createStallDto.shopkeeperWhatsAppNumber,
            countryCode: createStallDto.shopkeeperCountryCode || "+91",
            phoneNumber: createStallDto.shopkeeperPhoneNumber,
            businessName: createStallDto.businessName,
            businessType: createStallDto.businessType,
            businessCategory:
              createStallDto.businessCategory || createStallDto.businessType,
            businessDescription: createStallDto.businessDescription,
            address: createStallDto.businessAddress,
            city: createStallDto.businessCity,
            state: createStallDto.businessState,
            pincode: createStallDto.businessPincode,
            brandName: createStallDto.brandName,
            displayName: createStallDto.displayName,
            nameOfApplicant: createStallDto.nameOfApplicant,
            businessOwnerNationality: createStallDto.businessOwnerNationality,
            registrationNumber: createStallDto.registrationNumber,
            residency: createStallDto.residency,
            companyLogo: createStallDto.companyLogo,
            faceBookLink: createStallDto.faceBookLink,
            instagramLink: createStallDto.instagramLink,
            productDescription: createStallDto.productDescription,
            productImage: createStallDto.productImage,
            registrationImage: createStallDto.registrationImage,
            refundPaymentDescription: createStallDto.refundPaymentDescription,
            noOfOperators: createStallDto.noOfOperators,
            isActive: true,
            isGSTVerified: gstVerified,
            gstDetails: gstDetailsObj,
            gstVerifiedAt: gstVerified ? new Date() : undefined,
            isUENVerified: uenVerified,
            uenDetails: uenDetailsObj,
            uenVerifiedAt: uenVerified ? new Date() : undefined,
          });

          shopkeeperId = new Types.ObjectId(newVendor._id);
        }
      }

      const existingRequest = await this.stallModel.findOne({
        shopkeeperId,
        eventId: new Types.ObjectId(createStallDto.eventId),
        status: { $nin: ["Cancelled", "Completed"] },
      });

      if (existingRequest) {
        throw new ConflictException(
          "You already have a pending or active stall request for this event",
        );
      }

      // When this submission didn't include a freshly uploaded image, inherit
      // whatever the vendor already has on file so the stall always carries the
      // exhibitor's registration doc, logo, and product images. Existing
      // vendors who re-apply keep their previously uploaded files (the form
      // shows them as previews but doesn't re-upload them), so without this the
      // new stall would be saved with no images.
      const vendorImages: any = await this.vendorModel
        .findById(shopkeeperId)
        .select("registrationImage companyLogo productImage")
        .lean();

      const newStall = await this.stallModel.create({
        shopkeeperId,
        eventId: new Types.ObjectId(createStallDto.eventId),
        organizerId: new Types.ObjectId(createStallDto.organizerId),
        status: "Pending",
        paymentStatus: "Unpaid",
        selectedTables: [],
        selectedAddOns: [],
        tablesTotal: 0,
        depositTotal: 0,
        addOnsTotal: 0,
        grandTotal: 0,
        paidAmount: 0,
        remainingAmount: 0,
        requestDate: new Date(),
        noOfOperators: createStallDto.noOfOperators,
        notes: createStallDto.notes,
        brandName: createStallDto.brandName,
        displayName: createStallDto.displayName,
        nameOfApplicant: createStallDto.nameOfApplicant,
        registrationImage:
          createStallDto.registrationImage || vendorImages?.registrationImage,
        businessOwnerNationality: createStallDto.businessOwnerNationality,
        registrationNumber: createStallDto.registrationNumber,
        residency: createStallDto.residency,
        refundPaymentDescription: createStallDto.refundPaymentDescription,
        companyLogo: createStallDto.companyLogo || vendorImages?.companyLogo,
        faceBookLink: createStallDto.faceBookLink,
        instagramLink: createStallDto.instagramLink,
        productDescription: createStallDto.productDescription,
        productImage:
          createStallDto.productImage && createStallDto.productImage.length
            ? createStallDto.productImage
            : vendorImages?.productImage || [],
        preferredTemplateId: createStallDto.preferredTemplateId || null,
        preferredTemplateName: createStallDto.preferredTemplateName || null,
        preferredTemplateIds: parsePreferredArray(
          createStallDto.preferredTemplateIds,
          createStallDto.preferredTemplateId,
        ),
        preferredTemplateNames: parsePreferredArray(
          createStallDto.preferredTemplateNames,
          createStallDto.preferredTemplateName,
        ),
        preferredTemplateQuantities: (() => {
          try {
            const q = JSON.parse(
              createStallDto.preferredTemplateQuantities || "[]",
            );
            return Array.isArray(q)
              ? q.map((n: any) => Math.max(1, Math.floor(Number(n) || 1)))
              : [];
          } catch {
            return [];
          }
        })(),
      });

      const populatedStall = await newStall.populate([
        {
          path: "shopkeeperId",
          select: "name email whatsAppNumber businessName",
        },
        { path: "eventId", select: "title location startDate" },
        { path: "organizerId", select: "name email organizationName" },
      ]);

      await this.sendStallCreatedNotification(populatedStall);

      return {
        success: true,
        message:
          "Stall request submitted successfully. Waiting for organizer approval.",
        data: populatedStall,
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error("Error creating stall request:", error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // ============ PHASE 2: SELECT TABLES AND ADD-ONS ============

  async selectTablesAndAddOns(
    stallId: string,
    selectDto: SelectTablesAndAddOnsDto,
  ) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findById(stallId).populate("eventId");
      if (!stall) {
        throw new NotFoundException("Stall request not found");
      }

      // Past events accept no payments/bookings.
      if (eventHasEnded(stall.eventId as any)) {
        throw new BadRequestException(EVENT_ENDED_MESSAGE);
      }

      if (stall.status !== "Confirmed" && stall.status !== "Approved") {
        throw new BadRequestException(
          "Stall request must be approved/confirmed by organizer before selecting tables",
        );
      }

      const eventDoc: any = stall.eventId;
      if (!eventDoc) {
        throw new NotFoundException("Event not found for this stall.");
      }

      const event = eventDoc.toObject ? eventDoc.toObject() : eventDoc;

      // ✅ FIX: Handle venueTables as OBJECT with layout IDs
      let allTables: any[] = [];

      if (typeof event.venueTables === "object" && event.venueTables !== null) {
        // venueTables is an object with layout IDs as keys
        allTables = Object.values(event.venueTables).flat();
      } else if (Array.isArray(event.venueTables)) {
        // venueTables is an array (backward compatibility)
        allTables = event.venueTables;
      }

      if (!allTables || allTables.length === 0) {
        throw new BadRequestException("No tables available for this event");
      }

      const selectedPositionIds = selectDto.selectedTables.map(
        (t) => t.positionId,
      );

      const bookedStalls = await this.stallModel.find({
        eventId: stall.eventId,
        _id: { $ne: stallId },
        status: { $in: ["Processing", "Completed"] },
        "selectedTables.0": { $exists: true },
      });

      const bookedPositionIds = bookedStalls.flatMap((s) =>
        s.selectedTables.map((t) => t.positionId),
      );

      const unavailableTables = selectedPositionIds.filter((posId) =>
        bookedPositionIds.includes(posId),
      );

      if (unavailableTables.length > 0) {
        throw new ConflictException(
          `Some selected tables are no longer available: ${unavailableTables.join(
            ", ",
          )}`,
        );
      }

      // Enforce the organizer's per-space-type booking cap (maxPerBooking on
      // each stall template, e.g. max 1 large + 2 small). Resolve each
      // selected position to its source template, count per template, and
      // reject if any type exceeds its cap. Blank / 0 = unlimited.
      const templatesById: Record<string, any> = {};
      (event.tableTemplates || []).forEach((tpl: any) => {
        if (tpl?.id) templatesById[tpl.id] = tpl;
      });
      const posToTemplateId: Record<string, string> = {};
      allTables.forEach((t: any) => {
        if (t?.positionId) posToTemplateId[t.positionId] = t.id;
      });
      const countByTemplate: Record<string, number> = {};
      for (const sel of selectDto.selectedTables) {
        const tplId = posToTemplateId[sel.positionId] || (sel as any).tableId;
        if (!tplId) continue;
        countByTemplate[tplId] = (countByTemplate[tplId] || 0) + 1;
      }
      for (const [tplId, count] of Object.entries(countByTemplate)) {
        const max = Number(templatesById[tplId]?.maxPerBooking);
        if (Number.isFinite(max) && max > 0 && count > max) {
          const name = templatesById[tplId]?.name || "this type";
          throw new BadRequestException(
            `You can select at most ${max} "${name}" space${max === 1 ? "" : "s"} per booking.`,
          );
        }
      }

      // Event-level total cap: a vendor can't book more spaces than
      // maxSpacesPerVendor across all types.
      const maxTotal = Number(event.maxSpacesPerVendor);
      if (
        Number.isFinite(maxTotal) &&
        maxTotal > 0 &&
        selectDto.selectedTables.length > maxTotal
      ) {
        throw new BadRequestException(
          `You can book at most ${maxTotal} space${maxTotal === 1 ? "" : "s"} for this event.`,
        );
      }

      const tablesTotal = selectDto.selectedTables.reduce(
        (sum, table) => sum + table.price,
        0,
      );
      const depositTotal = selectDto.selectedTables.reduce(
        (sum, table) => sum + table.depositAmount,
        0,
      );
      const addOnsTotal = selectDto.selectedAddOns
        ? selectDto.selectedAddOns.reduce(
            (sum, addon) => sum + addon.price * addon.quantity,
            0,
          )
        : 0;
      const grandTotal = tablesTotal + depositTotal + addOnsTotal;

      const updatedStall = await this.stallModel
        .findByIdAndUpdate(
          stallId,
          {
            selectedTables: selectDto.selectedTables,
            selectedAddOns: selectDto.selectedAddOns || [],
            tablesTotal,
            depositTotal,
            couponCodeApplied: selectDto.couponCodeApplied || null,
            addOnsTotal,
            grandTotal,
            remainingAmount: grandTotal,
            status: "Processing",
            selectionDate: new Date(),
            // Vendor clicked "I have Paid": record when they submitted. The
            // payment-confirmation HOLD timer is opt-in — the organizer starts
            // it per stall (startConfirmationTimer) only if they choose to hold
            // the space for a vendor who asked for more time. No auto-deadline.
            paymentSubmittedAt: new Date(),
            notes: selectDto.notes || stall.notes,
            transactionId: selectDto.transactionId || null,
            transactionScreenshot: selectDto.transactionScreenshot || null,
            paymentMethod: selectDto.paymentMethod || null,
          },
          { new: true },
        )
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          { path: "eventId", select: "title location startDate" },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      // ✅ FIX: Update venueTables correctly (handle object structure)
      const updatedVenueTables: any = {};

      if (
        typeof event.venueTables === "object" &&
        !Array.isArray(event.venueTables)
      ) {
        // venueTables is object with layout IDs
        Object.keys(event.venueTables).forEach((layoutId) => {
          updatedVenueTables[layoutId] = event.venueTables[layoutId].map(
            (table: any) => {
              const isSelected = selectedPositionIds.includes(table.positionId);
              const tableObject = table.toObject ? table.toObject() : table;
              return {
                ...tableObject,
                isBooked: isSelected ? true : tableObject.isBooked,
              };
            },
          );
        });
      } else {
        // venueTables is array (backward compatibility)
        updatedVenueTables.default = allTables.map((table: any) => {
          const isSelected = selectedPositionIds.includes(table.positionId);
          const tableObject = table.toObject ? table.toObject() : table;
          return {
            ...tableObject,
            isBooked: isSelected ? true : tableObject.isBooked,
          };
        });
      }

      await this.eventModel.findByIdAndUpdate(
        event._id,
        { venueTables: updatedVenueTables },
        { new: true },
      );

      // Email the exhibitor that their request + payment were submitted and are
      // now pending organizer approval. The stall QR ticket is released only
      // after the organizer confirms the payment (a separate email). WhatsApp is
      // phased out — email is the single channel.
      try {
        const vendor = await this.vendorModel.findById(stall.shopkeeperId);
        const vendorEmail = this.vendorEmailRecipients(vendor);
        if (vendorEmail) {
          const senderConfig = await this.getOrganizerSenderConfig(
            stall.organizerId,
          );
          const orgCountry = (
            (await this.organizerModel
              .findById(stall.organizerId)
              .select("country")
              .lean()) as any
          )?.country as string | undefined;
          const tableNames = selectDto.selectedTables
            .map((t) => t.tableName)
            .join(", ");
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:24px;text-align:center">
                <h1 style="margin:0;font-size:20px">Booking Received ✅</h1>
                <p style="margin:6px 0 0;opacity:.9">${event.title}</p>
              </div>
              <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
                <p>Hi ${vendor?.name || "there"},</p>
                <p>Your booking for <strong>${event.title}</strong> has been
                  <strong>received</strong> and your payment details have been
                  submitted.</p>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:14px 0">
                  <p style="margin:0 0 6px"><strong>Spaces:</strong> ${tableNames || "—"}</p>
                  <p style="margin:0 0 6px"><strong>Grand Total:</strong> ${formatMoney(updatedStall.grandTotal, orgCountry)}</p>
                  <p style="margin:0"><strong>Status:</strong> Awaiting organizer payment approval</p>
                </div>
                <p><strong>What happens next?</strong> Please wait for the
                  organizer to verify and approve your payment. Once approved,
                  your <strong>stall ticket with the QR code</strong> will be
                  emailed to you.</p>
                <p style="color:#64748b;font-size:12px;margin-top:16px">You'll
                  receive another email with your QR code as soon as the
                  organizer releases it. Thank you!</p>
              </div>
            </div>`;
          await this.mailService.sendEmail({
            to: vendorEmail,
            subject: `Booking received — awaiting payment approval for ${event.title}`,
            html,
            senderConfig,
          });
          this.logger.log(`Payment-submitted email sent to ${vendorEmail}`);
        } else {
          this.logger.warn(
            `Vendor ${stall.shopkeeperId} has no email — submission notice not sent`,
          );
        }
      } catch (notifyErr) {
        this.logger.warn(
          "Failed to send payment-submitted notification",
          notifyErr,
        );
      }

      // Alert the organizer + all operators that a payment is awaiting approval
      // so the team can action it on priority (best-effort, never blocks).
      await this.notifyReviewersOfPayment(stall, event, grandTotal);

      return {
        success: true,
        message:
          "Tables and add-ons selected. A confirmation email was sent; awaiting payment approval from the organizer.",
        data: updatedStall,
      };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error("Error selecting tables and add-ons:", error);
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  /**
   * ORGANIZER-initiated edit of a stall's space + add-on allocation. Re-allocates
   * the spaces (restricted to the vendor's preferred template(s)) and add-ons on
   * a booking that already holds a space (status Processing or Completed), frees
   * the old spaces, books the new, recomputes totals, and returns the extra
   * amount to collect (`amountDue = max(0, newGrandTotal - oldGrandTotal)`).
   *
   * When there's an extra charge the booking is moved to Processing with the
   * outstanding balance recorded, so the organizer can collect it (dynamic QR)
   * and then confirm payment (which re-issues the ticket). No auto-payment here.
   */
  async organizerEditSpaces(stallId: string, dto: OrganizerEditStallDto) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }
      const stall = await this.stallModel.findById(stallId).populate("eventId");
      if (!stall) throw new NotFoundException("Stall request not found");

      const eventDoc: any = stall.eventId;
      if (!eventDoc)
        throw new NotFoundException("Event not found for this stall.");
      if (eventHasEnded(eventDoc)) {
        throw new BadRequestException(EVENT_ENDED_MESSAGE);
      }
      // Allow the organizer/operator to pick spaces + add-ons and collect
      // payment on the vendor's behalf for a freshly-approved booking
      // (Confirmed/Approved — no space yet, so oldGrandTotal is 0 and the full
      // amount is collected), as well as re-allocating an existing one
      // (Processing/Completed).
      if (
        stall.status !== "Confirmed" &&
        stall.status !== "Approved" &&
        stall.status !== "Processing" &&
        stall.status !== "Completed"
      ) {
        throw new BadRequestException(
          "This booking can't have spaces selected in its current state.",
        );
      }

      const newTables = dto.selectedTables || [];
      if (newTables.length === 0) {
        throw new BadRequestException("Select at least one space.");
      }

      const event = eventDoc.toObject ? eventDoc.toObject() : eventDoc;
      let allTables: any[] = [];
      if (typeof event.venueTables === "object" && event.venueTables !== null) {
        allTables = Object.values(event.venueTables).flat();
      } else if (Array.isArray(event.venueTables)) {
        allTables = event.venueTables;
      }

      // Map each placed position → its template id, so we can enforce the
      // vendor's preferred-type restriction regardless of what the client sent.
      const posToTemplateId: Record<string, string> = {};
      allTables.forEach((t: any) => {
        if (t?.positionId) posToTemplateId[t.positionId] = t.id;
      });

      // Preferred templates: the multi-type set, falling back to the singular.
      const preferredIds: string[] = (
        (stall as any).preferredTemplateIds &&
        (stall as any).preferredTemplateIds.length > 0
          ? (stall as any).preferredTemplateIds
          : [(stall as any).preferredTemplateId]
      ).filter(Boolean);

      if (preferredIds.length > 0) {
        for (const t of newTables) {
          const tplId = posToTemplateId[t.positionId] || (t as any).tableId;
          if (tplId && !preferredIds.includes(String(tplId))) {
            throw new BadRequestException(
              `Space "${t.tableName || t.positionId}" is not one of the vendor's preferred space types.`,
            );
          }
        }
      }

      // Availability: none of the new positions may be held by ANOTHER active
      // booking (this stall's own current spaces are fine — they get freed).
      const newPositionIds = newTables.map((t) => t.positionId);
      const bookedStalls = await this.stallModel.find({
        eventId: stall.eventId,
        _id: { $ne: stallId },
        status: { $in: ["Processing", "Completed"] },
        "selectedTables.0": { $exists: true },
      });
      const otherBookedPositions = new Set(
        bookedStalls.flatMap((s) => s.selectedTables.map((t) => t.positionId)),
      );
      const clash = newPositionIds.filter((p) => otherBookedPositions.has(p));
      if (clash.length > 0) {
        throw new ConflictException(
          `Some selected spaces are no longer available: ${clash.join(", ")}`,
        );
      }

      // Per-type + total caps (same rules as vendor selection).
      const templatesById: Record<string, any> = {};
      (event.tableTemplates || []).forEach((tpl: any) => {
        if (tpl?.id) templatesById[tpl.id] = tpl;
      });
      const countByTemplate: Record<string, number> = {};
      for (const sel of newTables) {
        const tplId = posToTemplateId[sel.positionId] || (sel as any).tableId;
        if (!tplId) continue;
        countByTemplate[tplId] = (countByTemplate[tplId] || 0) + 1;
      }
      for (const [tplId, count] of Object.entries(countByTemplate)) {
        const max = Number(templatesById[tplId]?.maxPerBooking);
        if (Number.isFinite(max) && max > 0 && count > max) {
          const name = templatesById[tplId]?.name || "this type";
          throw new BadRequestException(
            `At most ${max} "${name}" space${max === 1 ? "" : "s"} per booking.`,
          );
        }
      }
      const maxTotal = Number(event.maxSpacesPerVendor);
      if (
        Number.isFinite(maxTotal) &&
        maxTotal > 0 &&
        newTables.length > maxTotal
      ) {
        throw new BadRequestException(
          `At most ${maxTotal} space${maxTotal === 1 ? "" : "s"} for this event.`,
        );
      }

      // Enforce the vendor's requested per-type quantities (their allowed
      // booking number). preferredTemplateQuantities is parallel to
      // preferredTemplateIds; 0 / missing = unrestricted for that type.
      const reqQtys: number[] = Array.isArray(
        (stall as any).preferredTemplateQuantities,
      )
        ? (stall as any).preferredTemplateQuantities
        : [];
      if (reqQtys.length > 0 && preferredIds.length > 0) {
        const allowedByTpl: Record<string, number> = {};
        preferredIds.forEach((id, i) => {
          allowedByTpl[String(id)] = Number(reqQtys[i]) || 0;
        });
        for (const [tplId, count] of Object.entries(countByTemplate)) {
          const allow = allowedByTpl[tplId] || 0;
          if (allow > 0 && count > allow) {
            throw new BadRequestException(
              `The vendor requested only ${allow} of that space type.`,
            );
          }
        }
        const totalAllowed = Object.values(allowedByTpl).reduce(
          (s, n) => s + (n || 0),
          0,
        );
        if (totalAllowed > 0 && newTables.length > totalAllowed) {
          throw new BadRequestException(
            `The vendor may book at most ${totalAllowed} space${totalAllowed === 1 ? "" : "s"}.`,
          );
        }
      }

      // Re-price add-ons from the event's authoritative price list.
      const addOnById: Record<string, any> = {};
      (event.addOnItems || []).forEach((a: any) => {
        if (a?.id) addOnById[a.id] = a;
      });
      const newAddOns = (dto.selectedAddOns || []).map((a) => {
        const authoritative = addOnById[a.addOnId];
        const price = authoritative ? Number(authoritative.price) : a.price;
        return {
          addOnId: a.addOnId,
          name: authoritative?.name || a.name,
          price,
          quantity: Math.max(1, Number(a.quantity) || 1),
          color: authoritative?.color,
        };
      });

      // Totals + the extra to collect.
      const tablesTotal = newTables.reduce((s, t) => s + (t.price || 0), 0);
      const depositTotal = newTables.reduce(
        (s, t) => s + (t.depositAmount || 0),
        0,
      );
      const addOnsTotal = newAddOns.reduce(
        (s, a) => s + a.price * a.quantity,
        0,
      );
      const newGrandTotal = tablesTotal + depositTotal + addOnsTotal;
      const oldGrandTotal = Number((stall as any).grandTotal) || 0;
      const amountDue = Math.max(0, newGrandTotal - oldGrandTotal);
      const wasCompleted = stall.status === "Completed";

      // Re-map the event's venueTables in one pass: book the new positions, free
      // any of this booking's old positions that are no longer selected.
      const oldPositions = new Set(
        (stall.selectedTables || []).map((t: any) => t.positionId),
      );
      const newPositions = new Set(newPositionIds);
      const remap = (table: any) => {
        const obj = table.toObject ? table.toObject() : table;
        const pos = obj.positionId;
        if (newPositions.has(pos)) {
          return { ...obj, isBooked: true, bookedBy: String(stallId) };
        }
        if (oldPositions.has(pos)) {
          return { ...obj, isBooked: false, bookedBy: null };
        }
        return obj;
      };
      const eventLive: any = await this.eventModel.findById(event._id);
      if (eventLive?.venueTables) {
        if (Array.isArray(eventLive.venueTables)) {
          eventLive.venueTables = eventLive.venueTables.map(remap);
        } else {
          for (const layoutId of Object.keys(eventLive.venueTables)) {
            eventLive.venueTables[layoutId] = (
              eventLive.venueTables[layoutId] || []
            ).map(remap);
          }
        }
        eventLive.markModified("venueTables");
        await eventLive.save();
      }

      // Update the stall.
      const actor = (dto.changedBy || "").trim() || "Organizer";
      stall.selectedTables = newTables as any;
      stall.selectedAddOns = newAddOns as any;
      (stall as any).tablesTotal = tablesTotal;
      (stall as any).depositTotal = depositTotal;
      (stall as any).addOnsTotal = addOnsTotal;
      (stall as any).grandTotal = newGrandTotal;
      (stall as any).remainingAmount = amountDue;
      if (amountDue > 0) {
        // Needs a top-up before it's settled again.
        stall.status = "Processing" as any;
        if (wasCompleted) stall.paymentStatus = "Partial" as any;
        (stall as any).qrCodePath = null;
        (stall as any).qrCodeData = null;
        (stall as any).qrCodeImage = null;
      }
      stall.statusHistory.push({
        status: stall.status,
        note:
          `Spaces/add-ons edited by ${actor}.` +
          (amountDue > 0
            ? ` Extra ${amountDue} to collect.`
            : " No extra charge.") +
          (dto.notes && dto.notes.trim() ? ` ${dto.notes.trim()}` : ""),
        changedAt: new Date(),
        changedBy: actor,
      } as any);
      await stall.save();

      const populated = await this.stallModel
        .findById(stallId)
        .populate("shopkeeperId")
        .populate("eventId")
        .populate("organizerId");

      return {
        success: true,
        message:
          amountDue > 0
            ? `Allocation updated. Collect the extra ${amountDue} from the vendor, then confirm payment.`
            : "Allocation updated. No extra charge.",
        amountDue,
        grandTotal: newGrandTotal,
        data: populated,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      this.logger.error("Error editing stall spaces:", error);
      return { success: false, message: (error as any)?.message, data: null };
    }
  }

  /**
   * ORGANIZER/OPERATOR edit of a stall's full form (contact + business profile +
   * applicant/registration details). Contact/business fields save to the vendor;
   * applicant/registration fields save to BOTH the stall and the vendor so the
   * detail dialog + export stay in sync. Only sent fields are updated.
   */
  async editStallDetails(stallId: string, dto: EditStallDetailsDto) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }
      const stall = await this.stallModel.findById(stallId);
      if (!stall) throw new NotFoundException("Stall request not found");

      const set = (obj: any, key: string, val: any) => {
        if (val !== undefined) obj[key] = val;
      };

      // Fields that live on the stall doc (also mirrored to the vendor below).
      set(stall, "brandName", dto.brandName);
      set(stall, "displayName", dto.displayName);
      set(stall, "nameOfApplicant", dto.nameOfApplicant);
      set(stall, "registrationNumber", dto.registrationNumber);
      set(stall, "residency", dto.residency);
      set(stall, "businessOwnerNationality", dto.businessOwnerNationality);
      set(stall, "refundPaymentDescription", dto.refundPaymentDescription);
      set(stall, "productDescription", dto.productDescription);
      set(stall, "noOfOperators", dto.noOfOperators);

      const actor = (dto.changedBy || "").trim() || "Organizer";
      stall.statusHistory.push({
        status: stall.status,
        note: `Stall form edited by ${actor}.`,
        changedAt: new Date(),
        changedBy: actor,
      } as any);
      await stall.save();

      // Vendor profile fields (+ the shared ones).
      const vendorId = (stall as any).shopkeeperId;
      if (vendorId) {
        const vUpdate: Record<string, any> = {};
        set(vUpdate, "name", dto.name);
        set(vUpdate, "email", dto.email);
        set(vUpdate, "businessEmail", dto.businessEmail);
        set(vUpdate, "whatsAppNumber", dto.whatsAppNumber);
        set(vUpdate, "whatsappNumber", dto.whatsAppNumber);
        set(vUpdate, "phoneNumber", dto.phoneNumber);
        set(vUpdate, "country", dto.country);
        set(vUpdate, "businessName", dto.businessName);
        set(vUpdate, "businessType", dto.businessType);
        set(vUpdate, "businessCategory", dto.businessCategory);
        set(vUpdate, "businessDescription", dto.businessDescription);
        set(vUpdate, "address", dto.address);
        set(vUpdate, "city", dto.city);
        set(vUpdate, "state", dto.state);
        set(vUpdate, "pincode", dto.pincode);
        set(vUpdate, "faceBookLink", dto.faceBookLink);
        set(vUpdate, "instagramLink", dto.instagramLink);
        set(vUpdate, "brandName", dto.brandName);
        set(vUpdate, "displayName", dto.displayName);
        set(vUpdate, "nameOfApplicant", dto.nameOfApplicant);
        set(vUpdate, "registrationNumber", dto.registrationNumber);
        set(vUpdate, "residency", dto.residency);
        set(vUpdate, "businessOwnerNationality", dto.businessOwnerNationality);
        set(vUpdate, "refundPaymentDescription", dto.refundPaymentDescription);
        set(vUpdate, "productDescription", dto.productDescription);
        set(vUpdate, "noOfOperators", dto.noOfOperators);
        if (Object.keys(vUpdate).length > 0) {
          await this.vendorModel.findByIdAndUpdate(vendorId, { $set: vUpdate });
        }
      }

      const populated = await this.stallModel
        .findById(stallId)
        .populate("shopkeeperId")
        .populate("eventId")
        .populate("organizerId");

      return {
        success: true,
        message: "Stall details updated.",
        data: populated,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error("Error editing stall details:", error);
      return { success: false, message: (error as any)?.message, data: null };
    }
  }

  /**
   * Append a free-form note to a stall's statusHistory without changing the
   * status. Used by exhibitor / organizer / operator / volunteer to leave
   * timeline entries at any time from the Stall Dialog.
   */
  async addNote(stallId: string, note: string, addedBy?: string) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const trimmed = (note || "").trim();
    if (!trimmed) {
      throw new BadRequestException("Note text is required");
    }

    const stall = await this.stallModel.findById(stallId);
    if (!stall) throw new NotFoundException("Stall not found");

    stall.statusHistory.push({
      status: stall.status as any,
      note: trimmed,
      changedAt: new Date(),
      changedBy: (addedBy || "").trim() || "Unknown user",
    });
    stall.updatedAt = new Date();
    await stall.save();

    return { success: true, data: stall };
  }

  // ============ PHASE 3: PAYMENT & QR CODE - SAME AS TICKETS.SERVICE.TS ============

  /**
   * Confirm payment - Generate QR Code and Stall Ticket PDF (Same as tickets.service.ts)
   */
  async confirmPayment(stallId: string, notes?: string, changedBy?: string) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel
        .findById(stallId)
        .populate("shopkeeperId")
        .populate("eventId")
        .populate("organizerId");

      if (!stall) {
        throw new NotFoundException("Stall request not found");
      }

      // ===== GENERATE SECURE QR PAYLOAD (Same as tickets.service.ts) =====
      const qrPayload = {
        warning:
          "❌ Normal scanners not allowed. Please use the Eventsh app to scan this stall QR.",
        type: "eventsh-stall-checkin",
        stallId: stallId,
        shopkeeperId: (stall.shopkeeperId as any)._id.toString(),
        eventId: (stall.eventId as any)._id.toString(),
        issuedAt: new Date().toISOString(),
      };

      // ===== GENERATE QR CODE BASE64 (Same as tickets.service.ts) =====
      const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        width: 200,
        margin: 2,
      });

      // ===== SAVE QR TO DISK (Same as tickets.service.ts) =====
      await this.saveQRToDisk(qrCodeBase64, stallId);

      // ===== UPDATE PAYMENT STATUS =====
      stall.paymentStatus = "Paid";
      stall.paymentConfirmedDate = new Date();
      stall.status = "Completed";
      stall.completionDate = new Date();
      stall.remainingAmount = 0;
      // Confirmed in time — cancel the 24h auto-release window.
      stall.confirmationDeadline = null as any;
      // Persist the check-in payload HERE, before any PDF work. The ticket PDF
      // needs headless Chromium and can fail for environmental reasons (a
      // read-only /tmp, a missing browser); when it does, the vendor loses an
      // attachment — never the ability to be scanned at the gate. qrCodePath
      // stays null until a render actually lands the file on disk.
      stall.qrCodeData = JSON.stringify(qrPayload);
      stall.qrCodeImage = qrCodeBase64;
      stall.qrCodePath = null as any;
      // Any PDF left from an earlier confirmation carries the OLD issuedAt,
      // which scanning now rejects as superseded. Drop it so a download
      // regenerates from this payload instead of serving a dead ticket.
      await this.discardStallTicketPdf(stallId);
      stall.statusHistory.push({
        status: "Completed" as any,
        note: notes || "Payment confirmed. Stall completed.",
        changedAt: new Date(),
        // Actor comes from the caller (resolved from their JWT): operator name
        // or "Organizer". Falls back to Organizer when not supplied.
        changedBy: changedBy || "Organizer",
      });

      await stall.save();

      // ===== GENERATE STALL TICKET PDF =====
      // shopkeeperId may be populated (object) or raw ObjectId — handle both
      const vendorId = (stall.shopkeeperId as any)?._id || stall.shopkeeperId;
      const vendor = await this.vendorModel.findById(vendorId);
      if (!vendor) {
        throw new NotFoundException("Vendor not found for this stall");
      }

      const eventId = (stall.eventId as any)?._id || stall.eventId;
      const eventDetail = await this.eventModel.findById(eventId);
      if (!eventDetail) {
        throw new NotFoundException("Event not found for this stall");
      }

      const orgId = (stall.organizerId as any)?._id || stall.organizerId;
      const autoCoupon = eventDetail.autoGenerateVendorCoupon !== false;
      let coupon: any;

      if (autoCoupon) {
        const couponName = (
          (eventDetail.title || "Event") +
          (vendor.businessName || vendor.shopName || vendor.name || "Vendor") +
          (stall.noOfOperators || "1")
        ).replace(/\s+/g, "");

        const couponPayload: CreateCouponDto = {
          organizerId: String(orgId),
          code: couponName,
          discountType: "PERCENTAGE",
          discountPercentage: 100,
          minOrderAmount: eventDetail.ticketPrice || "0",
          maxUsage: Number(stall.noOfOperators) || 1,
          expiryDate: eventDetail.startDate,
          isActive: true,
          eventId: String(eventId),
          appliesTo: "ORGANIZER",
        };

        try {
          coupon = await this.couponService.create(couponPayload);
        } catch (couponErr: any) {
          // A coupon with this deterministic code already exists (e.g. the payment
          // was confirmed before, or the same vendor/event regenerates the same
          // code). Reuse the existing code instead of failing the entire
          // confirmation with an E11000 duplicate-key error.
          const isDuplicate =
            couponErr?.code === 11000 ||
            /E11000|duplicate key/i.test(
              String(couponErr?.message || couponErr),
            );
          if (isDuplicate) {
            this.logger.warn(
              `Coupon "${couponName}" already exists — reusing it for stall ${stallId}.`,
            );
            coupon = { code: couponName };
          } else {
            throw couponErr;
          }
        }

        stall.couponCodeAssigned = coupon.code;
      }

      // Get organizer country for currency
      const organizerDoc = await this.organizerModel.findById(orgId);
      const country = organizerDoc?.country || "IN";

      // Persist the coupon assignment now so the confirm response returns
      // immediately. The ticket PDF render (headless Chromium) + email/WhatsApp
      // delivery then run OUT-OF-BAND below: in production they were slow enough
      // to exceed the request/gateway timeout, and when delivery threw the error
      // was swallowed — which is why the organizer had to "Resend". Background
      // delivery failures are logged; "Resend ticket" remains the fallback.
      await stall.save();

      // Fire-and-forget: never block the confirm response on PDF + delivery.
      void this.deliverStallTicketPdf(
        stall,
        qrCodeBase64,
        qrPayload,
        coupon,
        country,
      ).catch((err) =>
        this.logger.error(
          `Background stall ticket delivery failed for stall ${stallId}: ${
            (err as any)?.message || err
          }`,
        ),
      );

      this.logger.log(
        `Payment confirmed for stall ${stallId}; ticket delivery started in background`,
      );

      return {
        success: true,
        message:
          "Payment confirmed. The stall ticket is being generated and sent to the vendor.",
        data: stall,
      };
    } catch (error) {
      this.logger.error("Error confirming payment:", error);
      throw error;
    }
  }

  /**
   * Organizer-initiated extension of a stall's 24h confirmation window. Adds
   * `hours` to the current deadline (or to "now" if it has already lapsed), so
   * the auto-release scheduler holds off and the dialog counter shows the new
   * time. Only valid while the stall is still awaiting confirmation.
   */
  async extendConfirmationDeadline(
    stallId: string,
    hours: number,
    note?: string,
    changedBy?: string,
  ) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const hrs = Number(hours);
    if (!Number.isFinite(hrs) || hrs <= 0 || hrs > 720) {
      throw new BadRequestException(
        "Extension must be between 1 and 720 hours",
      );
    }

    const stall = await this.stallModel
      .findById(stallId)
      .populate("shopkeeperId")
      .populate("eventId")
      .populate("organizerId");
    if (!stall) throw new NotFoundException("Stall request not found");

    // Only stalls still awaiting organizer confirmation have a live window.
    if (stall.paymentStatus === "Paid" || stall.status === "Cancelled") {
      throw new BadRequestException(
        "This booking is no longer awaiting confirmation.",
      );
    }

    const now = Date.now();
    const base = stall.confirmationDeadline
      ? Math.max(now, new Date(stall.confirmationDeadline).getTime())
      : now;
    const newDeadline = new Date(base + hrs * 60 * 60 * 1000);
    stall.confirmationDeadline = newDeadline;

    // Recompute how many reminder thresholds are already crossed for the NEW
    // deadline so extending doesn't re-fire reminders the team already saw.
    const REMINDER_HOURS = [12, 6, 1];
    const hoursRemaining = (newDeadline.getTime() - now) / 3_600_000;
    stall.deadlineRemindersSent = REMINDER_HOURS.filter(
      (h) => hoursRemaining <= h,
    ).length;

    const trimmedNote = String(note || "").trim();
    stall.statusHistory.push({
      status: stall.status as any,
      note:
        `Confirmation deadline extended by ${hrs} hour${
          hrs === 1 ? "" : "s"
        } by ${changedBy || "Organizer"}.` +
        (trimmedNote ? ` Note: ${trimmedNote}` : ""),
      changedAt: new Date(),
      changedBy: changedBy || "Organizer",
    });

    await stall.save();

    // Tell the vendor their confirmation window was extended (best-effort).
    await this.notifyVendorDeadlineExtended(
      stall,
      hrs,
      newDeadline,
      trimmedNote,
    );

    return {
      success: true,
      message: `Deadline extended by ${hrs} hour${hrs === 1 ? "" : "s"}.`,
      confirmationDeadline: stall.confirmationDeadline,
      data: stall,
    };
  }

  /**
   * Emails the vendor that the organizer extended their payment-confirmation
   * window — showing how much time was added, the new deadline + total time
   * remaining, and the organizer's extension note. Best-effort; never throws.
   */
  private async notifyVendorDeadlineExtended(
    stall: any,
    hoursAdded: number,
    newDeadline: Date,
    note: string,
  ) {
    try {
      const vendor = (stall.shopkeeperId as any) || {};
      const to = this.vendorEmailRecipients(vendor);
      if (!to) return;

      const event = (stall.eventId as any) || {};
      const senderConfig = await this.getOrganizerSenderConfig(
        stall.organizerId,
      );

      const totalHoursLeft = Math.max(
        0,
        Math.round((newDeadline.getTime() - Date.now()) / 3_600_000),
      );
      const deadlineStr =
        newDeadline.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore",
        }) + " SGT";
      const businessName =
        vendor?.businessName ||
        vendor?.shopName ||
        vendor?.brandName ||
        vendor?.name ||
        "there";

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:24px;text-align:center">
            <h1 style="margin:0;font-size:20px">⏳ More time to confirm your payment</h1>
            <p style="margin:6px 0 0;opacity:.9">${event?.title || "Your event"}</p>
          </div>
          <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
            <p>Hi ${businessName},</p>
            <p>Good news — the organizer has <strong>extended your payment
              confirmation window by ${hoursAdded} hour${
                hoursAdded === 1 ? "" : "s"
              }</strong>.</p>
            <div style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
              <div style="font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#15803d">New confirmation deadline</div>
              <div style="font-size:20px;font-weight:800;color:#16a34a;margin:6px 0">${deadlineStr}</div>
              <div style="font-size:13px;color:#166534">You now have about <strong>${totalHoursLeft} hour${
                totalHoursLeft === 1 ? "" : "s"
              }</strong> remaining to confirm your payment.</div>
            </div>
            ${
              note
                ? `<div style="border-left:3px solid #16a34a;background:#f8fafc;padding:10px 14px;margin:14px 0">
                     <p style="margin:0;color:#334155"><strong>Message from the organizer:</strong><br/>${note}</p>
                   </div>`
                : ""
            }
            <p style="color:#64748b;font-size:12px;margin-top:16px">Please make sure to connect with Organizer and Complete Payment (IF NOT DONE) before the new deadline so your space is secured.</p>
          </div>
        </div>`;

      await this.mailService.sendEmail({
        to,
        subject: `Your payment confirmation window was extended — ${
          event?.title || "Event"
        }`,
        html,
        senderConfig,
      });
      this.logger.log(
        `Deadline-extension email sent to vendor for stall ${stall._id}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `[stalls] notifyVendorDeadlineExtended failed: ${e?.message || e}`,
      );
    }
  }

  /**
   * Organizer-initiated payment-confirmation hold. The timer is OPT-IN, not
   * automatic: when a vendor who's clicked "I have Paid" asks for more time,
   * the organizer holds the space for `hours` from now. Once running, the
   * dialog shows a countdown and the scheduler auto-releases the space if the
   * vendor still hasn't paid by the deadline. No-op if the stall isn't awaiting
   * confirmation or a hold is already running (use extend to lengthen it).
   */
  async startConfirmationTimer(
    stallId: string,
    hours: number,
    note?: string,
    changedBy?: string,
  ) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const hrs = Number(hours);
    if (!Number.isFinite(hrs) || hrs <= 0 || hrs > 720) {
      throw new BadRequestException("Hold must be between 1 and 720 hours");
    }

    const stall = await this.stallModel
      .findById(stallId)
      .populate("shopkeeperId")
      .populate("eventId")
      .populate("organizerId");
    if (!stall) throw new NotFoundException("Stall request not found");

    // Only stalls where the vendor has submitted payment ("I have Paid" →
    // Processing) and it's still unconfirmed can be put on hold.
    const awaiting =
      stall.status === "Processing" && stall.paymentStatus !== "Paid";
    if (!awaiting) {
      throw new BadRequestException(
        "This booking is not awaiting payment confirmation.",
      );
    }
    if (stall.confirmationDeadline) {
      return {
        started: false,
        confirmationDeadline: stall.confirmationDeadline,
        message: "A hold is already running — use Extend to add more time.",
      };
    }

    const newDeadline = new Date(Date.now() + hrs * 60 * 60 * 1000);
    stall.confirmationDeadline = newDeadline;
    if (!stall.paymentSubmittedAt) {
      stall.paymentSubmittedAt = (stall as any).selectionDate || new Date();
    }
    stall.deadlineRemindersSent = 0;

    const trimmedNote = String(note || "").trim();
    stall.statusHistory.push({
      status: stall.status as any,
      note:
        `Payment-confirmation hold started — ${hrs} hour${
          hrs === 1 ? "" : "s"
        } by ${changedBy || "Organizer"}.` +
        (trimmedNote ? ` Note: ${trimmedNote}` : ""),
      changedAt: new Date(),
      changedBy: changedBy || "Organizer",
    });
    await stall.save();

    // Tell the vendor how long the space is held (reuses the extension email).
    await this.notifyVendorDeadlineExtended(
      stall,
      hrs,
      newDeadline,
      trimmedNote,
    );

    return { started: true, confirmationDeadline: stall.confirmationDeadline };
  }

  /**
   * Remove an active payment-confirmation hold (organizer turns the timer off).
   * Clears the deadline so the countdown stops and the scheduler no longer
   * auto-releases the space — the booking simply stays pending confirmation
   * with no clock. No-op if there's no hold running.
   */
  async cancelConfirmationTimer(stallId: string, changedBy?: string) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const stall = await this.stallModel.findById(stallId);
    if (!stall) throw new NotFoundException("Stall request not found");
    if (!stall.confirmationDeadline) {
      return { cleared: false, message: "No hold is running." };
    }
    stall.confirmationDeadline = null as any;
    stall.deadlineRemindersSent = 0;
    stall.statusHistory.push({
      status: stall.status as any,
      note: `Payment-confirmation hold removed by ${changedBy || "Organizer"}.`,
      changedAt: new Date(),
      changedBy: changedBy || "Organizer",
    });
    await stall.save();
    return { cleared: true };
  }

  /**
   * Render the stall ticket PDF and deliver it (WhatsApp text + email/WhatsApp
   * attachment), falling back to a plain email when the PDF render fails.
   * Persists qrCodePath (the PDF url) only — qrCodeData/qrCodeImage are already
   * written by the caller before this runs, so a render failure costs an
   * attachment and nothing else. Self-contained so both initial payment
   * confirmation and an amendment re-issue can call it.
   * Best-effort — never throws to the caller (run fire-and-forget).
   */
  private async deliverStallTicketPdf(
    stall: any,
    qrCodeBase64: string,
    qrPayload: any,
    coupon: any,
    country: string,
    opts?: { reissue?: boolean },
  ) {
    const isReissue = !!opts?.reissue;
    const headingText = isReissue
      ? "Your Updated Stall Ticket is Ready!"
      : "Your Stall Confirmation is Ready!";
    const stallId = String(stall._id);
    const vendorId = (stall.shopkeeperId as any)?._id || stall.shopkeeperId;
    const vendor = await this.vendorModel.findById(vendorId);
    if (!vendor) {
      this.logger.error(
        `Vendor not found for stall ${stallId} — cannot deliver ticket`,
      );
      return;
    }
    const orgId = (stall.organizerId as any)?._id || stall.organizerId;
    const organizerDoc = await this.organizerModel.findById(orgId);
    const vendorWhatsApp = vendor.whatsAppNumber || vendor.whatsappNumber;
    const vendorEmail = this.vendorEmailRecipients(vendor);
    const eventObj = stall.eventId as any;
    const message = this.buildBookingSummaryMessage(
      stall,
      vendor,
      eventObj,
      country,
      headingText,
      coupon,
      isReissue,
    );

    // Render the ticket PDF. If headless Chromium fails (common on constrained
    // production hosts), DON'T abort delivery — fall back to a plain email.
    let pdfPath: string | null = null;
    try {
      const pdfBuffer = await this.generateStallTicketPDF(
        stall,
        qrCodeBase64,
        coupon,
        country,
      );
      const pdfDir = path.join(process.cwd(), "uploads", "stallTickets");
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const pdfFileName = `stall_ticket_${stallId}.pdf`;
      pdfPath = path.join(pdfDir, pdfFileName);
      await fs.promises.writeFile(pdfPath, pdfBuffer);
      stall.qrCodePath = `/uploads/stallTickets/${pdfFileName}`;
      // Defensive: the caller persists these first, but if this is ever
      // reached with them unset, don't leave the booking unscannable.
      if (!stall.qrCodeData) stall.qrCodeData = JSON.stringify(qrPayload);
      if (!stall.qrCodeImage) stall.qrCodeImage = qrCodeBase64;
      await stall.save();
    } catch (pdfErr) {
      pdfPath = null;
      this.logger.error(
        `Stall ticket PDF generation failed for stall ${stallId}: ${
          (pdfErr as any)?.message || pdfErr
        }. Sending a plain confirmation instead. The QR payload is stored, so ` +
          `the booking stays scannable and "Resend ticket" will attach the PDF ` +
          `once the render issue is fixed.`,
      );
    }

    try {
      if (vendorWhatsApp) {
        try {
          await this.otpService.sendWhatsAppMessage(vendorWhatsApp, message);
        } catch (waErr) {
          this.logger.warn(
            `WhatsApp text failed for stall ${stallId} (continuing to email): ${
              (waErr as any)?.message || waErr
            }`,
          );
        }
      }

      if (pdfPath) {
        await this.otpService.sendMediaMessage(
          vendorWhatsApp || "",
          pdfPath,
          `Stall Ticket - ${eventObj?.title || "Event"}`,
          "stall-ticket.pdf",
          {
            to: vendorEmail,
            subject: isReissue
              ? `Your updated stall ticket for ${eventObj?.title || "Event"}`
              : `Your stall ticket for ${eventObj?.title || "Event"}`,
            heading: headingText,
            message,
            senderConfig: (organizerDoc as any)?.emailConfig,
          },
        );
      } else if (vendorEmail) {
        await this.mailService.sendEmail({
          to: vendorEmail,
          subject: isReissue
            ? `Your stall ticket was updated for ${eventObj?.title || "Event"}`
            : `Your stall is confirmed for ${eventObj?.title || "Event"}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:24px;text-align:center">
                <h1 style="margin:0;font-size:20px">${headingText}</h1>
              </div>
              <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
                <p>${message.replace(/\*/g, "").replace(/\n/g, "<br/>")}</p>
                <p style="color:#64748b;font-size:12px;margin-top:16px">Your ticket PDF will follow shortly.</p>
              </div>
            </div>`,
          senderConfig: (organizerDoc as any)?.emailConfig,
        });
      }

      if (!vendorEmail && !vendorWhatsApp) {
        this.logger.warn(
          `Vendor ${vendorId} has no email or WhatsApp — stall ticket not delivered`,
        );
      }
    } catch (sendError) {
      this.logger.error(
        `Failed to send stall ticket for stall ${stallId}: ${
          (sendError as any)?.message || sendError
        }`,
      );
    }
  }

  // ============================================================
  // EDIT REQUEST (AMENDMENT) — operators (free) + add-ons (add-only)
  // ============================================================

  /**
   * Vendor raises an "Edit Request" on a Completed/Paid booking: change the
   * operator count (free — only resizes the coupon/QR) and/or add or increase
   * add-ons (ADD-ONLY — never remove or reduce). Re-prices add-ons against the
   * event catalogue and records the extra amount owed. The live booking is
   * untouched until the organizer confirms.
   */
  async amendRequest(stallId: string, dto: AmendStallDto) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const stall = await this.stallModel.findById(stallId).populate("eventId");
    if (!stall) throw new NotFoundException("Stall request not found");
    // No edits/transactions once the event has ended.
    if (eventHasEnded(stall.eventId as any)) {
      throw new BadRequestException(EVENT_ENDED_MESSAGE);
    }
    if (stall.status !== "Completed" || stall.paymentStatus !== "Paid") {
      throw new BadRequestException(
        "Only a completed & paid booking can be edited.",
      );
    }
    if ((stall.pendingAmendment as any)?.status === "paid_pending_confirm") {
      throw new BadRequestException(
        "An amendment is already awaiting organizer confirmation.",
      );
    }

    const eventDoc: any = stall.eventId;
    const event = eventDoc?.toObject ? eventDoc.toObject() : eventDoc || {};
    const catalogue: any[] = Array.isArray(event.addOnItems)
      ? event.addOnItems
      : [];
    const byId = new Map(catalogue.map((a) => [String(a.id), a]));

    // Current add-on quantities form the add-only floor.
    const currentQty = new Map<string, number>();
    (stall.selectedAddOns || []).forEach((a: any) =>
      currentQty.set(String(a.addOnId), Number(a.quantity) || 0),
    );

    const bookedTables = stall.selectedTables || [];
    const proposed = Array.isArray(dto.selectedAddOns)
      ? dto.selectedAddOns
      : [];
    const seen = new Set<string>();
    const normalized: any[] = [];

    for (const item of proposed) {
      const cat = byId.get(String(item.addOnId));
      if (!cat) {
        throw new BadRequestException(
          `Unknown add-on: ${item.name || item.addOnId}`,
        );
      }
      const qty = Math.floor(Number(item.quantity) || 0);
      if (qty < 1) continue;
      seen.add(String(item.addOnId));

      // Add-only: never below the currently booked quantity.
      const floor = currentQty.get(String(item.addOnId)) || 0;
      if (qty < floor) {
        throw new BadRequestException(
          `"${cat.name}" can only be increased — not reduced below ${floor}.`,
        );
      }

      // Cap: maxPerTemplate overrides maxPerSpace; 0/undefined = unlimited.
      let cap = 0;
      let unlimited = false;
      for (const t of bookedTables as any[]) {
        const per =
          (cat.maxPerTemplate && cat.maxPerTemplate[String(t.tableId)]) ??
          cat.maxPerSpace;
        if (per === undefined || per === null || Number(per) === 0) {
          unlimited = true;
          break;
        }
        cap += Number(per) || 0;
      }
      if (!unlimited && cap > 0 && qty > cap) {
        throw new BadRequestException(
          `"${cat.name}" is capped at ${cap} for your booked spaces.`,
        );
      }

      normalized.push({
        addOnId: String(item.addOnId),
        name: cat.name,
        price: Number(cat.price) || 0, // event price is authoritative
        quantity: qty,
      });
    }

    // Reject removal of any existing add-on (add-only).
    for (const [id, floor] of currentQty.entries()) {
      if (floor > 0 && !seen.has(id)) {
        const nm = byId.get(id)?.name || id;
        throw new BadRequestException(
          `"${nm}" can't be removed — add-ons can only be added.`,
        );
      }
    }

    const newAddOnsTotal = normalized.reduce(
      (s, a) => s + a.price * a.quantity,
      0,
    );
    const amountDue = Math.max(0, newAddOnsTotal - (stall.addOnsTotal || 0));
    const ops = String(
      Math.min(10, Math.max(1, Math.floor(Number(dto.noOfOperators) || 1))),
    );

    stall.pendingAmendment = {
      noOfOperators: ops,
      selectedAddOns: normalized,
      addOnsTotal: newAddOnsTotal,
      amountDue,
      status: amountDue > 0 ? "awaiting_payment" : "paid_pending_confirm",
      requestedAt: new Date(),
    } as any;
    stall.markModified("pendingAmendment");
    await stall.save();

    return {
      success: true,
      message:
        amountDue > 0
          ? "Amendment saved — pay the difference to proceed."
          : "Amendment saved — awaiting organizer confirmation.",
      data: { amountDue, pendingAmendment: stall.pendingAmendment },
    };
  }

  /** Vendor records the top-up transaction for the amendment difference. */
  async amendPayment(
    stallId: string,
    dto: AmendPaymentDto,
    screenshotUrl?: string,
  ) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const stall = await this.stallModel
      .findById(stallId)
      .populate("eventId")
      .populate("organizerId");
    if (!stall) throw new NotFoundException("Stall request not found");
    // No edit-difference payments once the event has ended.
    if (eventHasEnded(stall.eventId as any)) {
      throw new BadRequestException(EVENT_ENDED_MESSAGE);
    }
    const pa: any = stall.pendingAmendment;
    if (!pa || pa.status !== "awaiting_payment") {
      throw new BadRequestException("No amendment awaiting payment.");
    }
    pa.transactionId = dto.transactionId || pa.transactionId;
    if (screenshotUrl) pa.transactionScreenshot = screenshotUrl;
    else if (dto.transactionScreenshot)
      pa.transactionScreenshot = dto.transactionScreenshot;
    pa.paymentMethod = dto.paymentMethod || pa.paymentMethod;
    pa.status = "paid_pending_confirm";
    pa.paidAt = new Date();
    stall.markModified("pendingAmendment");
    await stall.save();

    // Alert organizer reviewers that a top-up awaits confirmation.
    try {
      await this.notifyReviewersOfPayment(
        stall,
        stall.eventId,
        pa.amountDue || 0,
      );
    } catch {
      /* non-fatal */
    }

    return {
      success: true,
      message: "Payment recorded — awaiting organizer confirmation.",
      data: stall,
    };
  }

  /**
   * Organizer confirms a paid/no-cost amendment: apply the new operators +
   * add-ons to the live booking, bump the free-entry coupon's max-usage in
   * place, re-issue the QR ticket, and clear the pending amendment.
   */
  async confirmAmendment(stallId: string, dto: ConfirmAmendmentDto) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const stall = await this.stallModel
      .findById(stallId)
      .populate("shopkeeperId")
      .populate("eventId")
      .populate("organizerId");
    if (!stall) throw new NotFoundException("Stall request not found");
    const pa: any = stall.pendingAmendment;
    if (!pa || pa.status !== "paid_pending_confirm") {
      throw new BadRequestException("No amendment awaiting confirmation.");
    }

    // Apply to the live booking.
    stall.noOfOperators = pa.noOfOperators;
    stall.selectedAddOns = (pa.selectedAddOns || []).map((a: any) => ({
      addOnId: a.addOnId,
      name: a.name,
      price: a.price,
      quantity: a.quantity,
    })) as any;
    stall.addOnsTotal = pa.addOnsTotal || 0;
    stall.grandTotal =
      (stall.tablesTotal || 0) +
      (stall.depositTotal || 0) +
      (pa.addOnsTotal || 0);
    stall.paidAmount = (stall.paidAmount || 0) + (pa.amountDue || 0);
    stall.remainingAmount = 0;
    stall.statusHistory.push({
      status: "Completed" as any,
      note:
        dto.note ||
        `Edit Request confirmed — operators: ${pa.noOfOperators}, add-ons updated${
          pa.amountDue > 0 ? `, +${pa.amountDue} paid` : ""
        }.`,
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    });

    // Bump the free-entry coupon (one per operator), keeping the same code.
    // Suppress it from the re-issued ticket when the event's coupon toggle is
    // off, but still keep its max-usage in sync so re-enabling stays correct.
    const orgId = (stall.organizerId as any)?._id || stall.organizerId;
    const coupon: any = this.effectiveStallCoupon(stall, stall.eventId);
    if (stall.couponCodeAssigned) {
      try {
        await this.couponService.setMaxUsageByCode(
          String(orgId),
          stall.couponCodeAssigned,
          Number(pa.noOfOperators) || 1,
        );
      } catch (e) {
        this.logger.warn(
          `Coupon max-usage update failed for stall ${stallId}: ${
            (e as any)?.message || e
          }`,
        );
      }
    }

    // Re-issue the QR (ids unchanged; re-stamp issuedAt).
    const qrPayload = {
      warning:
        "❌ Normal scanners not allowed. Please use the Eventsh app to scan this stall QR.",
      type: "eventsh-stall-checkin",
      stallId: String(stall._id),
      shopkeeperId: String(
        (stall.shopkeeperId as any)?._id || stall.shopkeeperId,
      ),
      eventId: String((stall.eventId as any)?._id || stall.eventId),
      issuedAt: new Date().toISOString(),
    };
    const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrPayload), {
      width: 200,
      margin: 2,
    });
    await this.saveQRToDisk(qrCodeBase64, String(stall._id));
    stall.qrCodeData = JSON.stringify(qrPayload);
    stall.qrCodeImage = qrCodeBase64;
    stall.qrCodePath = null as any;
    await this.discardStallTicketPdf(String(stall._id));
    await stall.save();

    // Clear the pending amendment reliably.
    await this.stallModel.updateOne(
      { _id: stall._id },
      { $unset: { pendingAmendment: "" } },
    );
    (stall as any).pendingAmendment = undefined;

    const organizerDoc = await this.organizerModel.findById(orgId);
    const country = organizerDoc?.country || "IN";

    // Re-generate + re-deliver the updated ticket in the background.
    void this.deliverStallTicketPdf(
      stall,
      qrCodeBase64,
      qrPayload,
      coupon,
      country,
      { reissue: true },
    ).catch((err) =>
      this.logger.error(
        `Amendment ticket re-delivery failed for stall ${stallId}: ${
          (err as any)?.message || err
        }`,
      ),
    );

    return {
      success: true,
      message: "Amendment confirmed. Updated stall ticket is being re-issued.",
      data: stall,
    };
  }

  // ============================================================
  // CANCELLATION / DELETE REQUEST (vendor-initiated, organizer-approved)
  // ============================================================

  /**
   * Vendor asks to cancel/delete their booking, with a reason. Creates a
   * pending request for the organizer to decide on; the live booking + space
   * stay intact until then.
   */
  async requestCancellation(stallId: string, reason: string) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const stall = await this.stallModel
      .findById(stallId)
      .populate("eventId")
      .populate("organizerId");
    if (!stall) throw new NotFoundException("Stall request not found");
    if (stall.status === "Cancelled") {
      throw new BadRequestException("This booking is already cancelled.");
    }
    if ((stall.pendingCancellation as any)?.status === "requested") {
      throw new BadRequestException(
        "A cancellation request is already awaiting the organizer.",
      );
    }

    stall.pendingCancellation = {
      reason: (reason || "").trim(),
      status: "requested",
      organizerNote: "",
      requestedAt: new Date(),
    } as any;
    stall.markModified("pendingCancellation");
    await stall.save();

    // Best-effort: let the organizer know a cancellation was requested.
    try {
      const org: any = stall.organizerId;
      const orgEmail = org?.email;
      const eventObj: any = stall.eventId;
      if (orgEmail) {
        await this.mailService.sendEmail({
          to: orgEmail,
          subject: `Stall cancellation requested — ${eventObj?.title || "your event"}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#b45309">Cancellation requested</h2>
              <p>A vendor has requested to cancel their stall for
              <b>${eventObj?.title || "your event"}</b>.</p>
              <p><b>Reason:</b> ${(reason || "—").replace(/</g, "&lt;")}</p>
              <p>Open your dashboard to approve (frees the space, re-issues nothing,
              and lets you add a refund note) or reject it.</p>
            </div>`,
        });
      }
    } catch (e) {
      this.logger.warn(
        `Cancellation-request organizer notice failed for stall ${stallId}: ${
          (e as any)?.message || e
        }`,
      );
    }

    return {
      success: true,
      message: "Cancellation request sent to the organizer.",
      data: stall.pendingCancellation,
    };
  }

  /**
   * Organizer decides on a cancellation request. On approve: free the space,
   * cancel the booking, invalidate the QR + coupon, and email the vendor the
   * organizer's note (e.g. refund timing). On reject: email the vendor why.
   */
  async decideCancellation(stallId: string, dto: CancellationDecisionDto) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }
    const stall = await this.stallModel
      .findById(stallId)
      .populate("shopkeeperId")
      .populate("eventId")
      .populate("organizerId");
    if (!stall) throw new NotFoundException("Stall request not found");
    const pc: any = stall.pendingCancellation;
    if (!pc || pc.status !== "requested") {
      throw new BadRequestException("No cancellation request is pending.");
    }

    const note = (dto.organizerNote || "").trim();
    const orgId = (stall.organizerId as any)?._id || stall.organizerId;
    const organizerDoc = await this.organizerModel.findById(orgId);
    const vendorId = (stall.shopkeeperId as any)?._id || stall.shopkeeperId;
    const vendor = await this.vendorModel.findById(vendorId);
    const vendorEmail = vendor ? this.vendorEmailRecipients(vendor) : "";
    const eventObj: any = stall.eventId;

    if (dto.approve) {
      // Kill the free-entry coupon (no more free entries for a deleted stall).
      if (stall.couponCodeAssigned) {
        try {
          await this.couponService.setMaxUsageByCode(
            String(orgId),
            stall.couponCodeAssigned,
            0,
          );
        } catch {
          /* non-fatal */
        }
      }

      // Free the space back to the layout, then SOFT-cancel the booking (keep
      // the record). The organizer still needs to see it to settle the refund /
      // deposit, so it stays in the exhibitor/participants list marked
      // Cancelled. Its QR is void via the Cancelled-status guard in scanStallQR.
      await this.releaseStallTables(stall);

      // Email the vendor BEFORE deleting (we still have their details on hand):
      // cancellation confirmed + refund note.
      if (vendorEmail) {
        try {
          await this.mailService.sendEmail({
            to: vendorEmail,
            subject: `Your stall booking was cancelled — ${eventObj?.title || "Event"}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
                <div style="background:#dc2626;color:#fff;padding:20px;text-align:center">
                  <h1 style="margin:0;font-size:20px">Booking Cancelled</h1>
                </div>
                <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
                  <p>Your stall booking for <b>${eventObj?.title || "the event"}</b> has been cancelled and your space released.</p>
                  <p>Your previous QR code is <b>no longer valid</b>.</p>
                  ${note ? `<div style="margin-top:12px;padding:12px;background:#f8fafc;border-left:4px solid #dc2626;border-radius:4px"><b>Note from the organizer:</b><br/>${note.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</div>` : ""}
                </div>
              </div>`,
            senderConfig: (organizerDoc as any)?.emailConfig,
          });
        } catch (e) {
          this.logger.warn(
            `Cancellation email failed for stall ${stallId}: ${
              (e as any)?.message || e
            }`,
          );
        }
      }

      const actor = (dto.changedBy || "").trim() || "Organizer";
      stall.status = "Cancelled" as any;
      (stall as any).cancelledVia = "organizer-decision";
      pc.status = "approved";
      pc.organizerNote = note;
      pc.resolvedAt = new Date();
      stall.statusHistory.push({
        status: "Cancelled" as any,
        note: `Cancellation approved by ${actor} — booking cancelled & space freed. Kept in the list for refund/records.${
          note ? ` Organizer note: ${note}` : ""
        }`,
        changedAt: new Date(),
        changedBy: actor,
      });
      stall.markModified("pendingCancellation");
      await stall.save();

      return {
        success: true,
        message:
          "Cancellation approved. Booking cancelled (kept in list), space freed, vendor notified.",
        data: stall,
      };
    }

    // Rejected — keep the booking, record + email why.
    stall.statusHistory.push({
      status: stall.status as any,
      note: `Cancellation request rejected.${note ? ` Organizer note: ${note}` : ""}`,
      changedAt: new Date(),
      changedBy: dto.changedBy || "Organizer",
    });
    pc.status = "rejected";
    pc.organizerNote = note;
    pc.resolvedAt = new Date();
    stall.markModified("pendingCancellation");
    await stall.save();

    if (vendorEmail) {
      try {
        await this.mailService.sendEmail({
          to: vendorEmail,
          subject: `Update on your stall cancellation request — ${eventObj?.title || "Event"}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="background:#334155;color:#fff;padding:20px;text-align:center">
                <h1 style="margin:0;font-size:20px">Cancellation Not Approved</h1>
              </div>
              <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
                <p>Your request to cancel your stall for <b>${eventObj?.title || "the event"}</b> was not approved. Your booking remains active.</p>
                ${note ? `<div style="margin-top:12px;padding:12px;background:#f8fafc;border-left:4px solid #334155;border-radius:4px"><b>Note from the organizer:</b><br/>${note.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</div>` : ""}
              </div>
            </div>`,
          senderConfig: (organizerDoc as any)?.emailConfig,
        });
      } catch {
        /* non-fatal */
      }
    }

    return {
      success: true,
      message: "Cancellation request rejected and vendor notified.",
      data: stall,
    };
  }

  // ===== STALL TICKET HTML GENERATION (Adapted from tickets.service.ts) =====
  private async generateStallTicketHTML(
    stall: Stall,
    qrBase64: string,
    coupon?: any,
    country?: string,
  ): Promise<string> {
    const eventDate = new Date(stall.eventId["startDate"]).toLocaleDateString();

    // Resolve the full vendor document — callers sometimes pass the stall with
    // shopkeeperId populated only partially (or not at all), which is why the
    // PDF used to show "Business: N/A". Fetch fresh so every field is there.
    const skRaw: any = stall.shopkeeperId;
    let vendor: any = skRaw && skRaw.name ? skRaw : null;
    const vendorId = skRaw?._id || skRaw;
    if (!vendor && vendorId) {
      vendor = await this.vendorModel.findById(vendorId).lean();
    }
    vendor = vendor || {};

    // Organizer contact card ("Event Management") so the vendor knows who to
    // call — uses the contact numbers the organizer published in Settings
    // (contactPhones/contactPhoneNames), falling back to their primary phone.
    const orgIdForPdf =
      (stall as any).organizerId?._id || (stall as any).organizerId;
    let organizer: any = {};
    if (orgIdForPdf) {
      organizer =
        (await this.organizerModel
          .findById(orgIdForPdf)
          .select(
            "name organizationName phone businessPhone whatsAppNumber contactPhones contactPhoneNames email businessEmail",
          )
          .lean()) || {};
    }
    const contactPhones: string[] = Array.isArray(organizer.contactPhones)
      ? organizer.contactPhones.filter((p: string) => String(p || "").trim())
      : [];
    const contactNames: string[] = Array.isArray(organizer.contactPhoneNames)
      ? organizer.contactPhoneNames
      : [];
    const contactRows = contactPhones.length
      ? contactPhones
          .map((p, i) => {
            const label = String(contactNames[i] || "").trim() || "Contact";
            return `<div class="detail-row"><span class="detail-label">📞 ${label}:</span><span class="detail-value">${p}</span></div>`;
          })
          .join("")
      : organizer.phone || organizer.businessPhone || organizer.whatsAppNumber
        ? `<div class="detail-row"><span class="detail-label">📞 Phone:</span><span class="detail-value">${
            organizer.phone ||
            organizer.businessPhone ||
            organizer.whatsAppNumber
          }</span></div>`
        : "";

    // Row helper — skips empty values so the PDF never shows "N/A" filler.
    const row = (label: string, value: any) =>
      value
        ? `<div class="detail-row"><span class="detail-label">${label}:</span><span class="detail-value">${value}</span></div>`
        : "";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 10px 15px;
            background-color: #f5f5f5;
            font-size: 10px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
          }
          .header h1 {
            font-size: 22px;
            color: #007bff;
            margin-bottom: 5px;
          }
          .header p {
            font-size: 12px;
            color: #666;
            margin-top: 0;
          }
          .event-title {
            font-size: 20px;
            margin: 15px 0;
            font-weight: bold;
          }
          .details-section {
            margin: 15px 0;
          }
          .details-section h3 {
            font-size: 12px;
            color: #666;
            margin-bottom: 6px;
            text-transform: uppercase;
            border-bottom: 2px solid #007bff;
            display: inline-block;
          }
          .detail-row {
            padding: 5px 0;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
          }
          .table-item, .addon-item {
            padding: 6px;
            margin: 3px 0;
            font-size: 9px;
            background: #fafafa;
            border-radius: 4px;
          }
          /* Coupon Section Styling */
          .coupon-box {
            margin: 20px 0;
            padding: 10px;
            border: 2px dashed #28a745;
            background-color: #f8fff9;
            border-radius: 8px;
            text-align: center;
          }
          .coupon-code {
            font-size: 12px;
            font-weight: bold;
            color: #28a745;
            letter-spacing: 2px;
            margin: 5px 0;
          }
          .coupon-msg {
            font-size: 9px;
            color: #155724;
            line-height: 1.4;
          }

          .qr-label {
            font-size: 10px;
            color: #666;
            text-align: center;
            margin-bottom: 10px;
          }
          .qr-head {
            font-weight: bold;
            font-size: 15px;
            color: #007bff;
            text-align: center;
            margin-bottom: 5px;
          }
          .qr-section img {
            width: 180px;
            height: 180px;
            display: block;
            margin: 0 auto;
          }
          .warning {
            font-size: 10px;
            padding: 10px;
            margin: 15px 0;
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            color: #856404;
          }
          .footer {
            font-size: 9px;
            padding-top: 10px;
            border-top: 1px solid #eee;
            color: #999;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${organizer.organizationName || organizer.name || "EventSH"} Stall Confirmation</h1>
            <p>Your stall has been successfully booked</p>
          </div>

          <div class="event-title">${stall.eventId["title"]}</div>

          <div class="details-section">
            <h3>Business Details</h3>
            ${row("Business Name", vendor.businessName || vendor.shopName || (stall as any).brandName)}
            ${row("Brand Name", vendor.brandName)}
            ${row("Applicant Name", vendor.nameOfApplicant)}
            ${row("Owner Name", vendor.name)}
            ${row("Category", vendor.businessCategory || vendor.businessType)}
            ${row("Email", vendor.email || vendor.businessEmail)}
            ${row("WhatsApp", vendor.whatsAppNumber || vendor.whatsappNumber || vendor.phone)}
            ${row(
              "Address",
              [vendor.address, vendor.city, vendor.state, vendor.pincode]
                .filter(Boolean)
                .join(", "),
            )}
            ${row("Registration No.", vendor.registrationNumber)}
          </div>

          <div class="details-section">
            <h3>Event Information</h3>
            <div class="detail-row">
              <span class="detail-label">📅 Date:</span>
              <span class="detail-value">${eventDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">📍 Venue:</span>
              <span class="detail-value">${stall.eventId["location"] || "N/A"}</span>
            </div>
            ${row("Organized by", organizer.organizationName || organizer.name)}
          </div>

          <div class="details-section">
            <h3>Spaces Booked</h3>
            ${stall.selectedTables
              .map(
                (t) => `
              <div class="table-item">
                <strong>${t.tableName}</strong> (${t.tableType})<br>
                Venue Name: ${t.layoutName}<br>
                Price: ${formatCurrency(t.price, country)} | Deposit: ${formatCurrency(t.depositAmount, country)}
              </div>
            `,
              )
              .join("")}
          </div>

          ${
            stall.selectedAddOns && stall.selectedAddOns.length > 0
              ? `
            <div class="details-section">
              <h3>Add-ons Selected</h3>
              ${stall.selectedAddOns
                .map(
                  (a) => `
                <div class="addon-item">
                  <strong>${a.name}</strong> x${a.quantity}<br>
                  Price: ${formatCurrency(a.price * a.quantity, country)}
                </div>
              `,
                )
                .join("")}
            </div>
          `
              : ""
          }

          <div class="details-section">
            <h3>Payment Summary</h3>
            <div class="detail-row">
              <span class="detail-label">Spaces Total:</span>
              <span class="detail-value">${formatCurrency(stall.tablesTotal, country)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Deposit Total:</span>
              <span class="detail-value">${formatCurrency(stall.depositTotal, country)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Add-ons Total:</span>
              <span class="detail-value">${formatCurrency(stall.addOnsTotal, country)}</span>
            </div>
            <div class="detail-row" style="border: none; font-weight: bold; font-size: 16px; padding: 15px 0;">
              <span class="detail-label">Grand Total:</span>
              <span class="detail-value">${formatCurrency(stall.grandTotal, country)}</span>
            </div>
          </div>

          ${
            qrBase64
              ? `
          <div class="qr-section">
            <p class="qr-head">Your Stall QR Code</p>
            <p class="qr-label">Scan at Event Entrance</p>
            <img src="${qrBase64}" alt="Stall Entry QR Code">
          </div>
          <div class="warning">
            ⚠️ <strong>Important:</strong> Use Official EventSH App to scan QR code, to Check-In and Check-Out.
          </div>
          `
              : `
          <div class="warning" style="background: #fef3c7; border-color: #f59e0b; color: #92400e;">
            ⏳ <strong>Awaiting Full Payment</strong> — Your QR code will be released once the organizer confirms full payment.
          </div>
          `
          }

          ${
            coupon?.code
              ? `
          <div class="coupon-box">
             <div class="coupon-msg">🎟️ <strong>Exhibitor Complimentary Entry</strong></div>
             <div class="coupon-code">${coupon.code}</div>
             <div class="coupon-msg">
               This coupon is valid for <strong>${stall.noOfOperators} Operator(s)</strong>.<br>
               Use this code at the time of Purchasing ticket to waive the entry price for your exhibitors/operators.
             </div>
          </div>
          `
              : ""
          }

          ${
            contactRows || organizer.organizationName || organizer.name
              ? `
          <div class="details-section">
            <h3>Event Management Contact</h3>
            ${row("Organizer", organizer.organizationName || organizer.name)}
            ${contactRows}
            ${row("Email", organizer.businessEmail || organizer.email)}
            <p style="font-size:9px;color:#888;margin:6px 0 0">For any queries about your stall, spaces or payments, reach out to the event management using the contact details above.</p>
          </div>
          `
              : ""
          }

          <div class="footer">
            Powered by EventSH
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ===== GENERATE STALL TICKET PDF (Same pattern as tickets.service.ts) =====
  private async generateStallTicketPDF(
    stall: Stall,
    qrBase64: string,
    coupon?: any,
    country?: string,
  ): Promise<Buffer> {
    const html = await this.generateStallTicketHTML(
      stall,
      qrBase64,
      coupon,
      country,
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.setContent(await html, {
      waitUntil: "networkidle0",
      timeout: 20000,
    });

    const uint8arrayBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });

    await browser.close();

    const buffer = Buffer.from(uint8arrayBuffer);
    return buffer;
  }

  // ===== SEND STALL TICKET VIA WHATSAPP (Same pattern as tickets.service.ts) =====
  private async sendStallTicketViaWhatsApp(
    stall: Stall,
    qrBase64: string,
    whatsappNumber: string,
    coupon?: any,
    country?: string,
  ): Promise<void> {
    try {
      const pdfBuffer = await this.generateStallTicketPDF(
        stall,
        qrBase64,
        coupon,
        country,
      );
      const pdfDir = path.join(process.cwd(), "uploads", "stallTickets");

      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

      const pdfFileName = `stall_ticket_${(stall as any)._id}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);

      await fs.promises.writeFile(pdfPath, pdfBuffer);

      const eventObj = stall.eventId as any;
      const vendorObj = stall.shopkeeperId as any;
      // coupon is already passed in as a parameter — use it as-is.
      const message = this.buildBookingSummaryMessage(
        stall,
        vendorObj,
        eventObj,
        country,
        "Your Stall Confirmation is Ready!",
        coupon,
      );

      // Send WhatsApp message
      await this.otpService.sendWhatsAppMessage(whatsappNumber, message);

      // Resolve the owning organizer's custom-sender config (if any) so the
      // confirmation email goes from their address.
      const orgId2 =
        (stall as any).organizerId?._id || (stall as any).organizerId;
      let orgEmailCfg: any = (stall as any).organizerId?.emailConfig;
      if (!orgEmailCfg && orgId2) {
        const od = await this.organizerModel
          .findById(orgId2)
          .select("emailConfig")
          .lean();
        orgEmailCfg = (od as any)?.emailConfig;
      }

      // Send PDF as media (+ mirror to the vendor's registered email)
      await this.otpService.sendMediaMessage(
        whatsappNumber,
        pdfPath,
        `🎪 Your stall confirmation for ${stall.eventId["title"]}`,
        "stall-ticket.pdf",
        {
          to: this.vendorEmailRecipients(vendorObj),
          subject: `Your stall confirmation for ${eventObj?.title || "Event"}`,
          heading: "Your Stall Confirmation is Ready!",
          message,
          senderConfig: orgEmailCfg,
        },
      );
    } catch (error) {
      this.logger.error("Error sending stall ticket via WhatsApp:", error);
      throw error;
    }
  }

  // ===== SAVE QR TO DISK (Same as tickets.service.ts) =====
  /**
   * Guarantee the stall has a scannable check-in payload, creating and saving
   * one when it's missing — the state left behind by bookings confirmed while
   * the ticket PDF render was failing. Returns the payload and its QR image
   * either way, so callers can deliver something scannable without caring
   * which case they're in.
   *
   * Callers MUST check the payment precondition first: this mints a live
   * check-in credential and has no business running on an unpaid booking.
   */
  private async ensureStallQrPayload(stall: any): Promise<{
    qrPayload: any;
    qrCodeData: string;
    qrCodeImage: string;
    created: boolean;
  }> {
    if (stall.qrCodeData) {
      return {
        qrPayload: JSON.parse(stall.qrCodeData),
        qrCodeData: stall.qrCodeData,
        // Legacy rows predate qrCodeImage — re-render it from the stored
        // payload, which yields the same QR the vendor already holds.
        qrCodeImage:
          stall.qrCodeImage ||
          (await QRCode.toDataURL(stall.qrCodeData, { width: 200, margin: 2 })),
        created: false,
      };
    }

    const qrPayload = {
      warning: "❌ Normal scanners not allowed. Please use the Eventsh app.",
      type: "eventsh-stall-checkin",
      stallId: String(stall._id),
      shopkeeperId: String(
        (stall.shopkeeperId as any)?._id || stall.shopkeeperId,
      ),
      eventId: String((stall.eventId as any)?._id || stall.eventId),
      // Anchored to the payment, not to "now", so re-running this never
      // invalidates a QR someone already scanned or holds.
      issuedAt: new Date(stall.paymentConfirmedDate || Date.now()).toISOString(),
    };
    const qrCodeData = JSON.stringify(qrPayload);
    const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
      width: 200,
      margin: 2,
    });

    stall.qrCodeData = qrCodeData;
    stall.qrCodeImage = qrCodeImage;
    await stall.save();
    this.logger.log(`Created the missing QR payload for stall ${stall._id}.`);

    return { qrPayload, qrCodeData, qrCodeImage, created: true };
  }

  /**
   * Remove a stall's rendered ticket PDF. Called whenever the QR payload is
   * re-stamped, because the file on disk still encodes the previous issuedAt
   * and downloadStallTicket serves it verbatim when present — which would hand
   * the vendor a ticket that scanning rejects as superseded.
   * Best-effort: a missing file is the expected case, not an error.
   */
  private async discardStallTicketPdf(stallId: string) {
    try {
      await fs.promises.unlink(
        path.join(
          process.cwd(),
          "uploads",
          "stallTickets",
          `stall_ticket_${stallId}.pdf`,
        ),
      );
    } catch {
      // Nothing on disk (or already gone) — regeneration handles it.
    }
  }

  private async saveQRToDisk(
    base64Data: string,
    stallId: string,
  ): Promise<string> {
    const qrDir = path.join(process.cwd(), "uploads", "stallQRs");
    const fileName = `qr_${stallId}.png`;
    const filePath = path.join(qrDir, fileName);

    // The directory is absent on a fresh deploy (uploads/ isn't in git), and
    // this runs inside confirmPayment — an ENOENT here would fail the whole
    // confirmation, not just the QR copy.
    await fs.promises.mkdir(qrDir, { recursive: true });
    const buffer = Buffer.from(base64Data.split(",")[1], "base64");
    await fs.promises.writeFile(filePath, buffer);

    return filePath;
  }

  // ============ QR CODE SCANNING & ATTENDANCE ============

  async scanStallQR(qrCodeData: string) {
    try {
      // Parse QR data
      const qrData = JSON.parse(qrCodeData);

      if (qrData.type !== "eventsh-stall-checkin") {
        throw new BadRequestException("Invalid QR code type");
      }

      const stall = await this.stallModel
        .findById(qrData.stallId)
        .populate("shopkeeperId")
        .populate("eventId");

      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      // A cancelled booking's QR is dead.
      if (stall.status === "Cancelled") {
        throw new BadRequestException(
          "This booking was cancelled — the QR is no longer valid.",
        );
      }

      // Verify QR code matches. issuedAt is part of the match so that when a
      // ticket is re-issued (e.g. after an approved "Edit Request"), the stall's
      // stored issuedAt changes and any previously-issued QR stops validating —
      // only the latest QR works. Resend/download reuse the stored payload, so
      // they keep the same issuedAt and remain valid.
      const storedQrData = JSON.parse(stall.qrCodeData || "{}");
      if (
        storedQrData.stallId !== qrData.stallId ||
        storedQrData.shopkeeperId !== qrData.shopkeeperId
      ) {
        throw new BadRequestException("Invalid QR code");
      }
      if (storedQrData.issuedAt && qrData.issuedAt !== storedQrData.issuedAt) {
        throw new BadRequestException(
          "This QR code has been superseded by an updated ticket. Please use the latest QR emailed to the vendor.",
        );
      }

      const vendor = await this.vendorModel.findById(stall.shopkeeperId);

      const now = new Date();

      // First scan - Check-in
      if (stall.hasCheckedIn === false && stall.hasCheckedOut === false) {
        stall.checkInTime = now;
        stall.hasCheckedIn = true;
        await stall.save();

        const vendor = await this.vendorModel.findById(stall.shopkeeperId);
        const message =
          `✅ *Check-in Successful*\n\n` +
          `Welcome ${vendor.name}!\n` +
          `Check-in time: ${now.toLocaleString()}\n\n` +
          `Your stall is now open. Enjoy the event! 🎉`;

        await this.otpService.sendWhatsAppMessage(
          vendor.whatsAppNumber || vendor.whatsappNumber,
          message,
        );

        return {
          success: true,
          message: "Check-in successful",
          data: {
            action: "CHECK_IN",
            stallId: stall._id,
            checkInTime: stall.checkInTime,
            shopkeeper: stall.shopkeeperId,
            eventId: stall.eventId,
            businessType: vendor.businessCategory,
            Tables: stall.selectedTables,
            AddOns: stall.selectedAddOns,
            Amount: stall.grandTotal,
            paidAmount: stall.paidAmount,
            checkinTime: stall.checkInTime,
            remainingAmount: stall.remainingAmount,
          },
        };
      }

      // Second scan - Check-out
      if (stall.hasCheckedIn === true && stall.hasCheckedOut === false) {
        stall.checkOutTime = now;
        stall.hasCheckedOut = true;
        await stall.save();

        const vendor = await this.vendorModel.findById(stall.shopkeeperId);
        const duration = Math.floor(
          (now.getTime() - stall.checkInTime.getTime()) / (1000 * 60),
        );

        const message =
          `👋 *Check-out Successful*\n\n` +
          `Goodbye ${vendor.name}!\n` +
          `Check-out time: ${now.toLocaleString()}\n` +
          `Duration: ${duration} minutes\n\n` +
          `Thank you for participating! 🙏`;

        await this.otpService.sendWhatsAppMessage(
          vendor.whatsAppNumber || vendor.whatsappNumber,
          message,
        );

        // Fire the feedback link as a follow-up WhatsApp message. Hosts the
        // refund: vendor must submit feedback before the deposit is released.
        await this.feedbackService.notifyAfterCheckout({
          audience: "exhibitor",
          subjectId: String(stall._id),
          eventId: String(stall.eventId),
          whatsAppNumber: vendor.whatsAppNumber || vendor.whatsappNumber,
          hasDeposit:
            !!(stall as any).depositAmount ||
            (stall as any).remainingAmount === 0,
        });

        return {
          success: true,
          message: "Check-out successful",
          data: {
            action: "CHECK_OUT",
            stallId: stall._id,
            checkInTime: stall.checkInTime,
            shopkeeper: stall.shopkeeperId,
            eventId: stall.eventId,
            businessType: vendor.businessCategory,
            Tables: stall.selectedTables,
            AddOns: stall.selectedAddOns,
            Amount: stall.grandTotal,
            paidAmount: stall.paidAmount,
            checkinTime: stall.checkInTime,
            remainingAmount: stall.remainingAmount,
          },
        };
      }

      throw new BadRequestException("Stall has already been checked out");
    } catch (error) {
      this.logger.error("Error scanning QR:", error);
      throw error;
    }
  }

  // ============ OTHER UTILITY METHODS ============

  async getStallAttendance(stallId: string) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID");
      }

      const stall = await this.stallModel
        .findById(stallId)
        .select(
          "checkInTime checkOutTime hasCheckedIn hasCheckedOut shopkeeperId",
        )
        .populate("shopkeeperId", "name email");

      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      return {
        success: true,
        data: {
          checkInTime: stall.checkInTime,
          checkOutTime: stall.checkOutTime,
          hasCheckedIn: stall.hasCheckedIn,
          hasCheckedOut: stall.hasCheckedOut,
          shopkeeper: stall.shopkeeperId,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  // Public event-front URL for a vendor-facing email. Points at the storefront
  // route `/:organizationName/events/:id`, which renders the event front
  // directly (where the vendor can click "Rent a Stall"). `:organizationName`
  // is resolved by slug, so we use — in order — the organizer-store slug, the
  // organizer's own slug, or a slugified organization name. The bare
  // `/events/:id` route only exists in embed mode, so it's a last resort that
  // lands on the home page on the public site — avoid it when a slug exists.
  private async buildEventFrontUrl(
    organizerId: any,
    eventId: any,
  ): Promise<string> {
    const fe = process.env.FRONTEND_BASE_URL || "https://eventsh.com";
    const evId = String(eventId?._id || eventId || "");
    try {
      const orgId = organizerId?._id || organizerId;
      let slug: string | undefined;
      if (orgId) {
        const store = await this.organizerStoreModel
          .findOne({ organizerId: orgId })
          .select("slug")
          .lean();
        slug = (store as any)?.slug || undefined;
        if (!slug) {
          const org = await this.organizerModel
            .findById(orgId)
            .select("slug organizationName")
            .lean();
          const orgName = (org as any)?.organizationName;
          slug =
            (org as any)?.slug ||
            (orgName
              ? String(orgName)
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-+|-+$/g, "")
              : undefined);
        }
      }
      if (slug) return `${fe}/${slug}/events/${evId}`;
    } catch {
      // Slug lookup is cosmetic — fall through to the plain route.
    }
    return `${fe}/events/${evId}`;
  }

  // Fetch just the organizer's custom-sender config for vendor-facing email.
  private async getOrganizerSenderConfig(organizerId: any): Promise<any> {
    try {
      const orgId = organizerId?._id || organizerId;
      if (!orgId) return undefined;
      const org = await this.organizerModel
        .findById(orgId)
        .select("emailConfig")
        .lean();
      return (org as any)?.emailConfig;
    } catch {
      return undefined;
    }
  }

  // Build the recipient list for vendor/exhibitor-facing emails. Previously
  // these went to the personal `email` only (with `businessEmail` as a mere
  // fallback); now BOTH the personal and the business email receive every
  // exhibitor notification. Returns a single comma-joined string — nodemailer
  // accepts multiple recipients this way — deduped and lower-cased, or "" when
  // neither address is on file (callers already guard the empty case).
  private vendorEmailRecipients(vendor: any): string {
    const seen = new Set<string>();
    for (const raw of [vendor?.email, vendor?.businessEmail]) {
      const v = String(raw || "")
        .trim()
        .toLowerCase();
      if (v) seen.add(v);
    }
    return Array.from(seen).join(", ");
  }

  private async sendStallCreatedNotification(stall: any) {
    try {
      const vendor = await this.vendorModel.findById(stall.shopkeeperId);

      const event: any = stall.eventId;

      const message =
        `🎪 *Stall Request Submitted*\n\n` +
        `Dear ${vendor.name},\n\n` +
        `Your stall request for *${event.title}* has been submitted successfully.\n\n` +
        `📋 *Event Details:*\n` +
        `• Event: ${event.title}\n` +
        `• Location: ${event.location}\n` +
        `• Date: ${new Date(event.startDate).toLocaleDateString()}\n\n` +
        `Your request is now pending organizer approval.\n\n` +
        `Thank you! 🙏`;

      // Vendor's own WhatsApp confirmation — isolated so a WhatsApp failure
      // never prevents the reviewer email below from going out.
      try {
        await this.otpService.sendWhatsAppMessage(
          vendor.whatsAppNumber || vendor.whatsappNumber,
          message,
        );
      } catch (waErr) {
        this.logger.warn("Stall created WhatsApp notify failed", waErr);
      }

      // Email the vendor the same submission confirmation. Vendor-facing, so
      // it goes out from the organizer's custom sender when enabled.
      const vendorEmail = this.vendorEmailRecipients(vendor);
      if (vendorEmail) {
        try {
          const senderConfig = await this.getOrganizerSenderConfig(
            stall.organizerId,
          );
          const eventDate = event?.startDate
            ? new Date(event.startDate).toLocaleDateString()
            : "TBA";

          // Preferred space types the vendor selected, each with its price in
          // the organizer's currency (there can be several).
          const fullEvent: any = event?._id
            ? await this.eventModel
                .findById(event._id)
                .lean()
                .catch(() => null)
            : null;
          const templates: any[] =
            fullEvent?.tableTemplates || event?.tableTemplates || [];
          const tplById: Record<string, any> = {};
          templates.forEach((t: any) => {
            if (t?.id) tplById[t.id] = t;
          });
          const organizerForCur: any = await this.organizerModel
            .findById(stall.organizerId)
            .lean()
            .catch(() => null);
          const curCountry = organizerForCur?.country || "IN";
          const prefIds: string[] =
            Array.isArray(stall.preferredTemplateIds) &&
            stall.preferredTemplateIds.length
              ? stall.preferredTemplateIds
              : stall.preferredTemplateId
                ? [stall.preferredTemplateId]
                : [];
          // Inline "Name (price)" per selected type, e.g. "Small Space (₹10)".
          const prefInline = prefIds
            .map((id: string, i: number) => {
              const t = tplById[id];
              const nm =
                t?.name ||
                (stall.preferredTemplateNames &&
                  stall.preferredTemplateNames[i]) ||
                "Space";
              const price = t?.tablePrice ?? t?.bookingPrice;
              const priceStr =
                price != null && !isNaN(Number(price))
                  ? formatCurrency(Number(price), curCountry)
                  : null;
              const qty = Number(stall.preferredTemplateQuantities?.[i]) || 1;
              const label = qty > 1 ? `${nm} × ${qty}` : nm;
              return priceStr ? `${label} (${priceStr})` : label;
            })
            .join(", ");

          const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;padding:24px;text-align:center">
                <h1 style="margin:0;font-size:20px">Stall Request Submitted</h1>
                <p style="margin:6px 0 0;opacity:.9">${event?.title || "Event"}</p>
              </div>
              <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
                <p>Dear ${vendor.name || "Vendor"},</p>
                <p>Your stall request for <strong>${event?.title || "the event"}</strong> has been submitted successfully and is now <strong>pending organizer approval</strong>.</p>
                <table style="border-collapse:collapse;margin:12px 0">
                  <tr><td style="padding:4px 14px 4px 0;color:#64748b">Event</td><td style="padding:4px 0;font-weight:600">${event?.title || "—"}</td></tr>
                  <tr><td style="padding:4px 14px 4px 0;color:#64748b">Location</td><td style="padding:4px 0;font-weight:600">${event?.location || "—"}</td></tr>
                  <tr><td style="padding:4px 14px 4px 0;color:#64748b">Date</td><td style="padding:4px 0;font-weight:600">${eventDate}</td></tr>
                  <tr><td style="padding:4px 14px 4px 0;color:#64748b">Status</td><td style="padding:4px 0;font-weight:600">Pending approval</td></tr>
                </table>
                ${
                  prefInline
                    ? `<p style="margin:14px 0"><strong>Preferred space types selected:</strong> ${prefInline}</p>`
                    : ""
                }
                <p>We'll email you as soon as the organizer approves or rejects your request.</p>
                <p style="color:#64748b;font-size:12px;margin-top:16px">Thank you for registering!</p>
              </div>
            </div>`;
          await this.mailService.sendEmail({
            to: vendorEmail,
            subject: `Stall request submitted — ${event?.title || "Event"}`,
            html,
            senderConfig,
          });
        } catch (mailErr: any) {
          this.logger.warn(
            `Stall created vendor email failed: ${mailErr?.message || mailErr}`,
          );
        }
      }

      // Alert the organizer + every operator by email so the Approve/Reject
      // action can be taken quickly. Best-effort — never blocks the request.
      await this.notifyReviewersOfNewStall(stall, vendor, event);
    } catch (error) {
      this.logger.error("Error sending stall created notification:", error);
    }
  }

  // Email the organizer and all of their operators about a freshly submitted
  // stall request, with the applicant details and a link to the dashboard
  // where they can approve or reject it.
  private async notifyReviewersOfNewStall(stall: any, vendor: any, event: any) {
    try {
      const orgId = stall.organizerId?._id || stall.organizerId;
      if (!orgId) return;

      const organizer: any = await this.organizerModel.findById(orgId).lean();
      const operators = await this.operatorModel
        .find({ organizerId: String(orgId) })
        .lean();

      // Vendor/operator-facing operational notification → sent from the
      // organizer's custom sender (falls back to the global EventSH sender).
      const senderConfig = await this.getOrganizerSenderConfig(orgId);

      // Collect unique recipient emails: organizer (login + business) + ops.
      const recipients = new Set<string>();
      const add = (e?: string) => {
        const v = String(e || "")
          .trim()
          .toLowerCase();
        if (v) recipients.add(v);
      };
      add(organizer?.email);
      add(organizer?.businessEmail);
      for (const op of operators as any[]) {
        // Opt-in: only operators with "Allow Emails" switched ON get notified.
        if (!op.allowEmails) continue;
        add(op.email);
        add(op.companyEmail);
      }

      if (recipients.size === 0) return;

      const fe = process.env.FRONTEND_BASE_URL || "https://eventsh.com";
      // Route reviewers through the organizer login first. If they're not
      // signed in (no token), they land on the login screen and are sent to
      // the dashboard afterwards — instead of hitting /organizer-dashboard
      // directly and getting a stuck "loading" page. Already-signed-in
      // reviewers are forwarded straight to the dashboard by the app router.
      const dashboardUrl = `${fe}/organizer/login?redirect=${encodeURIComponent(
        "/organizer-dashboard",
      )}`;
      const eventDate = event?.startDate
        ? new Date(event.startDate).toLocaleDateString()
        : "TBA";
      const businessName =
        vendor?.businessName || vendor?.shopName || vendor?.brandName || "—";

      const row = (label: string, value: any) =>
        `<tr><td style="padding:4px 14px 4px 0;color:#64748b">${label}</td><td style="padding:4px 0;font-weight:600;color:#0f172a">${
          value || "—"
        }</td></tr>`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;padding:24px;text-align:center">
            <h1 style="margin:0;font-size:20px">New Stall Registration</h1>
            <p style="margin:6px 0 0;opacity:.9">${event?.title || "Your event"}</p>
          </div>
          <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
            <p>A new exhibitor has requested a stall and is awaiting your review.</p>
            <table style="border-collapse:collapse;margin:12px 0">
              ${row("Applicant", vendor?.nameOfApplicant || vendor?.name)}
              ${row("Business", businessName)}
              ${row("Category", vendor?.businessCategory || vendor?.businessType)}
              ${row("Email", vendor?.email)}
              ${row("WhatsApp", vendor?.whatsAppNumber || vendor?.whatsappNumber)}
              ${row("Event", event?.title)}
              ${row("Date", eventDate)}
              ${row("Status", "Pending approval")}
            </table>
            <div style="text-align:center;margin:22px 0 6px">
              <a href="${dashboardUrl}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">
                Review &amp; Approve / Reject
              </a>
            </div>
            <p style="color:#64748b;font-size:12px;margin-top:16px">Open your dashboard → CRM to approve or reject this request.</p>
          </div>
        </div>`;

      // Send individually so operators don't see each other's addresses.
      await Promise.all(
        Array.from(recipients).map((to) =>
          this.mailService
            .sendEmail({
              to,
              subject: `New stall request: ${businessName} — ${event?.title || "Event"}`,
              html,
              senderConfig,
            })
            .catch((e: any) =>
              this.logger.warn(
                `[stalls] reviewer notify failed for ${to}: ${e?.message || e}`,
              ),
            ),
        ),
      );
      this.logger.log(
        `New stall request emailed to ${recipients.size} reviewer(s)`,
      );
    } catch (error) {
      this.logger.warn(
        `[stalls] notifyReviewersOfNewStall failed: ${(error as any)?.message}`,
      );
    }
  }

  // Email the organizer + all operators that an exhibitor has submitted their
  // payment and is awaiting approval — so the team can verify and release the
  // QR ticket on priority. Always from the global EventSH sender (internal).
  private async notifyReviewersOfPayment(
    stall: any,
    event: any,
    grandTotal: number,
  ) {
    try {
      const orgId = stall.organizerId?._id || stall.organizerId;
      if (!orgId) return;

      const [organizer, operators, vendor] = await Promise.all([
        this.organizerModel.findById(orgId).lean(),
        this.operatorModel.find({ organizerId: String(orgId) }).lean(),
        this.vendorModel.findById(stall.shopkeeperId).lean(),
      ]);

      const recipients = new Set<string>();
      const add = (e?: string) => {
        const v = String(e || "")
          .trim()
          .toLowerCase();
        if (v) recipients.add(v);
      };
      add((organizer as any)?.email);
      add((organizer as any)?.businessEmail);
      for (const op of operators as any[]) {
        // Opt-in: only operators with "Allow Emails" switched ON get notified.
        if (!op.allowEmails) continue;
        add(op.email);
        add(op.companyEmail);
      }
      if (recipients.size === 0) return;

      // Operational alert → from the organizer's custom sender (falls back to
      // the global EventSH sender when none is configured).
      const senderConfig = await this.getOrganizerSenderConfig(orgId);

      const fe = process.env.FRONTEND_BASE_URL || "https://eventsh.com";
      const dashboardUrl = `${fe}/organizer/login?redirect=${encodeURIComponent(
        "/organizer-dashboard",
      )}`;
      const businessName =
        (vendor as any)?.businessName ||
        (vendor as any)?.shopName ||
        (vendor as any)?.brandName ||
        (vendor as any)?.name ||
        "An exhibitor";

      // 24h organizer-confirmation window — show the countdown + deadline so
      // reviewers know they're on the clock before the space auto-releases.
      const deadlineDate = stall.confirmationDeadline
        ? new Date(stall.confirmationDeadline)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);
      const hoursLeft = Math.max(
        0,
        Math.round((deadlineDate.getTime() - Date.now()) / 3_600_000),
      );
      const deadlineStr =
        deadlineDate.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Singapore",
        }) + " SGT";

      const row = (label: string, value: any) =>
        `<tr><td style="padding:4px 14px 4px 0;color:#64748b">${label}</td><td style="padding:4px 0;font-weight:600;color:#0f172a">${
          value || "—"
        }</td></tr>`;

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:24px;text-align:center">
            <h1 style="margin:0;font-size:20px">⏳ Payment Awaiting Approval</h1>
            <p style="margin:6px 0 0;opacity:.9">${event?.title || "Your event"}</p>
          </div>
          <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
            <p><strong>${businessName}</strong> has submitted their payment and is
              waiting for your approval. Please verify the payment and release
              their stall ticket on priority so they aren't kept waiting.</p>
            <div style="border:1px solid #fcd34d;background:#fffbeb;border-radius:10px;padding:16px;margin:16px 0;text-align:center">
              <div style="font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#b45309">Confirmation deadline</div>
              <div style="font-size:26px;font-weight:800;color:#d97706;margin:6px 0">⏳ ${hoursLeft} hours to approve</div>
              <div style="font-size:13px;color:#92400e">Please confirm by <strong>${deadlineStr}</strong>.<br/>If it isn't confirmed within 24 hours, this booking is <strong>automatically cancelled</strong> and the space is released for re-booking.</div>
            </div>
            <table style="border-collapse:collapse;margin:12px 0">
              ${row("Exhibitor", businessName)}
              ${row("Email", (vendor as any)?.email || (vendor as any)?.businessEmail)}
              ${row("Event", event?.title)}
              ${row("Grand Total", formatMoney(grandTotal, (organizer as any)?.country))}
              ${row("Confirm by", deadlineStr)}
              ${row("Status", "Payment submitted — awaiting approval")}
            </table>
            <div style="text-align:center;margin:22px 0 6px">
              <a href="${dashboardUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">
                Review &amp; Approve Payment
              </a>
            </div>
            <p style="color:#64748b;font-size:12px;margin-top:16px">Open your dashboard → Participants to verify the payment and confirm the booking.</p>
          </div>
        </div>`;

      await Promise.all(
        Array.from(recipients).map((to) =>
          this.mailService
            .sendEmail({
              to,
              subject: `⏳ Payment awaiting approval: ${businessName} — ${event?.title || "Event"}`,
              html,
              senderConfig,
            })
            .catch((e: any) =>
              this.logger.warn(
                `[stalls] payment reviewer notify failed for ${to}: ${e?.message || e}`,
              ),
            ),
        ),
      );
      this.logger.log(
        `Payment-pending alert emailed to ${recipients.size} reviewer(s)`,
      );
    } catch (error) {
      this.logger.warn(
        `[stalls] notifyReviewersOfPayment failed: ${(error as any)?.message}`,
      );
    }
  }

  // ============ 24-HOUR CONFIRMATION DEADLINE (auto-release) ============

  // Organizer + opted-in operator emails for a stall's organizer.
  private async getStallReviewerEmails(
    orgId: any,
  ): Promise<{ recipients: string[]; senderConfig: any }> {
    const [organizer, operators] = await Promise.all([
      this.organizerModel.findById(orgId).lean(),
      this.operatorModel.find({ organizerId: String(orgId) }).lean(),
    ]);
    const set = new Set<string>();
    const add = (e?: string) => {
      const v = String(e || "")
        .trim()
        .toLowerCase();
      if (v) set.add(v);
    };
    add((organizer as any)?.email);
    add((organizer as any)?.businessEmail);
    for (const op of operators as any[]) {
      if (!op.allowEmails) continue;
      add(op.email);
      add(op.companyEmail);
    }
    const senderConfig = await this.getOrganizerSenderConfig(orgId);
    return { recipients: Array.from(set), senderConfig };
  }

  /**
   * Cron-driven. For stalls where the vendor clicked "I have Paid" and the
   * organizer hasn't confirmed yet, email reminders as the 24h window closes,
   * then auto-release the space (soft-cancel) once it expires. Email-first.
   */
  async processConfirmationDeadlines() {
    const REMINDER_HOURS = [12, 6, 1]; // remind when <= this many hours remain
    const now = Date.now();
    // Only stalls whose confirmation window has ALREADY been started — either by
    // the vendor clicking "I have Paid" or by the organizer opening the request
    // (startConfirmationTimer). We deliberately do NOT auto-start the timer for
    // pre-feature stalls here; that only happens when the organizer opens the
    // dialog, so the clock begins when a human actually looks at the request.
    const stalls = await this.stallModel
      .find({
        status: "Processing",
        paymentStatus: "Unpaid",
        confirmationDeadline: { $ne: null, $exists: true },
      })
      .populate("shopkeeperId")
      .populate("eventId")
      .populate("organizerId");

    let released = 0;
    let reminded = 0;
    for (const stall of stalls) {
      try {
        const deadline = new Date(stall.confirmationDeadline).getTime();
        if (!deadline) continue;
        const msRemaining = deadline - now;

        if (msRemaining <= 0) {
          await this.autoReleaseUnconfirmedStall(stall);
          released++;
          continue;
        }
        const hoursRemaining = msRemaining / 3_600_000;
        const crossed = REMINDER_HOURS.filter(
          (h) => hoursRemaining <= h,
        ).length;
        if (crossed > (stall.deadlineRemindersSent || 0)) {
          await this.sendConfirmationReminder(stall, Math.ceil(hoursRemaining));
          stall.deadlineRemindersSent = crossed;
          await stall.save();
          reminded++;
        }
      } catch (e: any) {
        this.logger.warn(
          `[stalls] deadline processing failed for ${stall._id}: ${
            e?.message || e
          }`,
        );
      }
    }
    return { checked: stalls.length, released, reminded };
  }

  // Space freed + soft-cancelled (matches the manual delete convention).
  private async autoReleaseUnconfirmedStall(stall: any) {
    await this.releaseStallTables(stall);
    stall.status = "Cancelled";
    stall.confirmationDeadline = null;
    (stall as any).cancelledVia = "auto-timeout";
    stall.statusHistory.push({
      status: "Cancelled" as any,
      note: "Auto-released — the organizer did not confirm the payment within 24 hours. Space freed for re-booking.",
      changedAt: new Date(),
      changedBy: "System",
    });
    await stall.save();
    await this.notifyDeadlineRelease(stall);
    this.logger.log(`Auto-released unconfirmed stall ${stall._id}`);
  }

  private async sendConfirmationReminder(stall: any, hoursRemaining: number) {
    try {
      const event = stall.eventId as any;
      const orgId = (stall.organizerId as any)?._id || stall.organizerId;
      if (!orgId) return;
      const vendor: any = await this.vendorModel
        .findById(stall.shopkeeperId)
        .lean();
      const { recipients, senderConfig } =
        await this.getStallReviewerEmails(orgId);
      if (recipients.length === 0) return;
      const businessName =
        vendor?.businessName ||
        vendor?.shopName ||
        vendor?.brandName ||
        vendor?.name ||
        "An exhibitor";
      const fe = process.env.FRONTEND_BASE_URL || "https://eventsh.com";
      const dashboardUrl = `${fe}/organizer/login?redirect=${encodeURIComponent(
        "/organizer-dashboard",
      )}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
          <div style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:24px;text-align:center">
            <h1 style="margin:0;font-size:20px">⏳ ${hoursRemaining} hour(s) left to approve</h1>
            <p style="margin:6px 0 0;opacity:.9">${event?.title || "Your event"}</p>
          </div>
          <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
            <p><strong>${businessName}</strong> submitted their payment and is waiting for your approval.</p>
            <p style="font-weight:600;color:#b45309">Please confirm within <strong>${hoursRemaining} hour(s)</strong>, or their booking will be automatically cancelled and the space released for re-booking.</p>
            <div style="text-align:center;margin:22px 0 6px">
              <a href="${dashboardUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">Review &amp; Approve Payment</a>
            </div>
          </div>
        </div>`;
      await Promise.all(
        recipients.map((to) =>
          this.mailService
            .sendEmail({
              to,
              subject: `⏳ ${hoursRemaining}h left to approve: ${businessName} — ${
                event?.title || "Event"
              }`,
              html,
              senderConfig,
            })
            .catch((e: any) =>
              this.logger.warn(
                `[stalls] deadline reminder failed for ${to}: ${e?.message || e}`,
              ),
            ),
        ),
      );
      this.logger.log(
        `Deadline reminder (${hoursRemaining}h) emailed to ${recipients.length} reviewer(s) for stall ${stall._id}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `[stalls] sendConfirmationReminder failed: ${e?.message || e}`,
      );
    }
  }

  private async notifyDeadlineRelease(stall: any) {
    try {
      const event = stall.eventId as any;
      const orgId = (stall.organizerId as any)?._id || stall.organizerId;
      const vendor: any = await this.vendorModel
        .findById(stall.shopkeeperId)
        .lean();
      const senderConfig = orgId
        ? await this.getOrganizerSenderConfig(orgId)
        : undefined;

      // Vendor — booking released.
      const vendorEmail = this.vendorEmailRecipients(vendor);
      if (vendorEmail) {
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;padding:24px;text-align:center">
              <h1 style="margin:0;font-size:20px">Booking released</h1>
              <p style="margin:6px 0 0;opacity:.9">${event?.title || "Event"}</p>
            </div>
            <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
              <p>Dear ${vendor?.name || "Exhibitor"},</p>
              <p>Your stall booking for <strong>${event?.title || "the event"}</strong> was <strong>not confirmed by the organizer within 24 hours</strong>, so the space has been released.</p>
              <p>If you have already paid, please contact the organizer to resolve this or re-book.</p>
            </div>
          </div>`;
        await this.mailService
          .sendEmail({
            to: vendorEmail,
            subject: `Your stall booking was released — ${event?.title || "Event"}`,
            html,
            senderConfig,
          })
          .catch((e: any) =>
            this.logger.warn(
              `[stalls] release vendor email failed: ${e?.message || e}`,
            ),
          );
      }

      // Organizer + operators — space freed.
      if (orgId) {
        const { recipients } = await this.getStallReviewerEmails(orgId);
        const businessName =
          vendor?.businessName || vendor?.name || "An exhibitor";
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#64748b,#475569);color:#fff;padding:24px;text-align:center">
              <h1 style="margin:0;font-size:20px">Stall space released</h1>
              <p style="margin:6px 0 0;opacity:.9">${event?.title || "Event"}</p>
            </div>
            <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
              <p><strong>${businessName}</strong>'s payment was not confirmed within 24 hours, so their booking was cancelled and the space is now available for re-booking.</p>
            </div>
          </div>`;
        await Promise.all(
          recipients.map((to) =>
            this.mailService
              .sendEmail({
                to,
                subject: `Stall space released (unconfirmed): ${businessName} — ${
                  event?.title || "Event"
                }`,
                html,
                senderConfig,
              })
              .catch((e: any) =>
                this.logger.warn(
                  `[stalls] release reviewer email failed for ${to}: ${
                    e?.message || e
                  }`,
                ),
              ),
          ),
        );
      }
    } catch (e: any) {
      this.logger.warn(
        `[stalls] notifyDeadlineRelease failed: ${e?.message || e}`,
      );
    }
  }

  private async sendStatusUpdateNotification(
    stall: any,
    oldStatus: string,
    newStatus: string,
  ) {
    try {
      const vendor = await this.vendorModel.findById(stall.shopkeeperId);
      const event: any = stall.eventId;

      let message = "";

      if (newStatus === "Confirmed") {
        message =
          `✅ *Stall Request Approved!*\n\n` +
          `Congratulations ${vendor.name}!\n\n` +
          `Your stall request for *${event.title}* has been approved.\n\n` +
          `📋 *Next Steps:*\n` +
          `1. Select your preferred tables\n` +
          `2. Choose add-ons (if any)\n` +
          `3. Complete payment\n\n` +
          `Please log in to proceed. 🎉`;
      } else if (newStatus === "Cancelled") {
        message =
          `❌ *Stall Request Cancelled*\n\n` +
          `Dear ${vendor.name},\n\n` +
          `Your stall request for *${event.title}* has been cancelled.\n\n` +
          `Reason: ${stall.cancellationReason || "Not specified"}\n\n` +
          `Please contact the organizer for more information.`;
      }

      if (message) {
        try {
          await this.otpService.sendWhatsAppMessage(
            vendor.whatsAppNumber || vendor.whatsappNumber,
            message,
          );
        } catch (waErr) {
          this.logger.warn("Status update WhatsApp notify failed", waErr);
        }
      }

      // Email the vendor the same status update, with a link to the event
      // page so they can log in and continue (select tables, pay). Vendor-
      // facing, so it goes out from the organizer's custom sender when on.
      const vendorEmail = this.vendorEmailRecipients(vendor);
      const isApproved = newStatus === "Confirmed" || newStatus === "Approved";
      const isRejected = newStatus === "Cancelled";
      if (vendorEmail && (isApproved || isRejected)) {
        try {
          const senderConfig = await this.getOrganizerSenderConfig(
            stall.organizerId,
          );
          const eventUrl = await this.buildEventFrontUrl(
            stall.organizerId,
            stall.eventId,
          );
          const headerBg = isApproved
            ? "linear-gradient(135deg,#22c55e,#16a34a)"
            : "linear-gradient(135deg,#ef4444,#dc2626)";
          const title = isApproved
            ? "Stall Request Approved 🎉"
            : "Stall Request Rejected";
          const body = isApproved
            ? `
                <p>Congratulations ${vendor.name || "Vendor"}!</p>
                <p>Your stall request for <strong>${event?.title || "the event"}</strong> has been <strong style="color:#16a34a">approved</strong>.</p>
                <p><strong>Next steps:</strong></p>
                <ol style="margin:8px 0 16px;padding-left:20px">
                  <li>Click the button below to open the event page</li>
                  <li>Log in with your registered details</li>
                  <li>Select your preferred tables and add-ons</li>
                  <li>Complete the payment to confirm your stall</li>
                </ol>
                <div style="margin:16px 0;padding:12px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px">
                  <p style="margin:0;color:#b45309;font-weight:700">
                    ⚠️ Selecting isn't reserving. Pay, upload proof &amp; tap "I have Paid" — else your space may go to another vendor.
                  </p>
                </div>
                <div style="text-align:center;margin:22px 0 6px">
                  <a href="${eventUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">
                    Open Event Page
                  </a>
                </div>`
            : `
                <p>Dear ${vendor.name || "Vendor"},</p>
                <p>We're sorry — your stall request for <strong>${event?.title || "the event"}</strong> has been <strong style="color:#dc2626">rejected</strong>.</p>
                <p><strong>Reason:</strong> ${stall.cancellationReason || "Not specified"}</p>
                <p>Please contact the organizer for more information, or visit the event page below.</p>
                <div style="text-align:center;margin:22px 0 6px">
                  <a href="${eventUrl}" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px">
                    View Event Page
                  </a>
                </div>`;
          const html = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
              <div style="background:${headerBg};color:#fff;padding:24px;text-align:center">
                <h1 style="margin:0;font-size:20px">${title}</h1>
                <p style="margin:6px 0 0;opacity:.9">${event?.title || "Event"}</p>
              </div>
              <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
                ${body}
                <p style="color:#64748b;font-size:12px;margin-top:16px">If the button doesn't work, copy this link into your browser:<br/><a href="${eventUrl}">${eventUrl}</a></p>
              </div>
            </div>`;
          await this.mailService.sendEmail({
            to: vendorEmail,
            subject: isApproved
              ? `✅ Stall request approved — ${event?.title || "Event"}`
              : `Stall request rejected — ${event?.title || "Event"}`,
            html,
            senderConfig,
          });
        } catch (mailErr: any) {
          this.logger.warn(
            `Status update vendor email failed: ${mailErr?.message || mailErr}`,
          );
        }
      }
    } catch (error) {
      this.logger.error("Error sending status update notification:", error);
    }
  }

  private async sendPaymentStatusNotification(
    stall: any,
    oldPaymentStatus: string,
    newPaymentStatus: string,
  ) {
    try {
      const vendor = await this.vendorModel.findById(stall.shopkeeperId);
      const event: any = stall.eventId;
      const organizerDoc = await this.organizerModel.findById(
        stall.organizerId,
      );
      const country = organizerDoc?.country || "IN";

      let message = "";

      const paidAmount =
        stall.tablesTotal + stall.depositTotal + stall.addOnsTotal;

      const remaining = stall.grandTotal - paidAmount;

      if (newPaymentStatus === "Partial") {
        message =
          `💰 *Partial Payment Received*\n\n` +
          `Dear ${vendor.name},\n\n` +
          `We've received your partial payment for *${event.title}*.\n\n` +
          `• Amount Paid: ${formatCurrency(paidAmount, country)}\n` +
          `• Remaining: ${formatCurrency(remaining, country)}\n` +
          `• Total: ${formatCurrency(stall.grandTotal, country)}\n\n` +
          `Please complete the remaining payment.`;
      } else if (newPaymentStatus === "Paid") {
        message =
          `✅ *Payment Completed!*\n\n` +
          `Dear ${vendor.name},\n\n` +
          `Your payment for *${event.title}* has been processed!\n\n` +
          `💵 *Total Paid:* ${formatCurrency(stall.paidAmount, country)}\n\n` +
          `Your booking is confirmed. Ticket PDF will be sent shortly. 🎉`;
      }

      stall.paidAmount = paidAmount;
      stall.remainingAmount = remaining;
      await stall.save();

      if (message) {
        await this.otpService.sendWhatsAppMessage(
          vendor.whatsAppNumber || vendor.whatsappNumber,
          message,
        );
      }
    } catch (error) {
      this.logger.error("Error sending payment status notification:", error);
    }
  }

  async checkExistingRequest(eventId: string, shopkeeperId: string) {
    try {
      if (
        !Types.ObjectId.isValid(eventId) ||
        !Types.ObjectId.isValid(shopkeeperId)
      ) {
        throw new BadRequestException(
          "Invalid event ID or shopkeeper ID format",
        );
      }

      // Fetch ALL requests this vendor has for this event (newest first). A
      // vendor can legitimately hold several — e.g. a Completed booking plus a
      // freshly registered Pending one — and the storefront needs the full list
      // so none stays hidden behind the most-recent one.
      const allRequests = await this.stallModel
        .find({
          shopkeeperId: new Types.ObjectId(shopkeeperId),
          eventId: new Types.ObjectId(eventId),
        })
        .populate([
          {
            path: "shopkeeperId",
          },
          {
            path: "eventId",
          },
          { path: "organizerId" },
        ])
        .sort({ createdAt: -1 });

      const existingRequest = allRequests[0] || null;

      if (!existingRequest) {
        return {
          success: true,
          message: "No existing request found",
          data: null,
          requests: [],
        };
      }

      if (
        existingRequest.status === "Cancelled" ||
        existingRequest.status === "Completed"
      ) {
        return {
          success: true,
          status: existingRequest.status,
          message: `Existing request is ${existingRequest.status}`,
          data: existingRequest,
          requests: allRequests,
        };
      }

      return {
        success: true,
        message: "Existing request found",
        data: existingRequest,
        requests: allRequests,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async updatePaymentStatus(
    stallId: string,
    updateDto: UpdatePaymentStatusDto,
  ) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findById(stallId);
      if (!stall) {
        throw new NotFoundException("Stall request not found");
      }

      const oldPaymentStatus = stall.paymentStatus;

      const updateData: any = {
        paymentStatus: updateDto.paymentStatus,
        $push: {
          statusHistory: {
            status: `${updateDto.paymentStatus}` as any,
            note:
              updateDto.notes ||
              `Payment status changed to ${updateDto.paymentStatus}`,
            changedAt: new Date(),
            changedBy: updateDto.changedBy || "organizer",
          },
        },
      };

      if (
        updateDto.paymentStatus === "Paid" ||
        updateDto.paymentStatus === "Partial"
      ) {
        if (updateDto.paymentStatus === "Paid") {
          // Full payment — generate QR, coupon, PDF ticket, send via WhatsApp
          await this.confirmPayment(stallId, updateDto.notes);
        }
        if (updateDto.paymentStatus === "Partial") {
          // Partial payment — send details PDF without QR/coupon + WhatsApp notification
          try {
            const populatedStall = await this.stallModel
              .findById(stallId)
              .populate("shopkeeperId")
              .populate("eventId")
              .populate("organizerId");

            if (populatedStall) {
              const orgDoc = await this.organizerModel.findById(
                (populatedStall.organizerId as any)?._id ||
                  populatedStall.organizerId,
              );
              const ctry = orgDoc?.country || "IN";

              // Generate details-only PDF (no QR, no coupon)
              const pdfBuffer = await this.generateStallTicketPDF(
                populatedStall,
                null, // no QR
                null, // no coupon
                ctry,
              );

              const pdfDir = path.join(
                process.cwd(),
                "uploads",
                "stallTickets",
              );
              if (!fs.existsSync(pdfDir))
                fs.mkdirSync(pdfDir, { recursive: true });
              const pdfFileName = `stall_booking_${stallId}.pdf`;
              const pdfPath = path.join(pdfDir, pdfFileName);
              await fs.promises.writeFile(pdfPath, pdfBuffer);

              const vendor = populatedStall.shopkeeperId as any;
              const vendorWhatsApp =
                vendor?.whatsAppNumber || vendor?.whatsappNumber;
              const eventObj = populatedStall.eventId as any;

              const waText =
                `*Partial Payment Received — ${eventObj?.title || "Event"}*\n\n` +
                `We have received your partial payment.\n\n` +
                `Paid: ${formatMoney(populatedStall.paidAmount, ctry)}\n` +
                `Remaining: ${formatMoney(populatedStall.remainingAmount, ctry)}\n` +
                `Grand Total: ${formatMoney(populatedStall.grandTotal, ctry)}\n\n` +
                `Please complete the remaining payment. Your stall QR ticket will be released once full payment is confirmed by the organizer.\n\n` +
                `Your booking details PDF is attached.`;

              // WhatsApp text only when a number is on file.
              if (vendorWhatsApp) {
                await this.otpService.sendWhatsAppMessage(
                  vendorWhatsApp,
                  waText,
                );
              }

              // Always email the booking-details PDF (WhatsApp too when a
              // number exists). Email is independent of WhatsApp connectivity.
              await this.otpService.sendMediaMessage(
                vendorWhatsApp || "",
                pdfPath,
                `Booking Details - ${eventObj?.title || "Event"}`,
                "booking-details.pdf",
                {
                  to: this.vendorEmailRecipients(vendor),
                  subject: `Partial payment received — ${eventObj?.title || "Event"}`,
                  heading: "Partial Payment Received",
                  message:
                    `We have received your partial payment for ${eventObj?.title || "your event"}.\n\n` +
                    `Paid: ${formatMoney(populatedStall.paidAmount, ctry)}\n` +
                    `Remaining: ${formatMoney(populatedStall.remainingAmount, ctry)}\n` +
                    `Grand Total: ${formatMoney(populatedStall.grandTotal, ctry)}\n\n` +
                    `Your stall QR ticket will be released once full payment is confirmed by the organizer. Your booking details PDF is attached.`,
                  senderConfig: (orgDoc as any)?.emailConfig,
                },
              );
            }
          } catch (partialErr) {
            this.logger.warn(
              "Failed to send partial payment notification",
              partialErr,
            );
          }
        }
        updateData.paymentDate = new Date();
      }

      const updatedStall = await this.stallModel
        .findByIdAndUpdate(stallId, updateData, { new: true })
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          { path: "eventId", select: "title location startDate" },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      return {
        success: true,
        message: "Payment status updated successfully",
        data: updatedStall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async updateStatus(stallId: string, updateDto: UpdateStatusDto) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findById(stallId);
      if (!stall) {
        throw new NotFoundException("Stall request not found");
      }

      const oldStatus = stall.status;

      const updateData: any = {
        status: updateDto.status,
        $push: {
          statusHistory: {
            status: updateDto.status,
            note: updateDto.notes || `Status changed to ${updateDto.status}`,
            changedAt: new Date(),
            changedBy: updateDto.changedBy || "organizer",
          },
        },
      };

      if (updateDto.status === "Confirmed") {
        updateData.confirmationDate = new Date();
      }

      if (updateDto.status === "Cancelled") {
        updateData.cancellationReason = updateDto.cancellationReason;
        updateData.cancelledVia = "status-update";
      }

      const updatedStall = await this.stallModel
        .findByIdAndUpdate(stallId, updateData, { new: true })
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber businessName",
          },
          { path: "eventId", select: "title location startDate" },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      await this.sendStatusUpdateNotification(
        updatedStall,
        oldStatus,
        updateDto.status,
      );

      return {
        success: true,
        message: `Stall request ${updateDto.status.toLowerCase()} successfully`,
        data: updatedStall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // --- Vendor Lookup Methods ---

  async findVendorByWhatsApp(whatsAppNumber: string) {
    const vendor = await this.vendorModel
      .findOne({
        $or: [
          { whatsAppNumber: whatsAppNumber },
          { whatsAppNumber: whatsAppNumber.replace("+", "") },
          { whatsappNumber: whatsAppNumber },
          { whatsappNumber: whatsAppNumber.replace("+", "") },
        ],
      })
      .lean()
      .exec();

    if (!vendor) {
      throw new NotFoundException("Vendor not found");
    }
    return { success: true, data: vendor };
  }

  async findVendorById(vendorId: string) {
    const vendor = await this.vendorModel.findById(vendorId).lean().exec();
    if (!vendor) {
      throw new NotFoundException("Vendor not found");
    }
    return { success: true, data: vendor };
  }

  // Lookup a returning vendor by their Google email. Vendors created via
  // different flows store the sign-in address in either `email` or
  // `businessEmail`, so we match (case-insensitively) against both.
  async findVendorByEmail(email: string) {
    const normalized = String(email || "").trim();
    if (!normalized) {
      throw new NotFoundException("Vendor not found");
    }
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const emailRegex = new RegExp(`^${escaped}$`, "i");
    const vendor = await this.vendorModel
      .findOne({
        $or: [{ email: emailRegex }, { businessEmail: emailRegex }],
      })
      .lean()
      .exec();

    if (!vendor) {
      throw new NotFoundException("Vendor not found");
    }
    return { success: true, data: vendor };
  }

  // ALL vendor profiles registered under an email (or businessEmail). Powers
  // the eventfront "linked accounts" picker: one authenticated email can own
  // several vendor profiles, and the booker chooses which one to register
  // with (or adds a new one). Returns [] when none — never 404s.
  async findVendorsByEmail(email: string) {
    const normalized = String(email || "").trim();
    if (!normalized) return { success: true, data: [] };
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const emailRegex = new RegExp(`^${escaped}$`, "i");
    const vendors = await this.vendorModel
      .find({ $or: [{ email: emailRegex }, { businessEmail: emailRegex }] })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
    return { success: true, data: vendors };
  }

  async findAll() {
    try {
      const stalls = await this.stallModel
        .find()
        .populate([
          {
            path: "shopkeeperId",
            select: "name email whatsAppNumber shopName",
          },
          { path: "eventId", select: "title location startDate" },
          { path: "organizerId", select: "name email organizationName" },
        ])
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: "Stalls fetched successfully",
        data: stalls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findOne(id: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel.findById(id).populate([
        {
          path: "shopkeeperId",
        },
        {
          path: "eventId",
        },
        { path: "organizerId", select: "name email organizationName" },
      ]);

      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      return {
        success: true,
        message: "Stall fetched successfully",
        data: stall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findByEventId(eventId: string) {
    try {
      const stalls = await this.stallModel
        .find({ eventId: new Types.ObjectId(eventId) })
        .populate([
          {
            path: "shopkeeperId",
            // Operator-venue view + organizer billing + the exhibitor Excel
            // export read these fields. Both shopName + businessName exist on
            // the schema as separate properties; data lives in whichever the
            // vendor filled in, so we ship both and let the frontend fall back.
            // Keep this in sync with the fields the export/stall dialog show.
            select:
              "name email businessEmail phoneNumber phone whatsAppNumber whatsappNumber countryCode country shopName businessName businessType businessCategory businessDescription instagramLink instagramHandle faceBookLink businessOwnerNationality residency noOfOperators refundPaymentDescription productDescription nameOfApplicant registrationNumber brandName displayName hasDocVerification isGSTVerified isUENVerified GSTNumber UENNumber isMember membershipEndDate",
          },
          {
            path: "eventId",
            select:
              "title location startDate venueTables addOnItems venueConfig",
          },
          { path: "organizerId", select: "name email organizationName" },
        ]);

      return {
        success: true,
        message: "Stalls for event fetched successfully",
        data: stalls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findByOrganizerId(organizerId: string) {
    try {
      if (!Types.ObjectId.isValid(organizerId)) {
        throw new BadRequestException("Invalid organizer ID format");
      }

      const stalls = await this.stallModel
        .find({ organizerId: new Types.ObjectId(organizerId) })
        .populate([
          {
            path: "shopkeeperId",
          },
          { path: "eventId", select: "title location startDate endDate" },
        ])
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: "Stalls for organizer fetched successfully",
        data: stalls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async findByShopkeeperId(shopkeeperId: string) {
    try {
      if (!Types.ObjectId.isValid(shopkeeperId)) {
        throw new BadRequestException("Invalid shopkeeper ID format");
      }

      const stalls = await this.stallModel
        .find({ shopkeeperId: new Types.ObjectId(shopkeeperId) })
        .populate([
          { path: "eventId", select: "title location startDate image endDate" },
          {
            path: "organizerId",
            select: "name email organizationName businessEmail whatsAppNumber",
          },
        ])
        .sort({ createdAt: -1 });

      return {
        success: true,
        message: "Stalls for vendor fetched successfully",
        data: stalls,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async updateTransactionDetails(
    stallId: string,
    transactionId?: string,
    transactionScreenshot?: string,
  ) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID");
    }
    const updateData: any = {};
    if (transactionId) updateData.transactionId = transactionId;
    if (transactionScreenshot)
      updateData.transactionScreenshot = transactionScreenshot;

    return this.stallModel.findByIdAndUpdate(stallId, updateData, {
      new: true,
    });
  }

  async remove(id: string, changedBy?: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      // Fetch first so we know which space(s) to release before deleting.
      const stall = await this.stallModel.findById(id);
      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      // Free up any space this stall held — clear isBooked / bookedBy on the
      // event's venueTables for its selected positions. Covers stalls at any
      // stage (incl. partial payment), so the space goes vacant on the venue
      // map / availability immediately.
      await this.releaseStallTables(stall);

      // SOFT delete — the organizer often needs to still see a "deleted" stall
      // to settle its refund/deposit. Mark it Cancelled and keep the record so
      // it stays in the Participants list (its QR is already void via the
      // Cancelled-status guard in scanStallQR). We do NOT drop it from the DB.
      const actor = (changedBy || "").trim() || "Organizer";
      stall.status = "Cancelled" as any;
      (stall as any).cancelledVia = "manual-delete";
      stall.statusHistory.push({
        status: "Cancelled" as any,
        note: `Stall deleted by ${actor} — space freed. Kept in the list for refund/records.`,
        changedAt: new Date(),
        changedBy: actor,
      });
      await stall.save();

      return {
        success: true,
        message: "Stall deleted (kept in list for records) and space freed.",
        data: stall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // Release the tables/space a stall occupied back to "available" on the
  // event document. Handles venueTables as an array OR an object keyed by
  // layoutId. Best-effort — never blocks the caller.
  private async releaseStallTables(stall: any) {
    try {
      const positionIds = (stall?.selectedTables || [])
        .map((t: any) => t.positionId)
        .filter(Boolean);
      if (positionIds.length === 0 || !stall.eventId) return;

      const eventDoc: any = await this.eventModel.findById(stall.eventId);
      if (!eventDoc?.venueTables) return;

      const release = (t: any) => {
        if (!positionIds.includes(t.positionId)) return t;
        const obj = t.toObject ? t.toObject() : t;
        return { ...obj, isBooked: false, bookedBy: null };
      };

      if (Array.isArray(eventDoc.venueTables)) {
        eventDoc.venueTables = eventDoc.venueTables.map(release);
      } else {
        for (const layoutId of Object.keys(eventDoc.venueTables)) {
          eventDoc.venueTables[layoutId] = (
            eventDoc.venueTables[layoutId] || []
          ).map(release);
        }
      }

      eventDoc.markModified("venueTables");
      await eventDoc.save();
      this.logger.log(
        `Released ${positionIds.length} table(s) for deleted stall ${stall._id}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `Failed to release tables for stall ${stall?._id}: ${e?.message}`,
      );
    }
  }

  // Re-book the space(s) a cancelled stall previously held, refusing if any
  // position has since been booked by a *different* stall. Mirrors
  // releaseStallTables() but inverted, plus the conflict guard restore needs.
  private async reclaimStallTables(stall: any) {
    const positionIds = (stall?.selectedTables || [])
      .map((t: any) => t.positionId)
      .filter(Boolean);
    if (positionIds.length === 0 || !stall.eventId) return;

    const eventDoc: any = await this.eventModel.findById(stall.eventId);
    if (!eventDoc?.venueTables) return;

    const stallIdStr = String(stall._id);
    const allTables: any[] = Array.isArray(eventDoc.venueTables)
      ? eventDoc.venueTables
      : Object.values(eventDoc.venueTables).flat();

    const conflicts = allTables
      .filter((t: any) => positionIds.includes(t.positionId))
      .filter((t: any) => t.isBooked && String(t.bookedBy) !== stallIdStr)
      .map((t: any) => t.name || t.positionId);

    if (conflicts.length > 0) {
      throw new BadRequestException(
        `Can't restore — ${conflicts.join(", ")} ${
          conflicts.length === 1 ? "is" : "are"
        } now booked by another stall. Reassign that stall first.`,
      );
    }

    const reclaim = (t: any) => {
      if (!positionIds.includes(t.positionId)) return t;
      const obj = t.toObject ? t.toObject() : t;
      return { ...obj, isBooked: true, bookedBy: stallIdStr };
    };

    if (Array.isArray(eventDoc.venueTables)) {
      eventDoc.venueTables = eventDoc.venueTables.map(reclaim);
    } else {
      for (const layoutId of Object.keys(eventDoc.venueTables)) {
        eventDoc.venueTables[layoutId] = (
          eventDoc.venueTables[layoutId] || []
        ).map(reclaim);
      }
    }

    eventDoc.markModified("venueTables");
    await eventDoc.save();
    this.logger.log(
      `Reclaimed ${positionIds.length} table(s) for restored stall ${stall._id}`,
    );
  }

  // Walks statusHistory backwards from the most recent "Cancelled" entry to
  // find what the stall's status was immediately before cancellation.
  private getPreCancelStatus(stall: any): string {
    const history = stall.statusHistory || [];
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].status === "Cancelled") {
        for (let j = i - 1; j >= 0; j--) {
          if (history[j].status !== "Cancelled") return history[j].status;
        }
        break;
      }
    }
    return "Pending";
  }

  // Restore a stall that was cancelled by timer-expiry or manual delete —
  // reassigns it back to the vendor (shopkeeperId was never cleared on
  // cancel) and re-books its space(s). Excludes organizer-approved vendor
  // cancellations and plain status-updates, which carry side effects (zeroed
  // coupon, promised refund) a blind restore shouldn't silently undo.
  async restoreStall(id: string, changedBy?: string) {
    try {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException("Invalid stall ID format");
      }
      const stall = await this.stallModel.findById(id);
      if (!stall) {
        throw new NotFoundException("Stall not found");
      }
      if (stall.status !== "Cancelled") {
        throw new BadRequestException("Only cancelled stalls can be restored.");
      }
      const allowed = ["auto-timeout", "manual-delete"];
      if (!allowed.includes((stall as any).cancelledVia)) {
        throw new BadRequestException(
          "This stall wasn't cancelled by a timer expiry or manual delete, so it can't be restored from here.",
        );
      }

      // Throws BadRequestException if a position was re-booked since cancel.
      await this.reclaimStallTables(stall);

      const restoreStatus = this.getPreCancelStatus(stall);
      const actor = (changedBy || "").trim() || "Organizer";
      stall.status = restoreStatus as any;
      (stall as any).cancelledVia = undefined;
      stall.statusHistory.push({
        status: restoreStatus as any,
        note: `Stall restored by ${actor} — reassigned to the vendor and space re-booked.`,
        changedAt: new Date(),
        changedBy: actor,
      });
      await stall.save();

      return {
        success: true,
        message: "Stall restored.",
        data: stall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  async getAvailableTables(eventId: string) {
    try {
      if (!Types.ObjectId.isValid(eventId)) {
        throw new BadRequestException("Invalid event ID format");
      }

      const event = await this.eventModel.findById(eventId);
      if (!event) {
        throw new NotFoundException("Event not found");
      }

      if (!event.venueTables || event.venueTables.length === 0) {
        return {
          success: true,
          message: "No tables configured for this event",
          data: {
            allTables: [],
            bookedTables: [],
            availableTables: [],
          },
        };
      }

      const bookedStalls = await this.stallModel.find({
        eventId: new Types.ObjectId(eventId),
        status: { $in: ["Processing", "Completed"] },
        "selectedTables.0": { $exists: true },
      });

      const bookedPositionIds = bookedStalls.flatMap((s) =>
        (s.selectedTables || []).map((t) => t.positionId),
      );

      // Use toObject() so the FULL stall data (color, dimensions, template id,
      // …) is copied — spreading a Mongoose subdocument directly drops the data
      // fields, which stripped `color` and made every space render green.
      const tablesWithStatus = event.venueTables.map((table: any) => {
        const t = table?.toObject ? table.toObject() : table;
        return {
          ...t,
          isBooked: bookedPositionIds.includes(t.positionId),
        };
      });

      const availableTables = tablesWithStatus.filter((t) => !t.isBooked);
      const bookedTables = tablesWithStatus.filter((t) => t.isBooked);

      return {
        success: true,
        message: "Tables fetched successfully",
        data: {
          allTables: tablesWithStatus,
          bookedTables,
          availableTables,
          venueConfig: event.venueConfig,
          addOnItems: event.addOnItems || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  private async sendDepositReturnedNotification(stall: any) {
    try {
      const vendor = await this.vendorModel.findById(stall.shopkeeperId);
      const event = await this.eventModel.findById(stall.eventId);
      const organizer = await this.organizerModel.findById(stall.organizerId);
      const country = organizer?.country || "IN";

      const returnedAmount = stall.depositTotal;

      let message =
        `🔄 *Deposit Returned*\n\n` +
        `Dear ${vendor.name},\n\n` +
        `Your deposit for *${event.title}* has been successfully returned to your account.\n\n` +
        `• Amount Returned: ${formatCurrency(returnedAmount, country)}\n\n` +
        `Thank you for your participation!\n\n` +
        `We'd love to hear about your experience. Please reply with any feedback or use our feedback:\n\n` +
        `Best regards, ${organizer.organizationName}`;

      // Mark the deposit returned (optional business logic)
      stall.depositReturned = true;
      await stall.save();

      await this.otpService.sendWhatsAppMessage(
        vendor.whatsAppNumber || vendor.whatsappNumber,
        message,
      );
    } catch (error) {
      this.logger.error("Error sending deposit returned notification:", error);
    }
  }

  async returnedDeposit(stallId: string, notes: string, changedBy?: string) {
    try {
      const stall = await this.stallModel.findById(stallId);

      if (stall.hasCheckedOut && stall.checkOutTime) {
        const now = new Date();
        stall.depositReturned = true;
        stall.status = "Returned";
        stall.depositReturnedDate = now;
        stall.statusHistory.push({
          status: "Returned" as any,
          note: notes,
          changedAt: now,
          changedBy: changedBy || "Organizer",
        });

        await stall.save();

        await this.sendDepositReturnedNotification(stall);
      }

      return {
        success: true,
        message: "Deposit returned successfully",
        data: stall,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        data: null,
      };
    }
  }

  // ============ DOWNLOAD STALL TICKET ============
  async downloadStallTicket(stallId: string) {
    try {
      if (!Types.ObjectId.isValid(stallId)) {
        throw new BadRequestException("Invalid stall ID format");
      }

      const stall = await this.stallModel
        .findById(stallId)
        .populate("shopkeeperId")
        .populate("eventId")
        .populate("organizerId");

      if (!stall) {
        throw new NotFoundException("Stall not found");
      }

      // 1. Verify Payment Status
      if (stall.paymentStatus !== "Paid") {
        throw new BadRequestException(
          "Stall ticket can only be downloaded after the payment is completed (Paid status).",
        );
      }

      const pdfFileName = `stall_ticket_${stallId}.pdf`;
      const pdfDir = path.join(process.cwd(), "uploads", "stallTickets");
      const pdfPath = path.join(pdfDir, pdfFileName);

      // 2. If PDF already exists on disk (from confirmPayment), return it
      if (fs.existsSync(pdfPath)) {
        const buffer = await fs.promises.readFile(pdfPath);
        return { buffer, filename: pdfFileName };
      }

      // 3. Fallback: If file is missing from disk, regenerate it on the fly
      this.logger.warn(
        `PDF missing on disk for stall ${stallId}. Regenerating...`,
      );

      // Reconstruct the QR payload — and persist it when the stall has none (a
      // booking confirmed while the PDF render was failing). Without that
      // write the vendor gets a nice-looking ticket whose QR matches nothing
      // in the database and is rejected at the gate.
      const { qrCodeImage: qrCodeBase64 } =
        await this.ensureStallQrPayload(stall);

      // Construct coupon object for HTML template using the saved code, gated
      // by the event's live coupon toggle (off ⇒ omit it from the PDF).
      const coupon = this.effectiveStallCoupon(stall, stall.eventId);

      // Get organizer country for currency
      const organizerForCurrency = await this.organizerModel.findById(
        stall.organizerId,
      );
      const dlCountry = organizerForCurrency?.country || "IN";

      // Generate the PDF Buffer
      const pdfBuffer = await this.generateStallTicketPDF(
        stall,
        qrCodeBase64,
        coupon,
        dlCountry,
      );

      // Save it back to disk to speed up future downloads, and record the url
      // so the stall reflects that a ticket now exists.
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      await fs.promises.writeFile(pdfPath, pdfBuffer);
      if (stall.qrCodePath !== `/uploads/stallTickets/${pdfFileName}`) {
        stall.qrCodePath = `/uploads/stallTickets/${pdfFileName}`;
        await stall.save();
      }

      return {
        buffer: pdfBuffer,
        filename: pdfFileName,
      };
    } catch (error) {
      this.logger.error(
        `Error downloading stall ticket for ${stallId}:`,
        error,
      );
      throw error;
    }
  }

  // ============ RESEND STALL TICKET (QR) EMAIL ============
  // Re-deliver the QR stall ticket for an already-Paid stall, and repair it on
  // the way: a booking with no QR payload gets one created and saved first, so
  // "Resend" doubles as the organizer's one-click fix for stalls confirmed
  // while the PDF render was broken.
  //
  // Failure policy, deliberately split:
  //   • PDF render fails  → NOT an error. The QR goes inline in the email so
  //     the vendor is still scannable; the organizer sees a success telling
  //     them the PDF is missing.
  //   • Email send fails  → SURFACED (SMTP timeout / auth / blocked port / bad
  //     organizer email config). Swallowing this would tell the organizer the
  //     ticket went out when nothing did.
  async resendStallTicket(stallId: string) {
    if (!Types.ObjectId.isValid(stallId)) {
      throw new BadRequestException("Invalid stall ID format");
    }

    const stall: any = await this.stallModel
      .findById(stallId)
      .populate("shopkeeperId")
      .populate("eventId")
      .populate("organizerId");
    if (!stall) {
      throw new NotFoundException("Stall not found");
    }
    // Same precondition downloadStallTicket enforces — checked up front
    // because what follows mints a live check-in credential.
    if (stall.paymentStatus !== "Paid") {
      throw new BadRequestException(
        "Stall ticket can only be sent after the payment is completed (Paid status).",
      );
    }

    // Create the QR payload if this booking never got one. Then try for the
    // PDF, but treat a render failure as a downgrade, not an error: the
    // vendor still gets the scannable QR inline, and the organizer sees a
    // success instead of a dead end.
    const { qrCodeImage, created } = await this.ensureStallQrPayload(stall);
    let buffer: Buffer | null = null;
    try {
      ({ buffer } = await this.downloadStallTicket(stallId));
    } catch (pdfErr) {
      this.logger.warn(
        `Resend: ticket PDF unavailable for ${stallId} (${
          (pdfErr as any)?.message || pdfErr
        }) — emailing the QR image instead.`,
      );
    }

    const vendorObj = stall.shopkeeperId as any;
    const vendorEmail = this.vendorEmailRecipients(vendorObj);
    if (!vendorEmail) {
      throw new BadRequestException(
        "This vendor has no email on file, so the ticket can't be emailed.",
      );
    }

    const eventObj = stall.eventId as any;
    const orgId = (stall.organizerId as any)?._id || stall.organizerId;
    const orgDoc = await this.organizerModel.findById(orgId).lean();
    const senderConfig = (orgDoc as any)?.emailConfig;
    const country = (orgDoc as any)?.country || "IN";
    // Gate the coupon by the event's live toggle (off ⇒ no coupon in the
    // resent ticket PDF + summary message).
    const coupon = this.effectiveStallCoupon(stall, eventObj) ?? undefined;
    const eventTitle = eventObj?.title || "Event";
    const message = this.buildBookingSummaryMessage(
      stall,
      vendorObj,
      eventObj,
      country,
      "Your Stall Ticket",
      coupon,
    );
    // No PDF? Put the QR in the email body (and attach it as a PNG) so the
    // vendor can still be scanned in at the gate from their phone.
    const qrBlock = buffer
      ? ""
      : `<div style="text-align:center;padding:8px 0 16px">
            <img src="cid:stallqr" alt="Stall check-in QR" style="width:200px;height:200px"/>
            <p style="color:#64748b;font-size:12px;margin:8px 0 0">
              Show this QR at the entrance. It's also attached as an image.
            </p>
          </div>`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;padding:24px;text-align:center">
          <h1 style="margin:0;font-size:20px">Your Stall Ticket</h1>
        </div>
        <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
          <p>${message.replace(/\*/g, "").replace(/\n/g, "<br/>")}</p>
          ${qrBlock}
        </div>
      </div>`;

    const attachments = buffer
      ? [{ filename: "stall-ticket.pdf", content: buffer }]
      : [
          {
            filename: "stall-qr.png",
            content: Buffer.from(qrCodeImage.split(",")[1], "base64"),
            cid: "stallqr",
          },
        ];

    try {
      await this.mailService.sendEmail({
        to: vendorEmail,
        subject: `Your stall ticket for ${eventTitle}`,
        html,
        attachments,
        senderConfig,
      });
    } catch (err: any) {
      this.logger.error(
        `Resend stall ticket email failed for ${stallId}: ${err?.message || err}`,
      );
      throw new InternalServerErrorException(
        `Couldn't email the ticket: ${err?.message || "mail server error"}`,
      );
    }

    // Best-effort WhatsApp mirror (never fails the resend). Skipped when the
    // PDF couldn't be rendered — there'd be no file on disk to attach.
    const wa = vendorObj?.whatsAppNumber || vendorObj?.whatsappNumber;
    if (wa && buffer) {
      try {
        const pdfPath = path.join(
          process.cwd(),
          "uploads",
          "stallTickets",
          `stall_ticket_${stallId}.pdf`,
        );
        await this.otpService.sendMediaMessage(
          wa,
          pdfPath,
          `Stall Ticket - ${eventTitle}`,
          "stall-ticket.pdf",
        );
      } catch (waErr) {
        this.logger.warn(
          `Resend: WhatsApp mirror failed for ${stallId}: ${
            (waErr as any)?.message || waErr
          }`,
        );
      }
    }

    this.logger.log(
      `Stall ticket re-sent for ${stallId} to ${vendorEmail}` +
        (buffer ? "" : " (QR image — PDF render unavailable)") +
        (created ? " [QR payload was missing and has been created]" : ""),
    );
    return {
      success: true,
      message: buffer
        ? `Stall ticket re-sent to ${vendorEmail}.${
            created ? " The missing QR was generated first." : ""
          }`
        : `QR sent to ${vendorEmail}. The ticket PDF couldn't be generated on the ` +
          `server, so the scannable QR is in the email body instead.`,
    };
  }
}
