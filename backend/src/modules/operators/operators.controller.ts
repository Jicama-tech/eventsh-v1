import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from "@nestjs/common";
import { OperatorsService } from "./operators.service";
import { CreateOperatorDto } from "./dto/create-operator.dto";
import { UpdateOperatorDto } from "./dto/update-operator.dto";

@Controller("operators")
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  // Create operator for an Organizer
  @Post("create-by-organizer/:organizerId")
  createByOrganizer(
    @Param("organizerId") organizerId: string,
    @Body() createOperatorDto: CreateOperatorDto,
  ) {
    return this.operatorsService.createByOrganizer(
      createOperatorDto,
      organizerId,
    );
  }

  // Get all operators (admin)
  @Get()
  findAll() {
    return this.operatorsService.findAll();
  }

  // Get all operators by Organizer ID
  @Get("get-by-organizer/:organizerId")
  findByOrganizerId(@Param("organizerId") organizerId: string) {
    return this.operatorsService.findByOrganizerId(organizerId);
  }

  // Get one operator by ID
  @Get("fetch/:id")
  findOne(@Param("id") id: string) {
    return this.operatorsService.findOne(id);
  }

  // Update operator by ID
  @Patch("update-operator/:id")
  update(
    @Param("id") id: string,
    @Body() updateOperatorDto: UpdateOperatorDto,
  ) {
    return this.operatorsService.update(id, updateOperatorDto);
  }

  // Delete operator by ID
  @Delete("delete-operator/:id")
  remove(@Param("id") id: string) {
    return this.operatorsService.remove(id);
  }
}
