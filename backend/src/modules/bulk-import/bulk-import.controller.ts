import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { memoryStorage } from "multer";
import { BulkImportService } from "./bulk-import.service";

const ACCEPTED_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "text/csv", // .csv
  "application/csv",
  "application/octet-stream", // some browsers report this for .xlsx
]);

const ACCEPTED_EXT = /\.(xlsx|xls|csv)$/i;

const uploadInterceptor = FileInterceptor("file", {
  storage: memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB cap
  fileFilter: (_req, file, cb) => {
    if (
      ACCEPTED_MIMES.has(file.mimetype) ||
      ACCEPTED_EXT.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException("Only .xlsx, .xls or .csv files are accepted"),
        false,
      );
    }
  },
});

@Controller("bulk-import")
export class BulkImportController {
  constructor(private readonly service: BulkImportService) {}

  // ---------------- IMPORT ----------------

  @Post("visitors/:organizerId")
  @UseInterceptors(uploadInterceptor)
  async importVisitors(
    @Param("organizerId") organizerId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.service.importVisitors(organizerId, file.buffer);
  }

  @Post("exhibitors/:organizerId")
  @UseInterceptors(uploadInterceptor)
  async importExhibitors(
    @Param("organizerId") organizerId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("No file uploaded");
    return this.service.importExhibitors(organizerId, file.buffer);
  }

  // ---------------- EXPORT ----------------

  @Get("visitors/export/:organizerId")
  async exportVisitors(
    @Param("organizerId") organizerId: string,
    @Res() res: Response,
  ) {
    const buf = await this.service.exportVisitors(organizerId);
    this.sendXlsx(res, buf, `visitors-${Date.now()}.xlsx`);
  }

  @Get("exhibitors/export/:organizerId")
  async exportExhibitors(
    @Param("organizerId") organizerId: string,
    @Res() res: Response,
  ) {
    const buf = await this.service.exportExhibitors(organizerId);
    this.sendXlsx(res, buf, `exhibitors-${Date.now()}.xlsx`);
  }

  // ---------------- TEMPLATES ----------------

  @Get("visitors/template")
  async visitorTemplate(@Res() res: Response) {
    const buf = await this.service.visitorTemplate();
    this.sendXlsx(res, buf, "visitors-template.xlsx");
  }

  @Get("exhibitors/template")
  async exhibitorTemplate(@Res() res: Response) {
    const buf = await this.service.exhibitorTemplate();
    this.sendXlsx(res, buf, "exhibitors-template.xlsx");
  }

  private sendXlsx(res: Response, buf: Buffer, filename: string) {
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.send(buf);
  }
}
