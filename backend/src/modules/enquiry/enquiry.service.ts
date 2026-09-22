import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateEnquiryDto } from "./dto/create-enquiry.dto";
import { UpdateEnquiryDto } from "./dto/update-enquiry.dto";
import { Enquiry, EnquiryDocument } from "./entities/enquiry.entity";
import { MailService } from "../roles/mail.service";
import { emailBrand } from "../../common/email/email-brand";
import {
  brandedEmail,
  details,
  escapeEmailHtml,
  heading,
  link,
  p,
  strong,
  subheading,
} from "../../common/email/email-layout";

@Injectable()
export class EnquiryService {
  constructor(
    @InjectModel(Enquiry.name) private enquiryModel: Model<EnquiryDocument>,
    private mailService: MailService
  ) {}

  async create(createEnquiryDto: CreateEnquiryDto) {
    try {
      const enquiry = new this.enquiryModel(createEnquiryDto);
      const savedEnquiry = await enquiry.save();

      // Send confirmation email to user
      await this.mailService.sendEnquiryConfirmationToUser({
        firstName: createEnquiryDto.firstName,
        emailId: createEnquiryDto.emailId,
        enquiryFor: createEnquiryDto.enquiryFor,
        organizationName: createEnquiryDto.organizationName,
      });

      // Send notification to admin
      // await this.sendAdminNotification(createEnquiryDto);

      return {
        success: true,
        message: "Enquiry submitted successfully. We will contact you soon.",
        data: savedEnquiry,
      };
    } catch (error) {
      throw new BadRequestException(
        "Failed to submit enquiry: " + error.message
      );
    }
  }

  async findAll() {
    try {
      const enquiries = await this.enquiryModel
        .find()
        .sort({ createdAt: -1 })
        .exec();
      return enquiries;
    } catch (error) {
      throw new BadRequestException(
        "Failed to fetch enquiries: " + error.message
      );
    }
  }

  async findOne(id: string) {
    try {
      const enquiry = await this.enquiryModel.findById(id).exec();
      if (!enquiry) {
        throw new NotFoundException(`Enquiry with ID ${id} not found`);
      }
      return enquiry;
    } catch (error) {
      throw new NotFoundException("Enquiry not found");
    }
  }

  async update(id: string, updateEnquiryDto: UpdateEnquiryDto) {
    try {
      const enquiry = await this.enquiryModel
        .findByIdAndUpdate(id, updateEnquiryDto, { new: true })
        .exec();

      if (!enquiry) {
        throw new NotFoundException(`Enquiry with ID ${id} not found`);
      }

      return {
        success: true,
        message: "Enquiry updated successfully",
        data: enquiry,
      };
    } catch (error) {
      throw new BadRequestException(
        "Failed to update enquiry: " + error.message
      );
    }
  }

  async remove(id: string) {
    try {
      const enquiry = await this.enquiryModel.findByIdAndDelete(id).exec();

      if (!enquiry) {
        throw new NotFoundException(`Enquiry with ID ${id} not found`);
      }

      return {
        success: true,
        message: "Enquiry deleted successfully",
        data: enquiry,
      };
    } catch (error) {
      throw new BadRequestException(
        "Failed to delete enquiry: " + error.message
      );
    }
  }

  async findByEmail(emailId: string) {
    try {
      const enquiries = await this.enquiryModel
        .find({ emailId })
        .sort({ createdAt: -1 })
        .exec();
      return enquiries;
    } catch (error) {
      throw new BadRequestException(
        "Failed to fetch enquiries: " + error.message
      );
    }
  }

  async findByEnquiryType(enquiryFor: string) {
    try {
      const enquiries = await this.enquiryModel
        .find({ enquiryFor })
        .sort({ createdAt: -1 })
        .exec();
      return enquiries;
    } catch (error) {
      throw new BadRequestException(
        "Failed to fetch enquiries: " + error.message
      );
    }
  }

  async getEnquiryStats() {
    try {
      const stats = await this.enquiryModel.aggregate([
        {
          $group: {
            _id: "$enquiryFor",
            count: { $sum: 1 },
          },
        },
      ]);

      const statusStats = await this.enquiryModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      return {
        enquiryTypeStats: stats,
        statusStats: statusStats,
        totalEnquiries: await this.enquiryModel.countDocuments(),
      };
    } catch (error) {
      throw new BadRequestException("Failed to fetch stats: " + error.message);
    }
  }

  // Both go through MailService, not the bare mailer, so they get the
  // instance's brand frame, the no-reply headers and the platform sender.
  private async sendConfirmationEmail(enquiry: CreateEnquiryDto) {
    try {
      const brand = emailBrand();
      const enquiryType = this.getEnquiryTypeLabel(enquiry.enquiryFor);
      await this.mailService.sendMail({
        to: enquiry.emailId,
        subject: `Enquiry Received - ${brand.name}`,
        html: brandedEmail({
          preheading: "Enquiry received",
          preview: `Your enquiry for ${enquiryType} has been received.`,
          body:
            heading(`Hi ${enquiry.firstName},`) +
            p(
              `Thank you for reaching out to ${strong(brand.name)} from ${strong(enquiry.organizationName)}.`
            ) +
            p(`Your enquiry for ${strong(enquiryType)} has been received successfully.`) +
            p(
              "Our team will review your requirements and get back to you as soon as possible with the next steps."
            ) +
            p(
              `If you need to share any additional details, you can send them through our ${link("contact page", brand.contactUrl)}.`
            ),
        }),
      });
    } catch (error) {
      console.error("Error sending confirmation email:", error);
    }
  }

  private async sendAdminNotification(enquiry: CreateEnquiryDto) {
    try {
      const submittedAt = new Date().toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });
      await this.mailService.sendMail({
        to: process.env.ADMIN_EMAIL || "hello@eventsh.com",
        subject: `New Enquiry from ${enquiry.firstName} ${enquiry.lastName}`,
        html: brandedEmail({
          preheading: "New enquiry",
          preview: `New enquiry from ${enquiry.firstName} ${enquiry.lastName}.`,
          body:
            heading("New Enquiry Received") +
            details([
              ["First name", escapeEmailHtml(enquiry.firstName)],
              ["Last name", escapeEmailHtml(enquiry.lastName)],
              ["Organization", escapeEmailHtml(enquiry.organizationName)],
              [
                "Enquiry for",
                escapeEmailHtml(this.getEnquiryTypeLabel(enquiry.enquiryFor)),
              ],
              ["Contact number", escapeEmailHtml(enquiry.contactNumber)],
              [
                "Email",
                enquiry.emailId &&
                  link(enquiry.emailId, `mailto:${enquiry.emailId}`),
              ],
              ["Submitted at", escapeEmailHtml(submittedAt)],
            ]) +
            (enquiry.message
              ? subheading("Message") +
                p(escapeEmailHtml(enquiry.message).replace(/\n/g, "<br />"))
              : ""),
        }),
      });
    } catch (error) {
      console.error("Error sending admin notification:", error);
    }
  }

  private getEnquiryTypeLabel(type: string): string {
    const labels = {
      events: "Events Management",
    };
    return labels[type] || type;
  }
}
