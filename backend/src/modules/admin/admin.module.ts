import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { AdminSchema } from "./entities/admin.entity";
import { MongooseModule } from "@nestjs/mongoose/dist";
import { JwtModule } from "@nestjs/jwt";
import { OrganizersModule } from "../organizers/organizers.module";
import { OrganizerSchema } from "../organizers/schemas/organizer.schema";
import { EventSchema } from "../events/schemas/event.schema";
import { UserSchema } from "../users/schemas/user.schema";
import { MailModule } from "../roles/mail.module";
import { MailService } from "../roles/mail.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: "Admin", schema: AdminSchema },
      { name: "Organizer", schema: OrganizerSchema },
      { name: "Event", schema: EventSchema },
      { name: "User", schema: UserSchema },
    ]),
    MailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, MailService],
})
export class AdminModule {}
