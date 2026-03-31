import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Req,
  ParseIntPipe,
  ValidationPipe,
} from "@nestjs/common";
import {
  FileInterceptor,
  FilesInterceptor,
  FileFieldsInterceptor,
} from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { AuthGuard } from "@nestjs/passport";
import { EventsService } from "./events.service";
import { CreateEventDto } from "./dto/createEvent.dto";
import { UpdateEventDto } from "./dto/updateEvent.dto";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";
import { WebpValidationPipe } from "../../seed/parse-webp.pipe";

function generateFileName(req: any, file: any, cb: any) {
  const ext = path.extname(file.originalname);
  const filename = `${uuidv4()}${ext}`;
  cb(null, filename);
}

const imageFilter = (req: any, file: any, cb: any) => {
  if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
    cb(new Error("Only image files are allowed!"), false);
  } else {
    cb(null, true);
  }
};

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post("create-event")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "banner", maxCount: 1 },
        { name: "gallery", maxCount: 5 },
        { name: "addOnImages", maxCount: 100 },
        { name: "speakerImages", maxCount: 20 },
      ],
      {
        storage: diskStorage({
          destination: "./uploads/events",
          filename: generateFileName,
        }),
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
      },
    ),
  )
  async createEvent(
    @UploadedFiles(WebpValidationPipe)
    files: {
      banner?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
      addOnImages?: Express.Multer.File[];
      speakerImages?: Express.Multer.File[];
    },
    @Body() body: any,
    @Req() req: any,
  ) {
    try {
      // Extract organizer ID from JWT token
      body.organizerId = req.user.userId || req.user.sub || body.organizerId;

      // Parse JSON strings from FormData
      if (typeof body.tags === "string") body.tags = JSON.parse(body.tags);
      if (typeof body.features === "string")
        body.features = JSON.parse(body.features);
      if (typeof body.socialMedia === "string")
        body.socialMedia = JSON.parse(body.socialMedia);
      if (typeof body.tableTemplates === "string")
        body.tableTemplates = JSON.parse(body.tableTemplates);
      if (typeof body.venueTables === "string")
        body.venueTables = JSON.parse(body.venueTables);
      if (typeof body.addOnItems === "string")
        body.addOnItems = JSON.parse(body.addOnItems);
      if (typeof body.venueConfig === "string")
        body.venueConfig = JSON.parse(body.venueConfig);

      if (typeof body.termsAndConditionsforStalls === "string")
        body.termsAndConditionsforStalls = JSON.parse(
          body.termsAndConditionsforStalls,
        );
      if (typeof body.visitorTypes === "string")
        body.visitorTypes = JSON.parse(body.visitorTypes);
      if (typeof body.speakers === "string")
        body.speakers = JSON.parse(body.speakers);
      if (typeof body.speakerSlotTemplates === "string")
        body.speakerSlotTemplates = JSON.parse(body.speakerSlotTemplates);
      if (typeof body.venueSpeakerZones === "string")
        body.venueSpeakerZones = JSON.parse(body.venueSpeakerZones);
      if (typeof body.roundTableTemplates === "string")
        body.roundTableTemplates = JSON.parse(body.roundTableTemplates);
      if (typeof body.venueRoundTables === "string")
        body.venueRoundTables = JSON.parse(body.venueRoundTables);

      // Handle banner image
      if (files.banner && files.banner[0]) {
        body.image = `/uploads/events/${files.banner[0].filename}`;
      }

      // Handle gallery images
      if (files.gallery && files.gallery.length > 0) {
        body.gallery = files.gallery.map(
          (file) => `/uploads/events/${file.filename}`,
        );
      }

      if (
        files.addOnImages &&
        files.addOnImages.length > 0 &&
        Array.isArray(body.addOnItems)
      ) {
        let imageIndex = 0;

        body.addOnItems = body.addOnItems.map((addon) => {
          if (addon.hasNewImage && imageIndex < files.addOnImages.length) {
            addon.image = `/uploads/events/${files.addOnImages[imageIndex].filename}`;
            imageIndex++;
          }
          return addon;
        });
      }

      // Handle speaker images
      if (
        files.speakerImages &&
        files.speakerImages.length > 0 &&
        Array.isArray(body.speakers)
      ) {
        let imgIdx = 0;
        body.speakers = body.speakers.map((speaker) => {
          if (speaker.hasNewImage && imgIdx < files.speakerImages.length) {
            speaker.image = `/uploads/events/${files.speakerImages[imgIdx].filename}`;
            imgIdx++;
          }
          delete speaker.hasNewImage;
          return speaker;
        });
      }

      const event = await this.eventsService.create(body);

      return {
        success: true,
        message: "Event created successfully",
        data: event,
      };
    } catch (error) {
      throw error;
    }
  }

  @Get("get-events")
  async getAllEvents(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    try {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.min(100, Math.max(1, parseInt(limit) || 50));
      const result = await this.eventsService.findAll(p, l);
      return {
        success: true,
        message: "Events retrieved successfully",
        data: result.events,
        pagination: { total: result.total, page: p, limit: l },
      };
    } catch (error) {
      console.error("Error in getAllEvents:", error);
      throw error;
    }
  }

  @Get("search")
  async searchEvents(@Query("q") query: string) {
    try {
      const events = await this.eventsService.searchEvents(query);
      return {
        success: true,
        message: "Events searched successfully",
        data: events,
      };
    } catch (error) {
      console.error("Error in searchEvents:", error);
      throw error;
    }
  }

  @Get("organizer/:organizerId")
  async getEventsByOrganizer(@Param("organizerId") organizerId: string) {
    try {
      const result = await this.eventsService.findByOrganizer(organizerId);
      return {
        success: true,
        message: "Organizer events retrieved successfully",
        data: result.events,
        pagination: {
          total: result.total,
        },
      };
    } catch (error) {
      console.error("Error in getEventsByOrganizer:", error);
      throw error;
    }
  }

  @Get(":id")
  async getEventById(@Param("id") id: string) {
    try {
      const event = await this.eventsService.findById(id);
      return {
        success: true,
        message: "Event retrieved successfully",
        data: event,
      };
    } catch (error) {
      console.error("Error in getEventById:", error);
      throw error;
    }
  }

  @Put(":id")
  @UseGuards(AuthGuard("jwt"))
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "banner", maxCount: 1 },
        { name: "gallery", maxCount: 5 },
        { name: "addOnImages", maxCount: 100 },
        { name: "speakerImages", maxCount: 20 },
      ],
      {
        storage: diskStorage({
          destination: "./uploads/events",
          filename: generateFileName,
        }),
        fileFilter: imageFilter,
        limits: { fileSize: 5 * 1024 * 1024 },
      },
    ),
  )
  async updateEvent(
    @Param("id") id: string,
    @UploadedFiles(WebpValidationPipe)
    files: {
      banner?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
      addOnImages?: Express.Multer.File[];
      speakerImages?: Express.Multer.File[];
    },
    @Body() body: any,
    @Req() req: any,
  ) {
    try {
      // Parse JSON strings from FormData
      if (typeof body.tags === "string") body.tags = JSON.parse(body.tags);
      if (typeof body.features === "string")
        body.features = JSON.parse(body.features);
      if (typeof body.socialMedia === "string")
        body.socialMedia = JSON.parse(body.socialMedia);
      if (typeof body.tableTemplates === "string")
        body.tableTemplates = JSON.parse(body.tableTemplates);
      if (typeof body.venueTables === "string")
        body.venueTables = JSON.parse(body.venueTables);
      if (typeof body.addOnItems === "string")
        body.addOnItems = JSON.parse(body.addOnItems);
      if (typeof body.venueConfig === "string")
        body.venueConfig = JSON.parse(body.venueConfig);

      if (typeof body.termsAndConditionsforStalls === "string")
        body.termsAndConditionsforStalls = JSON.parse(
          body.termsAndConditionsforStalls,
        );
      if (typeof body.visitorTypes === "string")
        body.visitorTypes = JSON.parse(body.visitorTypes);
      if (typeof body.speakers === "string")
        body.speakers = JSON.parse(body.speakers);
      if (typeof body.speakerSlotTemplates === "string")
        body.speakerSlotTemplates = JSON.parse(body.speakerSlotTemplates);
      if (typeof body.venueSpeakerZones === "string")
        body.venueSpeakerZones = JSON.parse(body.venueSpeakerZones);
      if (typeof body.roundTableTemplates === "string")
        body.roundTableTemplates = JSON.parse(body.roundTableTemplates);
      if (typeof body.venueRoundTables === "string")
        body.venueRoundTables = JSON.parse(body.venueRoundTables);

      // Handle new banner image
      if (files.banner && files.banner[0]) {
        body.image = `/uploads/events/${files.banner[0].filename}`;
      }

      // Handle new gallery images
      if (files.gallery && files.gallery.length > 0) {
        body.gallery = files.gallery.map(
          (file) => `/uploads/events/${file.filename}`,
        );
      }

      // 3. Handle Add-On Images (Mapping new files to correct items)
      if (
        files.addOnImages &&
        files.addOnImages.length > 0 &&
        Array.isArray(body.addOnItems)
      ) {
        let imageIndex = 0;

        body.addOnItems = body.addOnItems.map((addon) => {
          // If frontend says a new image was uploaded for this item
          if (addon.hasNewImage && imageIndex < files.addOnImages.length) {
            addon.image = `/uploads/events/${files.addOnImages[imageIndex].filename}`;
            imageIndex++;
          }
          // Remove the helper flag before saving to DB
          delete addon.hasNewImage;
          return addon;
        });
      }

      // Handle speaker images
      if (
        files.speakerImages &&
        files.speakerImages.length > 0 &&
        Array.isArray(body.speakers)
      ) {
        let imgIdx = 0;
        body.speakers = body.speakers.map((speaker) => {
          if (speaker.hasNewImage && imgIdx < files.speakerImages.length) {
            speaker.image = `/uploads/events/${files.speakerImages[imgIdx].filename}`;
            imgIdx++;
          }
          delete speaker.hasNewImage;
          return speaker;
        });
      }

      const event = await this.eventsService.update(id, body);

      return {
        success: true,
        message: "Event updated successfully",
        data: event,
      };
    } catch (error) {
      console.error("Error in updateEvent:", error);
      throw error;
    }
  }

  @Put(":id/status")
  @UseGuards(AuthGuard("jwt"))
  async updateEventStatus(
    @Param("id") id: string,
    @Body("status") status: string,
  ) {
    try {
      const event = await this.eventsService.updateStatus(id, status);
      return {
        success: true,
        message: "Event status updated successfully",
        data: event,
      };
    } catch (error) {
      console.error("Error in updateEventStatus:", error);
      throw error;
    }
  }

  @Delete(":id")
  @UseGuards(AuthGuard("jwt"))
  async deleteEvent(@Param("id") id: string, @Req() req: any) {
    try {
      const event = await this.eventsService.remove(id);
      return {
        success: true,
        message: "Event deleted successfully",
        data: event,
      };
    } catch (error) {
      console.error("Error in deleteEvent:", error);
      throw error;
    }
  }
}
