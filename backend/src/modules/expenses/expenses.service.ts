import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import {
  EventExpense,
  EventExpenseDocument,
} from "./entities/event-expense.entity";
import { CreateExpenseDto } from "./dto/create-expense.dto";

/** Shape the JWT strategy puts on `req.user`. */
export interface JwtActor {
  userId?: string;
  name?: string;
  email?: string;
  roles?: string[];
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(EventExpense.name)
    private expenseModel: Model<EventExpenseDocument>,
    @InjectModel("Event") private eventModel: Model<any>,
    // Resolves whether an operator has been granted approval rights.
    @InjectModel("Operator") private operatorModel: Model<any>,
    // Currency for the amounts shown against an event.
    @InjectModel("Organizer") private organizerModel: Model<any>,
  ) {}

  private assertId(id: string, label = "id") {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
  }

  /**
   * Pick a human label for the caller from their token roles. Display only —
   * the id and email are what actually identify them.
   */
  private roleLabel(roles: string[]): string {
    const r = (roles || []).map((x) => String(x).toLowerCase());
    if (r.includes("operator")) return "operator";
    if (r.includes("admin")) return "admin";
    if (r.includes("organizer")) return "organizer";
    return r[0] || "organizer";
  }

  async create(dto: CreateExpenseDto, actor: JwtActor, receiptPath?: string) {
    this.assertId(dto.eventId, "eventId");

    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException("Enter an amount greater than zero.");
    }

    // The owning organizer comes from the event, never the client.
    const event = await this.eventModel
      .findById(dto.eventId)
      .select("organizer")
      .lean();
    if (!event) throw new NotFoundException("Event not found");
    const organizerId = (event as any).organizer;
    if (!organizerId) {
      throw new BadRequestException("This event has no organizer attached.");
    }

    const created = await this.expenseModel.create({
      eventId: new Types.ObjectId(dto.eventId),
      organizerId: new Types.ObjectId(String(organizerId)),
      title: dto.title.trim(),
      category: dto.category || "Other",
      amount,
      spentAt: dto.spentAt ? new Date(dto.spentAt) : new Date(),
      paidTo: dto.paidTo || "",
      notes: dto.notes || "",
      receipt: receiptPath || "",
      // Attribution comes from the verified token, so the row always says who
      // actually logged it.
      recordedById: actor?.userId || "",
      recordedBy: actor?.name || actor?.email || "",
      recordedByEmail: actor?.email || "",
      recordedByRole: this.roleLabel(actor?.roles || []),
      recordedByRoles: actor?.roles || [],
    });
    return { message: "Expense recorded", data: created };
  }

  /**
   * Every logged expense for an event, newest spend first, with the totals and
   * the organizer's currency so amounts render in the same units as the rest
   * of the app rather than defaulting.
   */
  async listByEvent(eventId: string) {
    this.assertId(eventId, "eventId");
    const rows = await this.expenseModel
      .find({ eventId: new Types.ObjectId(eventId) })
      .sort({ spentAt: -1 })
      .lean();

    // Currency follows the organizer's country (SG → SG$, else ₹).
    let currency = "IN";
    try {
      const event: any = await this.eventModel
        .findById(eventId)
        .select("organizer")
        .lean();
      if (event?.organizer) {
        const org: any = await this.organizerModel
          .findById(event.organizer)
          .select("country")
          .lean();
        currency = org?.country || "IN";
      }
    } catch {
      // Fall back to the default rather than failing the list.
    }
    const approved = rows.filter((r: any) => r.status === "Approved");
    const total = approved.reduce((s, r: any) => s + (Number(r.amount) || 0), 0);
    const pendingTotal = rows
      .filter((r: any) => r.status === "Pending")
      .reduce((s, r: any) => s + (Number(r.amount) || 0), 0);

    // Grouped for the P&L breakdown.
    const byCategory = new Map<string, number>();
    for (const r of approved as any[]) {
      const k = r.category || "Other";
      byCategory.set(k, (byCategory.get(k) || 0) + (Number(r.amount) || 0));
    }

    return {
      data: rows,
      total,
      pendingTotal,
      currency,
      byCategory: [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([category, amount]) => ({ category, amount })),
    };
  }

  /**
   * Who may sign off spend on this event: the organizer themselves, or an
   * operator they've granted `canApproveExpenses` to.
   *
   * The caller is identified from their token, so an operator can't approve
   * by pretending to be the organizer.
   */
  private async assertCanApprove(expense: any, actor: JwtActor) {
    const actorId = String(actor?.userId || "");
    if (!actorId) throw new ForbiddenException("Sign in to approve expenses.");

    // The organizer who owns the event.
    if (actorId === String(expense.organizerId)) return "organizer";

    const operator = await this.operatorModel
      .findOne({ _id: actorId })
      .select("organizerId canApproveExpenses")
      .lean();
    if (
      operator &&
      String((operator as any).organizerId) === String(expense.organizerId) &&
      (operator as any).canApproveExpenses
    ) {
      return "operator";
    }

    throw new ForbiddenException(
      "You don't have permission to approve expenses for this event.",
    );
  }

  /** Approve or reject a logged expense. */
  async decide(
    id: string,
    approve: boolean,
    actor: JwtActor,
    reason?: string,
  ) {
    this.assertId(id);
    const expense = await this.expenseModel.findById(id);
    if (!expense) throw new NotFoundException("Expense not found");
    if (expense.status !== "Pending") {
      throw new BadRequestException(
        `This expense has already been ${expense.status.toLowerCase()}.`,
      );
    }
    const role = await this.assertCanApprove(expense, actor);

    expense.status = approve ? "Approved" : "Rejected";
    expense.approvedById = String(actor.userId || "");
    expense.approvedBy = actor.name || actor.email || "";
    expense.approvedByRole = role;
    expense.decidedAt = new Date();
    expense.rejectionReason = approve ? "" : reason || "";
    await expense.save();

    return {
      message: approve ? "Expense approved" : "Expense rejected",
      data: expense,
    };
  }

  async remove(id: string) {
    this.assertId(id);
    const res = await this.expenseModel.deleteOne({
      _id: new Types.ObjectId(id),
    });
    if (res.deletedCount === 0) throw new NotFoundException("Expense not found");
    return { message: "Expense removed" };
  }
}
