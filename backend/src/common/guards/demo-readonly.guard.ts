import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require("jsonwebtoken");

// Global guard: a "demo" session token (minted by /events/demo-session for the
// read-only demo dashboard) may only READ. Any mutating request is rejected so
// prospects exploring the demo can never change real data via the API — even
// if they bypass the read-only UI. Requests without a demo token pass through
// untouched, so normal traffic is unaffected.
@Injectable()
export class DemoReadonlyGuard implements CanActivate {
  private static readonly SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const method = String(req?.method || "GET").toUpperCase();
    if (DemoReadonlyGuard.SAFE.has(method)) return true;

    const auth = String(req?.headers?.authorization || "");
    if (!auth.startsWith("Bearer ")) return true;
    const token = auth.slice(7);
    let decoded: any = null;
    try {
      decoded = jwt.decode(token);
    } catch {
      return true;
    }
    if (decoded?.demo === true) {
      throw new ForbiddenException({
        message: "This is a read-only demo. Register to make changes.",
        demo: true,
      });
    }
    return true;
  }
}
