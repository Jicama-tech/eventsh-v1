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
import { OAuth2Client } from "google-auth-library";

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

  // Map a Google `locale` (e.g. "en-IN", "en_US", "en") to a 2-letter
  // ISO country code. Used for the Individual onboarding flow so the
  // chatbot's currency picker (COUNTRY_CURRENCY in chatbot.service)
  // shows ₹ for India accounts, $ for US accounts, etc. Returns ""
  // when no region info is present — caller can fall back to a default.
  private countryFromLocale(locale?: string): string {
    if (!locale) return "";
    const m = String(locale).match(/[-_]([A-Za-z]{2})$/);
    return m ? m[1].toUpperCase() : "";
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
      // `accountTier` carries the organizer doc's own accountType field
      // ("Individual" | "Organizer") so the login branch downstream can
      // distinguish a lazy-created Individual record (chatbot-only mode)
      // from a fully registered Organizer (full dashboard).
      const accounts: Array<{
        accountId: string;
        accountType: "organizer" | "operator";
        organizationName: string;
        approved: boolean;
        accountTier: "Individual" | "Organizer";
      }> = [];
      for (const org of organizers as any[]) {
        accounts.push({
          accountId: String(org._id),
          accountType: "organizer",
          organizationName: org.organizationName,
          approved: !!org.approved && !org.rejected,
          accountTier:
            org.accountType === "Individual" ? "Individual" : "Organizer",
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
          // Operators of an Individual parent inherit Individual tier so
          // they too land on the chatbot-only mode.
          accountTier:
            parent.accountType === "Individual" ? "Individual" : "Organizer",
        });
      }

      // 0 organizer / operator records → "Individual" onboarding. We still
      // sign the user in (so the dashboard chatbot can talk to them) but
      // mark them as `roles:["individual"]`. The frontend gates the sidebar
      // off in this mode and only lets them chat or open the registration
      // form via the chatbot.
      if (accounts.length === 0) {
        let user = await this.usersService.findByEmail(email);
        if (!user) {
          user = await this.usersService.create({
            name,
            email,
            password: null,
            provider: "google",
            providerId: userFromGoogle.oauthId || userFromGoogle.providerId,
          } as any);
        }
        // Promote to "individual" without clobbering higher roles if the
        // user somehow already has them (defensive — admin/agent should
        // never reach this branch, but if they do, we don't downgrade them).
        const elevated = ["admin", "organizer", "agent"];
        const currentRoles: string[] = (user as any).roles || [];
        if (!currentRoles.some((r) => elevated.includes(r))) {
          (user as any).roles = ["individual"];
          await (user as any).save?.();
        }
        const country = this.countryFromLocale(userFromGoogle.locale);
        const token = this.jwtService.sign(
          {
            name: (user as any).name || name,
            email: (user as any).email || email,
            sub: (user as any)._id?.toString(),
            roles: (user as any).roles || ["individual"],
            // Country derived from Google `locale` (e.g. en-IN -> IN).
            // Lets the chatbot pick ₹/$ for the Individual account
            // without ever showing a country picker. Empty string
            // when Google didn't supply locale — chatbot then falls
            // back to US/$.
            country,
          },
          { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "24h" } as any,
        );
        return res.redirect(
          `${fe}/organizer-dashboard?token=${encodeURIComponent(token)}`,
        );
      }

      // 1 → direct login (or pending block).
      // Special case: the lone account is a lazy-created Individual-tier
      // organizer (we made it on first event publish). They never
      // registered through the full organizer form, so we sign them in
      // as roles:["individual"] — the dashboard then renders the
      // chatbot-only mode, NOT the full organizer surface.
      if (accounts.length === 1) {
        const only = accounts[0];
        if (!only.approved) {
          return res.redirect(`${fe}/organizer/login?error=pending_approval`);
        }
        if (only.accountTier === "Individual") {
          const token = await this.mintIndividualToken({
            email,
            name,
            providerId:
              userFromGoogle.oauthId || userFromGoogle.providerId || "",
            country: this.countryFromLocale(userFromGoogle.locale),
          });
          return res.redirect(
            `${fe}/organizer-dashboard?token=${encodeURIComponent(token)}`,
          );
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

  // Inline Google sign-in from the landing-page chatbot. Frontend uses
  // @react-oauth/google's useGoogleLogin (auth-code flow) which opens a
  // popup and returns a one-time authorization code. We exchange that
  // code server-side using client_secret for tokens, verify the id_token
  // signature with google-auth-library, then route by what we find:
  //   - 1+ organizer/operator records on the email → organizer JWT
  //   - none → create/reuse an Individual user, return individual JWT
  // The frontend stores the token and navigates to `routeTo`.
  //
  // We also accept `{ credential }` (an id_token from One Tap / GIS
  // credential flow) for forward compatibility.
  @Post("google-token-exchange")
  async googleTokenExchange(
    @Body() body: { code?: string; credential?: string; redirectUri?: string },
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId) {
      throw new InternalServerErrorException(
        "GOOGLE_CLIENT_ID not configured on the server",
      );
    }

    let payload: {
      email?: string;
      name?: string;
      sub?: string;
      email_verified?: boolean;
    } = {};

    if (body?.code) {
      if (!clientSecret) {
        throw new InternalServerErrorException(
          "GOOGLE_CLIENT_SECRET not configured — needed for auth-code exchange",
        );
      }
      // `postmessage` is the redirect_uri the GIS popup uses. The OAuth
      // client must allow it (web app type does by default). We also
      // accept an explicit redirectUri override for non-popup callers.
      const redirectUri = body.redirectUri || "postmessage";
      const oauth2 = new OAuth2Client(clientId, clientSecret, redirectUri);
      try {
        const { tokens } = await oauth2.getToken(body.code);
        if (!tokens?.id_token) {
          throw new Error("Google response had no id_token");
        }
        const ticket = await oauth2.verifyIdToken({
          idToken: tokens.id_token,
          audience: clientId,
        });
        const p: any = ticket.getPayload() || {};
        payload = {
          email: p.email,
          name: p.name,
          sub: p.sub,
          email_verified: p.email_verified,
        };
      } catch (err: any) {
        console.error(
          "[google-token-exchange] code exchange failed:",
          err?.message || err,
        );
        throw new UnauthorizedException(
          err?.message
            ? `Google rejected the auth code: ${err.message}`
            : "Google rejected the auth code",
        );
      }
    } else if (body?.credential) {
      const oauth2 = new OAuth2Client(clientId);
      try {
        const ticket = await oauth2.verifyIdToken({
          idToken: body.credential,
          audience: clientId,
        });
        const p: any = ticket.getPayload() || {};
        payload = {
          email: p.email,
          name: p.name,
          sub: p.sub,
          email_verified: p.email_verified,
        };
      } catch (err: any) {
        console.error(
          "[google-token-exchange] id_token verify failed:",
          err?.message || err,
        );
        throw new UnauthorizedException(
          err?.message
            ? `Google id_token verification failed: ${err.message}`
            : "Google id_token verification failed",
        );
      }
    } else {
      throw new UnauthorizedException(
        "Missing 'code' or 'credential' in request body",
      );
    }

    if (!payload?.email) {
      console.error(
        "[google-token-exchange] verified payload missing email:",
        Object.keys(payload || {}),
      );
      throw new UnauthorizedException(
        "Google response didn't include an email — make sure the OAuth scopes include 'email'.",
      );
    }

    let name = payload.name || (payload.email as string).split("@")[0];
    const email = (payload.email as string).toLowerCase();
    const profile = { email, name, sub: payload.sub as string };

    // Case-insensitive match — operator records aren't normalized to
    // lowercase, so a plain equality check would silently miss them.
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const emailRegex = new RegExp(`^${escaped}$`, "i");

    const [organizers, operators] = await Promise.all([
      this.organizerModel.find({ email: emailRegex }).lean(),
      this.operatorModel.find({ email: emailRegex }).lean(),
    ]);

    // For an inline flow we don't ask the user to pick — if multiple
    // accounts exist, pick the first approved organizer. Multi-account
    // disambiguation stays on the /organizer/login redirect flow.
    //
    // Important: a lazy-created Individual-tier organizer record (made
    // on first event publish) must NOT promote the user to the full
    // organizer dashboard on re-login. They never registered.
    const approvedFullOrg = (organizers as any[]).find(
      (o) =>
        o.approved && !o.rejected && o.accountType !== "Individual",
    );
    if (approvedFullOrg) {
      const token = await this.mintOrganizerToken(
        String(approvedFullOrg._id),
        "organizer",
      );
      return {
        token,
        routeTo: "/organizer-dashboard",
        accountType: "organizer" as const,
      };
    }
    const approvedOp = (operators as any[]).find((o) => o.organizerId);
    if (approvedOp) {
      const token = await this.mintOrganizerToken(
        String(approvedOp._id),
        "operator",
      );
      return {
        token,
        routeTo: "/organizer-dashboard",
        accountType: "organizer" as const,
      };
    }

    // No organizer/operator → Individual onboarding. Same code path as
    // googleOrganizerRedirect's individual branch, returned as JSON.
    let user = await this.usersService.findByEmail(email);
    const isNew = !user;
    if (!user) {
      user = await this.usersService.create({
        name,
        email,
        password: null,
        provider: "google",
        providerId: profile.sub,
      } as any);
    }
    const elevated = ["admin", "organizer", "agent"];
    const currentRoles: string[] = (user as any).roles || [];
    if (!currentRoles.some((r) => elevated.includes(r))) {
      (user as any).roles = ["individual"];
      await (user as any).save?.();
    }
    const token = this.jwtService.sign(
      {
        name: (user as any).name || name,
        email: (user as any).email || email,
        sub: (user as any)._id?.toString(),
        roles: (user as any).roles || ["individual"],
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "24h" } as any,
    );
    return {
      token,
      routeTo: "/organizer-dashboard",
      accountType: "individual" as const,
      isNew,
    };
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

  // Mint an Individual JWT (roles: ["individual"]). Used when the user
  // signing in has only a lazy-created Individual-tier organizer record —
  // they haven't registered through the full /register form, so they
  // should keep landing in the chatbot-only dashboard mode.
  private async mintIndividualToken({
    email,
    name,
    providerId,
    country,
  }: {
    email: string;
    name: string;
    providerId: string;
    country?: string;
  }): Promise<string> {
    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.create({
        name,
        email,
        password: null,
        provider: "google",
        providerId,
      } as any);
    }
    const elevated = ["admin", "organizer", "agent"];
    const currentRoles: string[] = (user as any).roles || [];
    if (!currentRoles.some((r) => elevated.includes(r))) {
      (user as any).roles = ["individual"];
      await (user as any).save?.();
    }
    // Resolve country: prefer the value Google supplied this sign-in,
    // fall back to whatever is already stored on the Organizer row for
    // this email (so repeat sign-ins keep the same currency even if
    // Google ever drops the `locale` field). Empty -> chatbot defaults
    // to USD.
    let resolvedCountry = (country || "").toUpperCase();
    if (!resolvedCountry) {
      const existingOrg: any = await this.organizerModel
        .findOne({ email: email.toLowerCase() })
        .lean();
      resolvedCountry = (existingOrg?.country || "").toUpperCase();
    }
    return this.jwtService.sign(
      {
        name: (user as any).name || name,
        email: (user as any).email || email,
        sub: (user as any)._id?.toString(),
        roles: (user as any).roles || ["individual"],
        country: resolvedCountry,
      },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: "24h" } as any,
    );
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
