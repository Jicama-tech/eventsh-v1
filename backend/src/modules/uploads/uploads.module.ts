import { forwardRef, Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller";
import { OrganizersModule } from "../organizers/organizers.module";

@Module({
  imports: [
    // OrganizersModule exports the Organizer model (needed by
    // OrganizerOrApiKeyGuard) and the guard itself.
    forwardRef(() => OrganizersModule),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
