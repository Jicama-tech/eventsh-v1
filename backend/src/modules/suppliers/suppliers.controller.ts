import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import * as fs from "fs";

const UPLOAD_DIR = "./uploads/suppliers";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierRequestDto } from "./dto/create-supplier-request.dto";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SupplierRespondDto } from "./dto/supplier-respond.dto";
import { UpsertSupplierConfigDto } from "./dto/upsert-supplier-config.dto";
import { UpdateSupplierStatusDto } from "./dto/update-supplier-status.dto";
import { RecordSupplierPaymentDto } from "./dto/record-supplier-payment.dto";
import { AddSupplierNoteDto } from "./dto/add-supplier-note.dto";

function generateFileName(_req: any, file: any, cb: any) {
  const ext = path.extname(file.originalname);
  cb(null, `${uuidv4()}${ext}`);
}

// Quotation docs + payment proofs — images or PDF.
const proofFilter = (_req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|pdf)$/)) {
    cb(new Error("Only image or PDF files are allowed!"), false);
  } else {
    cb(null, true);
  }
};

const supplierUpload = (field: string) =>
  FileInterceptor(field, {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      },
      filename: generateFileName,
    }),
    fileFilter: proofFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  // ---------- PUBLIC (token-gated) ----------

  // Supplier opens the shared link → sees the organizer's requirements.
  @Get("form/:eventId")
  async getForm(@Param("eventId") eventId: string) {
    const data = await this.suppliersService.getFormByEvent(eventId);
    return { success: true, message: "Supplier form loaded", data };
  }

  // Supplier signs in with Google on the form → look up their saved profile
  // (by email or business email) under this event's organizer, for prefill.
  // PUBLIC — the email is already Google-verified by the OAuth popup.
  @Get("event/:eventId/supplier-by-email/:email")
  async supplierByEmail(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
  ) {
    const data = await this.suppliersService.findSupplierForEventByEmail(
      eventId,
      email,
    );
    return { success: true, message: "Supplier lookup", data };
  }

  // Supplier revisit: their existing quotation + status timeline for this
  // event (or null). PUBLIC — email is Google-verified by the OAuth popup.
  @Get("event/:eventId/my-request/:email")
  async myRequest(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
  ) {
    const data = await this.suppliersService.getMyRequestForEvent(
      eventId,
      email,
    );
    return { success: true, message: "Supplier request timeline", data };
  }

  // Supplier's negotiation reply (Approve / Negotiate / Reject) from their
  // timeline. PUBLIC — email is Google-verified by the OAuth popup.
  @Post("event/:eventId/my-request/:email/respond")
  async supplierRespond(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
    @Body() dto: SupplierRespondDto,
  ) {
    const data = await this.suppliersService.supplierRespond(
      eventId,
      email,
      dto,
    );
    return { success: true, message: "Response recorded", data };
  }

  // Supplier confirms the organizer's payment + uploads their invoice/bill.
  // PUBLIC — email is Google-verified. Multipart (optional `invoice` file).
  @Post("event/:eventId/my-request/:email/confirm-payment")
  @UseInterceptors(supplierUpload("invoice"))
  async supplierConfirmPayment(
    @Param("eventId") eventId: string,
    @Param("email") email: string,
    @Body() body: { note?: string },
    @UploadedFile() file?: any,
  ) {
    const invoice = file
      ? `/uploads/suppliers/${(file as any).filename}`
      : undefined;
    const data = await this.suppliersService.supplierConfirmPayment(
      eventId,
      email,
      invoice,
      body?.note,
    );
    return { success: true, message: "Payment confirmed", data };
  }

  // Supplier submits their quotation + account details (multipart, optional
  // quotation attachment). PUBLIC — gated by the token in the body.
  @Post("register")
  @UseInterceptors(supplierUpload("quotationAttachment"))
  async register(
    @Body() dto: CreateSupplierRequestDto,
    @UploadedFile() file?: any,
  ) {
    const attachment = file
      ? `/uploads/suppliers/${(file as any).filename}`
      : undefined;
    const data = await this.suppliersService.submitRequest(dto, attachment);
    return {
      success: true,
      message: "Quotation submitted. The organizer will review it.",
      data,
    };
  }

  // ---------- ORGANIZER: supplier CRM (identity list) ----------

  @Post("create-by-organizer/:organizerId")
  @UseGuards(JwtAuthGuard)
  createByOrganizer(
    @Param("organizerId") organizerId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.suppliersService.createForOrganizer(organizerId, dto);
  }

  @Patch("update-by-organizer/:organizerId/:supplierId")
  @UseGuards(JwtAuthGuard)
  updateByOrganizer(
    @Param("organizerId") organizerId: string,
    @Param("supplierId") supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.suppliersService.updateForOrganizer(
      organizerId,
      supplierId,
      dto,
    );
  }

  @Delete("delete-by-organizer/:organizerId/:supplierId")
  @UseGuards(JwtAuthGuard)
  async deleteForOrganizer(
    @Param("organizerId") organizerId: string,
    @Param("supplierId") supplierId: string,
  ) {
    const { message } = await this.suppliersService.deleteForOrganizer(
      organizerId,
      supplierId,
    );
    return { success: true, message };
  }

  // Which events this supplier has been engaged for (eye icon in the CRM).
  @Get("history/:organizerId/:supplierId")
  @UseGuards(JwtAuthGuard)
  async supplierEventHistory(
    @Param("organizerId") organizerId: string,
    @Param("supplierId") supplierId: string,
  ) {
    const data = await this.suppliersService.supplierEventHistory(
      organizerId,
      supplierId,
    );
    return { success: true, message: "Supplier history fetched", data };
  }

  @Get("list-by-organizer/:organizerId")
  @UseGuards(JwtAuthGuard)
  listSuppliersByOrganizer(@Param("organizerId") organizerId: string) {
    return this.suppliersService.listForOrganizer(organizerId);
  }

  // ---------- ORGANIZER: per-event config + link ----------

  // Requirements derived from what actually sold — spaces booked + add-ons
  // purchased — so the organizer doesn't retype what the system already knows.
  @Get("event/:eventId/requirement-suggestions")
  @UseGuards(JwtAuthGuard)
  async requirementSuggestions(@Param("eventId") eventId: string) {
    const data = await this.suppliersService.requirementSuggestions(eventId);
    return { success: true, message: "Suggestions built", data };
  }

  // Which requirements are covered, by whom, and what's still to source.
  @Get("event/:eventId/fulfilment")
  @UseGuards(JwtAuthGuard)
  async requirementFulfilment(@Param("eventId") eventId: string) {
    const data = await this.suppliersService.requirementFulfilment(eventId);
    return { success: true, message: "Fulfilment built", data };
  }

  @Get("event/:eventId/config")
  @UseGuards(JwtAuthGuard)
  async getConfig(@Param("eventId") eventId: string) {
    const data = await this.suppliersService.getConfig(eventId);
    return { success: true, message: "Config loaded", data };
  }

  @Patch("event/:eventId/config")
  @UseGuards(JwtAuthGuard)
  async upsertConfig(
    @Param("eventId") eventId: string,
    @Body() dto: UpsertSupplierConfigDto,
  ) {
    const data = await this.suppliersService.upsertConfig(eventId, dto);
    return { success: true, message: "Config saved", data };
  }

  @Patch("event/:eventId/enabled")
  @UseGuards(JwtAuthGuard)
  async setEnabled(
    @Param("eventId") eventId: string,
    @Body() body: { enabled: boolean },
  ) {
    const data = await this.suppliersService.setEnabled(
      eventId,
      !!body?.enabled,
    );
    return { success: true, message: "Supplier form updated", data };
  }

  // ---------- ORGANIZER: quotations ----------

  @Get("event/:eventId")
  @UseGuards(JwtAuthGuard)
  async listByEvent(@Param("eventId") eventId: string) {
    const data = await this.suppliersService.listByEvent(eventId);
    return { success: true, message: "Supplier quotations fetched", data };
  }

  @Get("organizer/:organizerId")
  @UseGuards(JwtAuthGuard)
  async listByOrganizer(@Param("organizerId") organizerId: string) {
    const data = await this.suppliersService.listByOrganizer(organizerId);
    return { success: true, message: "Supplier quotations fetched", data };
  }

  @Get("request/:id")
  @UseGuards(JwtAuthGuard)
  async getOne(@Param("id") id: string) {
    const data = await this.suppliersService.getOne(id);
    return { success: true, message: "Supplier request fetched", data };
  }

  // Goods received at / returned from the venue. Separate from payment.
  @Patch("request/:id/check")
  @UseGuards(JwtAuthGuard)
  async checkItems(
    @Param("id") id: string,
    @Body()
    body: {
      direction?: "in" | "out";
      entries?: Array<{ requirementLabel: string; quantity: number }>;
      by?: string;
      note?: string;
    },
  ) {
    const data = await this.suppliersService.checkItems(
      id,
      body?.direction === "out" ? "out" : "in",
      body?.entries || [],
      body?.by,
      body?.note,
    );
    return { success: true, message: "Items updated", data };
  }

  @Patch("request/:id/status")
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierStatusDto,
  ) {
    const data = await this.suppliersService.updateStatus(id, dto);
    return { success: true, message: "Status updated", data };
  }

  @Post("request/:id/record-payment")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(supplierUpload("proofScreenshot"))
  async recordPayment(
    @Param("id") id: string,
    @Body() dto: RecordSupplierPaymentDto,
    @UploadedFile() file?: any,
  ) {
    const proof = file
      ? `/uploads/suppliers/${(file as any).filename}`
      : undefined;
    const data = await this.suppliersService.recordPayment(id, dto, proof);
    return { success: true, message: "Payment recorded", data };
  }

  @Post("request/:id/notes")
  @UseGuards(JwtAuthGuard)
  async addNote(@Param("id") id: string, @Body() dto: AddSupplierNoteDto) {
    const data = await this.suppliersService.addNote(id, dto);
    return { success: true, message: "Note added", data };
  }
}
