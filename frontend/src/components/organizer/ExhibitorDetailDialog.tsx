// File: src/components/organizer/ExhibitorDetailDialog.tsx
// Shared "Exhibitor / Stall Booking Details" dialog used by both the organizer
// (EventAttendees > Exhibitors tab, where it carries admin actions) and the
// operator/volunteer (OperatorVenueView > venue layout > "View details", where
// admin actions are intentionally absent). Action buttons render only when
// their corresponding callback prop is supplied — that's how the volunteer
// view stays read-only without forking the markup.

import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@radix-ui/react-separator";
import {
  AlertCircle,
  Calendar,
  Camera,
  CheckCircle,
  CheckCircle2,
  Clock,
  Clock1,
  Clock12,
  CreditCard,
  FileText,
  Loader2,
  MapPin,
  Package,
  ParkingCircle,
  Plus,
  Send,
  ShieldCheck,
  Wifi,
  XCircle,
} from "lucide-react";
import { FaUtensilSpoon } from "react-icons/fa";
import { StallRequest } from "./shopKeeper";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { toast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";

interface StatusHistoryEntry {
  status: string;
  note?: string;
  changedAt: string;
  changedBy?: string;
}

const apiURL = __API_URL__;

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: any; icon: any; color: string }> = {
    Pending: { variant: "secondary", icon: Clock, color: "text-yellow-600" },
    Confirmed: {
      variant: "default",
      icon: CheckCircle2,
      color: "text-green-600",
    },
    Cancelled: {
      variant: "destructive",
      icon: XCircle,
      color: "text-red-600",
    },
    Processing: {
      variant: "default",
      icon: AlertCircle,
      color: "text-blue-600",
    },
    Completed: {
      variant: "default",
      icon: CheckCircle2,
      color: "text-green-700",
    },
  };
  const config = variants[status] || variants.Pending;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
};

const getPaymentBadge = (paymentStatus: string) => {
  const variants: Record<string, { variant: any; color: string }> = {
    Unpaid: { variant: "destructive", color: "text-red-600" },
    Partial: { variant: "secondary", color: "text-yellow-600" },
    Paid: { variant: "default", color: "text-green-600" },
  };
  const config = variants[paymentStatus] || variants.Unpaid;
  return <Badge variant={config.variant}>{paymentStatus}</Badge>;
};

