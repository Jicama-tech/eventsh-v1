// File: src/components/organizer/ExhibitorDetailDialog.tsx
// Shared "Exhibitor / Stall Booking Details" dialog used by both the organizer
// (EventAttendees > Exhibitors tab, where it carries admin actions) and the
// operator/volunteer (OperatorVenueView > venue layout > "View details", where
// admin actions are intentionally absent). Action buttons render only when
// their corresponding callback prop is supplied — that's how the volunteer
// view stays read-only without forking the markup.

import React from "react";
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
  ShieldCheck,
  Wifi,
  XCircle,
} from "lucide-react";
import { FaUtensilSpoon } from "react-icons/fa";
import { StallRequest } from "./shopKeeper";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";

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
}: ExhibitorDetailDialogProps) {
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

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
            <div className="grid grid-cols-2 gap-4">
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
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="font-semibold text-sm text-green-800">
                      Payment Confirmed — QR ticket generated and sent to vendor
                    </p>
                  </div>
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
              <CardContent className="grid grid-cols-2 gap-4">
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
                    <p className="font-medium">
                      {stallRequest.registrationNumber}
                    </p>
                  </div>
                )}

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
                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4 p-3 bg-muted/30 rounded-lg">
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

                <div className="grid grid-cols-2 gap-4 border-t pt-4">
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
            {stallRequest.statusHistory &&
              stallRequest.statusHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Status History & Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              )}

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
