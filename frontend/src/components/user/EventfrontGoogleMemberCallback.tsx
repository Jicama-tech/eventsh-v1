import { useEffect } from "react";

// Tiny static route. The backend's /auth/google-member/redirect bounces
// the popup here after a successful Google OAuth round-trip, with the
// user profile in the query string. Living on the FRONTEND origin keeps
// `window.opener.postMessage` reliable across browsers that tighten
// Cross-Origin-Opener-Policy on cross-origin popup navigations.
//
// Flow:
//   1. Read email/name/picture from the query string.
//   2. window.opener.postMessage({kind: "eventsh:google-member", ...}, "*")
//   3. window.close()
//   4. If opener is gone (popup-blocker / refreshed / bookmarked), fall
//      back to a polled localStorage handshake so the dialog can still
//      pick up the result.
export function EventfrontGoogleMemberCallback() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const payload = {
      kind: "eventsh:google-member" as const,
      email: url.searchParams.get("email") || "",
      name: url.searchParams.get("name") || "",
      picture: url.searchParams.get("picture") || "",
    };
    // postMessage path — preferred. opener may be cross-origin (the
    // eventfront page); we send "*" because the receiver filters by
    // `kind` and there's no secret in the payload.
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, "*");
      }
    } catch {
      // ignore — fall through to localStorage handshake
    }
    // localStorage handshake fallback — same origin as the dialog, so
    // the EventfrontMemberDialog can read it directly if postMessage
    // didn't make it through.
    try {
      localStorage.setItem(
        "eventsh:google-member",
        JSON.stringify({ ...payload, at: Date.now() }),
      );
    } catch {
      // private mode / quota — best-effort
    }
    // Close the popup once the message is delivered. If the browser
    // refuses (popup not opened via window.open), we leave a tiny note
    // so the user knows they can close it manually.
    const t = window.setTimeout(() => {
      try {
        window.close();
      } catch {
        // ignore
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        fontFamily: "Inter, Arial, sans-serif",
        padding: 24,
        textAlign: "center",
        color: "#0f172a",
      }}
    >
      <p>Signed in — you can close this window.</p>
    </div>
  );
}
