import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { ArrowLeft, GraduationCap, Package, Minus, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrencyhook";

interface WorkshopSelection {
  eventId: string;
  organizerId: string;
  eventTitle: string;
  bookingType: "session" | "package";
  sessionId?: string;
  packageId?: string;
  name: string;
  description?: string;
  unitPrice: number;
  seatsRemaining: number | null;
  included?: string[];
}

const WorkshopCheckoutPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const apiURL = __API_URL__;

  const item = location.state as WorkshopSelection | null;

  const [quantity, setQuantity] = useState(1);
  const [visitorInfo, setVisitorInfo] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState("");
  const { formatPrice } = useCurrency(country);

  useEffect(() => {
    if (!item?.organizerId) return;
    fetch(`${apiURL}/organizers/profile-get/${item.organizerId}`)
      .then((r) => r.json())
      .then((result) => setCountry(result?.data?.country || ""))
      .catch(() => undefined);
  }, [item?.organizerId]);

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <p className="text-gray-500 mb-4">No workshop selected.</p>
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft size={16} className="mr-2" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxQty = item.seatsRemaining != null ? item.seatsRemaining : 20;
  const total = item.unitPrice * quantity;

  const handleProceed = async () => {
    if (!visitorInfo.name || !visitorInfo.email || !visitorInfo.phone) {
      toast({
        title: "Missing details",
        description: "Please fill in your name, email and phone.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiURL}/workshop-bookings/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: item.eventId,
          organizerId: item.organizerId,
          bookingType: item.bookingType,
          sessionId: item.sessionId,
          packageId: item.packageId,
          quantity,
          visitorName: visitorInfo.name,
          visitorEmail: visitorInfo.email,
          visitorPhone: visitorInfo.phone,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        toast({
          title: "Booking failed",
          description: result.message,
          variant: "destructive",
          duration: 5000,
        });
        return;
      }
      navigate("/workshop-payment", {
        state: {
          bookings: [result.data],
          eventTitle: item.eventTitle,
          totalAmount: result.data.amount,
          organizerId: item.organizerId,
        },
      });
    } catch (err: any) {
      toast({
        title: "Booking failed",
        description: err.message,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Workshop Checkout</h1>
            <p className="text-sm text-gray-500">{item.eventTitle}</p>
          </div>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {item.bookingType === "package" ? (
                <Package className="h-4 w-4 text-indigo-500" />
              ) : (
                <GraduationCap className="h-4 w-4 text-blue-500" />
              )}
              {item.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {item.description && (
              <p className="text-sm text-gray-600">{item.description}</p>
            )}
            {item.included && item.included.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.included.map((n) => (
                  <Badge key={n} variant="secondary" className="text-xs">
                    {n}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {item.unitPrice === 0 ? "Free" : formatPrice(item.unitPrice)}
                  <span className="text-gray-400 font-normal"> / person</span>
                </p>
                {item.seatsRemaining != null && (
                  <p className="text-xs text-gray-400">
                    {item.seatsRemaining} seat(s) left
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-gray-500 hover:bg-gray-100"
                >
                  <Minus size={14} />
                </button>
                <span className="font-semibold w-6 text-center">{quantity}</span>
                <button
                  type="button"
                  disabled={quantity >= maxQty}
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-bold text-gray-800">Total Amount</span>
              <span className="font-bold text-lg text-blue-600">{formatPrice(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Your Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <input
                type="text"
                placeholder="John Doe"
                value={visitorInfo.name}
                onChange={(e) =>
                  setVisitorInfo({ ...visitorInfo, name: e.target.value })
                }
                className="w-full mt-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <input
                type="email"
                placeholder="john@email.com"
                value={visitorInfo.email}
                onChange={(e) =>
                  setVisitorInfo({ ...visitorInfo, email: e.target.value })
                }
                className="w-full mt-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
              />
            </div>
            <div>
              <Label className="text-xs">Phone *</Label>
              <PhoneInput
                value={visitorInfo.phone}
                onChange={(value) =>
                  setVisitorInfo({ ...visitorInfo, phone: value })
                }
                enableSearch={true}
                countryCodeEditable={false}
                preferredCountries={["in", "sg", "us", "gb", "ae"]}
                inputProps={{ name: "wsPhone", required: true }}
                inputStyle={{
                  width: "100%",
                  height: "42px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  border: "1px solid #e5e7eb",
                }}
                containerStyle={{ width: "100%", marginTop: "4px" }}
                buttonStyle={{
                  borderRadius: "12px 0 0 12px",
                  border: "1px solid #e5e7eb",
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full py-6 text-base font-bold rounded-xl"
          onClick={handleProceed}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" /> Processing...
            </>
          ) : (
            `Proceed to Payment — ${formatPrice(total)}`
          )}
        </Button>
      </div>
    </div>
  );
};

export default WorkshopCheckoutPage;
