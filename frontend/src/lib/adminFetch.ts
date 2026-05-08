/**
 * Thin fetch wrapper for admin API calls.
 * - Automatically attaches the Bearer token from sessionStorage if present.
 * - On a 401 response, dispatches a global `admin-session-expired` event so a
 *   single listener (mounted in AdminDashboard) can clear state, toast, and
 *   redirect to the admin login. Callers can still inspect / handle the
 *   response normally; the redirect happens out-of-band.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = sessionStorage.getItem("token");
  const headers = new Headers(init?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    // Fire-and-forget — the listener in AdminDashboard handles UX.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("admin-session-expired"));
    }
  }
  return res;
}
