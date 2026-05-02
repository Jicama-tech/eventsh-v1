import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Res,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LocalDto } from "./dto/local.dto";
import { GoogleAuthGuard } from "./guards/google.guard";
import { InstagramAuthGuard } from "./guards/instagram.guard";
import { Request, Response } from "express";
import { CreateUserDto } from "../users/dto/create-users.dto";
import { UsersService } from "../users/users.service";
import { JwtService } from "@nestjs/jwt";
import { AuthGuard } from "@nestjs/passport";
import { RoleService } from "../roles/roles.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly rolesService: RoleService,
    @InjectModel("Organizer") private readonly organizerModel: Model<any>,
    @InjectModel("Operator") private readonly operatorModel: Model<any>,
  ) {}

  // Frontend base URL used for redirects after Google OAuth.
  private get frontendBase() {
    return process.env.FRONTEND_BASE_URL || "https://eventsh.com";
  }

  @Post("login")
  async login(@Body() dto: LocalDto) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    if (!user) return { error: "Invalid credentials" };
    return this.authService.login(user);
  }

  @Post("register")
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      const result = await this.usersService.create(createUserDto);
      return result;
    } catch (error) {
      console.error("Registration error:", error);
      throw new InternalServerErrorException(
        "An error occurred during registration.",
      );
    }
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  async googleAuth() {
    // This is the initial endpoint to start the Google auth flow.
  }

  @Get("google/redirect")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const userFromGoogle = req.user as any;
      if (!userFromGoogle) {
        return res.redirect("https://eventsh.com/login?error=auth_failed");
        // return res.redirect("http://localhost:8080/login?error=auth_failed");
      }

      // 1. Check if the user already exists in your database
      let user = await this.usersService.findByEmail(userFromGoogle.email);

      // 2. If the user doesn't exist, create a new one
      if (!user) {
        const createUserDto: CreateUserDto = {
          name: userFromGoogle.name,
          email: userFromGoogle.email,
          password: userFromGoogle.password,
          provider: userFromGoogle.oauthProvider,
          providerId: userFromGoogle.oauthId,
        };
        user = await this.usersService.create(createUserDto);
      }

      // 3. Generate a JWT token
      const payload = {
        name: user.name,
        email: user.email,
        sub: user._id,
        roles: user.roles,
      };
      const token = this.jwtService.sign(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: "1h",
      });

      // 4. Redirect to the frontend with the token
      // This is the correct line to use!
      return res.redirect(`https://eventsh.com/user-dashboard?token=${token}`);

      // return res.redirect(
      //   `http://localhost:8080/user-dashboard?token=${token}`
      // );
      // Remove the res.json line
      // res.json({ message: "User logged in successfully", token });
    } catch (error) {
      return res.redirect("https://eventsh.com/login?error=auth_failed");
      // return res.redirect("http://localhost:8080/login?error=auth_failed");
    }
  }

  // ===== Google Buyer Auth (for ticket cart) =====
  @Get("google-buyer")
  @UseGuards(AuthGuard("google-buyer"))
  async googleBuyerAuth() {
    // Redirects to Google consent screen
  }

  @Get("google-buyer/redirect")
  @UseGuards(AuthGuard("google-buyer"))
  async googleBuyerRedirect(@Req() req: Request, @Res() res: Response) {
    try {
      const userFromGoogle = req.user as any;
      if (!userFromGoogle) {
        return res.redirect(
          "http://localhost:8080/ticket-cart?error=auth_failed",
        );
      }

      // Find or create user
      let user = await this.usersService.findByEmail(userFromGoogle.email);
      const isExisting = !!user;

      if (!user) {
        const createUserDto: CreateUserDto = {
          name: userFromGoogle.name,
          email: userFromGoogle.email,
          password: "oauth-" + userFromGoogle.oauthId,
          provider: userFromGoogle.oauthProvider,
          providerId: userFromGoogle.oauthId,
        };
        user = await this.usersService.create(createUserDto);
      }

      const params = new URLSearchParams({
        google_auth: "success",
        email: userFromGoogle.email || "",
        firstName: userFromGoogle.firstName || "",
        lastName: userFromGoogle.lastName || "",
        name: userFromGoogle.name || "",
        existing: isExisting ? "true" : "false",
      });

      const returnUrl = (req.query?.state as string) || "";
      const baseUrl = returnUrl || "http://localhost:8080/ticket-cart";
      return res.redirect(`${baseUrl}?${params.toString()}`);
    } catch (error) {
      return res.redirect(
        "http://localhost:8080/ticket-cart?error=auth_failed",
      );
    }
  }

  @Get("google-organizer")
  @UseGuards(AuthGuard("google-organizer"))
  async googleOrganizerAuth() {
    // This is the initial endpoint to start the Google auth flow.
  }

  @Get("google-organizer/redirect")
  @UseGuards(AuthGuard("google-organizer"))
  async googleOrganizerRedirect(@Req() req: Request, @Res() res: Response) {
    const fe = this.frontendBase;
    try {
      const userFromGoogle = req.user as any;
      if (!userFromGoogle?.email) {
        return res.redirect(`${fe}/organizer/login?error=auth_failed`);
      }
      const email = String(userFromGoogle.email).toLowerCase();
      const name = userFromGoogle.name || "";

      // 1. Approved organizer? Mint organizer JWT and log them straight in.
      const approvedOrg: any = await this.organizerModel
        .findOne({ email, approved: true })
        .lean();
      if (approvedOrg) {
        const token = this.jwtService.sign(
          {
            name: approvedOrg.name,
            email: approvedOrg.email,
            sub: approvedOrg._id.toString(),
            country: approvedOrg.country,
            organizationName: approvedOrg.organizationName,
            roles: ["organizer"],
          },
          { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "24h" },
        );
        return res.redirect(
          `${fe}/organizer/login?token=${encodeURIComponent(token)}&direct=1`,
        );
      }

      // 2. Organizer record exists but isn't approved yet → block with message.
      const pendingOrg: any = await this.organizerModel
        .findOne({ email, approved: { $ne: true } })
        .lean();
      if (pendingOrg) {
        return res.redirect(
          `${fe}/organizer/login?error=pending_approval`,
        );
      }

      // 3. Operator? Log in under the parent organizer's identity.
      const operator: any = await this.operatorModel
        .findOne({ email })
        .lean();
      if (operator?.organizerId) {
        const parentOrg: any = await this.organizerModel
          .findOne({ _id: operator.organizerId, approved: true })
          .lean();
        if (parentOrg) {
          const token = this.jwtService.sign(
            {
              name: operator.name,
              email: operator.email,
              sub: parentOrg._id.toString(),
              operatorId: operator._id.toString(),
              accessTabs: operator.accessTabs || [],
              country: parentOrg.country,
              organizationName: parentOrg.organizationName,
              roles: ["organizer"],
            },
            { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "24h" },
          );
          return res.redirect(
            `${fe}/organizer/login?token=${encodeURIComponent(token)}&direct=1`,
          );
        }
      }

      // 4. No organizer or operator found → send to registration prefilled.
      const params = new URLSearchParams({ email, name });
      return res.redirect(`${fe}/register?${params.toString()}`);
    } catch (error) {
      return res.redirect(`${fe}/organizer/login?error=auth_failed`);
    }
  }

  @Post("check-role") // e.g. /auth/check-role
  @UseGuards(JwtAuthGuard)
  async checkRoleFromAuth(
    @Req() req: any,
    @Body() body: { role: "organizer" },
  ) {
    try {
      const email = req.user.email;
      const name = req.user.name;

      return this.rolesService.checkRoleAvailability1(email, name, body.role);
    } catch (error) {
      console.error("checkRoleFromAuth error:", error);
      throw error;
    }
  }

  @Get("instagram")
  @UseGuards(InstagramAuthGuard)
  async instagramAuth() {}

  @Get("instagram/redirect")
  @UseGuards(InstagramAuthGuard)
  async instagramRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user as any;
    if (!user) {
      return res.redirect("http://localhost:8080/login?error=auth_failed");
    }

    // Check if the user exists based on provider ID, and if not, create them.
    // This is a placeholder for your logic.
    // The correct approach is to call a service method to handle this.
    // const createdUser = await this.authService.findOrCreateSocialUser({
    //   email: user.email,
    //   name: user.name,
    //   provider: "instagram",
    //   providerId: user.providerId,
    // });

    // const result = await this.authService.login(createdUser);
    // return res.redirect(
    //   `http://localhost:8080/dashboard?token=${result.token}`
    // );
  }
}
