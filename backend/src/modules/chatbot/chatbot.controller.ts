import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Get,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ChatbotService } from "./chatbot.service";

@Controller("chatbot")
export class ChatbotController {
  constructor(private readonly chatbot: ChatbotService) {}

  @Post("message")
  @UseGuards(AuthGuard("jwt"))
  async message(
    @Body() body: { message: string },
    @Req() req: any,
  ) {
    const organizerId = req.user?.userId || req.user?.sub;
    const organizerName: string = req.user?.name || "there";
    return this.chatbot.handleMessage({
      organizerId,
      organizerName,
      message: String(body.message || "").slice(0, 4000),
    });
  }

  @Get("health")
  health() {
    return { ok: true, provider: this.chatbot.activeProvider };
  }
}
