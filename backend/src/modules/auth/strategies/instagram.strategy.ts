import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-instagram";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InstagramStrategy extends PassportStrategy(Strategy, "instagram") {
  constructor(private readonly configService: ConfigService) {
    super({
      // See google.strategy.ts — an empty/undefined clientID/clientSecret
      // crashes the whole app at boot (the underlying OAuth2 strategy's own
      // constructor throws), not just this login flow.
      clientID: configService.get("INSTAGRAM_CLIENT_ID") || "not-configured",
      clientSecret:
        configService.get("INSTAGRAM_CLIENT_SECRET") || "not-configured",
      callbackURL:
        configService.get("INSTAGRAM_REDIRECT_URI") ||
        "http://localhost:3000/auth/instagram/redirect",
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function
  ): Promise<any> {
    const { id, username, displayName } = profile;
    const user = {
      provider: "instagram",
      providerId: id,
      name: displayName || username,
      // Instagram doesn't always provide an email, so we need to handle this.
      email: null,
    };

    done(null, user);
  }
}
