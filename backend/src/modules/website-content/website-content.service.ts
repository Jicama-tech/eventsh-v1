import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  WebsiteContent,
  WebsiteContentDocument,
} from "./schemas/website-content.schema";

const ALLOWED_TYPES = [
  "faq",
  "about_us",
  "contact_us",
  "terms",
  "privacy",
  "blog",
] as const;

interface CreateInput {
  content_type: string;
  title?: string;
  content?: string;
  meta_description?: string;
  is_published?: boolean;
  order_index?: number;
  author?: string;
  slug?: string;
}

interface UpdateInput extends Partial<CreateInput> {}

@Injectable()
export class WebsiteContentService {
  constructor(
    @InjectModel(WebsiteContent.name)
    private model: Model<WebsiteContentDocument>,
  ) {}

  async list() {
    // The frontend renders results in reverse-chronological order, like the
    // original Supabase query did.
    const rows = await this.model.find().sort({ created_at: -1 }).lean();
    return rows.map((r) => this.serialize(r));
  }

  async create(body: CreateInput) {
    if (!ALLOWED_TYPES.includes(body.content_type as any)) {
      throw new BadRequestException(
        `content_type must be one of ${ALLOWED_TYPES.join(", ")}`,
      );
    }
    const doc = await this.model.create({
      content_type: body.content_type,
      title: (body.title ?? "").slice(0, 300),
      content: body.content ?? "",
      meta_description: (body.meta_description ?? "").slice(0, 500),
      is_published: !!body.is_published,
      order_index: Number.isFinite(Number(body.order_index))
        ? Number(body.order_index)
        : 0,
      author: (body.author ?? "").slice(0, 200),
      slug:
        body.slug ||
        (body.title || "").toLowerCase().trim().replace(/\s+/g, "-"),
    });
    return this.serialize(doc.toObject());
  }

  async update(id: string, updates: UpdateInput) {
    if (
      updates.content_type &&
      !ALLOWED_TYPES.includes(updates.content_type as any)
    ) {
      throw new BadRequestException(
        `content_type must be one of ${ALLOWED_TYPES.join(", ")}`,
      );
    }
    const allowed: any = {};
    for (const k of [
      "content_type",
      "title",
      "content",
      "meta_description",
      "is_published",
      "order_index",
      "author",
      "slug",
    ] as const) {
      if (updates[k] !== undefined) allowed[k] = (updates as any)[k];
    }
    const doc = await this.model
      .findByIdAndUpdate(id, allowed, { new: true })
      .lean();
    if (!doc) throw new NotFoundException("Content item not found");
    return this.serialize(doc as any);
  }

  async delete(id: string) {
    const res = await this.model.findByIdAndDelete(id).lean();
    if (!res) throw new NotFoundException("Content item not found");
    return { ok: true };
  }

  /**
   * Convert Mongo's `_id` to the `id` field the frontend expects (matches the
   * original Supabase shape) and pass through snake_case timestamps.
   */
  private serialize(doc: any) {
    return {
      id: String(doc._id),
      content_type: doc.content_type,
      title: doc.title || "",
      content: doc.content || "",
      meta_description: doc.meta_description || "",
      is_published: !!doc.is_published,
      order_index: doc.order_index ?? 0,
      author: doc.author || "",
      slug: doc.slug || "",
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    };
  }
}
