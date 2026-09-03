/**
 * English source strings. This is the reference dictionary: every key must
 * exist here, and hi.ts mirrors it. A key missing from hi.ts renders the
 * English value, so translating is safe to do incrementally.
 *
 * Keys are grouped by surface: `nav.*` organizer sidebar, `navi.*` the
 * Individual (marriage) sidebar, `hdr.*` dashboard header, `form.*` the
 * full-screen event forms, `common.*` shared verbs and labels.
 */
export const en: Record<string, string> = {
  // ---- organizer sidebar ----
  "nav.chatbot": "Chatbot",
  "nav.dashboard": "Analytics",
  "nav.kiosk": "In-Person Booking",
  "nav.eventAttendees": "Participants",
  "nav.platformFees": "Platform Fees",
  "nav.users": "CRM",
  "nav.events": "Events/Coupons",
  "nav.feedback": "Feedback",
  "nav.membership": "Membership",
  "nav.support": "Support",
  "nav.storefront": "Eventfront",
  "nav.settings": "Settings",

  // ---- individual (marriage) sidebar ----
  "navi.chatbot": "Assistant",
  "navi.events": "My Events",
  "navi.guest-list": "Guest List",
  "navi.email-settings": "Settings",
  "navi.help": "Help",

  // ---- dashboard header ----
  "hdr.help": "Need Help?",
  "hdr.logout": "Logout",
  "hdr.theme.toLight": "Switch to light theme",
  "hdr.theme.toDark": "Switch to dark theme",
  "hdr.lang": "Language",

  // ---- full-screen event forms ----
  "form.create.title": "Create event",
  "form.edit.title": "Edit event",
  "form.marriage.create.title": "Create wedding event",
  "form.marriage.edit.title": "Edit wedding event",
  "form.close": "Close",

  // ---- shared ----
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.back": "Back",
  "common.loading": "Loading…",
};
