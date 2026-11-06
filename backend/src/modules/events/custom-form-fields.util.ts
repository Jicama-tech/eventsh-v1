import { BadRequestException } from "@nestjs/common";

/**
 * Organizer-defined extra questions on a public application form (stored on
 * Event.registrationFormFields.customFields[<category>]).
 */
export interface CustomFormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  options?: string[];
}

export interface CustomFormAnswer {
  id: string;
  label: string;
  value: string;
}

const MAX_FIELDS = 20;
const MAX_OPTIONS = 30;
const MAX_ANSWER_LENGTH = 1000;
const TYPES = ["text", "textarea", "select"];

/** Keeps only well-formed definitions; everything else is dropped. */
export function sanitizeCustomFormFields(
  raw: Record<string, any> | undefined,
): Record<string, CustomFormField[]> {
  const out: Record<string, CustomFormField[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [category, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    const fields: CustomFormField[] = [];
    for (const f of list.slice(0, MAX_FIELDS)) {
      const id = String(f?.id ?? "").trim().slice(0, 40);
      const label = String(f?.label ?? "").trim().slice(0, 120);
      const type = TYPES.includes(f?.type) ? f.type : "text";
      if (!id || !label || seen.has(id)) continue;
      seen.add(id);
      const options =
        type === "select"
          ? (Array.isArray(f?.options) ? f.options : [])
              .map((o: any) => String(o ?? "").trim().slice(0, 120))
              .filter(Boolean)
              .slice(0, MAX_OPTIONS)
          : undefined;
      if (type === "select" && !options?.length) continue;
      fields.push({ id, label, type, required: !!f?.required, options });
    }
    out[category] = fields;
  }
  return out;
}

/**
 * Checks a visitor's answers against the event's custom fields and returns
 * the cleaned list to store (label kept with each answer so later edits to
 * the form don't change what the visitor was asked).
 */
export function buildCustomAnswers(
  fields: CustomFormField[] | undefined,
  answers: Record<string, any> | undefined,
): CustomFormAnswer[] {
  const out: CustomFormAnswer[] = [];
  for (const f of fields || []) {
    const value = String(answers?.[f.id] ?? "")
      .trim()
      .slice(0, MAX_ANSWER_LENGTH);
    if (!value) {
      if (f.required) throw new BadRequestException(`${f.label} is required`);
      continue;
    }
    if (f.type === "select" && !f.options?.includes(value)) {
      throw new BadRequestException(`Choose a valid option for ${f.label}`);
    }
    out.push({ id: f.id, label: f.label, value });
  }
  return out;
}
