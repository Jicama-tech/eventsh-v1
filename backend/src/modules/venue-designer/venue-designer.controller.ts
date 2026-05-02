import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { VenueDesignerService } from "./venue-designer.service";

@Controller("venue-designer")
export class VenueDesignerController {
  constructor(private readonly designer: VenueDesignerService) {}

  @Post("generate")
  @UseGuards(AuthGuard("jwt"))
  async generate(@Body() body: any) {
    return this.designer.generate(body);
  }

  @Post("chat")
  @UseGuards(AuthGuard("jwt"))
  async chat(@Body() body: any) {
    return this.designer.chat(body);
  }
}
