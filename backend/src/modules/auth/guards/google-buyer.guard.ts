import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

// Plain `AuthGuard('google-buyer')` never reads `req.query.state` — it calls
// passport.authenticate() with no options, so the `?state=<returnPath>` a
// caller (ticketCart, workshopCheckout, ...) passes on the INITIAL request
// is silently dropped: it's never sent to Google, so it's never echoed back
// on the /google-buyer/redirect callback either. Every caller ends up
// falling through to that handler's hardcoded /ticket-cart default instead
// of returning to wherever they actually started.
//
// Overriding getAuthenticateOptions() to forward it as the OAuth `state`
// param fixes this: passport-oauth2 includes it in the Google authorize
// URL, and Google returns it verbatim as req.query.state on the callback.
@Injectable()
export class GoogleBuyerAuthGuard extends AuthGuard("google-buyer") {
  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const state = req.query?.state;
    return { state: typeof state === "string" ? state : "" };
  }
}
