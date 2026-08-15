import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
import { DemoReadonlyGuard } from "./common/guards/demo-readonly.guard";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { EventsModule } from "./modules/events/events.module";
import { OrganizersModule } from "./modules/organizers/organizers.module";
import { UploadsModule } from "./modules/uploads/uploads.module";
import { AdminModule } from "./modules/admin/admin.module";
import { RolesModule } from "./modules/roles/roles.module";
import { MailModule } from "./modules/roles/mail.module";
import { OtpModule } from "./modules/otp/otp.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { StallsModule } from "./modules/stalls/stalls.module";
import { ScheduledSpacesModule } from "./modules/scheduled-spaces/scheduled-spaces.module";
import { PlansModule } from "./modules/plans/plans.module";
import { EnquiryModule } from "./modules/enquiry/enquiry.module";
import { OrganizerStoresModule } from "./modules/organizer-stores/organizer-stores.module";
import { CouponModule } from "./modules/coupon/coupon.module";
import { OperatorsModule } from "./modules/operators/operators.module";
import { SpeakerRequestsModule } from "./modules/speaker-requests/speaker-requests.module";
import { RoundTableBookingsModule } from "./modules/round-table-bookings/round-table-bookings.module";
import { WorkshopBookingsModule } from "./modules/workshop-bookings/workshop-bookings.module";
import { WorkshopRequestsModule } from "./modules/workshop-requests/workshop-requests.module";
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
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { FilesModule } from "./modules/files/files.module";
import { SponsorsModule } from "./modules/sponsors/sponsors.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { PlatformRegistryModule } from "./modules/platform-registry/platform-registry.module";
import { PlatformSyncModule } from "./modules/platform-sync/platform-sync.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // @nestjs/throttler was installed but never wired up anywhere in the
    // app. Registered here (module-level only — NOT as a global APP_GUARD,
    // so existing browser traffic patterns on the shared SaaS are
    // completely unaffected) so ThrottlerGuard can be applied explicitly to
    // the new Phase-4 API-key-reachable surface, where machine traffic
    // patterns differ from browser users. 60 requests / 60s per IP+route by
    // default; override per-route with @Throttle() if a specific endpoint
    // needs a different limit.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60000, limit: 60 }]),
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
    FilesModule,
    EventsModule,
    OrganizersModule,
    // Standalone POST /uploads/events (Phase 4 — see uploads.controller.ts).
    // The module used to be scaffolded and unused; this is a fresh
    // implementation, not a resurrection of old dead code.
    UploadsModule,
    AdminModule,
    RolesModule,
    PaymentsModule,
    TicketsModule,
    StallsModule,
    ScheduledSpacesModule,
    PlansModule,
    SubscriptionsModule,
    BillingPaymentsModule,
    EnquiryModule,
    OrganizerStoresModule,
    CouponModule,
    OperatorsModule,
    SpeakerRequestsModule,
    RoundTableBookingsModule,
    WorkshopBookingsModule,
    WorkshopRequestsModule,
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
    SuppliersModule,
    SponsorsModule,
    ExpensesModule,
    AnalyticsModule,
    PlatformRegistryModule,
    PlatformSyncModule,
  ],
  providers: [
    // Read-only demo sessions can never mutate real data via the API.
    { provide: APP_GUARD, useClass: DemoReadonlyGuard },
  ],
})
export class AppModule {}
