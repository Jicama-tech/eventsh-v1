// Derives a SPECIFIC, organizer-facing stage label for a stall/exhibitor
// booking, so the list says WHAT a booking is waiting on rather than a bare
// "Pending" / "Processing".
//
// The platform encodes the lifecycle across several fields (no dedicated
// "submitted" state), so we read them together:
//   - Vendor just submitted a request      → status "Pending"    (awaiting the
//     organizer's approval of the request)
//   - Organizer approved, vendor not paid   → status "Confirmed", Unpaid, no proof
//   - Vendor selected spaces + paid         → status "Processing", proof present
//     (awaiting the organizer's payment verification)
//   - Organizer verified payment            → status "Completed" / Paid
// Plus the amendment / cancellation side-flows.

export interface StallStage {
  label: string;
  /** Tailwind badge classes (bg + text). */
  className: string;
}

const AMBER = "bg-amber-100 text-amber-800";
const BLUE = "bg-blue-100 text-blue-800";
const ORANGE = "bg-orange-100 text-orange-800";
const YELLOW = "bg-yellow-100 text-yellow-800";
const GREEN = "bg-green-100 text-green-800";
const GRAY = "bg-gray-100 text-gray-700";
const ROSE = "bg-rose-100 text-rose-700";

export function stallStage(stall: any): StallStage {
  const status = stall?.status || "Pending";
  const paymentStatus = stall?.paymentStatus || "Unpaid";
  const pendingCancel = stall?.pendingCancellation?.status;
  const pendingAmend = stall?.pendingAmendment?.status;

  // Side-flows take precedence — they're the thing needing attention.
  if (pendingCancel === "requested")
    return { label: "Cancellation Requested", className: ROSE };
  if (pendingAmend === "paid_pending_confirm")
    return { label: "Edit — Pending Approval", className: BLUE };

  if (status === "Cancelled") return { label: "Cancelled", className: GRAY };

  // Initial request awaiting the organizer's approval.
  if (status === "Pending")
    return { label: "Pending Approval", className: AMBER };

  // Fully settled.
  if (paymentStatus === "Paid" || status === "Completed")
    return { label: "Confirmed & Paid", className: GREEN };

  // Part-paid, balance still owed.
  if (paymentStatus === "Partial")
    return { label: "Partial — Balance Pending", className: YELLOW };

  // Vendor selected spaces + submitted payment → awaiting the organizer's
  // payment verification.
  if (status === "Processing")
    return { label: "Pending Payment Approval", className: ORANGE };

  // Approved by the organizer; it's now the vendor's turn to pay.
  if (status === "Confirmed" || status === "Approved")
    return { label: "Approved — Awaiting Payment", className: BLUE };

  return { label: status, className: GRAY };
}
