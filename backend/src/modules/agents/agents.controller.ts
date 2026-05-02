import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AgentsService } from "./agents.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { UpdateAgentDto } from "./dto/update-agent.dto";

@Controller("agents")
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post()
  @UseGuards(AuthGuard("jwt"))
  create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto);
  }

  @Get()
  @UseGuards(AuthGuard("jwt"))
  findAll() {
    return this.agentsService.findAll();
  }

  // Public — used by registration dropdown
  @Get("active")
  findActive() {
    return this.agentsService.findActive();
  }

  // Public — used by referral link
  @Get("by-referral/:code")
  findByReferral(@Param("code") code: string) {
    return this.agentsService.findByReferralCode(code);
  }

  @Get(":id")
  @UseGuards(AuthGuard("jwt"))
  findById(@Param("id") id: string) {
    return this.agentsService.findById(id);
  }

  @Get(":id/analytics")
  @UseGuards(AuthGuard("jwt"))
  getAnalytics(@Param("id") id: string) {
    return this.agentsService.getAnalytics(id);
  }

  @Patch(":id")
  @UseGuards(AuthGuard("jwt"))
  update(@Param("id") id: string, @Body() dto: UpdateAgentDto) {
    return this.agentsService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  remove(@Param("id") id: string) {
    return this.agentsService.remove(id);
  }
}
