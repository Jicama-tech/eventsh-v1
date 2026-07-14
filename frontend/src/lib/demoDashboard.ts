// Starts a READ-ONLY demo organizer-dashboard session for a prospect. Mints a
// demo token for the demo organization (scoped to a demo event if given),
// stores it, and hard-navigates into the real dashboard — which detects the
// `demo` claim and disables every write.
export async function startDemoDashboard(eventId?: string): Promise<void> {
  try {
    const res = await fetch(`${__API_URL__}/events/demo-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    const json = await res.json();
    if (json?.success && json?.token) {
      sessionStorage.setItem("token", json.token);
      // Full navigation so the auth/subscription providers re-init with the
      // demo token and render the organizer dashboard.
      window.location.href = "/organizer-dashboard";
    }
  } catch {
    // Non-fatal — the button just does nothing if the demo org is unavailable.
  }
}
