import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AppFeedback,
  AppFeedbackDocument,
} from "./schemas/app-feedback.schema";
import {
  SubmitAppFeedbackDto,
  SubmitSupportDto,
  UpdateAppFeedbackDto,
} from "./dto/app-feedback.dto";
import { OtpService } from "../otp/otp.service";

// In-process per-email cooldown for full submissions. The OtpService already
// throttles OTP requests; this protects the submit endpoint from a verified
// spammer hammering the form with new comments after a single OTP.
const SUBMIT_COOLDOWN_MS = 1000 * 60 * 60 * 24; // 24h per email

@Injectable()
export class AppFeedbackService {
  private readonly lastSubmit = new Map<string, number>();

  constructor(
    @InjectModel(AppFeedback.name)
    private readonly model: Model<AppFeedbackDocument>,
    private readonly otpService: OtpService,
  ) {}

  // Sends the email OTP used to verify the submitter before a feedback row
  // is written. Role "app_feedback" namespaces this away from the volunteer
  // and business-email OTP flows.
  async requestOtp(email: string) {
    if (!email) throw new BadRequestException("Email is required");
    await this.otpService.sendOtp(email.trim().toLowerCase(), "app_feedback");
    return { message: "OTP sent to your email" };
  }

  async submit(dto: SubmitAppFeedbackDto) {
    const email = dto.email.trim().toLowerCase();
    const lastAt = this.lastSubmit.get(email);
    if (lastAt && Date.now() - lastAt < SUBMIT_COOLDOWN_MS) {
      throw new BadRequestException(
        "You've already shared feedback recently. Try again later.",
      );
    }

    await this.otpService.verifyOtp(email, "app_feedback", dto.otp);

    const doc = await this.model.create({
      kind: "testimonial",
      name: dto.name.trim(),
      role: dto.role || "general",
      email,
      rating: dto.rating,
      comment: dto.comment.trim(),
      originalComment: dto.comment.trim(),
      city: dto.city?.trim() || undefined,
      featured: false,
      hidden: false,
    });
    this.lastSubmit.set(email, Date.now());
    return { ok: true, id: doc._id };
  }

  // Public — the carousel content. Excludes hidden + non-featured rows.
  // $ne filter on kind treats pre-existing rows (no kind field) as testimonials.
  async getFeatured() {
    const rows = await this.model
      .find({ featured: true, hidden: false, kind: { $ne: "support" } })
      .sort({ featuredOrder: 1, createdAt: -1 })
      .select("name role rating comment city createdAt")
      .lean();
    return { items: rows };
  }

  // Public — the "by the numbers" hero stat. Counts all non-hidden rows
  // (not only featured) so the aggregate reflects real volume.
  async getStats() {
    const rows = await this.model
      .find({ hidden: false, kind: { $ne: "support" } })
      .select("rating")
      .lean();
    const count = rows.length;
    const avg =
      count > 0
        ? Number(
            (rows.reduce((s, r) => s + r.rating, 0) / count).toFixed(2),
          )
        : 0;
    return { count, avg };
  }

  // Super-admin — full list with filter chips driving the curation tab.
  // The "support" filter surfaces organizer-submitted support tickets (a
  // separate `kind` in the same collection); all other filters operate on
  // testimonials only.
  async listAll(
    filter: "all" | "pending" | "featured" | "hidden" | "support" = "pending",
  ) {
    const q: any =
      filter === "support" ? { kind: "support" } : { kind: { $ne: "support" } };
    if (filter === "pending") {
      q.featured = false;
      q.hidden = false;
    } else if (filter === "featured") {
      q.featured = true;
      q.hidden = false;
    } else if (filter === "hidden") {
      q.hidden = true;
    }
    const rows = await this.model.find(q).sort({ createdAt: -1 }).lean();
    return { items: rows };
  }

  // ── Support tickets ────────────────────────────────────────────────────

  // Organizer submits a support ticket from the dashboard. JWT already
  // authenticated them, so no OTP. We stamp identity from the token rather
  // than trusting any client-supplied name/email.
  async submitSupport(args: {
    userId?: string;
    email?: string;
    name?: string;
    dto: SubmitSupportDto;
    attachmentUrls: string[];
  }) {
    const { userId, email, name, dto, attachmentUrls } = args;
    const doc = await this.model.create({
      kind: "support",
      // Body is required on the schema; description carries the support detail.
      name: (name || email || "Organizer").trim(),
      role: "organizer",
      email: email?.trim().toLowerCase(),
      rating: 0,
      comment: dto.description.trim(),
      originalComment: dto.description.trim(),
      subject: dto.subject.trim(),
      category: dto.category,
      status: "open",
      attachments: attachmentUrls,
      submittedByUserId: userId as any,
      featured: false,
      hidden: false,
    });
    return { ok: true, id: doc._id };
  }

  // Lists the support tickets the calling organizer submitted, newest first.
  async listMySupport(userId: string) {
    const rows = await this.model
      .find({ kind: "support", submittedByUserId: userId as any })
      .sort({ createdAt: -1 })
      .select("subject category status attachments comment createdAt updatedAt")
      .lean();
    return { items: rows };
  }

  async update(id: string, patch: UpdateAppFeedbackDto, approverId?: string) {
    const existing = await this.model.findById(id);
    if (!existing) throw new NotFoundException("Feedback not found");

    if (patch.featured !== undefined) {
      existing.featured = patch.featured;
      if (patch.featured) {
        existing.approvedBy = approverId as any;
        existing.approvedAt = new Date();
      }
    }
    if (patch.featuredOrder !== undefined) {
      existing.featuredOrder = patch.featuredOrder;
    }
    if (patch.hidden !== undefined) {
      existing.hidden = patch.hidden;
      if (patch.hidden) {
        existing.featured = false; // hidden ⇒ remove from carousel
      }
    }
    if (patch.comment !== undefined) {
      existing.comment = patch.comment.trim();
    }
    if (patch.name !== undefined) {
      existing.name = patch.name.trim();
    }
    await existing.save();
    return existing.toObject();
  }

  async remove(id: string) {
    const res = await this.model.findByIdAndDelete(id);
    if (!res) throw new NotFoundException("Feedback not found");
    return { ok: true };
  }
}
