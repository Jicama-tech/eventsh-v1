import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      // passport-oauth2's own constructor throws synchronously (crashing
      // the whole Nest app at boot, not just this one login flow) if
      // clientID/clientSecret are falsy — "" included. A non-empty
      // placeholder lets the app boot on a fresh white-label deployment
      // that hasn't set up Google OAuth yet; actually using this login
      // button would then fail normally at Google's end, not at boot.
      clientID: process.env.GOOGLE_CLIENT_ID || "not-configured",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "not-configured",
      callbackURL:
        process.env.GOOGLE_REDIRECT_URI ||
        "http://localhost:8080/auth/google/redirect",
      scope: ["email", "profile"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    // Here you'd find or create the user in DB. For skeleton, return profile
    const user = {
      oauthProvider: "google",
      oauthId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      profile,
    };
    done(null, user);
  }
}
