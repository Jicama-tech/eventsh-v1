import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { TemplatesService } from "./templates.service";
import { TemplateType } from "./schemas/template.schema";

@Controller("templates")
export class TemplatesController {
  constructor(private readonly service: TemplatesService) {}

  // GET /templates/by-organizer/:organizerId?type=space
  @Get("by-organizer/:organizerId")
  async list(
    @Param("organizerId") organizerId: string,
    @Query("type") type?: string,
  ) {
    let typed: TemplateType | undefined;
    if (type) {
      if (!Object.values(TemplateType).includes(type as TemplateType)) {
        throw new BadRequestException(
          `Unknown template type "${type}". Allowed: ${Object.values(TemplateType).join(", ")}`,
        );
      }
      typed = type as TemplateType;
    }
    const data = await this.service.listForOrganizer(organizerId, typed);
    return { message: "Templates fetched", data };
  }

  // POST /templates
  // Body: { organizerId, type, name, payload }
  @Post()
  async create(
    @Body()
    body: {
      organizerId: string;
      type: TemplateType;
      name: string;
      payload: Record<string, any>;
    },
  ) {
    if (!body?.organizerId || !body?.type || !body?.name || !body?.payload) {
      throw new BadRequestException(
        "organizerId, type, name and payload are required",
      );
    }
    if (!Object.values(TemplateType).includes(body.type)) {
      throw new BadRequestException(`Unknown type "${body.type}"`);
    }
    return this.service.create(
      body.organizerId,
      body.type,
      body.name,
      body.payload,
    );
  }

  // DELETE /templates/:organizerId/:templateId
  @Delete(":organizerId/:templateId")
  async remove(
    @Param("organizerId") organizerId: string,
    @Param("templateId") templateId: string,
  ) {
    return this.service.remove(organizerId, templateId);
  }
}
