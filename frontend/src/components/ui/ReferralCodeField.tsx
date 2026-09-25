import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isMalformedReferralInput } from "@/lib/eventReferral";

interface ReferralCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** The event only accepts bookings that carry a valid code. */
  required?: boolean;
  /** Smaller label, for the forms that use plain (non-shadcn) labels. */
  compact?: boolean;
  className?: string;
  disabled?: boolean;
  /** The code came from the agent's / operator's link: shown, not editable. */
  locked?: boolean;
}

/**
 * "Referral code" input shown first on every public booking form. Prefilled
 * from the agent / operator share link (?ref) when the visitor came through
 * one; always editable so a code passed on by hand can be typed in. The
 * server decides whether a code counts — this field only normalises it.
 */
export function ReferralCodeField({
  value,
  onChange,
  required = false,
  compact = false,
  className = "",
  disabled = false,
  locked = false,
}: ReferralCodeFieldProps) {
  const malformed = isMalformedReferralInput(value);
  const labelClass = compact
    ? "text-[11px] font-medium text-gray-500 mb-1 block"
    : "";
  return (
    <div className={className}>
      <Label className={labelClass}>
        Referral code{" "}
        {required ? (
          <span className="text-red-500">*</span>
        ) : (
          <span className="font-normal text-muted-foreground">(optional)</span>
        )}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="e.g. AB12CD"
        maxLength={12}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        required={required}
        disabled={disabled || locked}
        readOnly={locked}
        className="uppercase tracking-widest"
        aria-invalid={malformed || undefined}
      />
      {locked ? (
        <p className="text-xs text-muted-foreground mt-1">
          Filled in from the link you used. It cannot be changed here.
        </p>
      ) : malformed ? (
        <p className="text-xs text-red-500 mt-1">
          Codes are 4 to 12 letters or digits.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">
          {required
            ? "This event can only be booked with a referral code from an agent."
            : "Came through an agent or operator link? Their code is filled in for you."}
        </p>
      )}
    </div>
  );
}

export default ReferralCodeField;
