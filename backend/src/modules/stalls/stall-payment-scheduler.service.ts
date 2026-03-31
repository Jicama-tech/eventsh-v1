import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Stall, StallDocument, StallStatusEnum } from "./entities/stall.entity";
import { OtpService } from "../otp/otp.service";

@Injectable()
export class StallPaymentSchedulerService {
  private readonly logger = new Logger(StallPaymentSchedulerService.name);

  constructor(
    @InjectModel(Stall.name)
    private readonly stallModel: Model<StallDocument>,
    @InjectModel("Event") private readonly eventModel: Model<any>,
    private readonly otpService: OtpService,
  ) {}

  /**
   * Runs daily at 9 AM — checks all stalls with partial payment
   * - 45 days before event → reminder (you have 15 days left)
   * - 30 days before event → forfeit payment, release tables
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handlePaymentRemindersAndForfeits() {
    this.logger.log("Running stall payment reminder/forfeit check...");

    try {
      // Find all stalls with partial payment that are in Processing status
      const partialStalls = await this.stallModel
        .find({
          paymentStatus: "Partial",
          status: { $in: ["Processing", "Confirmed"] },
        })
        .populate("shopkeeperId")
        .populate("eventId")
        .populate("organizerId");

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      for (const stall of partialStalls) {
        const event = stall.eventId as any;
        if (!event?.startDate) continue;

        const eventDate = new Date(event.startDate);
        eventDate.setHours(0, 0, 0, 0);
        const daysUntilEvent = Math.ceil(
          (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        const vendor = stall.shopkeeperId as any;
        const whatsApp =
          vendor?.whatsAppNumber || vendor?.whatsappNumber || vendor?.phone;

        if (daysUntilEvent <= 30) {
          // FORFEIT — 30 days or less, payment not completed
          await this.forfeitStall(stall, event, whatsApp);
        } else if (daysUntilEvent <= 45 && daysUntilEvent > 30) {
          // REMINDER — between 45 and 30 days
          await this.sendPaymentReminder(stall, event, whatsApp, daysUntilEvent);
        }
      }

      this.logger.log(
        `Checked ${partialStalls.length} stalls with partial payment`,
      );
    } catch (error) {
      this.logger.error("Error in payment scheduler:", error);
    }
  }

  private async sendPaymentReminder(
    stall: any,
    event: any,
    whatsApp: string,
    daysLeft: number,
  ) {
    if (!whatsApp) return;

    try {
      const vendor = stall.shopkeeperId as any;
      const message =
        `*Payment Reminder — ${event.title}*\n\n` +
        `Hi ${vendor?.name || "Exhibitor"},\n\n` +
        `Your stall booking for *${event.title}* has a remaining payment of *${stall.remainingAmount}*.\n\n` +
        `The event is in *${daysLeft} days*. Please complete your payment within *${daysLeft - 30} days* to avoid forfeiture.\n\n` +
        `If payment is not received by 30 days before the event, your booking will be cancelled and the partial payment will be forfeited.\n\n` +
        `Table(s): ${stall.selectedTables?.map((t: any) => t.tableName).join(", ") || "—"}\n` +
        `Paid: ${stall.paidAmount} | Remaining: ${stall.remainingAmount}`;

      await this.otpService.sendWhatsAppMessage(whatsApp, message);

      // Track that reminder was sent
      stall.statusHistory.push({
        status: stall.status,
        note: `Payment reminder sent — ${daysLeft} days to event`,
        changedAt: new Date(),
        changedBy: "System",
      });
      await stall.save();

      this.logger.log(
        `Payment reminder sent to ${vendor?.name} for stall ${stall._id}`,
      );
    } catch (error) {
      this.logger.warn(`Failed to send reminder for stall ${stall._id}`, error);
    }
  }

  private async forfeitStall(stall: any, event: any, whatsApp: string) {
    try {
      const vendor = stall.shopkeeperId as any;
      const tableNames =
        stall.selectedTables?.map((t: any) => t.tableName).join(", ") || "—";

      // 1. Release the booked tables back to available
      if (stall.selectedTables?.length > 0 && event._id) {
        const eventDoc = await this.eventModel.findById(event._id);
        if (eventDoc?.venueTables) {
          const bookedPositionIds = stall.selectedTables.map(
            (t: any) => t.positionId,
          );

          // venueTables can be array or object keyed by layoutId
          if (Array.isArray(eventDoc.venueTables)) {
            eventDoc.venueTables = eventDoc.venueTables.map((t: any) => {
              if (bookedPositionIds.includes(t.positionId)) {
                return { ...t, isBooked: false, bookedBy: null };
              }
              return t;
            });
          } else {
            // Object format: { layoutId: [...tables] }
            for (const layoutId of Object.keys(eventDoc.venueTables)) {
              eventDoc.venueTables[layoutId] = eventDoc.venueTables[
                layoutId
              ].map((t: any) => {
                if (bookedPositionIds.includes(t.positionId)) {
                  return { ...t, isBooked: false, bookedBy: null };
                }
                return t;
              });
            }
          }

          eventDoc.markModified("venueTables");
          await eventDoc.save();
          this.logger.log(
            `Released ${bookedPositionIds.length} table(s) for stall ${stall._id}`,
          );
        }
      }

      // 2. Update stall status to Forfeited
      stall.status = StallStatusEnum.Forfeited;
      stall.paymentStatus = "Partial"; // keep as partial to show they lost money
      stall.statusHistory.push({
        status: StallStatusEnum.Forfeited,
        note: `Payment forfeited. Paid amount ${stall.paidAmount} not refunded. Tables released.`,
        changedAt: new Date(),
        changedBy: "System",
      });
      await stall.save();

      // 3. Send WhatsApp notification to vendor
      if (whatsApp) {
        try {
          const message =
            `*Stall Booking Forfeited — ${event.title}*\n\n` +
            `Hi ${vendor?.name || "Exhibitor"},\n\n` +
            `Your stall booking for *${event.title}* has been *forfeited* because the remaining payment was not completed within the required timeframe.\n\n` +
            `*Forfeited Amount:* ${stall.paidAmount}\n` +
            `*Released Tables:* ${tableNames}\n\n` +
            `The partial payment of ${stall.paidAmount} is non-refundable as per the booking terms.\n\n` +
            `If you believe this is an error, please contact the organizer immediately.`;

          await this.otpService.sendWhatsAppMessage(whatsApp, message);
        } catch {
          this.logger.warn("Failed to send forfeit WhatsApp notification");
        }
      }

      // 4. Notify organizer
      try {
        const organizer = stall.organizerId as any;
        const orgPhone = organizer?.whatsAppNumber || organizer?.phone;
        if (orgPhone) {
          await this.otpService.sendWhatsAppMessage(
            orgPhone,
            `*Stall Forfeited — ${event.title}*\n\n` +
              `Exhibitor: ${vendor?.name || "—"}\n` +
              `Tables released: ${tableNames}\n` +
              `Forfeited amount: ${stall.paidAmount}\n\n` +
              `These tables are now available for re-booking.`,
          );
        }
      } catch {
        this.logger.warn("Failed to notify organizer about forfeit");
      }

      this.logger.log(
        `Stall ${stall._id} forfeited — tables released, vendor notified`,
      );
    } catch (error) {
      this.logger.error(`Failed to forfeit stall ${stall._id}:`, error);
    }
  }
}
