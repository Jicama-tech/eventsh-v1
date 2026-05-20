import {
  Controller,
  Get,
  Req,
  UseGuards,
  Res,
  InternalServerErrorException,
  ConflictException,
  Body,
  Post,
  Param,
  BadRequestException,
  Query,
  Patch,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { UsersService } from "./users.service";
import { JwtService } from "@nestjs/jwt";
import { CreateUserDto } from "./dto/create-users.dto";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private get frontendBase() {
    return process.env.FRONTEND_BASE_URL || "https://eventsh.com";
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  async googleAuth(@Req() req: Request) {
    // Passport will handle the redirect. No code needed here.
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const fe = this.frontendBase;
    try {
      const userFromGoogle = req.user as any;
      if (!userFromGoogle) {
        return res.redirect(`${fe}/login?error=auth_failed`);
      }

      let user = await this.usersService.findByProviderId(
        userFromGoogle.providerId,
        userFromGoogle.provider,
      );

      if (!user) {
        const createUserDto: CreateUserDto = {
          name: userFromGoogle.name,
          email: userFromGoogle.email,
          password: userFromGoogle.password,
          provider: userFromGoogle.provider,
          providerId: userFromGoogle.providerId,
        };
        user = await this.usersService.create(createUserDto);
      }

      const payload = { email: user.email, sub: user._id, roles: user.roles };
      const token = this.jwtService.sign(payload);
      return res.redirect(`${fe}/user-dashboard?token=${token}`);
    } catch (error) {
      return res.redirect(`${fe}/login?error=auth_failed`);
    }
  }

  @Get("verify/:email")
  async verifyEmail(@Param("email") email: string) {
    try {
      return await this.usersService.findByEmail(email);
    } catch (error) {
      throw error;
    }
  }

  @Post("register")
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      const existingUser = await this.usersService.findByEmail(
        createUserDto.email,
      );
      if (existingUser) {
        throw new ConflictException("User with this email already exists.");
      }
      return await this.usersService.create(createUserDto);
    } catch (error) {
      throw new InternalServerErrorException(
        "An error occurred during registration.",
      );
    }
  }

  @Get("get-user-by-whatsAppNumber/:whatsAppNumber")
  async getUserByWhatsAppNumber(
    @Param("whatsAppNumber") whatsAppNumber: string,
  ) {
    try {
      return await this.usersService.fetchUserByWhatsAppNumber(whatsAppNumber);
    } catch (error) {
      throw error;
    }
  }

  /**
   * NEW: Email verification for cart
   */
  @Post("verify-email-for-cart")
  async verifyEmailForCart(
    @Body() body: { email: string; whatsAppNumber: string },
  ) {
    try {
      if (!body.email || !body.whatsAppNumber) {
        throw new BadRequestException("Please provide everything");
      }
      return await this.usersService.verifyEmailForCart(
        body.email,
        body.whatsAppNumber,
      );
    } catch (error) {
      console.error("Email verification error:", error);
      throw error;
    }
  }

  /**
   * NEW: Send WhatsApp OTP
   */
  @Post("send-whatsapp-otp")
  async sendWhatsAppOtp(@Body() body: { whatsAppNumber: string }) {
    try {
      if (!body.whatsAppNumber) {
        throw new BadRequestException("userId and whatsAppNumber are required");
      }
      return await this.usersService.sendWhatsAppOtp(body.whatsAppNumber);
    } catch (error) {
      console.error("WhatsApp OTP send error:", error);
      throw error;
    }
  }

  /**
   * NEW: Verify WhatsApp OTP
   */
  @Post("verify-whatsapp-otp")
  async verifyWhatsAppOtp(
    @Body()
    body: {
      // userId: string;
      whatsAppNumber: string;
      otp: string;
      fullName: string;
    },
  ) {
    try {
      if (!body.whatsAppNumber || !body.otp) {
        throw new BadRequestException(
          "userId, whatsAppNumber, and otp are required",
        );
      }
      return await this.usersService.verifyWhatsAppOtp(
        body.fullName,
        body.whatsAppNumber,
        body.otp,
      );
    } catch (error) {
      console.error("WhatsApp OTP verification error:", error);
      throw error;
    }
  }

  @Get("reverse")
  async reverseGeocode(@Query("lat") lat: string, @Query("lng") lng: string) {
    const apiKey = process.env.GEOAPIFY_KEY; // or any provider key
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error("Reverse geocoding failed");
    }
    const json = await res.json();

    const props = json.features?.[0]?.properties;
    return {
      country: props?.country,
      state: props?.state || props?.state_code,
      city: props?.city || props?.town || props?.village,
      postcode: props?.postcode,
      fullAddress: props?.formatted,
    };
  }

  // Place autocomplete — proxies Geoapify so the API key stays on the server.
  // Returns a flattened shape the venue-name input can render directly.
  @Get("places-autocomplete")
  async placesAutocomplete(
    @Query("q") query: string,
    @Query("countryCode") countryCode?: string,
  ) {
    if (!query || query.trim().length < 2) {
      return { results: [] };
    }
    const apiKey = process.env.GEOAPIFY_KEY;
    if (!apiKey) {
      return { results: [], error: "GEOAPIFY_KEY not configured" };
    }
    const params = new URLSearchParams({
      text: query,
      limit: "8",
      format: "geojson",
      apiKey,
    });
    // Bias to the organizer's country when supplied (ISO-2 like "IN", "SG").
    if (countryCode && /^[a-z]{2}$/i.test(countryCode)) {
      params.set("filter", `countrycode:${countryCode.toLowerCase()}`);
    }
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?${params}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        return { results: [], error: `Geoapify ${res.status}` };
      }
      const json = await res.json();
      const features: any[] = Array.isArray(json?.features)
        ? json.features
        : [];
      const results = features.map((f: any) => {
        const p = f?.properties || {};
        return {
          placeId: p.place_id,
          name:
            p.name ||
            p.address_line1 ||
            p.street ||
            p.city ||
            p.formatted ||
            "",
          formattedAddress: p.formatted || "",
          city: p.city || p.town || p.village || "",
          state: p.state || p.state_code || "",
          country: p.country || "",
          postcode: p.postcode || "",
          lat: p.lat,
          lon: p.lon,
        };
      });
      return { results };
    } catch (err: any) {
      return { results: [], error: err?.message || "lookup failed" };
    }
  }

  /**
   * NEW: Check WhatsApp verification status
   */
  // @Get("whatsapp-status/:userId")
  // async checkWhatsAppStatus(@Param("userId") userId: string) {
  //   try {
  //     if (!userId) {
  //       throw new BadRequestException("userId is required");
  //     }
  //     return await this.usersService.checkWhatsAppStatus(userId);
  //   } catch (error) {
  //     console.error("WhatsApp status check error:", error);
  //     throw error;
  //   }
  // }
  @Post("get-by-email")
  async getProfile(@Body() body: { email: string }) {
    try {
      const email = body?.email;
      if (!email) return { success: false, user: null };
      const user = await this.usersService.findByEmail(email);
      // Wrap in a stable envelope so the frontend can reliably check
      // `data.success && data.user`. Returning the raw doc made it look like
      // a falsy response when the user was missing certain fields.
      if (!user) return { success: false, user: null };
      const u: any = (user as any).toObject ? (user as any).toObject() : user;
      return {
        success: true,
        user: {
          _id: u._id,
          email: u.email,
          name: u.name,
          firstName: u.firstName,
          lastName: u.lastName,
          whatsAppNumber: u.whatsAppNumber,
        },
      };
    } catch (error) {
      throw error;
    }
  }

  @Get("get-user-By-id/:id")
  async getUserById(@Param("id") id: string) {
    try {
      return await this.usersService.findById(id);
    } catch (error) {
      throw error;
    }
  }

  @Post("create-user-by-shopkeeper/:shopkeeperId")
  async createUserByShopkeeper(
    @Body() createUserDto: CreateUserDto,
    @Param("shopkeeperId") shopkeeperId: string,
  ) {
    try {
      return await this.usersService.createUserByShopkeeper(
        createUserDto,
        shopkeeperId,
      );
    } catch (error) {
      throw error;
    }
  }

  @Patch("update-user-by-shopkeeper/:shopkeeperId/:userId")
  async updateUserByShopkeeper(
    @Param("shopkeeperId") shopkeeperId: string,
    @Param("userId") userId: string,
    @Body() updateUserDto: CreateUserDto,
  ) {
    try {
      return await this.usersService.updateUserByShopkeeper(
        userId,
        updateUserDto,
        shopkeeperId,
      );
    } catch (error) {
      throw error;
    }
  }

  @Get("fetch-users-by-shopkeeper/:shopkeeperId")
  async fetchUsersByShopkeeperId(@Param("shopkeeperId") shopkeeperId: string) {
    try {
      return await this.usersService.fetchUsersByShopkeeperId(shopkeeperId);
    } catch (error) {
      throw error;
    }
  }

  // Organizer-side CRUD — mirrors the shopkeeper trio but tags users with
  // provider:"Organizer" so an organizer's customer list stays separate
  // from anything created via the shopkeeper flow.
  @Post("create-user-by-organizer/:organizerId")
  async createUserByOrganizer(
    @Body() createUserDto: CreateUserDto,
    @Param("organizerId") organizerId: string,
  ) {
    return this.usersService.createUserByOrganizer(createUserDto, organizerId);
  }

  @Patch("update-user-by-organizer/:organizerId/:userId")
  async updateUserByOrganizer(
    @Param("organizerId") organizerId: string,
    @Param("userId") userId: string,
    @Body() updateUserDto: CreateUserDto,
  ) {
    return this.usersService.updateUserByOrganizer(
      userId,
      updateUserDto,
      organizerId,
    );
  }

  @Get("fetch-users-by-organizer/:organizerId")
  async fetchUsersByOrganizerId(@Param("organizerId") organizerId: string) {
    return this.usersService.fetchUsersByOrganizerId(organizerId);
  }
}
