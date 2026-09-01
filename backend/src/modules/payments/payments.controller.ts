import {
  Controller,
  Post,
  Get,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { PaymentsService } from "./payments.service";
import * as path from "path";
import { diskStorage } from "multer";

function tempStorage() {
  return diskStorage({
    destination: "./uploads/tmp",
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    },
  });
}

@Controller("payments")
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post("decode-qr")
  @UseInterceptors(FileInterceptor("file", { storage: tempStorage() }))
  async decodeQr(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("No file provided");
    return this.paymentsService.decodeQrFromFile(file.path);
  }

  @Get("decode-qr-url")
  async decodeQrUrl(@Query("imageUrl") imageUrl: string) {
    return this.paymentsService.decodeQrFromUrl(imageUrl);
  }

  /**
   * `static=1` returns a re-usable QR with no amount in it — the payer types
   * the sum. That is what the super-admin invoice embeds, so the PDF keeps
   * working after the amount it was generated for has been part-paid.
   */
  @Get("generate-qr")
  async generateQr(
    @Query("scheme") scheme: "UPI" | "PAYNOW",
    @Query("payeeId") payeeId: string,
    @Query("payeeName") payeeName: string,
    @Query("amount") amount: string,
    @Query("billNumber") billNumber?: string,
    @Query("currency") currency = scheme === "PAYNOW" ? "SGD" : "INR",
    @Query("static") staticQr?: string
  ) {
    if (!payeeId || !payeeName)
      throw new BadRequestException("Missing payeeId or payeeName");

    const isStatic = staticQr === "1" || staticQr === "true";

    try {
      return await this.paymentsService.generateQrCode(
        {
          scheme,
          payeeId,
          payeeName,
          amount,
          billNumber,
          currency,
          editableAmount: false,
          staticQr: isStatic,
          countryCode: scheme === "PAYNOW" ? "SG" : "IN",
        },
        billNumber
      );
    } catch (error) {
      throw new BadRequestException("Failed to generate QR: " + error.message);
    }
  }
}
