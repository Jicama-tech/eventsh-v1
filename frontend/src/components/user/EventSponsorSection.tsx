import { useEffect, useState } from "react";
import SponsorMarquee from "@/components/ui/SponsorMarquee";

const apiURL = __API_URL__;

interface ConfirmedSponsor {
  _id: string;
  logo: string;
  companyName: string;
  sponsorTypeName?: string;
  website?: string;
}

const resolveSrc = (u: string) =>
  /^https?:\/\//.test(u) || u.startsWith("blob:") ? u : `${apiURL}${u}`;

/**
 * Sponsor logo marquee: the organizer's manually-uploaded logos plus the
 * logos of any business whose sponsorship has been confirmed and paid.
 * Self-contained so eventFront only needs a one-line mount.
 */
export function EventSponsorMarquee({
  eventId,
  staticLogos = [],
}: {
  eventId?: string;
  staticLogos?: string[];
}) {
  const [confirmed, setConfirmed] = useState<ConfirmedSponsor[]>([]);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiURL}/sponsors/event/${eventId}/confirmed-logos`,
        );
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled && Array.isArray(j?.data)) setConfirmed(j.data);
      } catch {
        // Non-fatal — fall back to the organizer's own logo list.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const logos = [
    ...staticLogos.map(resolveSrc),
    ...confirmed.filter((c) => c.logo).map((c) => resolveSrc(c.logo)),
  ];
  if (logos.length === 0) return null;

  return (
    <div className="border-b border-gray-100 bg-white py-4">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-widest text-gray-400">
        Our Sponsors
      </p>
      <SponsorMarquee logos={logos} />
    </div>
  );
}
