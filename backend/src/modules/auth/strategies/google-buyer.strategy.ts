import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

@Injectable()
export class GoogleBuyerStrategy extends PassportStrategy(
  Strategy,
  "google-buyer",
) {
  constructor() {
    super({
      // See google.strategy.ts — an empty clientID/clientSecret crashes the
      // whole app at boot (passport-oauth2's own constructor throws), not
      // just this login flow.
      clientID: process.env.GOOGLE_CLIENT_ID || "not-configured",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "not-configured",
      callbackURL:
        process.env.GOOGLE_BUYER_REDIRECT_URI ||
        "http://localhost:3000/auth/google-buyer/redirect",
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
      profile,
    };
    done(null, user);
  }
}
