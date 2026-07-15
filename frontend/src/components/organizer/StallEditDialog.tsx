// Organizer-side "Edit stall request" dialog. Lets the organizer re-allocate a
// booking's spaces (restricted to the vendor's PREFERRED template/type) and
// add-ons. If the change costs more, it shows the dynamic-QR payment panel (the
// same one the vendor sees) so the organizer can collect the difference —
// on-screen or via a shareable pay link — then confirm payment (which re-issues
// the ticket) and resend it. Space/add-on totals are recomputed server-side.

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, Copy, Minus, Plus, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useCountry } from "@/hooks/useCountry";
import { useCurrency } from "@/hooks/useCurrencyhook";
import StallPaymentPanel from "../user/StallPaymentPanel";

const apiURL = __API_URL__;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  stall: any;
  changedBy: string;
  onDone: () => void | Promise<void>;
}

export function StallEditDialog({
  open,
  onOpenChange,
  stall,
  changedBy,
  onDone,
}: Props) {
  const { country } = useCountry();
  const { formatPrice } = useCurrency(country);

  // Which section of the edit dialog is showing.
  const [tab, setTab] = useState<"details" | "spaces">("details");
  const [form, setForm] = useState<Record<string, string>>({});
  const [savingDetails, setSavingDetails] = useState(false);

  const [loading, setLoading] = useState(true);
  const [allTables, setAllTables] = useState<any[]>([]);
  // tableTemplates keyed by id — the fallback source for member pricing.
  const [templatesById, setTemplatesById] = useState<Record<string, any>>({});
  // Event-level cap on how many spaces one vendor may book (0 = no cap).
  const [maxSpacesPerVendor, setMaxSpacesPerVendor] = useState(0);

  // Member vendors get member pricing (falls back to regular when unset).
  const vendorIsMember = !!stall?.shopkeeperId?.isMember;

  // Member-aware price/deposit for a placed space, mirroring the eventfront.
  const priceOf = (t: any) => {
    const tpl = templatesById[String(t?.id)] || {};
    const reg = Number(t?.tablePrice ?? t?.bookingPrice ?? t?.price ?? 0);
    if (!vendorIsMember) return reg;
    const mp =
      t?.memberPrice ??
      tpl?.memberPrice ??
      t?.memberBookingPrice ??
      tpl?.memberBookingPrice;
    return mp != null ? Number(mp) : reg;
  };
  const depositOf = (t: any) => {
    const tpl = templatesById[String(t?.id)] || {};
    const reg = Number(t?.depositPrice ?? 0);
    if (!vendorIsMember) return reg;
    const md = t?.memberDepositPrice ?? tpl?.memberDepositPrice;
    return md != null ? Number(md) : reg;
  };
  const [addOnItems, setAddOnItems] = useState<any[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(
    new Set(),
  );
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});

  const [saving, setSaving] = useState(false);
  // "edit" → picking spaces/add-ons; "pay" → collect the extra charge.
  const [step, setStep] = useState<"edit" | "pay">("edit");
  const [amountDue, setAmountDue] = useState(0);
  // True after a save that needed no extra charge — lets the organizer resend
  // the updated ticket without a payment step.
  const [savedNoCharge, setSavedNoCharge] = useState(false);
  const [payTxnId, setPayTxnId] = useState("");
  const [payScreenshot, setPayScreenshot] = useState<File | null>(null);
  const [payLink, setPayLink] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);

  const eventId = stall?.eventId?._id || stall?.eventId;
  const organizerId = stall?.organizerId?._id || stall?.organizerId;

  // The vendor's preferred templates — spaces are restricted to these.
  const preferredIds: string[] = useMemo(() => {
    const multi = stall?.preferredTemplateIds;
    if (Array.isArray(multi) && multi.length > 0) return multi.map(String);
    return [stall?.preferredTemplateId].filter(Boolean).map(String);
  }, [stall]);

  const myPositions = useMemo<Set<string>>(
    () =>
      new Set(
        (stall?.selectedTables || []).map((t: any) => String(t.positionId)),
      ),
    [stall],
  );

  // Per-template quantities the vendor requested (parallel to
  // preferredTemplateIds); 0 = unspecified for that type.
  const typeAllowance = useMemo(() => {
    const ids: string[] =
      Array.isArray(stall?.preferredTemplateIds) &&
      stall.preferredTemplateIds.length
        ? stall.preferredTemplateIds.map(String)
        : [stall?.preferredTemplateId].filter(Boolean).map(String);
    const qtys: number[] = Array.isArray(stall?.preferredTemplateQuantities)
      ? stall.preferredTemplateQuantities
      : [];
    const map: Record<string, number> = {};
    ids.forEach((id, i) => {
      map[id] = Number(qtys[i]) || 0;
    });
    return map;
  }, [stall]);

  const requestedTotal = useMemo(
    () => Object.values(typeAllowance).reduce((s, n) => s + (n || 0), 0),
    [typeAllowance],
  );

  // The vendor's allowed booking count: their requested total (if given),
  // capped by the event's max-per-vendor; else just the event cap.
  const allowedTotal = useMemo(() => {
    if (requestedTotal > 0)
      return maxSpacesPerVendor > 0
        ? Math.min(requestedTotal, maxSpacesPerVendor)
        : requestedTotal;
    return maxSpacesPerVendor > 0 ? maxSpacesPerVendor : Infinity;
  }, [requestedTotal, maxSpacesPerVendor]);

  const selectedByType = useMemo(() => {
    const m: Record<string, number> = {};
    allTables
      .filter((t) => selectedPositions.has(t.positionId))
      .forEach((t) => {
        const id = String(t.id ?? "");
        m[id] = (m[id] || 0) + 1;
      });
    return m;
  }, [allTables, selectedPositions]);

  // Load spaces (with booking status) + the event's add-on catalogue.
  useEffect(() => {
    if (!open || !eventId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setStep("edit");
      setTab("details");
      setSavedNoCharge(false);
      setPayTxnId("");
      setPayScreenshot(null);

      // Seed the details form from the stall + its vendor profile.
      const v = stall?.shopkeeperId || {};
      setForm({
        name: v.name || "",
        email: v.email || "",
        businessEmail: v.businessEmail || "",
        whatsAppNumber: v.whatsappNumber || v.whatsAppNumber || "",
        phoneNumber: v.phoneNumber || v.phone || "",
        country: v.country || v.countryCode || "",
        businessName: v.businessName || "",
        businessType: v.businessType || "",
        businessCategory: v.businessCategory || "",
        businessDescription: v.businessDescription || "",
        address: v.address || "",
        city: v.city || "",
        state: v.state || "",
        pincode: v.pincode || "",
        faceBookLink: v.faceBookLink || "",
        instagramLink: v.instagramLink || v.instagramHandle || "",
        brandName: stall?.brandName || v.brandName || "",
        nameOfApplicant: stall?.nameOfApplicant || v.nameOfApplicant || "",
        registrationNumber:
          stall?.registrationNumber || v.registrationNumber || "",
        residency: stall?.residency || v.residency || "",
        businessOwnerNationality:
          stall?.businessOwnerNationality || v.businessOwnerNationality || "",
        noOfOperators: stall?.noOfOperators || v.noOfOperators || "",
        refundPaymentDescription:
          stall?.refundPaymentDescription || v.refundPaymentDescription || "",
        productDescription:
          stall?.productDescription || v.productDescription || "",
      });
      try {
        const [tRes, eRes] = await Promise.all([
          fetch(`${apiURL}/stalls/available-tables/${eventId}`),
          fetch(`${apiURL}/events/${eventId}`),
        ]);
        const tJson = await tRes.json();
        const eJson = await eRes.json();
        if (cancelled) return;
        const ev = eJson?.data || eJson;

        // Flatten venueTables — it's sometimes a flat array, sometimes an
        // object keyed by layout id (the available-tables endpoint only handles
        // the array shape, so we read spaces straight off the event here).
        const flatten = (vt: any): any[] => {
          if (Array.isArray(vt)) return vt;
          if (vt && typeof vt === "object")
            return Object.values(vt).flatMap((x: any) =>
              Array.isArray(x) ? x : [],
            );
          return [];
        };
        const eventTables = flatten(ev?.venueTables);

        // Authoritative "booked" set: prefer the endpoint's booked list (it
        // recomputes from active stalls); fall back to each space's own flag.
        const gaBooked = new Set(
          (tJson?.data?.bookedTables || []).map((t: any) => t.positionId),
        );
        const gaWorked = (tJson?.data?.allTables || []).length > 0;
        const tables = eventTables.map((t: any) => ({
          ...t,
          isBooked: gaWorked ? gaBooked.has(t.positionId) : !!t.isBooked,
        }));

        setAllTables(tables);
        const tplMap: Record<string, any> = {};
        (Array.isArray(ev?.tableTemplates) ? ev.tableTemplates : []).forEach(
          (t: any) => {
            if (t?.id != null) tplMap[String(t.id)] = t;
          },
        );
        setTemplatesById(tplMap);
        setMaxSpacesPerVendor(Number(ev?.maxSpacesPerVendor) || 0);
        setAddOnItems(Array.isArray(ev?.addOnItems) ? ev.addOnItems : []);
        setSelectedPositions(new Set(myPositions));
        const q: Record<string, number> = {};
        (stall?.selectedAddOns || []).forEach((a: any) => {
          q[a.addOnId] = Number(a.quantity) || 0;
        });
        setAddonQty(q);
      } catch {
        toast({
          title: "Couldn't load the layout",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Spaces the organizer may allocate: only the vendor's preferred type(s),
  // and either free or already this booking's own.
  const pickableSpaces = useMemo(() => {
    return allTables
      .filter(
        (t) =>
          preferredIds.length === 0 || preferredIds.includes(String(t.id)),
      )
      .map((t) => ({
        ...t,
        mine: myPositions.has(t.positionId),
        takenByOther: !!t.isBooked && !myPositions.has(t.positionId),
      }));
  }, [allTables, preferredIds, myPositions]);

  const toggleSpace = (t: any) => {
    if (t.takenByOther) return;
    const isSel = selectedPositions.has(t.positionId);
    if (!isSel) {
      // Enforce the vendor's allowed booking numbers before adding.
      if (selectedPositions.size >= allowedTotal) {
        toast({
          title: `This vendor may book at most ${allowedTotal} space${allowedTotal === 1 ? "" : "s"}.`,
          variant: "destructive",
        });
        return;
      }
      const id = String(t.id ?? "");
      const perTypeMax = typeAllowance[id] || 0;
      if (perTypeMax > 0 && (selectedByType[id] || 0) >= perTypeMax) {
        toast({
          title: `The vendor requested only ${perTypeMax} of this space type.`,
          variant: "destructive",
        });
        return;
      }
    }
    setSelectedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(t.positionId)) next.delete(t.positionId);
      else next.add(t.positionId);
      return next;
    });
  };

  const bump = (id: string, delta: number, max: number) =>
    setAddonQty((prev) => {
      const v = Math.max(0, Math.min(max, (prev[id] || 0) + delta));
      return { ...prev, [id]: v };
    });

  // Live totals preview.
  const { newGrand, extra } = useMemo(() => {
    const chosen = allTables.filter((t) => selectedPositions.has(t.positionId));
    const tablesTotal = chosen.reduce((s, t) => s + priceOf(t), 0);
    const depositTotal = chosen.reduce((s, t) => s + depositOf(t), 0);
    const addOnsTotal = addOnItems.reduce(
      (s, a) => s + (addonQty[a.id] || 0) * Number(a.price || 0),
      0,
    );
    const grand = tablesTotal + depositTotal + addOnsTotal;
    return { newGrand: grand, extra: Math.max(0, grand - (stall?.grandTotal || 0)) };
  }, [allTables, selectedPositions, addOnItems, addonQty, stall]);

  const setField = (k: string, val: string) =>
    setForm((prev) => ({ ...prev, [k]: val }));

  const renderField = (
    label: string,
    key: string,
    opts: { full?: boolean; area?: boolean } = {},
  ) => (
    <div className={opts.full ? "sm:col-span-2" : ""}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {opts.area ? (
        <Textarea
          value={form[key] || ""}
          onChange={(e) => setField(key, e.target.value)}
          rows={2}
        />
      ) : (
        <Input
          value={form[key] || ""}
          onChange={(e) => setField(key, e.target.value)}
        />
      )}
    </div>
  );

  const saveDetails = async () => {
    setSavingDetails(true);
    try {
      const res = await fetch(`${apiURL}/stalls/${stall._id}/edit-details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, changedBy }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) {
        throw new Error(j?.message || "Failed to update details");
      }
      toast({ title: "Details updated" });
      await onDone();
    } catch (e: any) {
      toast({
        title: "Couldn't update",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const save = async () => {
    if (selectedPositions.size === 0) {
      toast({ title: "Select at least one space", variant: "destructive" });
      return;
    }
    const selectedTables = allTables
      .filter((t) => selectedPositions.has(t.positionId))
      .map((t) => ({
        tableId: t.id,
        positionId: t.positionId,
        tableName: t.tableName || t.name || "",
        tableType: t.type || "",
        layoutName: t.layoutName || "",
        price: priceOf(t),
        depositAmount: depositOf(t),
      }));
    const selectedAddOns = addOnItems
      .filter((a) => (addonQty[a.id] || 0) > 0)
      .map((a) => ({
        addOnId: a.id,
        name: a.name,
        price: Number(a.price || 0),
        quantity: addonQty[a.id],
      }));

    setSaving(true);
    try {
      const res = await fetch(`${apiURL}/stalls/${stall._id}/organizer-edit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedTables, selectedAddOns, changedBy }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) {
        throw new Error(j?.message || "Failed to update the booking");
      }
      const due = Number(j.amountDue) || 0;
      await onDone();
      if (due > 0) {
        setAmountDue(due);
        setStep("pay");
        toast({
          title: "Allocation updated",
          description: `Collect ${formatPrice(due)} from the vendor, then confirm payment.`,
        });
      } else {
        setSavedNoCharge(true);
        toast({
          title: "Allocation updated",
          description: "No extra charge. You can resend the ticket if needed.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Couldn't update",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Collect the extra charge: save the proof (if any), mark paid (which
  // re-issues the QR ticket), then finish.
  const confirmPaid = async () => {
    setConfirming(true);
    try {
      if (payTxnId.trim() || payScreenshot) {
        const proof = new FormData();
        proof.append("stallId", stall._id);
        if (payTxnId.trim()) proof.append("transactionId", payTxnId.trim());
        if (payScreenshot) proof.append("screenshot", payScreenshot);
        await fetch(`${apiURL}/stalls/upload-transaction-screenshot`, {
          method: "POST",
          body: proof,
        }).catch(() => {});
      }
      const res = await fetch(`${apiURL}/stalls/${stall._id}/payment-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "Paid", changedBy }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) {
        throw new Error(j?.message || "Failed to confirm payment");
      }
      toast({
        title: "Payment confirmed",
        description: "The updated ticket has been re-issued and emailed.",
      });
      await onDone();
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Couldn't confirm",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  const resendTicket = async () => {
    setResending(true);
    try {
      const res = await fetch(`${apiURL}/stalls/${stall._id}/resend-ticket`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.success === false) {
        throw new Error(j?.message || "Failed to resend the ticket");
      }
      toast({ title: "Ticket resent to the vendor" });
    } catch (e: any) {
      toast({
        title: "Couldn't resend",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const copyLink = async () => {
    if (!payLink) return;
    try {
      await navigator.clipboard.writeText(payLink);
      toast({ title: "Payment link copied" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "edit" ? "Edit stall — spaces & add-ons" : "Collect the extra charge"}
          </DialogTitle>
          <DialogDescription>
            {step === "edit"
              ? "Re-allocate spaces (limited to the vendor's preferred type) and add-ons. Any extra charge is collected next."
              : `Show the QR to the vendor or share the pay link. After they pay, confirm to re-issue the ticket.`}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
            Loading layout…
          </div>
        ) : step === "edit" ? (
          <div className="space-y-4">
            {/* Tab switcher */}
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setTab("details")}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium ${tab === "details" ? "bg-white shadow" : "text-muted-foreground"}`}
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => setTab("spaces")}
                className={`flex-1 rounded-md px-3 py-1.5 font-medium ${tab === "spaces" ? "bg-white shadow" : "text-muted-foreground"}`}
              >
                Spaces &amp; Add-ons
              </button>
            </div>

            {tab === "details" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderField("Owner Name", "name")}
                {renderField("Applicant Name", "nameOfApplicant")}
                {renderField("Brand Name", "brandName")}
                {renderField("Business Name", "businessName")}
                {renderField("Primary Email", "email")}
                {renderField("Business Email", "businessEmail")}
                {renderField("WhatsApp", "whatsAppNumber")}
                {renderField("Phone", "phoneNumber")}
                {renderField("Country", "country")}
                {renderField("Owner Nationality", "businessOwnerNationality")}
                {renderField("Business Type", "businessType")}
                {renderField("Business Category", "businessCategory")}
                {renderField("Registration No.", "registrationNumber")}
                {renderField("Residency", "residency")}
                {renderField("No. of Operators", "noOfOperators")}
                {renderField("Facebook", "faceBookLink")}
                {renderField("Instagram", "instagramLink")}
                {renderField("Address", "address", { full: true })}
                {renderField("City", "city")}
                {renderField("State", "state")}
                {renderField("Pincode", "pincode")}
                {renderField("Business Description", "businessDescription", {
                  area: true,
                  full: true,
                })}
                {renderField("Product Description", "productDescription", {
                  area: true,
                  full: true,
                })}
                {renderField(
                  "Refund Payment Description",
                  "refundPaymentDescription",
                  { area: true, full: true },
                )}
              </div>
            ) : (
            <div className="space-y-5">
            {/* Spaces */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">
                  Spaces —{" "}
                  {Number.isFinite(allowedTotal)
                    ? `${selectedPositions.size} of ${allowedTotal} allowed`
                    : `${selectedPositions.size} selected`}
                </h4>
                {preferredIds.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    Preferred type only
                  </span>
                )}
              </div>
              {pickableSpaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {allTables.length === 0
                    ? "No spaces are configured on this event's venue."
                    : preferredIds.length > 0
                      ? "No free spaces of the vendor's preferred type right now (all taken)."
                      : "No spaces available."}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {pickableSpaces.map((t) => {
                    const checked = selectedPositions.has(t.positionId);
                    const tplId = String(t.id ?? "");
                    const perTypeMax = typeAllowance[tplId] || 0;
                    const atLimit =
                      !checked &&
                      (selectedPositions.size >= allowedTotal ||
                        (perTypeMax > 0 &&
                          (selectedByType[tplId] || 0) >= perTypeMax));
                    const disabled = t.takenByOther || atLimit;
                    return (
                      <button
                        key={t.positionId}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleSpace(t)}
                        className={`flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm transition-colors ${
                          disabled
                            ? "border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed"
                            : checked
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {t.tableName || t.name || "Space"}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {t.type || "Space"} · {formatPrice(priceOf(t))}
                            {depositOf(t) > 0
                              ? ` + ${formatPrice(depositOf(t))} dep.`
                              : ""}
                            {t.takenByOther ? " · booked" : ""}
                          </div>
                        </div>
                        <span
                          className={`h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center ${
                            checked
                              ? "bg-blue-600 border-blue-600"
                              : "border-gray-300"
                          }`}
                        >
                          {checked && <Check className="h-3 w-3 text-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Add-ons */}
            {addOnItems.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Add-ons</h4>
                <div className="space-y-2">
                  {addOnItems.map((a) => {
                    const max = Number(a.maxPerSpace ?? a.maxPerTemplate ?? 99);
                    const qty = addonQty[a.id] || 0;
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{a.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatPrice(Number(a.price || 0))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => bump(a.id, -1, max)}
                            disabled={qty === 0}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="w-6 text-center tabular-nums">
                            {qty}
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => bump(a.id, 1, max)}
                            disabled={qty >= max}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="rounded-lg bg-slate-50 border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Current total paid</span>
                <span className="font-medium">
                  {formatPrice(stall?.grandTotal || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">New total</span>
                <span className="font-medium">{formatPrice(newGrand)}</span>
              </div>
              <div className="flex justify-between border-t pt-1">
                <span className="font-semibold">Extra to collect</span>
                <span
                  className={`font-bold ${extra > 0 ? "text-orange-600" : "text-green-600"}`}
                >
                  {formatPrice(extra)}
                </span>
              </div>
            </div>
            </div>
            )}
          </div>
        ) : (
          // Pay step
          <div className="space-y-3">
            <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm">
              Extra to collect:{" "}
              <span className="font-bold">{formatPrice(amountDue)}</span>
            </div>
            {payLink && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={copyLink}
              >
                <Copy className="h-4 w-4 mr-1.5" /> Copy pay link to share
              </Button>
            )}
            <StallPaymentPanel
              organizerId={String(organizerId)}
              amount={amountDue}
              reference={stall._id}
              whatsAppNumber={stall?.shopkeeperId?.whatsappNumber}
              transactionId={payTxnId}
              onTransactionIdChange={setPayTxnId}
              screenshot={payScreenshot}
              onScreenshotChange={setPayScreenshot}
              onLinkReady={setPayLink}
            />
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "edit" && tab === "details" ? (
            <>
              <Button
                variant="buttonOutline"
                onClick={() => onOpenChange(false)}
                disabled={savingDetails}
              >
                Close
              </Button>
              <Button onClick={saveDetails} disabled={savingDetails || loading}>
                {savingDetails ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save details"
                )}
              </Button>
            </>
          ) : step === "edit" && savedNoCharge ? (
            <>
              <Button
                variant="buttonOutline"
                onClick={resendTicket}
                disabled={resending}
              >
                {resending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Resend ticket
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          ) : step === "edit" ? (
            <>
              <Button
                variant="buttonOutline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || loading}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="buttonOutline"
                onClick={resendTicket}
                disabled={resending}
              >
                {resending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Resend ticket
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={confirmPaid}
                disabled={confirming}
              >
                {confirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Confirming…
                  </>
                ) : (
                  "Confirm payment & issue ticket"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StallEditDialog;
