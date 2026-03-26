import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ConfigModule } from "@nestjs/config";
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
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
    EnquiryModule,
    OrganizerStoresModule,
    CouponModule,
    OperatorsModule,
    SpeakerRequestsModule,
  ],
})
export class AppModule {}
