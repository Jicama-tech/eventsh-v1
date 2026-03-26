import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-instagram";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class InstagramStrategy extends PassportStrategy(Strategy, "instagram") {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get("INSTAGRAM_CLIENT_ID"),
      clientSecret: configService.get("INSTAGRAM_CLIENT_SECRET"),
      callbackURL: "http://localhost:3000/auth/instagram/redirect",
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
