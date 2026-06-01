import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Event, EventDocument } from "./schemas/event.schema";
import { CreateEventDto } from "./dto/createEvent.dto";
import { UpdateEventDto } from "./dto/updateEvent.dto";
import { TemplatesService } from "../templates/templates.service";
import { OtpService } from "../otp/otp.service";

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    private readonly templatesService: TemplatesService,
    private readonly otpService: OtpService,
  ) {}

  // Email-OTP gate for volunteer sign-in on the scanner page. Two steps:
  //   1) sendVolunteerOtp: refuse early if the email isn't on the event's
  //      volunteer list, so we don't email random people OTP codes.
  //   2) verifyVolunteerOtp: confirm the OTP, then re-check the allow-list
  //      (the list could have changed between send and verify).
  // Uses the existing OtpService email channel under role="volunteer" to
  // namespace away from other email-OTP flows.
  async sendVolunteerOtp(eventId: string, email: string) {
    if (!email) {
      throw new BadRequestException("Email is required");
    }
    const event: any = await this.eventModel.findById(eventId).lean();
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    const normalized = email.trim().toLowerCase();
    const isVolunteer = (event.volunteers || []).some(
      (v: any) => (v.email || "").toLowerCase() === normalized,
    );
    if (!isVolunteer) {
      throw new ForbiddenException(
        "This email isn't on the volunteer list for this event.",
      );
    }
    await this.otpService.sendOtp(normalized, "volunteer");
    return { message: "OTP sent to your email" };
  }

  async verifyVolunteerOtp(eventId: string, email: string, otp: string) {
    if (!email || !otp) {
      throw new BadRequestException("Email and OTP are required");
    }
    const normalized = email.trim().toLowerCase();
    await this.otpService.verifyOtp(normalized, "volunteer", otp);
    const event: any = await this.eventModel.findById(eventId).lean();
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    const volunteer = (event.volunteers || []).find(
      (v: any) => (v.email || "").toLowerCase() === normalized,
    );
    if (!volunteer) {
      throw new ForbiddenException(
        "This email isn't on the volunteer list for this event.",
      );
    }
    return {
      volunteer: {
        name: volunteer.name,
        email: volunteer.email,
        phoneNumber: volunteer.phoneNumber,
      },
    };
  }

  async create(createEventDto: CreateEventDto): Promise<Event> {
    try {
      const startDate = new Date(createEventDto.startDate);
      const endDate = createEventDto.endDate
        ? new Date(createEventDto.endDate)
        : new Date(createEventDto.startDate);

      // Initial ticket capacity = sum of visitor-type caps when present,
      // otherwise the flat totalTickets. Stored in originalTotalTickets so the
      // front end can always show "available / original" — purchases later
      // decrement the live counts but never this baseline.
      const initialCapacity =
        Array.isArray(createEventDto.visitorTypes) &&
        createEventDto.visitorTypes.length > 0
          ? createEventDto.visitorTypes.reduce(
              (sum: number, v: any) => sum + (Number(v.maxCount) || 0),
              0,
            )
          : Number(createEventDto.totalTickets) || undefined;

      const event = new this.eventModel({
        title: createEventDto.title,
        description: createEventDto.description,
        category: createEventDto.category,
        startDate,
        time: createEventDto.time,
        endDate,
        endTime: createEventDto.endTime || "",
        organizer: createEventDto.organizerId,
        location: createEventDto.location,
        address: createEventDto.address,
        ticketPrice: createEventDto.ticketPrice,
        totalTickets: initialCapacity,
        originalTotalTickets: initialCapacity,
        visibility: createEventDto.visibility || "public",
        inviteLink: createEventDto.inviteLink,
        tags: createEventDto.tags || [],
        features: createEventDto.features || {
          food: false,
          parking: false,
          wifi: false,
          photography: false,
          security: false,
          accessibility: false,
        },
        ageRestriction: createEventDto.ageRestriction,
        dresscode: createEventDto.dresscode,
        specialInstructions: createEventDto.specialInstructions,
        refundPolicy: createEventDto.refundPolicy,
        termsAndConditions: createEventDto.termsAndConditions,
        setupTime: createEventDto.setupTime,
        breakdownTime: createEventDto.breakdownTime,
        socialMedia: createEventDto.socialMedia || {
          facebook: "",
          instagram: "",
          twitter: "",
          linkedin: "",
        },
        image: createEventDto.image,
        gallery: createEventDto.gallery || [],
        tableTemplates: createEventDto.tableTemplates || [],
        termsAndConditionsforStalls:
          createEventDto.termsAndConditionsforStalls || [],
        venueTables: createEventDto.venueTables || [],
        addOnItems: createEventDto.addOnItems || [],
        visitorTypes: createEventDto.visitorTypes || [],
        speakers: createEventDto.speakers || [],
        speakerSlotTemplates: createEventDto.speakerSlotTemplates || [],
        venueSpeakerZones: createEventDto.venueSpeakerZones || [],

        // IMPORTANT: venueConfig is now an ARRAY
        venueConfig:
          createEventDto.venueConfig && createEventDto.venueConfig.length > 0
            ? createEventDto.venueConfig
            : [
                {
                  venueConfigId: "venueConfig1",
                  width: 800,
                  height: 500,
                  scale: 0.75,
                  gridSize: 20,
                  showGrid: true,
                  hasMainStage: true,
                  totalRows: 3,
                },
              ],

        roundTableTemplates: createEventDto.roundTableTemplates || [],
        venueRoundTables: createEventDto.venueRoundTables || [],
        venueAnnotations: createEventDto.venueAnnotations || [],
        volunteers: (createEventDto.volunteers || []).map((v) => ({
          name: v.name,
          email: (v.email || "").toLowerCase(),
          phoneNumber: v.phoneNumber,
        })),

        status: createEventDto.status || "draft",
        featured: createEventDto.featured || false,
      });

      const savedEvent = await event.save();

      // Mirror this event's space configs into the templates collection so
      // they're available as picks when the organizer creates future events.
      // Fire-and-forget — never block the create on template capture.
      this.templatesService
        .captureSpaceTemplates(
          createEventDto.organizerId,
          createEventDto.tableTemplates,
        )
        .catch(() => {});

      return savedEvent;
    } catch (error) {
      throw { statusCode: 400, message: error.message || "Event creation failed", validationErrors: error.errors };
    }
  }

  async findAll(page = 1, limit = 50): Promise<{ events: Event[]; total: number }> {
    try {
      const skip = (page - 1) * limit;
      const [events, total] = await Promise.all([
        this.eventModel
          .find()
          .populate("organizer")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        this.eventModel.countDocuments().exec(),
      ]);
      return { events, total };
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Event> {
    try {
      const event = await this.eventModel
        .findById(id)
        .populate("organizer")
        .exec();

      if (!event) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return event;
    } catch (error) {
      console.error("Error finding event:", error);
      throw error;
    }
  }

  async findByOrganizer(
    organizerId: string,
  ): Promise<{ events: Event[]; total: number }> {
    try {
      const [events, total] = await Promise.all([
        this.eventModel
          .find({ organizer: organizerId })
          .populate("organizer")
          .sort({ createdAt: -1 })
          .exec(),
        this.eventModel.countDocuments({ organizer: organizerId }).exec(),
      ]);

      return { events, total };
    } catch (error) {
      console.error("Error fetching organizer events:", error);
      throw error;
    }
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    try {
      // Handle date conversions
      if (updateEventDto.startDate) {
        updateEventDto.startDate = new Date(updateEventDto.startDate) as any;
      }
      if (updateEventDto.endDate) {
        updateEventDto.endDate = new Date(updateEventDto.endDate) as any;
      } else if (updateEventDto.startDate) {
        updateEventDto.endDate = new Date(updateEventDto.startDate) as any;
      }

      // Normalize volunteer emails so the verifyVolunteer lookup matches.
      if (Array.isArray(updateEventDto.volunteers)) {
        updateEventDto.volunteers = updateEventDto.volunteers.map((v) => ({
          name: v.name,
          email: (v.email || "").toLowerCase(),
          phoneNumber: v.phoneNumber,
        }));
      }

      const updatedEvent = await this.eventModel
        .findByIdAndUpdate(id, updateEventDto, {
          new: true,
          runValidators: true,
        })
        .populate("organizer")
        .exec();

      if (!updatedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      // Capture any space templates touched by this update — covers both
      // newly added templates AND legacy events whose tableTemplates were
      // never previously stored in the templates collection.
      const orgId = (updatedEvent as any).organizer?._id || (updatedEvent as any).organizer;
      const tplSource =
        (updateEventDto as any)?.tableTemplates ??
        (updatedEvent as any)?.tableTemplates;
      this.templatesService
        .captureSpaceTemplates(orgId, tplSource)
        .catch(() => {});

      return updatedEvent;
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  }

  async remove(id: string): Promise<Event> {
    try {
      const deletedEvent = await this.eventModel
        .findByIdAndDelete(id)
        .populate("organizer")
        .exec();

      if (!deletedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return deletedEvent;
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<Event> {
    try {
      const updatedEvent = await this.eventModel
        .findByIdAndUpdate(id, { status }, { new: true })
        .populate("organizer")
        .exec();

      if (!updatedEvent) {
        throw new NotFoundException(`Event with ID ${id} not found`);
      }

      return updatedEvent;
    } catch (error) {
      console.error("Error updating event status:", error);
      throw error;
    }
  }

  async searchEvents(query: string): Promise<Event[]> {
    try {
      const searchRegex = new RegExp(query, "i");

      const events = await this.eventModel
        .find({
          $or: [
            { title: { $regex: searchRegex } },
            { description: { $regex: searchRegex } },
            { category: { $regex: searchRegex } },
            { location: { $regex: searchRegex } },
            { tags: { $in: [searchRegex] } },
          ],
        })
        .populate("organizer")
        .sort({ createdAt: -1 })
        .exec();

      return events;
    } catch (error) {
      console.error("Error searching events:", error);
      throw error;
    }
  }
}
