import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import * as fs from "fs";

import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { EXPENSE_CATEGORIES } from "./entities/event-expense.entity";

const UPLOAD_DIR = "./uploads/expenses";

const receiptUpload = FileInterceptor("receipt", {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) =>
      cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|pdf)$/)) {
      cb(new Error("Only image or PDF receipts are allowed!"), false);
    } else {
      cb(null, true);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /** Categories the UI offers — kept server-side so both stay in step. */
  @Get("categories")
  categories() {
    return { success: true, data: EXPENSE_CATEGORIES };
  }

  // Signed in: the recorder is read off the token, never the request body.
  @Post()
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(receiptUpload)
  async create(
    @Body() dto: CreateExpenseDto,
    @Request() req: any,
    @UploadedFile() file?: any,
  ) {
    const receipt = file
      ? `/uploads/expenses/${(file as any).filename}`
      : undefined;
    const { message, data } = await this.expensesService.create(
      dto,
      req.user,
      receipt,
    );
    return { success: true, message, data };
  }

  @Get("event/:eventId")
  async listByEvent(@Param("eventId") eventId: string) {
    const { data, total, pendingTotal, currency, byCategory } =
      await this.expensesService.listByEvent(eventId);
    return {
      success: true,
      message: "Expenses fetched",
      data,
      total,
      pendingTotal,
      currency,
      byCategory,
    };
  }

  // Approve / reject — organizer, or an operator granted the permission.
  @Patch(":id/decision")
  @UseGuards(AuthGuard("jwt"))
  async decide(
    @Param("id") id: string,
    @Body() body: { approve?: boolean | string; reason?: string },
    @Request() req: any,
  ) {
    const approve = body?.approve === true || body?.approve === "true";
    const { message, data } = await this.expensesService.decide(
      id,
      approve,
      req.user,
      body?.reason,
    );
    return { success: true, message, data };
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  async remove(@Param("id") id: string) {
    const { message } = await this.expensesService.remove(id);
    return { success: true, message };
  }
}
