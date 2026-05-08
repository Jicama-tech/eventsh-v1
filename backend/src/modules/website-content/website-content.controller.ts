import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { WebsiteContentService } from "./website-content.service";

@Controller("website-content")
export class WebsiteContentController {
  constructor(private readonly service: WebsiteContentService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  list() {
    return this.service.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  update(@Param("id") id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  delete(@Param("id") id: string) {
    return this.service.delete(id);
  }
}
