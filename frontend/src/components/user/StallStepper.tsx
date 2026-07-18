// Progress indicator for the exhibitor stall-booking flow. Shown at the top of
// every surface in the flow so the vendor always knows where they are:
//   1. Sign in      → the Google / WhatsApp auth gate
//   2. Terms        → the rules & regulations gate
//   3. Your details → the stall registration form
//   4. Spaces & pay → space selection + payment
//   5. Confirmed    → payment approved, booking complete (transaction cycle done)
//
// Two stages wait on the organizer: after the form is submitted (request
// approval) and after payment is submitted (payment approval). Pass
// `pending` + a `note` to render the waiting banner at either point.
import { Check, Clock } from "lucide-react";

const STALL_STEPS = [
  "Sign in",
  "Terms",
  "Your details",
  "Spaces & pay",
  "Confirmed",
] as const;

export function StallStepper({
  current,
  pending = false,
  note,
}: {
  /** 1-based active step. Steps below `current` render as done; pass a value
   *  past the last step (e.g. 6) to mark every step complete. */
  current: number;
  /** True while awaiting organizer approval — the `current` step renders as
   *  not-yet-started and the waiting banner is shown. */
  pending?: boolean;
  /** Banner text when `pending` (defaults to organizer approval). */
  note?: string;
}) {
  return (
    <div className="mb-4">
      <ol className="flex items-start">
        {STALL_STEPS.map((label, i) => {
          const step = i + 1;
          const done = step < current;
          const active = !pending && step === current;
          const isLast = step === STALL_STEPS.length;
          return (
            <li
              key={label}
              className="relative flex flex-1 flex-col items-center"
            >
              {/* connector line to the next step (sits behind the circle) */}
              {!isLast && (
                <span
                  className={`absolute left-1/2 top-3 h-0.5 w-full ${
                    done ? "bg-blue-500" : "bg-gray-200"
                  }`}
                />
              )}
              <span
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                  done
                    ? "border-blue-500 bg-blue-500 text-white"
                    : active
                      ? "border-blue-500 bg-white text-blue-600"
                      : "border-gray-300 bg-white text-gray-400"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step}
              </span>
              <span
                className={`mt-1.5 px-0.5 text-center text-[10px] leading-tight sm:text-xs ${
                  active
                    ? "font-semibold text-blue-600"
                    : done
                      ? "text-gray-600"
                      : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
      {pending && (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800">
          <Clock className="h-3.5 w-3.5" />
          {note || "Waiting for organizer approval"}
        </div>
      )}
    </div>
  );
}

export default StallStepper;