const formatDate = (dateString: string) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (dateTimeString?: string | Date) => {
  if (!dateTimeString) return "N/A";
  return new Date(dateTimeString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export interface ExhibitorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stallRequest: StallRequest | null;
  /** Optional ref attached to the scrollable detail body — used by callers
   * that want to capture it for PDF generation. */
  detailRef?: React.RefObject<HTMLDivElement>;
  /** When provided, shows the "Confirm Payment" action bar (organizer only).
   * Receives the current stall so the caller can open its payment dialog. */
  onConfirmPayment?: (stall: StallRequest) => void;
  /** When provided, shows the "Deposit Returned" button after checkout
   * (organizer only — volunteers can view but not return deposits). */
  onReturnDeposit?: (stall: StallRequest) => void;
  /** When provided, shows the "Share as PDF" footer button. */
  onSharePDF?: () => void;
  /** Drives the loading state of the PDF button. */
  isGeneratingPDF?: boolean;
  /** Called after a note is successfully appended so the caller can refresh
   * the stall and the new entry shows up in the timeline. */
  onNoteAdded?: () => void | Promise<void>;
  /** Display string the caller wants attached to notes ("Jane (organizer)").
   * If omitted, the dialog derives one from the JWT in sessionStorage. */
  currentUserDisplay?: string;
}

export function ExhibitorDetailDialog({
  open,
  onOpenChange,
  stallRequest,
  detailRef,
  onConfirmPayment,
  onReturnDeposit,
  onSharePDF,
  isGeneratingPDF,
  onNoteAdded,
  currentUserDisplay,
}: ExhibitorDetailDialogProps) {
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  // Note-form state: lives in the Status History card.
  const [noteFormOpen, setNoteFormOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Fallback "addedBy" derived from JWT (email + first role). Callers can
  // override via `currentUserDisplay` when they have richer info.
  const derivedUserDisplay = useMemo(() => {
    if (currentUserDisplay) return currentUserDisplay;
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return "";
      const decoded: any = jwtDecode(token);
      const email: string = decoded?.email || "";
      const roles: string[] = Array.isArray(decoded?.roles) ? decoded.roles : [];
      const role = roles[0] || "user";
      if (!email) return role;
      return `${email} (${role})`;
    } catch {
      return "";
    }
  }, [currentUserDisplay, open]);

  const resetNoteForm = () => {
    setNoteFormOpen(false);
    setNoteText("");
  };

  const handleSubmitNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed || !stallRequest?._id) return;
    setIsAddingNote(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(`${apiURL}/stalls/${stallRequest._id}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          note: trimmed,
          addedBy: derivedUserDisplay || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Add note failed (${res.status})`);
      }
      resetNoteForm();
      await onNoteAdded?.();
      toast({
        duration: 4000,
        title: "Note added",
        description: "Your note has been added to the stall timeline.",
      });
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Could not add note",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAddingNote(false);
    }
  };

  // "Resend ticket" is an organizer-only recovery action (volunteers get a
  // read-only dialog with no admin callbacks). It re-delivers the QR ticket
  // email and surfaces the real failure if the mail server rejects it.
  const canManage = !!onConfirmPayment || !!onReturnDeposit;
  const [isResending, setIsResending] = useState(false);

  const handleResendTicket = async () => {
    if (!stallRequest?._id) return;
    setIsResending(true);
    try {
      const token = sessionStorage.getItem("token");
      const res = await fetch(
        `${apiURL}/stalls/${stallRequest._id}/resend-ticket`,
        {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || `Resend failed (${res.status})`);
      }
      toast({
        duration: 5000,
        title: "Ticket re-sent",
        description: body?.message || "The stall ticket email was sent.",
      });
    } catch (err: any) {
      toast({
        duration: 8000,
        title: "Couldn't send the ticket",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stall Request Details</DialogTitle>
          <DialogDescription>
            Complete information about the stall booking request
          </DialogDescription>
        </DialogHeader>

        {stallRequest && (
          <div className="space-y-6" ref={detailRef}>
            {/* Status and Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Request Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {getStatusBadge(stallRequest.status)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Payment Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {getPaymentBadge(stallRequest.paymentStatus)}
                </CardContent>
              </Card>
            </div>

            {/* Payment Action Bar (organizer only) */}
            {onConfirmPayment &&
              stallRequest.status !== "Pending" &&
              stallRequest.status !== "Cancelled" &&
              (stallRequest.status as string) !== "Forfeited" &&
              stallRequest.paymentStatus !== "Paid" && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm text-blue-900">
                          Payment Confirmation Required
                        </p>
                        <p className="text-xs text-blue-700 mt-0.5">
                          Grand Total:{" "}
                          <span className="font-bold">
                            {formatPrice(stallRequest.grandTotal)}
                          </span>
                          {(stallRequest as any).paidAmount > 0 && (
                            <>
                              {" "}
                              &middot; Paid:{" "}
                              <span className="font-bold">
                                {formatPrice((stallRequest as any).paidAmount)}
                              </span>{" "}
                              &middot; Remaining:{" "}
                              <span className="font-bold">
                                {formatPrice(
                                  (stallRequest as any).remainingAmount,
                                )}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={() => onConfirmPayment(stallRequest)}
                      >
                        <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                        Confirm Payment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Transaction Verification Details */}
            {((stallRequest as any).transactionId ||
              (stallRequest as any).transactionScreenshot) && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-4 space-y-3">
                  <p className="font-semibold text-sm text-amber-900 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Transaction Details from Vendor
                  </p>
                  {(stallRequest as any).transactionId && (
                    <div>
                      <p className="text-xs text-amber-700">
                        Transaction ID / Reference
                      </p>
                      <p className="font-mono font-bold text-sm text-gray-800 bg-white rounded px-3 py-1.5 border border-amber-200 mt-1">
                        {(stallRequest as any).transactionId}
                      </p>
                    </div>
                  )}
                  {(stallRequest as any).transactionScreenshot && (
                    <div>
                      <p className="text-xs text-amber-700 mb-1">
                        Payment Screenshot
                      </p>
                      <a
                        href={`${apiURL}${
                          (stallRequest as any).transactionScreenshot
                        }`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={`${apiURL}${
                            (stallRequest as any).transactionScreenshot
                          }`}
                          alt="Transaction Screenshot"
                          className="max-w-xs max-h-60 rounded-lg border border-amber-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                        />
                      </a>
                    </div>
                  )}
                  {(stallRequest as any).paymentMethod && (
                    <p className="text-xs text-amber-700">
                      Payment Method:{" "}
                      <span className="font-semibold capitalize">
                        {(stallRequest as any).paymentMethod === "bank"
                          ? "Bank Transfer"
                          : "QR / UPI Payment"}
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {stallRequest.paymentStatus === "Paid" && (
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="font-semibold text-sm text-green-800">
                        Payment Confirmed — QR ticket generated and sent to
                        vendor
                      </p>
                    </div>
                    {canManage && (
                      <Button
                        size="sm"
                        variant="buttonOutline"
                        onClick={handleResendTicket}
                        disabled={isResending}
                        className="h-8"
                      >
                        {isResending ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            Resend ticket
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  {canManage && (
                    <p className="mt-2 text-xs text-green-700/80">
                      Didn't arrive? Re-send the QR ticket email to the vendor.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Shopkeeper Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Shopkeeper Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {stallRequest.companyLogo && (
                  <div className="col-span-2 mb-2 flex items-center gap-4">
                    <img
                      src={`${apiURL}${stallRequest.companyLogo}`}
                      alt="Company Logo"
                      className="w-16 h-16 rounded-md object-contain border bg-gray-50"
                    />
                    <div>
                      <p className="font-bold text-lg">
                        {stallRequest.brandName}
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground">Owner Name</Label>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {stallRequest.shopkeeperId?.name ||
                        stallRequest.nameOfApplicant ||
                        "—"}
                    </p>
                    {stallRequest.shopkeeperId?.hasDocVerification && (
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] h-5"
                      >
                        Verified
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Business Name</Label>
                  <p className="font-medium">
                    {stallRequest.shopkeeperId?.shopName ||
                      stallRequest.brandName ||
                      "—"}
                  </p>
                </div>
                {stallRequest.shopkeeperId?.email && (
                  <div>
                    <Label className="text-muted-foreground">
                      Primary Email
                    </Label>
                    <p className="font-medium">
                      <a
                        href={`mailto:${stallRequest.shopkeeperId?.email}`}
                        className="text-blue-600 hover:underline block truncate"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {stallRequest.shopkeeperId?.email}
                      </a>
                    </p>
                  </div>
                )}
                {stallRequest.shopkeeperId?.businessEmail && (
                  <div>
                    <Label className="text-muted-foreground">
                      Business Email
                    </Label>
                    <p className="font-medium">
                      <a
                        href={`mailto:${stallRequest.shopkeeperId?.businessEmail}`}
                        className="text-blue-600 hover:underline block truncate"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {stallRequest.shopkeeperId?.businessEmail}
                      </a>
                    </p>
                  </div>
                )}
                {stallRequest.shopkeeperId?.whatsappNumber && (
                  <div>
                    <Label className="text-muted-foreground">WhatsApp</Label>
                    <p className="font-medium">
                      <a
                        href={`https://wa.me/${(
                          stallRequest.shopkeeperId?.whatsappNumber || ""
                        ).replace(/\+/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                      >
                        {stallRequest.shopkeeperId?.whatsappNumber}
                      </a>
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">
                    Country / Nationality
                  </Label>
                  <p className="font-medium">
                    {(() => {
                      const code =
                        (stallRequest.shopkeeperId as any)?.countryCode ||
                        stallRequest.shopkeeperId?.country ||
                        "";
                      const nationality =
                        stallRequest.businessOwnerNationality ||
                        (stallRequest.shopkeeperId as any)
                          ?.businessOwnerNationality ||
                        "";
                      if (code === "+91" || code === "IN") return "🇮🇳 India";
                      if (code === "+65" || code === "SG") return "🇸🇬 Singapore";
                      if (code === "+1" || code === "US") return "🇺🇸 USA";
                      if (code === "+44" || code === "GB") return "🇬🇧 UK";
                      if (code === "+971" || code === "AE") return "🇦🇪 UAE";
                      if (nationality) return nationality;
                      if (code) return code;
                      return "—";
                    })()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Instagram</Label>
                  <p className="font-medium">
                    {stallRequest.shopkeeperId?.instagramHandle ? (
                      <a
                        href={stallRequest.shopkeeperId?.instagramHandle}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pink-600 hover:underline truncate block"
                      >
                        @
                        {stallRequest.shopkeeperId?.instagramHandle
                          .split("/")
                          .pop()}
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">
                        Not linked
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  {(() => {
                    const code =
                      (stallRequest.shopkeeperId as any)?.countryCode ||
                      stallRequest.shopkeeperId?.country ||
                      "";
                    const isIN = code === "+91" || code === "IN";
                    if (isIN) {
                      return (
                        <>
                          <Label className="text-muted-foreground">
                            GST Number
                          </Label>
                          <p className="font-medium uppercase">
                            {stallRequest.shopkeeperId?.GSTNumber ||
                              "Not Provided"}
                          </p>
                        </>
                      );
                    }
                    if (stallRequest.shopkeeperId?.UENNumber) {
                      return (
                        <>
                          <Label className="text-muted-foreground">
                            UEN Number
                          </Label>
                          <p className="font-medium uppercase">
                            {stallRequest.shopkeeperId.UENNumber}
                          </p>
                        </>
                      );
                    }
                    if (stallRequest.shopkeeperId?.GSTNumber) {
                      return (
                        <>
                          <Label className="text-muted-foreground">
                            GST Number
                          </Label>
                          <p className="font-medium uppercase">
                            {stallRequest.shopkeeperId.GSTNumber}
                          </p>
                        </>
                      );
                    }
                    if (stallRequest.registrationNumber) {
                      return (
                        <>
                          <Label className="text-muted-foreground">
                            Registration No.
                          </Label>
                          <p className="font-medium uppercase">
                            {stallRequest.registrationNumber}
                          </p>
                        </>
                      );
                    }
                    return (
                      <>
                        <Label className="text-muted-foreground">
                          Registration
                        </Label>
                        <p className="font-medium text-muted-foreground italic text-sm">
                          Not Provided
                        </p>
                      </>
                    );
                  })()}
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium">
                    {stallRequest.shopkeeperId?.businessCategory || "—"}
                  </p>
                </div>

                <div>
                  <Label className="text-muted-foreground">
                    Applicant Name
                  </Label>
                  <p className="font-medium">{stallRequest.nameOfApplicant}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Owner Nationality
                  </Label>
                  <p className="font-medium">
                    {stallRequest.businessOwnerNationality || "—"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Residency</Label>
                  <p className="font-medium">{stallRequest.residency || "—"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    No. Of Operators
                  </Label>
                  <p className="font-medium">
                    {stallRequest.noOfOperators || "Not Provided"}
                  </p>
                </div>

                <div>
                  <Label className="text-muted-foreground">
                    Coupon Assigned
                  </Label>
                  <p className="text-sm">
                    {stallRequest.couponCodeAssigned || "None Assigned"}
                  </p>
                </div>

                {stallRequest.registrationNumber && (
                  <div className="pt-2 border-t">
                    <Label className="text-muted-foreground">
                      Registration Number
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">
                        {stallRequest.registrationNumber}
                      </p>
                      {/^(NOGST|NOUEN|NOTPROV)/i.test(
                        String(stallRequest.registrationNumber || ""),
                      ) && (
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-50 text-amber-700"
                        >
                          ⚠ Placeholder — no registration provided, contact
                          vendor
                        </Badge>
                      )}
                      {/* Singapore UEN has no free auto-verify API like India's
                          GST, so give the organizer a one-click Verify: it
                          copies the UEN and opens the official UEN registry —
                          paste it in and hit Search to see the details. */}
                      {!/^(NOGST|NOUEN|NOTPROV)/i.test(
                        String(stallRequest.registrationNumber || ""),
                      ) &&
                        (/singapore/i.test(
                          String(
                            stallRequest.residency ||
                              stallRequest.shopkeeperId?.residency ||
                              "",
                          ),
                        ) ||
                          stallRequest.shopkeeperId?.country === "SG") && (
                        <a
                          href="https://www.bizfile.gov.sg/"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            const uen = String(
                              stallRequest.registrationNumber || "",
                            ).trim();
                            try {
                              navigator.clipboard?.writeText(uen);
                            } catch {
                              /* clipboard blocked — the site still opens */
                            }
                            toast({
                              title: "UEN copied",
                              description:
                                "In BizFile, open the Entity search, paste the UEN and click Search.",
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          title="Copy the UEN and open the official ACRA BizFile registry"
                        >
                          Verify ↗
                        </a>
                      )}
                      {/* India GST — let the organizer verify the GSTIN on the
                          official government portal too (useful when the vendor
                          didn't verify it themselves at registration). */}
                      {!/^(NOGST|NOUEN|NOTPROV)/i.test(
                        String(stallRequest.registrationNumber || ""),
                      ) &&
                        (/india/i.test(
                          String(
                            stallRequest.residency ||
                              stallRequest.shopkeeperId?.residency ||
                              "",
                          ),
                        ) ||
                          stallRequest.shopkeeperId?.country === "IN") && (
                        <a
                          href="https://services.gst.gov.in/services/searchtp"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            const gstin = String(
                              stallRequest.registrationNumber || "",
                            ).trim();
                            try {
                              navigator.clipboard?.writeText(gstin);
                            } catch {
                              /* clipboard blocked — the site still opens */
                            }
                            toast({
                              title: "GSTIN copied",
                              description:
                                "On the GST portal, paste the GSTIN, enter the captcha and click Search.",
                            });
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          title="Copy the GSTIN and open the official GST portal (Search Taxpayer)"
                        >
                          Verify ↗
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* GST verified against the government registry (AppyFlow) at
                    registration — shown so the organizer can approve with
                    confidence without re-checking. */}
                {stallRequest.shopkeeperId?.isGSTVerified &&
                  stallRequest.shopkeeperId?.gstDetails && (
                    <div className="col-span-2 pt-2 border-t">
                      <div className="mb-2 flex items-center gap-2">
                        <Label className="text-muted-foreground">
                          GST Verification
                        </Label>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          ✓ Verified
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                        {(() => {
                          const g = stallRequest.shopkeeperId.gstDetails as any;
                          const rows: [string, string][] = [
                            ["GSTIN", g?.gstin],
                            ["Legal name", g?.legalName],
                            ["Trade name", g?.tradeName],
                            ["Status", g?.status],
                            ["Registered", g?.registrationDate],
                            ["Constitution", g?.constitution],
                            ["State", g?.state],
                            ["Registered address", g?.address],
                          ].filter(([, v]) => !!v) as [string, string][];
                          return rows.map(([label, value]) => (
                            <div
                              key={label}
                              className={
                                label === "Registered address"
                                  ? "sm:col-span-2"
                                  : ""
                              }
                            >
                              <div className="text-xs text-muted-foreground">
                                {label}
                              </div>
                              <div className="font-medium">{value}</div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                {/* Singapore UEN verified against ACRA's free open-data
                    registry at registration. If a brand-new entity wasn't found
                    there, the organizer can still use the "Verify" link above to
                    check the official registry. */}
                {stallRequest.shopkeeperId?.isUENVerified &&
                  stallRequest.shopkeeperId?.uenDetails && (
                    <div className="col-span-2 pt-2 border-t">
                      <div className="mb-2 flex items-center gap-2">
                        <Label className="text-muted-foreground">
                          UEN Verification
                        </Label>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          ✓ Verified
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          via ACRA
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                        {(() => {
                          const u = stallRequest.shopkeeperId.uenDetails as any;
                          const rows: [string, string][] = [
                            ["UEN", u?.uen],
                            ["Entity name", u?.entityName],
                            ["Status", u?.status],
                            ["Entity type", u?.entityType],
                            ["Issued", u?.issueDate],
                            ["Agency", u?.agency],
                            ["Registered address", u?.address],
                          ].filter(([, v]) => !!v) as [string, string][];
                          return rows.map(([label, value]) => (
                            <div
                              key={label}
                              className={
                                label === "Registered address"
                                  ? "sm:col-span-2"
                                  : ""
                              }
                            >
                              <div className="text-xs text-muted-foreground">
                                {label}
                              </div>
                              <div className="font-medium">{value}</div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                {/* Vendor's preferred space type(s), with requested quantity. */}
                {(() => {
                  const sr = stallRequest as any;
                  const names: string[] =
                    Array.isArray(sr.preferredTemplateNames) &&
                    sr.preferredTemplateNames.length
                      ? sr.preferredTemplateNames
                      : sr.preferredTemplateName
                        ? [sr.preferredTemplateName]
                        : [];
                  if (!names.length) return null;
                  const qtys: any[] = Array.isArray(
                    sr.preferredTemplateQuantities,
                  )
                    ? sr.preferredTemplateQuantities
                    : [];
                  const label = names
                    .map((n, i) => {
                      const q = Number(qtys[i]) || 1;
                      return q > 1 ? `${n} × ${q}` : n;
                    })
                    .join(", ");
                  return (
                    <div className="pt-2 border-t">
                      <Label className="text-muted-foreground">
                        Preferred Space Type(s)
                      </Label>
                      <p className="font-medium">{label}</p>
                    </div>
                  );
                })()}

                {stallRequest.registrationImage && (
                  <div className="col-span-2 pt-2 border-t">
                    <Label className="text-muted-foreground block mb-2">
                      Registration Document
                    </Label>
                    <img
                      src={`${apiURL}${stallRequest.registrationImage}`}
                      alt="Registration"
                      className="max-w-xs rounded-md border"
                    />
                  </div>
                )}

                <div className="pt-2 border-t col-span-2">
                  <Label className="text-muted-foreground text-xs">
                    Business Address
                  </Label>
                  <p className="text-sm leading-tight mt-1 italic">
                    {stallRequest.shopkeeperId?.address || "Not provided"}
                  </p>
                </div>

                {stallRequest.refundPaymentDescription && (
                  <div className="pt-2 border-t col-span-2">
                    <Label className="text-muted-foreground text-xs">
                      Refund Payment Details
                    </Label>
                    <p className="text-sm leading-tight mt-1 italic">
                      {stallRequest.refundPaymentDescription}
                    </p>
                  </div>
                )}

                {stallRequest.productDescription && (
                  <div className="col-span-2 pt-2 border-t">
                    <Label className="text-muted-foreground">
                      Product Description
                    </Label>
                    <p className="text-sm mt-1 text-gray-700">
                      {stallRequest.productDescription}
                    </p>
                  </div>
                )}

                {stallRequest.productImage &&
                  stallRequest.productImage.length > 0 && (
                    <div className="col-span-2 pt-2 border-t">
                      <Label className="text-muted-foreground mb-2 block">
                        Product Images
                      </Label>
                      <div className="flex gap-2 overflow-x-auto">
                        {stallRequest.productImage.map(
                          (img: string, idx: number) => (
                            <img
                              key={idx}
                              src={`${apiURL}${img}`}
                              alt="Product"
                              className="w-20 h-20 object-cover rounded-md border"
                            />
                          ),
                        )}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Event Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Event Title</Label>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg">
                        {stallRequest.eventId?.title || "—"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Category</Label>
                    <p className="font-medium">
                      {stallRequest.eventId?.category || "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Duration
                    </Label>
                    <p className="text-sm font-medium">
                      {formatDate(stallRequest.eventId?.startDate)} -{" "}
                      {formatDate(stallRequest.eventId?.endDate)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Starts at: {stallRequest.eventId?.time || "TBA"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Venue
                    </Label>
                    <p className="text-sm font-medium">
                      {stallRequest.eventId?.location || "TBA"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {stallRequest.eventId?.address}
                    </p>
                  </div>
                </div>

                {stallRequest.eventId?.features &&
                  Object.values(stallRequest.eventId.features).some(Boolean) && (
                    <div>
                      <Label className="text-muted-foreground mb-2 block text-xs uppercase tracking-wider">
                        Included Features
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {stallRequest.eventId?.features?.parking && (
                          <Badge
                            variant="outline"
                            className="flex gap-1 items-center bg-green-50"
                          >
                            <ParkingCircle className="w-3 h-3" /> Parking
                          </Badge>
                        )}
                        {stallRequest.eventId?.features?.wifi && (
                          <Badge
                            variant="outline"
                            className="flex gap-1 items-center bg-yellow-50"
                          >
                            <Wifi className="w-3 h-3" /> WiFi
                          </Badge>
                        )}
                        {stallRequest.eventId?.features?.photography && (
                          <Badge
                            variant="outline"
                            className="flex gap-1 items-center bg-blue-50"
                          >
                            <Camera className="w-3 h-3" /> Photography
                          </Badge>
                        )}
                        {stallRequest.eventId?.features?.security && (
                          <Badge
                            variant="outline"
                            className="flex gap-1 items-center bg-red-50"
                          >
                            <ShieldCheck className="w-3 h-3" /> Security
                          </Badge>
                        )}
                        {stallRequest.eventId?.features?.food && (
                          <Badge
                            variant="outline"
                            className="flex gap-1 items-center bg-pink-50"
                          >
                            <FaUtensilSpoon className="w-3 h-3" /> Food Available
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                  <div>
                    <Label className="text-muted-foreground">Dress Code</Label>
                    <p className="text-sm font-medium">
                      {stallRequest.eventId?.dresscode || "Casual"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Age Limit</Label>
                    <p className="text-sm font-medium">
                      {stallRequest.eventId?.ageRestriction || "No Limit"}
                    </p>
                  </div>
                </div>

                {(stallRequest.eventId?.ticketPrice ||
                  ((stallRequest.eventId as any)?.visitorTypes?.length ?? 0) >
                    0) && (
                  <div className="border-t pt-4">
                    <Label className="text-muted-foreground block mb-2">
                      Ticketing
                    </Label>
                    <div className="flex gap-4 text-sm">
                      <div className="text-center p-2 border rounded-md flex-1">
                        <span className="block text-xs text-muted-foreground">
                          Ticket Price
                        </span>
                        <span className="font-bold">
                          {stallRequest.eventId?.ticketPrice
                            ? formatPrice(stallRequest.eventId.ticketPrice)
                            : "Free"}
                        </span>
                      </div>
                      <div className="text-center p-2 border rounded-md flex-1">
                        <span className="block text-xs text-muted-foreground">
                          Available Slots
                        </span>
                        <span className="font-bold">
                          {stallRequest.eventId?.totalTickets || "Unlimited"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {stallRequest.eventId?.gallery?.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="text-muted-foreground block mb-2">
                      Event Gallery
                    </Label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {stallRequest.eventId?.gallery.map((img, idx) => (
                        <img
                          key={idx}
                          src={`${apiURL}${img}`}
                          className="w-16 h-16 rounded-md object-cover border shadow-sm"
                          alt="Event"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Tables */}
            {stallRequest.selectedTables.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Selected Tables</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stallRequest.selectedTables.map((table, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded"
                      >
                        <div>
                          <p className="font-medium">{table.tableName}</p>
                          <p className="text-sm text-muted-foreground">
                            {table.tableType}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatPrice(table.price)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            +{formatPrice(table.depositAmount)} deposit
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Add-ons */}
            {stallRequest.selectedAddOns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Selected Add-ons</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stallRequest.selectedAddOns.map((addon, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded"
                      >
                        <div>
                          <p className="font-medium">{addon.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Quantity: {addon.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">
                            {formatPrice(addon.price * addon.quantity)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(addon.price)} each
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Price Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Price Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Tables Rental</span>
                  <span className="font-semibold">
                    {formatPrice(stallRequest.tablesTotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Deposit</span>
                  <span className="font-semibold">
                    {formatPrice(stallRequest.depositTotal)}
                  </span>
                </div>
                {stallRequest.addOnsTotal > 0 && (
                  <div className="flex justify-between">
                    <span>Add-ons</span>
                    <span className="font-semibold">
                      {formatPrice(stallRequest.addOnsTotal)}
                    </span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Grand Total</span>
                  <span className="text-green-600">
                    {formatPrice(stallRequest.grandTotal)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Request Submitted</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(stallRequest.requestDate)}
                    </p>
                  </div>
                </div>
                {stallRequest.confirmationDate && (
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 rounded-full p-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Request Confirmed</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(stallRequest.confirmationDate)}
                      </p>
                    </div>
                  </div>
                )}
                {stallRequest.selectionDate && (
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-100 rounded-full p-2">
                      <Package className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Tables Selected</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(stallRequest.selectionDate)}
                      </p>
                    </div>
                  </div>
                )}
                {stallRequest.paymentDate && (
                  <div className="flex items-start gap-3">
                    <div className="bg-yellow-100 rounded-full p-2">
                      <CreditCard className="h-4 w-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium">Payment Received</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(stallRequest.paymentDate)}
                      </p>
                    </div>
                  </div>
                )}
                {stallRequest.completionDate && (
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 rounded-full p-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Booking Completed</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(stallRequest.completionDate)}
                      </p>
                    </div>
                  </div>
                )}
                {stallRequest.hasCheckedIn && stallRequest.checkInTime && (
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 rounded-full p-2">
                      <Clock1 className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Checked In Time</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(stallRequest.checkInTime)}
                      </p>
                    </div>
                  </div>
                )}
                {stallRequest.hasCheckedOut && stallRequest.checkOutTime && (
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-start gap-3">
                      <div className="bg-green-100 rounded-full p-2">
                        <Clock12 className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Checked Out Time</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(stallRequest.checkOutTime)}
                        </p>
                      </div>
                    </div>
                    {onReturnDeposit && !stallRequest.depositReturned && (
                      <div className="flex justify-between gap-3">
                        <div>
                          <button
                            className="bg-primary px-4 py-2 rounded text-white"
                            onClick={() => onReturnDeposit(stallRequest)}
                          >
                            Deposit Returned
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status History Timeline with Notes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Status History & Notes
                  </CardTitle>
                  {!noteFormOpen && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setNoteFormOpen(true)}
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Add Note
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {noteFormOpen && (
                    <div className="mb-4 rounded-md border bg-muted/30 p-3 space-y-2">
                      <Label
                        htmlFor="add-stall-note"
                        className="text-sm font-medium"
                      >
                        Add a note
                      </Label>
                      <Textarea
                        id="add-stall-note"
                        placeholder="What happened? (Visible to organizer, operator, volunteer and exhibitor on the timeline.)"
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={3}
                        disabled={isAddingNote}
                      />
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground">
                          {derivedUserDisplay
                            ? `Posting as ${derivedUserDisplay}`
                            : "You'll be recorded as the author."}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={resetNoteForm}
                            disabled={isAddingNote}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSubmitNote}
                            disabled={isAddingNote || !noteText.trim()}
                            className="gap-1"
                          >
                            {isAddingNote ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Save Note
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {(!stallRequest.statusHistory ||
                    stallRequest.statusHistory.length === 0) && (
                    <p className="text-sm text-muted-foreground italic">
                      No timeline entries yet. Use "Add Note" to start the
                      history.
                    </p>
                  )}

                  {stallRequest.statusHistory &&
                    stallRequest.statusHistory.length > 0 && (
                      <div className="relative space-y-0">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                      {stallRequest.statusHistory.map(
                        (entry: StatusHistoryEntry, index: number) => {
                          const statusConfig: Record<
                            string,
                            { bg: string; text: string; border: string }
                          > = {
                            Pending: {
                              bg: "bg-yellow-100",
                              text: "text-yellow-700",
                              border: "border-yellow-300",
                            },
                            Confirmed: {
                              bg: "bg-green-100",
                              text: "text-green-700",
                              border: "border-green-300",
                            },
                            Processing: {
                              bg: "bg-blue-100",
                              text: "text-blue-700",
                              border: "border-blue-300",
                            },
                            Partial: {
                              bg: "bg-orange-100",
                              text: "text-orange-700",
                              border: "border-orange-300",
                            },
                            Paid: {
                              bg: "bg-green-100",
                              text: "text-green-700",
                              border: "border-green-300",
                            },
                            Completed: {
                              bg: "bg-emerald-100",
                              text: "text-emerald-700",
                              border: "border-emerald-300",
                            },
                            Cancelled: {
                              bg: "bg-red-100",
                              text: "text-red-700",
                              border: "border-red-300",
                            },
                            Returned: {
                              bg: "bg-purple-100",
                              text: "text-purple-700",
                              border: "border-purple-300",
                            },
                          };
                          const config = statusConfig[entry.status] || {
                            bg: "bg-gray-100",
                            text: "text-gray-700",
                            border: "border-gray-300",
                          };

                          return (
                            <div
                              key={index}
                              className="relative flex gap-4 pb-6 last:pb-0"
                            >
                              <div
                                className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${config.bg} border-2 ${config.border}`}
                              >
                                <span className="text-xs font-bold">
                                  {index + 1}
                                </span>
                              </div>

                              <div
                                className={`flex-1 rounded-lg border ${config.border} ${config.bg} p-3`}
                              >
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <Badge
                                    className={`${config.bg} ${config.text} border ${config.border} font-semibold`}
                                  >
                                    {entry.status}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDateTime(entry.changedAt)}
                                  </span>
                                </div>

                                {entry.note && (
                                  <p
                                    className={`text-sm mt-2 ${config.text}`}
                                  >
                                    📝 {entry.note}
                                  </p>
                                )}

                                {entry.changedBy && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    By:{" "}
                                    <span className="font-medium capitalize">
                                      {entry.changedBy}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        },
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

            {/* Cancellation Reason */}
            {stallRequest.cancellationReason && (
              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-lg text-red-600">
                    Cancellation Reason
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{stallRequest.cancellationReason}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:justify-between">
          <Button variant="buttonOutline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onSharePDF && (
            <Button
              onClick={onSharePDF}
              disabled={isGeneratingPDF}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Share as PDF
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
