// Standalone image upload endpoint — POST /uploads/events. Doesn't exist
// anywhere else in eventsh today: every existing image upload is inline on
// events.controller.ts's create-event/update (FileFieldsInterceptor bundled
// with the rest of the form). A Phase-4 client with its own frontend (e.g.
// SingAdvisor's events-admin-client.ts's `uploadEventImage`) uploads an
// image as its own step — often before the event exists yet — then sends
// back just the resulting URL as part of the JSON event payload. Reuses the
// exact same storage/filename/filter as the inline uploads
// (events.controller.ts) so files land in the same place with the same
// naming, just reachable as their own call.
import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ThrottlerGuard } from "@nestjs/throttler";
import { diskStorage } from "multer";
import {
  generateFileName,
  imageFilter,
} from "../events/events.controller";
import { WebpValidationPipe } from "../../seed/parse-webp.pipe";
import { OrganizerOrApiKeyGuard } from "../organizers/guards/organizer-or-api-key.guard";

@Controller("uploads")
export class UploadsController {
  @Post("events")
  // Same auth as the write endpoints this feeds into (create-event/update):
  // existing browser JWT unchanged, or a Phase-4 API key. Not public — an
  // open upload endpoint is a disk-fill/abuse vector.
  @UseGuards(OrganizerOrApiKeyGuard, ThrottlerGuard)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/events",
        filename: generateFileName,
      }),
      fileFilter: imageFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadEventImage(
    @UploadedFile(WebpValidationPipe) file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return { url: `/uploads/events/${file.filename}` };
  }
}
