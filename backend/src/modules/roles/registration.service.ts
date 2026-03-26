import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as bcrypt from "bcrypt";

import { Organizer } from "../organizers/schemas/organizer.schema";
import { MailService } from "./mail.service";

@Injectable()
export class RegistrationService {
  constructor(
    @InjectModel("Organizer") private organizerModel: Model<Organizer>,
    private readonly mailService: MailService
  ) {}

  async createRegistration(data: {
    name: string;
    email: string;
    password: string;
    role: "organizer";
  }) {
    const hashedPassword = await bcrypt.hash(data.password, 10);

    let createdUser;

    if (data.role === "organizer") {
      createdUser = await new this.organizerModel({
        name: data.name,
        email: data.email,
        password: hashedPassword,
        status: "pending",
      }).save();
    } else {
      throw new Error("Invalid role");
    }

    // Send emails
    await this.mailService.sendApprovalRequestToAdmin(data);
    await this.mailService.sendConfirmationToUser(data);

    return createdUser;
  }
}
