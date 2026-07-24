import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import * as fs from "fs";

const UPLOAD_DIR = "./uploads/suppliers";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierRequestDto } from "./dto/create-supplier-request.dto";
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
  @Get("form/:token")
  async getForm(@Param("token") token: string) {
    const data = await this.suppliersService.getFormByToken(token);
    return { success: true, message: "Supplier form loaded", data };
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

  // ---------- ORGANIZER: per-event config + link ----------

  @Get("event/:eventId/config")
  async getConfig(@Param("eventId") eventId: string) {
    const data = await this.suppliersService.getOrCreateConfig(eventId);
    return { success: true, message: "Config loaded", data };
  }

  @Patch("event/:eventId/config")
  async upsertConfig(
    @Param("eventId") eventId: string,
    @Body() dto: UpsertSupplierConfigDto,
  ) {
    const data = await this.suppliersService.upsertConfig(eventId, dto);
    return { success: true, message: "Config saved", data };
  }

  @Post("event/:eventId/link")
  async generateLink(@Param("eventId") eventId: string) {
    const data = await this.suppliersService.generateLink(eventId);
    return { success: true, message: "Supplier link generated", data };
  }

  @Patch("event/:eventId/link")
  async setLinkEnabled(
    @Param("eventId") eventId: string,
    @Body() body: { enabled: boolean },
  ) {
    const data = await this.suppliersService.setLinkEnabled(
      eventId,
      !!body?.enabled,
    );
    return { success: true, message: "Supplier link updated", data };
  }

  // ---------- ORGANIZER: quotations ----------

  @Get("event/:eventId")
  async listByEvent(@Param("eventId") eventId: string) {
    const data = await this.suppliersService.listByEvent(eventId);
    return { success: true, message: "Supplier quotations fetched", data };
  }

  @Get("organizer/:organizerId")
  async listByOrganizer(@Param("organizerId") organizerId: string) {
    const data = await this.suppliersService.listByOrganizer(organizerId);
    return { success: true, message: "Supplier quotations fetched", data };
  }

  @Get("request/:id")
  async getOne(@Param("id") id: string) {
    const data = await this.suppliersService.getOne(id);
    return { success: true, message: "Supplier request fetched", data };
  }

  @Patch("request/:id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateSupplierStatusDto,
  ) {
    const data = await this.suppliersService.updateStatus(id, dto);
    return { success: true, message: "Status updated", data };
  }

  @Post("request/:id/record-payment")
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
  async addNote(@Param("id") id: string, @Body() dto: AddSupplierNoteDto) {
    const data = await this.suppliersService.addNote(id, dto);
    return { success: true, message: "Note added", data };
  }
}
