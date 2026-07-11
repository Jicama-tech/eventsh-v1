import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { EventsModule } from "./modules/events/events.module";
import { OrganizersModule } from "./modules/organizers/organizers.module";
// import { UploadsModule } from "./modules/uploads/uploads.module";
import { AdminModule } from "./modules/admin/admin.module";
import { RolesModule } from "./modules/roles/roles.module";
import { MailModule } from "./modules/roles/mail.module";
import { OtpModule } from "./modules/otp/otp.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { StallsModule } from "./modules/stalls/stalls.module";
import { PlansModule } from "./modules/plans/plans.module";
import { EnquiryModule } from "./modules/enquiry/enquiry.module";
import { OrganizerStoresModule } from "./modules/organizer-stores/organizer-stores.module";
import { CouponModule } from "./modules/coupon/coupon.module";
import { OperatorsModule } from "./modules/operators/operators.module";
import { SpeakerRequestsModule } from "./modules/speaker-requests/speaker-requests.module";
import { RoundTableBookingsModule } from "./modules/round-table-bookings/round-table-bookings.module";
import { AgentsModule } from "./modules/agents/agents.module";
import { ChatbotModule } from "./modules/chatbot/chatbot.module";
import { VenueDesignerModule } from "./modules/venue-designer/venue-designer.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ShopkeepersModule } from "./modules/shopkeepers/shopkeepers.module";
import { BulkImportModule } from "./modules/bulk-import/bulk-import.module";
import { TemplatesModule } from "./modules/templates/templates.module";
import { WebsiteContentModule } from "./modules/website-content/website-content.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { AppFeedbackModule } from "./modules/app-feedback/app-feedback.module";
import { PaymentFeedbackModule } from "./modules/payment-feedback/payment-feedback.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { BillingPaymentsModule } from "./modules/billing-payments/billing-payments.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { RsvpModule } from "./modules/rsvp/rsvp.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MailModule,
    MongooseModule.forRoot(
      process.env.MONGO_URI || "mongodb://127.0.0.1:27017/eventsh_dev",
      {
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
      },
    ),
    AuthModule,
    UsersModule,
    OtpModule,
    EventsModule,
    OrganizersModule,
    // UploadsModule,
    AdminModule,
    RolesModule,
    PaymentsModule,
    TicketsModule,
    StallsModule,
    PlansModule,
    SubscriptionsModule,
    BillingPaymentsModule,
    EnquiryModule,
    OrganizerStoresModule,
    CouponModule,
    OperatorsModule,
    SpeakerRequestsModule,
    RoundTableBookingsModule,
    AgentsModule,
    ChatbotModule,
    VenueDesignerModule,
    CategoriesModule,
    ShopkeepersModule,
    BulkImportModule,
    TemplatesModule,
    WebsiteContentModule,
    FeedbackModule,
    AppFeedbackModule,
    PaymentFeedbackModule,
    RsvpModule,
    MembershipsModule,
  ],
})
export class AppModule {}
