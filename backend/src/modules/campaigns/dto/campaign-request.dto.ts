import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { CONTACT_SOURCES, ContactSource } from "../entities/whatsapp-campaign.entity";

/** `<source>:<24-hex id>`, optionally `:<index>` for a person nested in a
 * record (a seat guest on a round-table booking, an RSVP's extra attendee). */
export const CONTACT_ID = /^[a-z]+:[a-f0-9]{24}(?::\d{1,3})?$/i;

/** `sources` arrives as an array in JSON and comma-separated in a query. */
const toSourceList = ({ value }: { value: unknown }) => {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim() !== "")
    return value.split(",").map((v) => v.trim()).filter(Boolean);
  return undefined;
};

/**
 * The sources a request names. `sources` (one or more groups) wins over the
 * older single `source`; nothing named means everyone. "all" anywhere means
 * all, and duplicates are dropped.
 */
export function requestedSources(dto: {
  source?: ContactSource;
  sources?: ContactSource[];
}): ContactSource[] {
  const named = (dto.sources ?? []).filter((s) =>
    (CONTACT_SOURCES as readonly string[]).includes(s),
  );
  const picked: ContactSource[] =
    named.length > 0 ? named : dto.source ? [dto.source] : ["all"];
  if (picked.includes("all")) return ["all"];
  return [...new Set(picked)];
}

/**
 * A campaign as the composer describes it — used for both the preview and
 * the real send, so what was previewed is what is sent.
 *
 * Deliberately carries NO names and NO phone numbers. The audience is only
 * ever a list of contact ids, and the server looks each one up and checks it
 * belongs to the organizer; a browser that could post numbers here could use
 * the organizer's WhatsApp to message anyone.
 *
 * Exactly one of `contactIds` / `allContacts` must be given; that rule spans
 * two fields, so the service enforces it.
 */
export class CampaignRequestDto {
  @IsString()
  @Length(1, 3000)
  @Matches(/\S/, { message: "Write a message first." })
  template: string;

  /** Which collection the contacts are read from (older single form). */
  @IsOptional()
  @IsIn(CONTACT_SOURCES as unknown as string[])
  source?: ContactSource;

  /** One or more groups (Exhibitors, Visitors, …) as server sources; takes
   * precedence over `source`. */
  @Transform(toSourceList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONTACT_SOURCES.length)
  @IsIn(CONTACT_SOURCES as unknown as string[], { each: true })
  sources?: ContactSource[];

  // "" is what a cleared event picker tends to send; it means "every event".
  @Transform(({ value }) => (value === "" || value === null ? undefined : value))
  @IsOptional()
  @IsMongoId()
  eventId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @Matches(CONTACT_ID, { each: true, message: "Invalid contact id." })
  contactIds?: string[];

  @IsOptional()
  @IsBoolean()
  allContacts?: boolean;

  @IsOptional()
  @IsBoolean()
  attachEventImage?: boolean;

  /**
   * With an `eventId`: true (or absent) limits the audience to that event's
   * bookers; false keeps every contact in the chosen groups and uses the
   * event only for `{{event}}` details and the image — "tell all my visitors
   * about this event".
   */
  @IsOptional()
  @IsBoolean()
  filterByEvent?: boolean;
}

/** The contact list the composer shows, read from the same source rules. */
export class ContactsQueryDto {
  @IsOptional()
  @IsIn(CONTACT_SOURCES as unknown as string[])
  source?: ContactSource;

  /** Comma-separated in the query string: `sources=stalls,tickets`. */
  @Transform(toSourceList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONTACT_SOURCES.length)
  @IsIn(CONTACT_SOURCES as unknown as string[], { each: true })
  sources?: ContactSource[];

  @Transform(({ value }) => (value === "" || value === null ? undefined : value))
  @IsOptional()
  @IsMongoId()
  eventId?: string;
}
