import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Public — used by organizer settings dropdown
  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  // Auth required — any logged-in organizer can add a new category
  @Post()
  @UseGuards(AuthGuard("jwt"))
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }
}
