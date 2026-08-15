// Role check on top of JwtAuthGuard. JwtAuthGuard alone only proves "some
// valid eventsh JWT" — organizer tokens are also valid JWTs (payload
// `roles: ["organizer"]`, admin tokens `roles: admin.role` which defaults to
// ["admin"], see admin.entity.ts/admin.service.ts login()). Endpoints that
// must be Super-Admin-only (platform-registry instance management, API-key
// generation) need this in addition to JwtAuthGuard, not instead of it —
// apply as `@UseGuards(JwtAuthGuard, AdminRolesGuard)` so `request.user` is
// populated before this guard reads it.
//
// Closes the gap a code review flagged on the Container branch:
// platform-registry.controller.ts's POST/GET /instances were JWT-guarded but
// not role-checked, so any logged-in organizer/vendor could register
// instances or list every white-label customer's domain + sync stats.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class AdminRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const roles: string[] = req.user?.roles || [];
    if (!roles.includes("admin")) {
      throw new ForbiddenException("Admin access required");
    }
    return true;
  }
}
