import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { WorkshopRequestsService } from "./workshop-requests.service";
import {
  CreateWorkshopRequestDto,
  UpdateWorkshopRequestStatusDto,
  UpdateWorkshopHostingFeeDto,
  UpdateWorkshopProposalDto,
} from "./dto/create-workshop-request.dto";

@Controller("workshop-requests")
export class WorkshopRequestsController {
  constructor(private readonly service: WorkshopRequestsService) {}

  // Phase 1: Apply to host a workshop
  @Post("apply")
  @HttpCode(HttpStatus.CREATED)
  async apply(@Body() body: CreateWorkshopRequestDto) {
    return this.service.create(body);
  }

  // Phase 1b: Apply with a host photo
  @Post("apply-with-image")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("image", {
      storage: diskStorage({
        destination: "./uploads/workshopRequests",
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname);
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error("Only image files are allowed!"), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async applyWithImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    if (file) body.hostImage = `/uploads/workshopRequests/${file.filename}`;
    return this.service.create(body);
  }

  @Get("event/:eventId")
  async findByEvent(@Param("eventId") eventId: string) {
    return this.service.findByEvent(eventId);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  // Phase 2: Approve / reject
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateWorkshopRequestStatusDto,
  ) {
    return this.service.updateStatus(id, dto);
  }

  // Set/override the hosting fee
  @Patch(":id/fee")
  async updateFee(
    @Param("id") id: string,
    @Body() dto: UpdateWorkshopHostingFeeDto,
  ) {
    return this.service.updateFee(id, dto);
  }

  // Adjust the proposal (price/seats/times) before it goes live
  @Patch(":id/proposal")
  async updateProposal(
    @Param("id") id: string,
    @Body() dto: UpdateWorkshopProposalDto,
  ) {
    return this.service.updateProposal(id, dto);
  }

  // Host self-reports having paid — informational, does not publish.
  @Patch(":id/payment-submitted")
  async markPaymentSubmitted(@Param("id") id: string) {
    return this.service.markPaymentSubmitted(id);
  }

  // Phase 3: Organizer confirms hosting-fee payment → publishes the workshop
  @Post(":id/confirm-payment")
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @Param("id") id: string,
    @Body() body: { notes?: string; changedBy?: string },
  ) {
    return this.service.confirmPayment(id, body?.notes, body?.changedBy);
  }
}
