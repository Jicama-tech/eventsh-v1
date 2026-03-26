import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

@Injectable()
export class GoogleOrganizerStrategy extends PassportStrategy(
  Strategy,
  "google-organizer" // ← DIFFERENT NAME!
) {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      callbackURL:
        process.env.GOOGLE_ORGANIZER_REDIRECT_URI ||
        "http://localhost:8080/auth/google-organizer/redirect", // ← SHOPKEEPER CALLBACK
      scope: ["email", "profile"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback
  ): Promise<any> {
    const user = {
      oauthProvider: "google",
      oauthId: profile.id,
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      password: "oauth-" + profile.id,
    };
    done(null, user);
  }
}
