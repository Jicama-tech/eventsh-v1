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
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
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
    const fe = this.frontendBase;
    try {
      const userFromGoogle = req.user as any;
      if (!userFromGoogle) {
        return res.redirect(`${fe}/login?error=auth_failed`);
      }

      let user = await this.usersService.findByEmail(userFromGoogle.email);

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

      return res.redirect(`${fe}/user-dashboard?token=${token}`);
    } catch (error) {
      return res.redirect(`${fe}/login?error=auth_failed`);
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
    const fe = this.frontendBase;
    try {
      const userFromGoogle = req.user as any;
      if (!userFromGoogle) {
        return res.redirect(`${fe}/ticket-cart?error=auth_failed`);
      }

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
      const baseUrl = returnUrl || `${fe}/ticket-cart`;
      return res.redirect(`${baseUrl}?${params.toString()}`);
    } catch (error) {
      return res.redirect(`${fe}/ticket-cart?error=auth_failed`);
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

      // Case-insensitive match — operator records aren't normalized to
      // lowercase, so a plain equality check would silently miss them.
      const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const emailRegex = new RegExp(`^${escaped}$`, "i");

      // Gather every organizer + operator record tied to this email.
      // Match against the organizer's primary `email` only — businessEmail
      // is the contact address, not the sign-in identity.
      const [organizers, operators] = await Promise.all([
        this.organizerModel.find({ email: emailRegex }).lean(),
        this.operatorModel.find({ email: emailRegex }).lean(),
      ]);

      // Resolve parent organizers for any operator hits.
      const parentIds = Array.from(
        new Set(
          operators
            .filter((o: any) => o.organizerId)
            .map((o: any) => String(o.organizerId)),
        ),
      );
      const parentOrgs = parentIds.length
        ? await this.organizerModel
            .find({ _id: { $in: parentIds } })
            .lean()
        : [];
      const parentLookup = new Map<string, any>(
        parentOrgs.map((p: any) => [String(p._id), p]),
      );

      // Build a unified list. Pending organizers stay in but flagged
      // approved=false so the UI can grey them out and block selection.
      // Operator entries inherit the parent organization's approval state.
      const accounts: Array<{
        accountId: string;
        accountType: "organizer" | "operator";
        organizationName: string;
        approved: boolean;
      }> = [];
      for (const org of organizers as any[]) {
        accounts.push({
          accountId: String(org._id),
          accountType: "organizer",
          organizationName: org.organizationName,
          approved: !!org.approved && !org.rejected,
        });
      }
      for (const op of operators as any[]) {
        if (!op.organizerId) continue;
        const parent = parentLookup.get(String(op.organizerId));
        if (!parent) continue;
        accounts.push({
          accountId: String(op._id),
          accountType: "operator",
          organizationName: `${parent.organizationName} (Operator: ${op.name})`,
          approved: !!parent.approved,
        });
      }

      // 0 → registration
      if (accounts.length === 0) {
        const params = new URLSearchParams({ email, name });
        return res.redirect(`${fe}/register?${params.toString()}`);
      }

      // 1 → direct login (or pending block)
      if (accounts.length === 1) {
        const only = accounts[0];
        if (!only.approved) {
          return res.redirect(`${fe}/organizer/login?error=pending_approval`);
        }
        const token = await this.mintOrganizerToken(
          only.accountId,
          only.accountType,
        );
        return res.redirect(
          `${fe}/organizer/login?token=${encodeURIComponent(token)}&direct=1`,
        );
      }

      // 2+ → mint short-lived selection token, send user to picker UI.
      const selToken = this.jwtService.sign(
        { typ: "organizer-select", email, name, accounts },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "5m" } as any,
      );
      return res.redirect(
        `${fe}/organizer/login?selToken=${encodeURIComponent(selToken)}`,
      );
    } catch (error) {
      return res.redirect(`${fe}/organizer/login?error=auth_failed`);
    }
  }

  // Exchange a selection token + chosen account for the real organizer JWT.
  // Used by the multi-account dropdown after Google sign-in.
  @Post("select-organizer-account")
  async selectOrganizerAccount(
    @Body()
    body: {
      selToken: string;
      accountId: string;
      accountType: "organizer" | "operator";
    },
  ) {
    if (!body?.selToken || !body?.accountId || !body?.accountType) {
      throw new UnauthorizedException("Missing selection payload");
    }
    let payload: any;
    try {
      payload = this.jwtService.verify(body.selToken, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException(
        "Selection link expired. Please sign in again.",
      );
    }
    if (payload?.typ !== "organizer-select") {
      throw new UnauthorizedException("Invalid selection token");
    }
    const match = (payload.accounts || []).find(
      (a: any) =>
        a.accountId === body.accountId && a.accountType === body.accountType,
    );
    if (!match) {
      throw new UnauthorizedException("Account not in selection list");
    }
    if (!match.approved) {
      throw new ForbiddenException(
        "This account is awaiting approval and cannot be used yet.",
      );
    }
    const token = await this.mintOrganizerToken(
      body.accountId,
      body.accountType,
    );
    return { token };
  }

  // Mint the organizer dashboard JWT for either an organizer record or an
  // operator (which logs in under the parent organizer's identity).
  private async mintOrganizerToken(
    accountId: string,
    accountType: "organizer" | "operator",
  ): Promise<string> {
    if (accountType === "organizer") {
      const org: any = await this.organizerModel.findById(accountId).lean();
      if (!org) throw new NotFoundException("Organizer not found");
      return this.jwtService.sign(
        {
          name: org.name,
          email: org.email,
          sub: org._id.toString(),
          country: org.country,
          organizationName: org.organizationName,
          roles: ["organizer"],
        },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "24h" } as any,
      );
    }
    const op: any = await this.operatorModel.findById(accountId).lean();
    if (!op?.organizerId) throw new NotFoundException("Operator not found");
    const parent: any = await this.organizerModel
      .findById(op.organizerId)
      .lean();
    if (!parent) throw new NotFoundException("Parent organization not found");
    return this.jwtService.sign(
      {
        name: op.name,
        email: op.email,
        sub: parent._id.toString(),
        operatorId: op._id.toString(),
        accessTabs: op.accessTabs || [],
        country: parent.country,
        organizationName: parent.organizationName,
        roles: ["organizer"],
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "24h" } as any,
    );
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
      return res.redirect(`${this.frontendBase}/login?error=auth_failed`);
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
