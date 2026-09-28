import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * For public endpoints that behave differently for signed-in staff: with a
 * valid `Authorization: Bearer <jwt>` (the same passport "jwt" strategy as
 * `AuthGuard("jwt")`) `req.user` is set; without one — or with an expired
 * or invalid one — the request goes through anonymously with `req.user`
 * null instead of being refused.
 */
@Injectable()
export class OptionalJwtGuard extends AuthGuard("jwt") {
  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
