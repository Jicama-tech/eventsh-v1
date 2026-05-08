import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Edit3, Plus, Trash } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";

const apiURL = __API_URL__;

/**
 * Standalone Coupons UI. Originally lived inside OrganizerSettings; moved here
 * so it can render as a sibling tab next to My Events. Self-contained — owns
 * its own state, fetches its own coupons + events, and submits directly to
 * the backend coupons API. No props.
 */
export function CouponsManager() {
  const { country: globalCountry } = useCountry();
  const [selectedCountry] = useState(globalCountry || "IN");
  const { formatPrice } = useCurrency(selectedCountry);

  const [coupons, setCoupons] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [openCouponDialog, setOpenCouponDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null);

  const blankCoupon = {
    code: "",
    discountType: "PERCENTAGE",
    discountPercentage: "",
    flatDiscountAmount: "",
    minOrderAmount: "",
    maxUsage: "",
    expiryDate: "",
    appliesTo: "GLOBAL",
    isActive: true,
    eventIds: [] as string[],
  };
  const [coupon, setCoupon] = useState<any>(blankCoupon);
  const resetCoupon = () => setCoupon(blankCoupon);

  const today = new Date().toISOString().split("T")[0];

  // ===== Bootstrap: fetch organizer's coupons + events on mount =====
  useEffect(() => {
    const init = async () => {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return;
        const decoded = jwtDecode<{ sub: string }>(token);
        const organizerId = decoded.sub;

        // Coupons list
        const couponsRes = await fetch(
          `${apiURL}/coupons/organizer/${organizerId}`,
          { method: "GET", headers: { "Content-Type": "application/json" } },
        );
        if (couponsRes.ok) {
          const couponsData = await couponsRes.json();
          setCoupons(couponsData?.data || []);
        }

        // Events list (for the multi-event selector in the dialog)
        const eventsRes = await fetch(
          `${apiURL}/events/organizer/${organizerId}`,
        );
        if (eventsRes.ok) {
          const data = await eventsRes.json();
          setEvents(data.data || []);
        }
      } catch (e) {
        console.error("CouponsManager init failed:", e);
      }
    };
    init();
  }, []);

  // ===== Handlers =====
  const handleAddCoupon = () => {
    resetCoupon();
    setIsEditMode(false);
    setOpenCouponDialog(true);
  };

  const handleEditCoupon = (data: any) => {
    // Migrate legacy single-event coupons (eventId) to the new multi shape.
    const migratedEventIds: string[] = Array.isArray(data.eventIds)
      ? data.eventIds
      : data.eventId && data.eventId !== "NONE"
        ? [data.eventId]
        : [];
    setCoupon({
      ...data,
      eventIds: migratedEventIds,
      expiryDate: data.expiryDate?.split("T")[0],
    });
    setIsEditMode(true);
    setOpenCouponDialog(true);
  };

  const handleChange = (key: string, value: string | number | boolean | string[]) => {
    setCoupon((prev: any) => ({ ...prev, [key]: value }));
  };

  const createCoupon = async (payload: any) => {
    const res = await fetch(`${apiURL}/coupons/create-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to create coupon");
    }
    return res.json();
  };

  const updateCoupon = async (id: string, payload: any) => {
    const res = await fetch(`${apiURL}/coupons/update-coupon/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to update coupon");
    }
    return res.json();
  };

  const handleSubmitCoupon = async () => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) throw new Error("Please login to continue");
      const decoded = jwtDecode<{ sub: string }>(token);
      const organizerId = decoded.sub;
      const payload: any = {
        code: coupon.code,
        organizerId,
        discountType: coupon.discountType,
        discountPercentage:
          coupon.discountType === "PERCENTAGE"
            ? Number(coupon.discountPercentage)
            : undefined,
        flatDiscountAmount:
          coupon.discountType === "FLAT"
            ? Number(coupon.flatDiscountAmount)
            : undefined,
        minOrderAmount: coupon.minOrderAmount
          ? Number(coupon.minOrderAmount)
          : undefined,
        maxUsage: coupon.maxUsage ? Number(coupon.maxUsage) : undefined,
        expiryDate: coupon.expiryDate ? new Date(coupon.expiryDate) : undefined,
        isActive: true,
        appliesTo: "ORGANIZER",
        eventIds:
          Array.isArray(coupon.eventIds) && coupon.eventIds.length > 0
            ? coupon.eventIds
            : undefined,
      };

      if (isEditMode && coupon._id) {
        await updateCoupon(coupon._id, payload);
        setCoupons((prev) =>
          prev.map((c) => (c._id === coupon._id ? { ...c, ...payload } : c)),
        );
      } else {
        const created = await createCoupon(payload);
        setCoupons((prev) => [...prev, created?.data || created]);
      }
      setOpenCouponDialog(false);
    } catch (error: any) {
      console.error("❌ Coupon Error:", error?.message);
      alert(error?.message || "Coupon save failed");
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      const res = await fetch(`${apiURL}/coupons/delete-coupon/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete coupon");
      }
      setCoupons((prev) => prev.filter((c) => c._id !== id));
    } catch (error: any) {
      console.error("❌ Delete Coupon Error:", error?.message);
      alert(error?.message || "Coupon delete failed");
    }
  };

  const handleToggleActiveCoupon = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`${apiURL}/coupons/update-coupon/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to toggle coupon");
      }
      setCoupons((prev) =>
        prev.map((c) => (c._id === id ? { ...c, isActive } : c)),
      );
    } catch (error: any) {
      console.error("❌ Toggle Coupon Error:", error?.message);
      alert(error?.message || "Coupon toggle failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Coupons</h3>
        <Button onClick={handleAddCoupon}>+ Add Coupon</Button>
      </div>

      {coupons.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border rounded-md">
          No Coupons Found
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((c) => (
            <Card key={c._id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{c.code}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.discountType === "PERCENTAGE"
                      ? `${c.discountPercentage}% off`
                      : `${formatPrice(c.flatDiscountAmount)} off`}
                  </p>
                  <p className="text-xs">
                    Expires:{" "}
                    {c.expiryDate ? new Date(c.expiryDate).toDateString() : "—"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={c.isActive}
                    onCheckedChange={() => {
                      handleToggleActiveCoupon(c._id, !c.isActive);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditCoupon(c)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setCouponToDelete(c._id);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={openCouponDialog} onOpenChange={setOpenCouponDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Update Coupon" : "Create Coupon"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-col-2 gap-4">
              <div className="space-y-1 flex-1">
                <Label>Coupon Code</Label>
                <Input
                  placeholder="SAVE20"
                  value={coupon.code}
                  onChange={(e) =>
                    handleChange("code", e.target.value.toUpperCase())
                  }
                  disabled={isEditMode}
                />
              </div>

              <div className="space-y-1 flex-1">
                <Label>Discount Type</Label>
                <Select
                  value={coupon.discountType}
                  onValueChange={(value) => handleChange("discountType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select discount type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                    <SelectItem value="FLAT">Flat Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col-2 gap-4">
              {coupon.discountType === "PERCENTAGE" && (
                <div className="space-y-1 flex-1">
                  <Label>Discount Percentage (%) *</Label>
                  <Input
                    type="number"
                    placeholder="10"
                    min={0}
                    value={coupon.discountPercentage}
                    onChange={(e) =>
                      handleChange("discountPercentage", e.target.value)
                    }
                  />
                </div>
              )}

              {coupon.discountType === "FLAT" && (
                <div className="space-y-1 flex-1">
                  <Label>Flat Discount Amount *</Label>
                  <Input
                    type="number"
                    placeholder="100"
                    min={0}
                    value={coupon.flatDiscountAmount}
                    onChange={(e) =>
                      handleChange("flatDiscountAmount", e.target.value)
                    }
                  />
                </div>
              )}

              <div className="space-y-1 flex-1">
                <Label>Minimum Order Amount *</Label>
                <Input
                  type="number"
                  placeholder="500"
                  min={0}
                  value={coupon.minOrderAmount}
                  onChange={(e) =>
                    handleChange("minOrderAmount", e.target.value)
                  }
                />
              </div>
            </div>

            <div className="flex flex-col-2 gap-4">
              <div className="space-y-1 flex-1">
                <Label>Maximum Usage</Label>
                <Input
                  type="number"
                  placeholder="50"
                  min={0}
                  value={coupon.maxUsage}
                  onChange={(e) => handleChange("maxUsage", e.target.value)}
                />
              </div>

              <div className="space-y-1 flex-1">
                <Label>Expiry Date</Label>
                <div className="relative">
                  <Input
                    type="date"
                    min={today}
                    value={coupon.expiryDate}
                    onChange={(e) =>
                      handleChange("expiryDate", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Linked Events (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">
                    {coupon.eventIds.length === 0
                      ? "All events (Global Coupon)"
                      : coupon.eventIds.length === 1
                        ? events.find((e) => e._id === coupon.eventIds[0])
                            ?.title || "1 event selected"
                        : `${coupon.eventIds.length} events selected`}
                  </span>
                  <Plus className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-2 max-h-[300px] overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-sm text-muted-foreground px-2 py-1.5">
                    No events found.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-2 py-1 mb-1 border-b">
                      <span className="text-xs text-muted-foreground">
                        {coupon.eventIds.length} of {events.length} selected
                      </span>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => handleChange("eventIds", [])}
                      >
                        Clear
                      </button>
                    </div>
                    {events.map((evt) => {
                      const checked = coupon.eventIds.includes(evt._id);
                      return (
                        <label
                          key={evt._id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(val) => {
                              const next = val
                                ? [...coupon.eventIds, evt._id]
                                : coupon.eventIds.filter(
                                    (id: string) => id !== evt._id,
                                  );
                              handleChange("eventIds", next);
                            }}
                          />
                          <span className="text-sm truncate">{evt.title}</span>
                        </label>
                      );
                    })}
                  </>
                )}
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground mt-1">
              Leave empty for an organizer-wide coupon. Select one or more
              events to limit this coupon to those events only.
            </p>
          </div>

          <Button className="w-full mt-4" onClick={handleSubmitCoupon}>
            {isEditMode ? "Update Coupon" : "Create Coupon"}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Coupon</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this coupon? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setCouponToDelete(null);
              }}
            >
              Cancel
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                if (couponToDelete) {
                  handleDeleteCoupon(couponToDelete);
                }
                setDeleteDialogOpen(false);
                setCouponToDelete(null);
              }}
            >
              Yes, Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
