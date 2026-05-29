import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

// Dedicated Passport strategy for the eventfront "Become a member" popup
// flow. Uses a backend-hosted callback (localhost:3000) so the Google
// Cloud client only needs that one origin registered — no need to whitelist
// the frontend dev origin. Mirrors GoogleBuyerStrategy's shape.
@Injectable()
export class GoogleMemberStrategy extends PassportStrategy(
  Strategy,
  "google-member",
) {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL:
        process.env.GOOGLE_MEMBER_REDIRECT_URI ||
        "http://localhost:3000/auth/google-member/redirect",
      scope: ["email", "profile"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const user = {
      oauthProvider: "google",
      oauthId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      firstName: profile.name?.givenName || "",
      lastName: profile.name?.familyName || "",
      picture: profile.photos?.[0]?.value,
    };
    done(null, user);
  }
}
