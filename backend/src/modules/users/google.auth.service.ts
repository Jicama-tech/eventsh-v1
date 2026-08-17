import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { OAuth2Client } from "google-auth-library";

@Injectable()
export class GoogleAuthService {
  private client: OAuth2Client;

  constructor() {
    // OAuth2Client's own constructor doesn't require a clientId — the
    // missing-config check below is intentionally deferred to actual use
    // (verifyIdToken), not here. This is an @Injectable() provider, so Nest
    // constructs it eagerly at app boot regardless of whether Google auth
    // is ever used; throwing here would crash the whole app on a fresh
    // white-label deployment that hasn't configured Google OAuth yet,
    // instead of just failing the one login flow that needs it.
    this.client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }

  /**
   * Verify Google ID Token and return user profile info
   * @param idToken Google ID token from frontend Google sign-in
   */
  async verifyIdToken(idToken: string) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new InternalServerErrorException("Missing GOOGLE_OAUTH_CLIENT_ID");
    }
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new InternalServerErrorException("Invalid Google token payload");
      }

      return {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        emailVerified: payload.email_verified,
        locale: payload.locale,
        sub: payload.sub, // Google user ID
      };
    } catch (error) {
      throw new InternalServerErrorException(
        "Google token verification failed: " + error.message
      );
    }
  }
}
