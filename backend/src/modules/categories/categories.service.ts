import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Category, CategoryDocument } from "./schemas/category.schema";
import { CreateCategoryDto } from "./dto/create-category.dto";

const DEFAULT_CATEGORIES = [
  "Technology",
  "Music",
  "Food",
  "Sports",
  "Arts",
  "Fashion",
  "Electronics",
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  // Seed defaults if collection is empty
  async onModuleInit() {
    const count = await this.categoryModel.estimatedDocumentCount();
    if (count === 0) {
      await this.categoryModel.insertMany(
        DEFAULT_CATEGORIES.map((name) => ({ name })),
      );
      this.logger.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories`);
    }
  }

  findAll() {
    return this.categoryModel.find().sort({ name: 1 }).lean();
  }

  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    // Case-insensitive duplicate check
    const existing = await this.categoryModel
      .findOne({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } })
      .lean();
    if (existing) {
      throw new ConflictException("Category already exists");
    }
    try {
      return await this.categoryModel.create({ name });
    } catch (e: any) {
      if (e?.code === 11000) {
        throw new ConflictException("Category already exists");
      }
      throw e;
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
