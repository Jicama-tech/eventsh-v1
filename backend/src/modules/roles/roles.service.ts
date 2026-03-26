import { Injectable, NotFoundException } from "@nestjs/common";
import { OrganizersService } from "../organizers/organizers.service";
import { RegistrationService } from "../roles/registration.service";
import { MailService } from "../roles/mail.service";

@Injectable()
export class RoleService {
  constructor(
    private readonly organizerService: OrganizersService,
    private readonly registrationService: RegistrationService,
    private readonly mailService: MailService,
  ) {}

  // Check if user already has this role and handle accordingly
  async checkRoleAvailability(
    email: string,
    name: string,
    role: "organizer",
  ) {
    if (role === "organizer") {
      const organizer = await this.organizerService.findByEmail(email);
      if (organizer) {
        return {
          found: true,
          message: "Organizer found. Please use password login.",
          data: { email, role: "organizer" },
        };
      }
    }

    // User not found - proceed with registration
    return {
      found: false,
      message: `${role} not found. Please complete registration.`,
      user: { name, email, role },
    };
  }

  async checkRoleAvailability1(
    email: string,
    name: string,
    role: "organizer",
  ) {
    if (role === "organizer") {
      const organizer = await this.organizerService.findByEmail(email);
      if (organizer) {
        try {
          return {
            found: true,
            message: "Organizer found. OTP sent to your registered email.",
            data: {
              email,
              role: "organizer",
            },
          };
        } catch (error) {
          return {
            found: true,
            message:
              "Organizer found but failed to send OTP. Please try again.",
            error: error.message,
            data: { email, role: "organizer" },
          };
        }
      }
    }

    // User not found - proceed with registration
    return {
      found: false,
      message: `${role} not found. Please complete registration.`,
      user: { name, email, role },
    };
  }

  // Register the new role and send emails
  async registerRole(
    name: string,
    email: string,
    password: string,
    role: "organizer",
  ) {
    try {
      // Create pending registration
      const registration = await this.registrationService.createRegistration({
        name,
        email,
        password,
        role,
      });

      // Send admin approval email
      await this.mailService.sendApprovalRequestToAdmin({
        name,
        email,
        role,
      });

      // Send confirmation email to user
      await this.mailService.sendConfirmationToUser({
        name,
        email,
        role,
      });

      return {
        success: true,
        message: `${role} registration submitted successfully. Please wait for admin approval.`,
        data: {
          name,
          email,
          role,
          status: "pending_approval",
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to register ${role}. Please try again.`,
        error: error.message,
      };
    }
  }

  // Combined method for handling both check and action
  async handleRoleRequest(
    email: string,
    name: string,
    password: string,
    role: "organizer",
  ) {
    // First check if user exists
    const availabilityResult = await this.checkRoleAvailability(
      email,
      name,
      role,
    );

    if (availabilityResult.found) {
      return {
        action: "login_required",
        message: availabilityResult.message,
        data: availabilityResult.data,
      };
    } else {
      // User not found - proceed with registration
      const registrationResult = await this.registerRole(
        name,
        email,
        password,
        role,
      );
      return {
        action: "registration_submitted",
        message: registrationResult.message,
        success: registrationResult.success,
        data: registrationResult.data,
      };
    }
  }
}
