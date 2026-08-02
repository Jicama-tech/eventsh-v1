/**
 * Single source of truth for the "configurable Registration Forms" feature
 * — which fields on the four public application forms (Stall, Speaker,
 * Round Table, Workshop) an organizer can toggle on/off per event.
 *
 * `alwaysOn: true` fields are excluded from the toggle UI entirely (no
 * switch, always rendered) because they're required at the Mongoose
 * schema level, the backend DTO level, or hardcoded as required by a
 * frontend validation function independent of the DTO (see Stall's
 * `handleRentFormSubmit` in eventFront.tsx) — disabling them would either
 * be rejected server-side or make the form unsubmittable client-side.
 *
 * Config shape mirrors `Event.sectionVisibility`: missing key = enabled,
 * explicit `false` = disabled. `isFieldEnabled` implements that convention.
 */

export type RegistrationFormCategory =
  | "stall"
  | "speaker"
  | "roundTable"
  | "workshop";

export interface RegistrationFormFieldDef {
  key: string;
  label: string;
  alwaysOn: boolean;
}

export type RegistrationFormFieldsConfig = Partial<
  Record<RegistrationFormCategory, Record<string, boolean>>
>;

export const REGISTRATION_FORM_FIELDS: Record<
  RegistrationFormCategory,
  RegistrationFormFieldDef[]
> = {
  stall: [
    { key: "nameOfApplicant", label: "Name of Applicant", alwaysOn: true },
    { key: "name", label: "Owner Name", alwaysOn: true },
    { key: "businessOwnerNationality", label: "Owner Nationality", alwaysOn: false },
    { key: "residency", label: "Residency", alwaysOn: false },
    { key: "brandName", label: "Brand Name", alwaysOn: false },
    { key: "shopName", label: "Registered Business Name", alwaysOn: true },
    { key: "email", label: "Primary Email", alwaysOn: true },
    { key: "businessEmail", label: "Business Email", alwaysOn: false },
    { key: "whatsappNumber", label: "WhatsApp Number", alwaysOn: false },
    { key: "phone", label: "Phone Number", alwaysOn: false },
    { key: "businessCategory", label: "Business Category", alwaysOn: false },
    { key: "noOfOperators", label: "No. of Operators", alwaysOn: false },
    { key: "registrationNumber", label: "Registration Number (GST/UEN)", alwaysOn: false },
    { key: "faceBookLink", label: "Facebook Link", alwaysOn: false },
    { key: "instagramLink", label: "Instagram Link", alwaysOn: false },
    { key: "registrationImage", label: "Business Registration Document", alwaysOn: false },
    { key: "companyLogo", label: "Company Logo", alwaysOn: false },
    { key: "productImage", label: "Product Images", alwaysOn: false },
    { key: "preferredTemplateIds", label: "Preferred Space Type(s)", alwaysOn: true },
    { key: "description", label: "Business, Products & Brand Description", alwaysOn: false },
    { key: "address", label: "Business Address", alwaysOn: false },
    { key: "refundPaymentDescription", label: "Refund Payment Description", alwaysOn: false },
  ],
  speaker: [
    { key: "image", label: "Photo", alwaysOn: false },
    { key: "name", label: "Full Name", alwaysOn: true },
    { key: "email", label: "Email", alwaysOn: true },
    { key: "phone", label: "Phone / WhatsApp", alwaysOn: false },
    { key: "title", label: "Role / Title", alwaysOn: false },
    { key: "organization", label: "Company / Organization", alwaysOn: false },
    { key: "bio", label: "Bio", alwaysOn: false },
    { key: "expertise", label: "Area of Expertise", alwaysOn: false },
    { key: "linkedin", label: "LinkedIn URL", alwaysOn: false },
    { key: "twitter", label: "Twitter URL", alwaysOn: false },
    { key: "website", label: "Website URL", alwaysOn: false },
    { key: "sessionTopic", label: "Session Topic", alwaysOn: true },
    { key: "sessionDescription", label: "Session Description", alwaysOn: false },
    { key: "previousSpeakingExperience", label: "Previous Speaking Experience", alwaysOn: false },
    { key: "equipmentNeeded", label: "Equipment Needed", alwaysOn: false },
    { key: "selectedSlotId", label: "Speaker Space", alwaysOn: true },
    { key: "preferredStartTime", label: "Preferred Start Time", alwaysOn: false },
    { key: "preferredEndTime", label: "Preferred End Time", alwaysOn: false },
  ],
  roundTable: [
    { key: "tableSelection", label: "Table / Chair Selection", alwaysOn: true },
    { key: "visitorName", label: "Full Name", alwaysOn: true },
    { key: "visitorEmail", label: "Email", alwaysOn: true },
    { key: "visitorPhone", label: "Phone", alwaysOn: true },
    { key: "seatGuests", label: "Per-Seat Guest Details", alwaysOn: false },
  ],
  workshop: [
    { key: "photoFile", label: "Photo", alwaysOn: false },
    { key: "hostName", label: "Host Name", alwaysOn: true },
    { key: "workshopName", label: "Workshop Title", alwaysOn: true },
    { key: "hostPhone", label: "Phone / WhatsApp", alwaysOn: false },
    { key: "hostBio", label: "Your Bio", alwaysOn: false },
    { key: "workshopDescription", label: "Workshop Description", alwaysOn: false },
    { key: "proposedPrice", label: "Suggested Visitor Price", alwaysOn: false },
    { key: "maxSeats", label: "Max Seats", alwaysOn: false },
    { key: "hostAccountName", label: "Payout Account Holder Name", alwaysOn: false },
    { key: "hostAccountDetails", label: "Payout Account Details", alwaysOn: false },
    { key: "proposedStartTime", label: "Start Time", alwaysOn: false },
    { key: "proposedEndTime", label: "End Time", alwaysOn: false },
  ],
};

/** Missing key = enabled (matches Event.sectionVisibility's convention). */
export function isFieldEnabled(
  config: RegistrationFormFieldsConfig | null | undefined,
  category: RegistrationFormCategory,
  key: string,
): boolean {
  const categoryConfig = config?.[category];
  if (!categoryConfig) return true;
  return categoryConfig[key] !== false;
}

export const CATEGORY_LABELS: Record<RegistrationFormCategory, string> = {
  stall: "Stall / Exhibitor",
  speaker: "Speaker",
  roundTable: "Round Table",
  workshop: "Workshop",
};

/** Maps each category to the Event.features.hasX flag that gates it. */
export const CATEGORY_FEATURE_FLAG: Record<RegistrationFormCategory, string> = {
  stall: "hasStalls",
  speaker: "hasSpeakers",
  roundTable: "hasRoundTables",
  workshop: "hasWorkshops",
};
