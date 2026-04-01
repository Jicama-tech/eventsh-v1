import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Store,
  Palette,
  ShoppingCart,
  CreditCard,
  Package,
  Bell,
  Globe,
  Settings,
  Upload,
  Truck,
  DollarSign,
  Mail,
  Phone,
  MapPin,
  Clock,
  Lock,
  Shield,
  ExternalLink,
  BellRing,
  CalendarIcon,
  FileText,
  Building,
  QrCode,
  Flag,
  Banknote,
  AlertCircle,
  Eye,
  EyeOff,
  ReceiptText,
  Building2,
  CheckCircle2,
  Zap,
  Info,
  ShieldCheck,
  Loader,
  Receipt,
  ReceiptTextIcon,
  CopyPlusIcon,
  Trash,
  Edit3,
  UserPlus2,
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { format } from "date-fns";
import { Calendar } from "../ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { lazy, Suspense } from "react";
import "react-quill/dist/quill.snow.css";
const ReactQuill = lazy(() => import("react-quill"));
import { useCurrency } from "@/hooks/useCurrencyhook";
import { useCountry } from "@/hooks/useCountry";
// import { Globe, CreditCard } from "lucide-react";

export const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

interface Operator {
  _id?: string;
  name: string;
  email: string;
  whatsAppNumber: string;
  organizerId?: string;
}

interface ShopkeeperSettingsProps {
  onSave?: (settings: any) => void;
}

interface Country {
  name: string;
  code: string;
  dialCode: string;
}

// Overlay wrapper to blur and disable non-profile tabs
export function BlurWrapper({
  children,
  label = "In development",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <span className="rounded-full bg-black/60 text-white text-xs md:text-sm px-3 py-1 shadow">
          {label}
        </span>
      </div>
      <div className="blur-sm pointer-events-none select-none">{children}</div>
    </div>
  );
}

export function OrganizerSettings({ onSave }: ShopkeeperSettingsProps) {
  const { toast } = useToast();
  const [paymentQrFile, setPaymentQrFile] = useState<File | null>(null);
  const [paymentQrPreview, setPaymentQrPreview] = useState<string | null>(null);
  const apiURL = __API_URL__;

  // Country codes for WhatsApp
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [countryCode, setCountryCode] = useState("+91");
  const [whatsAppNumber, setwhatsAppNumber] = useState("");
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null);

  const APPYFLOW_KEY = import.meta.env.VITE_APPYFLOW_KEY_SECRET;

  const COUNTRIES = [
    {
      code: "IN",
      name: "India",
      countryCode: "+91",
      docType: "GST",
      transactionLimit: "INR 100,000",
      contactEmail: "support@eventsh.com",
      contactPhone: "+91-XXX-XXX-XXXX",
    },
    {
      code: "SG",
      name: "Singapore",
      countryCode: "+65",
      docType: "UEN",
      transactionLimit: "SGD 50,000",
      contactEmail: "support@eventsh.com",
      contactPhone: "+65-XXXX-XXXX",
    },
  ];

  const { country: globalCountry, setCountry: setGlobalCountry } = useCountry();
  const [selectedCountry, setSelectedCountry] = useState(globalCountry || "IN");
  const { formatPrice, getSymbol } = useCurrency(selectedCountry);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState({
    organizationName: "",
    ownerName: "",
    email: "",
    phone: "",
    address: "",
    description: "",
    GSTNumber: "",
    UENNumber: "",
  });

  const currentCountry = COUNTRIES.find((c) => c.code === selectedCountry);

  const [gstVerified, setGstVerified] = useState(false);
  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstError, setGstError] = useState("");
  const [uenVerified, setUenVerified] = useState(false);
  const [uenVerifying, setUenVerifying] = useState(false);
  const [uenError, setUenError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gstDetails, setGstDetails] = useState(null);
  const [gstValid, setGstValid] = useState<boolean | null>(null);
  const [ueValid, setUeValid] = useState<boolean | null>(null);

  // Profile (aligned to Shopkeeper Registration fields)
  const [shopProfile, setOrganizerProfile] = useState({
    _id: "",
    ownerName: "",
    organizationName: "",
    email: "",
    businessEmail: "",
    whatsAppNumber: "",
    phone: "",
    address: "",
    description: "",
    businessCategory: "",
    country: selectedCountry,
    receiptType: "58MM",
    whatsAppQR: false,
    instagramQR: false,
    dynamicQR: false,
    whatsAppQRNumber: "",
    instagramHandle: "",
    GSTNumber: "",
    UENNumber: "",
    hasDocVerification: false,
    paymentURL: "",
    taxPercentage: 0,
    discountPercentage: 0,
    shopClosedFromDate: "",
    shopClosedToDate: "",
    termsAndConditions: "",
    bankTransferEnabled: false,
    bankName: "",
    bankAccountNumber: "",
    bankIfscCode: "",
    bankSwiftCode: "",
    bankBranchCode: "",
    bankBranch: "",
    accountHolderName: "",
    bankAccountType: "",
    payNowId: "",
    businessHours: {
      monday: { open: "09:00", close: "18:00", closed: false },
      tuesday: { open: "09:00", close: "18:00", closed: false },
      wednesday: { open: "09:00", close: "18:00", closed: false },
      thursday: { open: "09:00", close: "18:00", closed: false },
      friday: { open: "09:00", close: "20:00", closed: false },
      saturday: { open: "10:00", close: "20:00", closed: false },
      sunday: { open: "12:00", close: "17:00", closed: false },
    },
  });

  const [hasDocVerification, setHasDocVerified] = useState(false);

  const [shopClosedFromDate, setOrganizerClosedFromDate] = useState<
    Date | undefined
  >(
    shopProfile.shopClosedFromDate
      ? new Date(shopProfile.shopClosedFromDate)
      : undefined,
  );
  const [shopClosedToDate, setOrganizerClosedToDate] = useState<
    Date | undefined
  >(
    shopProfile.shopClosedToDate
      ? new Date(shopProfile.shopClosedToDate)
      : undefined,
  );

  const [bankInfo, setBankInfo] = useState({
    //
    panNumber: "",
    gstNumber: "",

    // Singapore
    uenNumber: "",

    // Both
    accountHolder: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    accountType: "savings",
    isVerified: false,
  });

  const [showPan, setShowPan] = useState(false);
  const [showUen, setShowUen] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);

  // const handleSaveBankInfo = async () => {
  //   setIsSavingBank(true);
  //   try {
  //     // Encrypt before sending
  //     const encrypted = await encryptSensitiveData(bankInfo);

  //     await api.post(`/shopkeepers/${organizerId}/bank-info`, encrypted);

  //     setBankInfo((prev) => ({ ...prev, isVerified: true }));
  //     toast({ duration: 5000, title: "Bank details saved securely!" });
  //   } finally {
  //     setIsSavingBank(false);
  //   }
  // };

  const handleFromDateChange = (date: Date | undefined) => {
    setOrganizerClosedFromDate(date);

    setOrganizerProfile((p) => {
      // if no date, clear both in profile
      if (!date) {
        return {
          ...p,
          shopClosedFromDate: "",
          shopClosedToDate: "",
        };
      }

      // if current to-date is <= new from-date, clear to-date
      let newToDateStr = p.shopClosedToDate;
      if (shopClosedToDate && shopClosedToDate <= date) {
        setOrganizerClosedToDate(undefined);
        newToDateStr = "";
      }

      return {
        ...p,
        shopClosedFromDate: date.toISOString(), // store as string
        shopClosedToDate: newToDateStr,
      };
    });
  };

  const handleToDateChange = (date: Date | undefined) => {
    setOrganizerClosedToDate(date);

    setOrganizerProfile((p) => ({
      ...p,
      shopClosedToDate: date ? date.toISOString() : "",
    }));
  };

  // Calculate minimum date for "To Date" (From Date + 1 day)
  const getMinToDate = () => {
    if (!shopClosedFromDate) return new Date();

    const d = new Date(shopClosedFromDate);
    d.setDate(d.getDate() + 1);
    return d;
  };

  // Fetch countries from REST Countries API
  // Update the fetchCountries function
  useEffect(() => {
    async function fetchCountries() {
      try {
        setLoadingCountries(true);
        const response = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,cca2,idd",
        );
        const data = await response.json();
        const mapped = data
          .map((country: any) => {
            const root = country.idd?.root ?? "";
            const suffixes = country.idd?.suffixes ?? [];
            const dialCode = suffixes.length === 1 ? root + suffixes[0] : root;
            return {
              name: country.name?.common || "",
              code: country.cca2 || "",
              dialCode: dialCode,
            };
          })
          .filter(
            (c: Country) =>
              c.dialCode &&
              c.dialCode.trim() !== "" &&
              c.name &&
              c.name.trim() !== "" &&
              c.code &&
              c.code.trim() !== "",
          ) // More robust filtering
          .sort((a: Country, b: Country) => a.name.localeCompare(b.name));
        setCountries(mapped);
      } catch (error) {
        console.error("Failed to fetch countries:", error);
        toast({
          duration: 5000,
          title: "Error",
          description: "Failed to load country codes",
          variant: "destructive",
        });
        // Set fallback countries if API fails
        setCountries([
          { name: "India", code: "IN", dialCode: "+91" },
          { name: "United States", code: "US", dialCode: "+1" },
          { name: "United Kingdom", code: "GB", dialCode: "+44" },
        ]);
      } finally {
        setLoadingCountries(false);
      }
    }
    fetchCountries();
  }, []);

  const handleVerifyGST = async (GSTnumber: string) => {
    try {
      setLoading(true);

      const gstin = GSTnumber?.trim().toUpperCase();
      if (!gstin) {
        toast({
          duration: 5000,
          title: "Error",
          description: "GST Number is required",
        });
        return;
      }

      if (!APPYFLOW_KEY) {
        toast({
          duration: 5000,
          title: "Config error",
          description: "AppyFlow API key not configured",
        });
        return;
      }

      const url = `https://appyflow.in/api/verifyGST?gstNo=${encodeURIComponent(
        gstin,
      )}&key_secret=${encodeURIComponent(APPYFLOW_KEY)}`;

      const response = await fetch(url);
      if (!response.ok) {
        toast({
          duration: 5000,
          title: "Verification failed",
          description: `API error: ${response.status}`,
        });
        setGstValid(false);
        return;
      }

      const data = await response.json();

      if (data?.taxpayerInfo?.sts === "Active" || data?.is_gst_valid === true) {
        setGstValid(true);
        setGstDetails(data);

        toast({
          duration: 5000,
          title: "GST Verified",
          description: `Registered name: ${
            data.taxablePersonName || data.taxpayerInfo?.tradeNam || gstin
          }`,
        });

        // Auto-fill address from GST data
        const addr = data?.taxpayerInfo?.pradr?.addr || data?.pradr?.addr;
        const fullAddress = [
          addr?.bnm,
          addr?.flno,
          addr?.st,
          addr?.loc,
          addr?.dst,
          addr?.stcd,
          addr?.pncd,
        ]
          .filter(Boolean)
          .join(", ");

        setOrganizerProfile((prev) => ({
          ...prev,
          address: fullAddress || prev.address,
          ownerName: data?.taxpayerInfo?.lgnm || prev.ownerName,
          organizationName:
            data?.taxpayerInfo?.tradeNam || prev.organizationName,
          isGSTVerified: true,
          hasDocVerification: true,
        }));
      } else {
        setGstValid(false);
        toast({
          duration: 5000,
          title: "Invalid GST",
          description: "GST number is not valid or inactive",
        });
      }
    } catch (error) {
      console.error("GST verify error", error);
      toast({
        duration: 5000,
        title: "Error",
        description: "Something went wrong while verifying GST",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUEN = async () => {
    try {
      setUenVerifying(true);
      setUenError("");

      const response = await fetch(`${apiURL}/verify/uen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          uenNumber: shopProfile.UENNumber,
        }),
      });

      if (!response.ok) {
        throw new Error("Invalid or inactive UEN number");
      }

      setUenVerified(true);
      toast({
        duration: 5000,
        title: "✓ UEN Verified",
        description: "Your UEN number has been verified successfully",
      });
    } catch (error: any) {
      setUenError(error.message || "Failed to verify UEN");
      toast({
        duration: 5000,
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUenVerifying(false);
    }
  };

  // Parse existing whatsapp number into country code and local number
  useEffect(() => {
    if (shopProfile.whatsAppNumber) {
      // Try to match country code from existing number
      for (const country of countries) {
        if (shopProfile.whatsAppNumber.startsWith(country.dialCode)) {
          setCountryCode(country.dialCode);
          setwhatsAppNumber(
            shopProfile.whatsAppNumber.slice(country.dialCode.length),
          );
          setWhatsappVerified(true); // Assume existing number is verified
          return;
        }
      }
      // Fallback: assume it's a full number with default country code
      setwhatsAppNumber(shopProfile.whatsAppNumber);
      setWhatsappVerified(true);
    }
  }, [shopProfile.whatsAppNumber, countries]);

  // Get full whatsapp number
  const getFullwhatsAppNumber = () => {
    return countryCode + whatsAppNumber;
  };

  // Send OTP
  const handleSendOtp = async () => {
    if (!whatsAppNumber) {
      toast({
        duration: 5000,
        title: "Please enter WhatsApp number",
        variant: "destructive",
      });
      return;
    }

    setSendingOtp(true);
    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        toast({
          duration: 5000,
          title: "Please login first",
          variant: "destructive",
        });
        return;
      }

      const decoded = jwtDecode<{ sub: string }>(token);
      const userId = decoded.sub;

      const res = await fetch(`${apiURL}/otp/send-whatsapp-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whatsAppNumber: getFullwhatsAppNumber(),
        }),
      });

      if (!res.ok) throw new Error("Failed to send WhatsApp OTP");

      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        toast({
          duration: 5000,
          title: "OTP Sent",
          description: "Please check WhatsApp for OTP",
        });
      } else if (data.alreadyVerified) {
        setWhatsappVerified(true);
        toast({
          duration: 5000,
          title: "Already Verified",
          description: data.message,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSendingOtp(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp) {
      toast({
        duration: 5000,
        title: "Please enter OTP",
        variant: "destructive",
      });
      return;
    }

    setVerifyingOtp(true);
    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        toast({
          duration: 5000,
          title: "Please login first",
          variant: "destructive",
        });
        return;
      }

      const decoded = jwtDecode<{ sub: string }>(token);
      const userId = decoded.sub;

      const res = await fetch(`${apiURL}/users/verify-whatsapp-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          whatsAppNumber: getFullwhatsAppNumber(),
          otp,
        }),
      });

      if (!res.ok) throw new Error("Failed to verify WhatsApp OTP");

      const data = await res.json();
      if (data.success) {
        setWhatsappVerified(true);
        setOtpSent(false);
        setOtp("");
        // Update profile with verified number
        setOrganizerProfile((prev) => ({
          ...prev,
          whatsAppNumber: getFullwhatsAppNumber(),
        }));
        toast({
          duration: 5000,
          title: "WhatsApp Verified",
          description: "Number verified successfully",
        });
      } else if (data.alreadyVerified) {
        setWhatsappVerified(true);
        toast({
          duration: 5000,
          title: "Already Verified",
          description: data.message,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const onPaymentQrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        duration: 5000,
        title: "Invalid file",
        description: "Only images are allowed",
        variant: "destructive",
      });
      return;
    }
    setPaymentQrFile(file);
    setPaymentQrPreview(URL.createObjectURL(file));
  };

  const removePaymentQr = () => {
    if (paymentQrPreview) URL.revokeObjectURL(paymentQrPreview);
    setPaymentQrPreview(null);
    setPaymentQrFile(null);
  };

  // Branding Settings
  const [branding, setBranding] = useState({
    primaryColor: "#3b82f6",
    secondaryColor: "#64748b",
    accentColor: "#f59e0b",
    backgroundColor: "#ffffff",
    textColor: "#1f2937",
    fontFamily: "Inter",
    showLogo: true,
    customCSS: "",
  });

  // Product Settings
  const [productSettings, setProductSettings] = useState({
    defaultCurrency: "USD",
    taxRate: 8.5,
    lowStockThreshold: 10,
    autoPublish: true,
    requireApproval: false,
    allowBackorders: false,
    trackInventory: true,
    showOutOfStock: true,
    enableReviews: true,
    enableWishlist: true,
    productImageSize: "medium",
    enableVariants: true,
    sku: { autoGenerate: true, prefix: "EP", startNumber: 1000 },
  });

  // Cart & Checkout Settings
  const [cartSettings, setCartSettings] = useState({
    enableGuestCheckout: true,
    requireAccountForPurchase: false,
    cartSessionTimeout: 30,
    enableAbandonedCartRecovery: true,
    abandonedCartDelay: 60,
    maxCartItems: 50,
    enableCoupons: true,
    enableDiscounts: true,
    minimumOrderAmount: 0,
    freeShippingThreshold: 50,
    enableMultiplePaymentMethods: true,
    enableSaveForLater: true,
    enableQuickBuy: true,
    showRecommendations: true,
  });

  // Payment Settings
  const [paymentSettings, setPaymentSettings] = useState({
    acceptCreditCards: true,
    acceptDebitCards: true,
    acceptPayPal: true,
    acceptApplePay: false,
    acceptGooglePay: false,
    acceptCrypto: false,
    enableInstallments: false,
    paymentProcessingFee: 2.9,
    refundPolicy: "30 days",
    autoRefund: false,
  });

  const [paymentMethods, setPaymentMethods] = useState({
    razorpayCards: false,
    staticQR: true,
    dynamicQR: false,
    // ...other methods
  });

  const [razorpaySettings, setRazorpaySettings] = useState({
    isConnected: false,
    razorpayAccountId: "",
    businessName: "",
    businessType: "proprietorship",
    accountHolderName: "",
    bankAccountNumber: "",
    bankName: "",
    ifscCode: "",
    panNumber: "",
    gstNumber: "",
    uenNumber: "",
    businessEmail: "",
    businessPhone: "",
    consent: false,
    enableCards: true,
    enableUpi: true,
    enableNetbanking: true,
    enableWallets: false,
  });

  const [isConnectingRazorpay, setIsConnectingRazorpay] = useState(false);

  const [operators, setOperators] = useState<Operator[]>([]);
  const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);
  const [editingOperatorIndex, setEditingOperatorIndex] = useState<
    number | null
  >(null);
  const [operatorForm, setOperatorForm] = useState<{
    name: string;
    operatorCountryCode: string;
    operatorEmail: string;
    operatorLocalNumber: string;
  }>({
    name: "",
    operatorCountryCode: "+91",
    operatorEmail: "",
    operatorLocalNumber: "",
  });
  const [isSavingOperators, setIsSavingOperators] = useState(false);

  // const handleConnectRazorpay = async () => {
  //   setIsConnectingRazorpay(true);
  //   try {
  //     // POST razorpaySettings + shopProfile.id to your backend
  //     // Backend will call Razorpay partner API to create account
  //     await api.post(`/payments/razorpay/setup`, {
  //       organizerId: shopProfile.id,
  //       data: razorpaySettings,
  //     });
  //     // Then mark as connected or pending based on response
  //     setRazorpaySettings((prev) => ({
  //       ...prev,
  //       isConnected: true,
  //       razorpayAccountId: "RZP_FAKE_ID", // replace with real id from API
  //     }));
  //   } finally {
  //     setIsConnectingRazorpay(false);
  //   }
  // };

  // Shipping Settings
  const [shippingSettings, setShippingSettings] = useState({
    enableShipping: true,
    freeShippingThreshold: 50,
    defaultShippingCost: 5.99,
    expeditedShipping: true,
    expeditedCost: 12.99,
    internationalShipping: false,
    estimatedDelivery: "3-5 business days",
    trackingEnabled: true,
    packageWeight: 1,
    packageDimensions: { length: 12, width: 8, height: 4 },
  });

  const [coupons, setCoupons] = useState<any[]>([]);

  const [openCouponDialog, setOpenCouponDialog] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const [coupon, setCoupon] = useState<any>({
    code: "",
    discountType: "PERCENTAGE",
    discountPercentage: "",
    flatDiscountAmount: "",
    minOrderAmount: "",
    maxUsage: "",
    expiryDate: "",
    appliesTo: "GLOBAL",
    isActive: true,
    eventId: "NONE", // ✅ ADDED: Default to "NONE"
  });

  const resetCoupon = () => {
    setCoupon({
      code: "",
      discountType: "PERCENTAGE",
      discountPercentage: "",
      flatDiscountAmount: "",
      minOrderAmount: "",
      maxUsage: "",
      expiryDate: "",
      appliesTo: "GLOBAL",
      isActive: true,
      eventId: "NONE", // ✅ ADDED
    });
  };

  useEffect(() => {
    const fetchOrganizerEvents = async () => {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return;
        const decoded = jwtDecode<{ sub: string }>(token);
        const organizerId = decoded.sub;

        // ⚠️ Adjust this URL to match your backend's "get events by organizer" route
        const res = await fetch(`${apiURL}/events/organizer/${organizerId}`);
        if (res.ok) {
          const data = await res.json();
          // Assuming your backend returns an array of events
          setEvents(data.data);
        }
      } catch (error) {
        console.error("Failed to fetch events:", error);
      }
    };

    fetchOrganizerEvents();
  }, []);

  const handleAddCoupon = () => {
    resetCoupon();
    setIsEditMode(false);
    setOpenCouponDialog(true);
  };

  const handleEditCoupon = (data: any) => {
    setCoupon({
      ...data,
      expiryDate: data.expiryDate?.split("T")[0],
    });
    setIsEditMode(true);
    setOpenCouponDialog(true);
  };

  const today = new Date().toISOString().split("T")[0];

  const handleChange = (key: string, value: string | number | boolean) => {
    setCoupon((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const createCoupon = async (payload: any) => {
    const res = await fetch(`${apiURL}/coupons/create-coupon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
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
      const err = await res.json();
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
      const payload = {
        code: coupon.code,
        organizerId: organizerId,
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

        // ✅ ADDED: Send the eventId if one was selected
        eventId:
          coupon.eventId && coupon.eventId !== "NONE"
            ? coupon.eventId
            : undefined,
      };


      if (isEditMode && coupon._id) {
        await updateCoupon(coupon._id, payload);
      } else {
        await createCoupon(payload);
      }

      setOpenCouponDialog(false);
      setCoupons((prev) => [
        ...prev.filter((c) => c._id !== coupon._id),
        coupon,
      ]);
    } catch (error: any) {
      console.error("❌ Coupon Error:", error.message);
      alert(error.message);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      const res = await fetch(`${apiURL}/coupons/delete-coupon/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete coupon");
      }
      setCoupons((prev) => prev.filter((c) => c._id !== id));
    } catch (error: any) {
      console.error("❌ Delete Coupon Error:", error.message);
      alert(error.message);
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
        const err = await res.json();
        throw new Error(err.message || "Failed to toggle coupon");
      }
      setCoupons((prev) =>
        prev.map((c) => (c._id === id ? { ...c, isActive } : c)),
      );
    } catch (error: any) {
      console.error("❌ Toggle Coupon Error:", error.message);
      alert(error.message);
    }
  };

  // ✅ Fetch operators from dedicated endpoint
  const fetchOperators = async (organizerId: string, token: string) => {
    try {
      const res = await fetch(
        `${apiURL}/operators/get-by-organizer/${organizerId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) return; // empty list is fine
      const json = await res.json();
      setOperators(json?.data ?? []);
    } catch (err) {
      console.error("Failed to fetch operators", err);
    }
  };

  // ✅ Create operator via POST
  const handleSubmitOperator = async () => {
    if (!operatorForm.name.trim() || !operatorForm.operatorLocalNumber.trim()) {
      toast({
        duration: 3000,
        title: "Please fill all fields",
        variant: "destructive",
      });
      return;
    }

    setIsSavingOperators(true);
    try {
      const token = sessionStorage.getItem("token");
      if (!token) throw new Error("Please login");
      const decoded = jwtDecode<{ sub: string }>(token);
      const organizerId = decoded.sub;

      const fullWhatsApp =
        operatorForm.operatorCountryCode + operatorForm.operatorLocalNumber;

      const isEditing = editingOperatorIndex !== null;
      const editingOperator = isEditing
        ? operators[editingOperatorIndex!]
        : null;

      const url = isEditing
        ? `${apiURL}/operators/update-operator/${editingOperator!._id}`
        : `${apiURL}/operators/create-by-organizer/${organizerId}`;

      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: operatorForm.name,
          whatsAppNumber: fullWhatsApp,
          email: operatorForm.operatorEmail,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to save operator");
      }

      await fetchOperators(organizerId, token);
      toast({
        duration: 3000,
        title: isEditing ? "Operator updated" : "Operator added",
      });
      setOperatorDialogOpen(false);
      setOperatorForm({
        name: "",
        operatorCountryCode: "+91",
        operatorEmail: "",
        operatorLocalNumber: "",
      });
      setEditingOperatorIndex(null);
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingOperators(false);
    }
  };

  // ✅ Delete operator via DELETE
  const handleDeleteOperator = async (operatorId: string) => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) throw new Error("Please login");
      const decoded = jwtDecode<{ sub: string }>(token);
      const organizerId = decoded.sub;

      const res = await fetch(`${apiURL}/operators/${operatorId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to delete operator");
      }

      await fetchOperators(organizerId, token);
      toast({ duration: 3000, title: "Operator deleted" });
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // Notification Settings
  const [notifications, setNotifications] = useState({
    orderReceived: true,
    lowStock: true,
    // newCustomer: true,
    // productReview: true,
    // refundRequest: true,
    emailNotifications: true,
    // smsNotifications: false,
    // pushNotifications: true,
    dailyReports: true,
    weeklyReports: true,
  });

  // Store Front Settings
  const [storeFront, setStoreFront] = useState({
    customDomain: "",
    enableCustomDomain: false,
    seoTitle: "EventFlow Shop - Premium Event Products",
    seoDescription:
      "Discover premium event products and services at EventFlow Shop",
    socialMediaLinks: {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
    enableChat: true,
    enableWishlist: true,
    showRecentlyViewed: true,
    enableSearch: true,
    enableFilters: true,
    productsPerPage: 20,
  });

  // const [paymentMethods, setPaymentMethods] = useState({
  //   staticQR: false,
  //   dynamicQR: false,
  //   cardPayments: false,
  // });

  // Stripe (kept as-is)
  const [stripeSettings, setStripeSettings] = useState({
    isConnected: false,
    stripeAccountId: null,
    accountHolder: "",
    panNumber: "",
    gstNumber: "",
    uenNumber: "",
    bankName: "",
    accountNumber: "",
    ifscCode: "",
  });

  const [isConnectingStripe, setIsConnectingStripe] = useState(false);

  const handleSave = async () => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        toast({
          duration: 5000,
          title: "Error",
          description: "Please login",
          variant: "destructive",
        });
        return;
      }

      type JwtPayload = { sub?: string; [k: string]: any };
      const decoded = jwtDecode<JwtPayload>(token);
      const id = decoded?.sub;
      if (!id) {
        toast({
          duration: 5000,
          title: "Error",
          description: "Invalid session (no id)",
          variant: "destructive",
        });
        return;
      }

      const fd = new FormData();
      // Optional textual fields to update:
      fd.append("ownerName", shopProfile.ownerName || "");
      fd.append("organizationName", shopProfile.organizationName || "");
      fd.append("email", shopProfile.email || "");
      fd.append("businessEmail", shopProfile.businessEmail || "");
      fd.append("termsAndConditions", shopProfile.termsAndConditions || "");
      fd.append("whatsAppNumber", getFullwhatsAppNumber() || "");
      fd.append("taxPercentage", shopProfile.taxPercentage.toString() || "");
      fd.append(
        "discountPercentage",
        shopProfile.discountPercentage.toString() || "",
      );

      fd.append("phone", shopProfile.phone || "");
      fd.append("address", shopProfile.address || "");
      fd.append("description", shopProfile.description || "");
      fd.append("GSTNumber", shopProfile.GSTNumber || "");
      fd.append(
        "hasDocVerification",
        shopProfile.hasDocVerification.toString(),
      );
      fd.append("receiptType", shopProfile.receiptType);
      fd.append("UENNumber", shopProfile.UENNumber || "");
      fd.append("whatsAppQR", shopProfile.whatsAppQR.toString());
      fd.append("instagramQR", shopProfile.instagramQR.toString());
      fd.append("dynamicQR", shopProfile.dynamicQR.toString());
      fd.append("whatsAppQRNumber", shopProfile.whatsAppQRNumber || "");
      fd.append("instagramHandle", shopProfile.instagramHandle || "");
      fd.append("country", selectedCountry);
      fd.append("businessCategory", shopProfile.businessCategory || "");
      if (shopClosedFromDate) {
        fd.append("shopClosedFromDate", shopClosedFromDate.toISOString());
      }
      if (shopClosedToDate) {
        fd.append("shopClosedToDate", shopClosedToDate.toISOString());
      }

      // Bank transfer details
      fd.append("bankTransferEnabled", String(shopProfile.bankTransferEnabled));
      fd.append("bankName", shopProfile.bankName || "");
      fd.append("bankAccountNumber", shopProfile.bankAccountNumber || "");
      fd.append("bankIfscCode", shopProfile.bankIfscCode || "");
      fd.append("bankSwiftCode", shopProfile.bankSwiftCode || "");
      fd.append("bankBranchCode", shopProfile.bankBranchCode || "");
      fd.append("bankBranch", shopProfile.bankBranch || "");
      fd.append("accountHolderName", shopProfile.accountHolderName || "");
      fd.append("bankAccountType", shopProfile.bankAccountType || "");
      fd.append("payNowId", shopProfile.payNowId || "");

      // File
      if (paymentQrFile) fd.append("paymentURL", paymentQrFile);


      const res = await fetch(`${apiURL}/organizers/profile/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          // Do NOT set Content-Type manually; let the browser set multipart boundary
        },
        body: fd,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to update profile: ${res.status} ${txt}`);
      }

      const json = await res.json().catch(() => ({}));
      const d = json?.data || json;

      setOrganizerProfile((p) => ({
        ...p,
        ownerName: d?.name ?? p.ownerName,
        organizationName: d?.organizationName ?? p.organizationName,
        email: d?.email ?? p.email,
        businessEmail: d?.businessEmail ?? p.businessEmail,
        whatsAppNumber: d?.whatsAppNumber ?? p.whatsAppNumber,
        taxPercentage: d?.taxPercentage ?? p.taxPercentage,
        discountPercentage: d?.discountPercentage ?? p.discountPercentage,
        whatsAppQR: d?.whatsAppQR ?? p.whatsAppQR,
        instagramQR: d?.instagramQR ?? p.instagramQR,
        dynamicQR: d?.dynamicQR ?? p.dynamicQR,
        whatsAppQRNumber: d?.whatsAppQRNumber ?? p.whatsAppQRNumber,
        instagramHandle: d?.instagramHandle ?? p.instagramHandle,
        phone: d?.phone ?? p.phone,
        address: d?.address ?? p.address,
        description: d?.description ?? p.description,
        receiptType: d?.receiptType ?? p.receiptType,
        termsAndConditions: d?.termsAndConditions ?? p.termsAndConditions,
        businessCategory: d?.businessCategory ?? p.businessCategory,
        paymentURL: d?.paymentURL ?? p.paymentURL,
        bankTransferEnabled: d?.bankTransferEnabled ?? p.bankTransferEnabled,
        bankName: d?.bankName ?? p.bankName,
        bankAccountNumber: d?.bankAccountNumber ?? p.bankAccountNumber,
        bankIfscCode: d?.bankIfscCode ?? p.bankIfscCode,
        bankSwiftCode: d?.bankSwiftCode ?? p.bankSwiftCode,
        bankBranchCode: d?.bankBranchCode ?? p.bankBranchCode,
        bankBranch: d?.bankBranch ?? p.bankBranch,
        accountHolderName: d?.accountHolderName ?? p.accountHolderName,
        bankAccountType: d?.bankAccountType ?? p.bankAccountType,
        payNowId: d?.payNowId ?? p.payNowId,
      }));

      if (paymentQrPreview) {
        URL.revokeObjectURL(paymentQrPreview);
        setPaymentQrPreview(null);
        setPaymentQrFile(null);
      }

      // Update global country context so all components reflect the change instantly
      setGlobalCountry(selectedCountry);

      await fetchOperators(id, token);

      toast({
        duration: 5000,
        title: "Saved",
        description: "Profile updated successfully",
      });
    } catch (e: any) {
      console.error("Save profile error", e);
      toast({
        duration: 5000,
        title: "Error",
        description: e.message || "Failed to save profile",
        variant: "destructive",
      });
    }
  };

  // const handleSaveStripe = async () => {
  //   setIsStripeLoading(true);
  //   try {
  //     const {
  //       data: { user },
  //     } = await supabase.auth.getUser();
  //     if (!user) throw new Error("Not authenticated");
  //     const { error } = await supabase.from("stripe_configs").upsert({
  //       user_id: user.id,
  //       role: "shopkeeper",
  //       stripe_secret_key: stripeSettings.secretKey,
  //       stripe_publishable_key: stripeSettings.publishableKey,
  //       is_live_mode: stripeSettings.isLiveMode,
  //       is_active: stripeSettings.isActive,
  //     });
  //     if (error) throw error;
  //     toast({ duration: 5000,
  //       title: "Stripe Settings Saved",
  //       description: "Your Stripe configuration has been updated successfully.",
  //     });
  //   } catch (error) {
  //     console.error("Error saving Stripe settings:", error);
  //     toast({ duration: 5000,
  //       title: "Error",
  //       description: "Failed to save Stripe settings. Please try again.",
  //       variant: "destructive",
  //     });
  //   } finally {
  //     setIsStripeLoading(false);
  //   }
  // };

  const loadStripeSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("stripe_configs")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", "shopkeeper")
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      // if (data) {
      //   setStripeSettings({
      //     secretKey: data.stripe_secret_key || "",
      //     publishableKey: data.stripe_publishable_key || "",
      //     isLiveMode: data.is_live_mode || false,
      //     isActive: data.is_active || true,
      //   });
      // }
    } catch (error) {
      console.error("Error loading Stripe settings:", error);
    }
  };

  // Load Stripe settings on component mount (kept)
  useEffect(() => {
    loadStripeSettings();
  }, []);

  // Load Shopkeeper profile on mount and fill all fields
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return;

        // Decode JWT to get sub (shopkeeper id)
        type JwtPayload = { sub?: string; [k: string]: any };
        let decoded: JwtPayload | null = null;

        try {
          decoded = jwtDecode<JwtPayload>(token);
        } catch {
          // Fallback manual base64url decode if jwt-decode not available
          try {
            const payload = token.split(".")[1] || "";
            const b64 =
              payload.replace(/-/g, "+").replace(/_/g, "/") +
              "=".repeat((4 - (payload.length % 4)) % 4);
            decoded = JSON.parse(atob(b64));
          } catch (e) {
            console.error("Failed to decode JWT token payload", e);
            return;
          }
        }

        const id = decoded?.sub;
        if (!id) {
          console.error("JWT does not contain sub (id); cannot load profile");
          return;
        }

        const url = `${apiURL}/organizers/profile-get/${id}`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.error(
            `Profile fetch failed: ${res.status} ${res.statusText} ${res.url}`,
            errText,
          );
          throw new Error(`Failed to load profile (${res.status})`);
        }

        const raw = await res.text();
        if (!raw) {
          console.warn("Profile response has empty body");
          return;
        }

        let response: any;
        try {
          response = JSON.parse(raw);
        } catch (e) {
          console.error("Profile response is not valid JSON:", raw);
          throw e;
        }

        const d = response?.data ?? response;

        setOrganizerProfile((prev) => ({
          ...prev,
          ownerName: d?.name ?? "",
          organizationName: d?.organizationName ?? "",
          email: d?.email ?? "",
          businessEmail: d?.businessEmail ?? "",
          whatsAppNumber: d?.whatsAppNumber ?? "",
          taxPercentage: d?.taxPercentage ?? 0,
          discountPercentage: d?.discountPercentage ?? 0,
          whatsAppQR: d?.whatsAppQR ?? false,
          instagramQR: d?.instagramQR ?? false,
          dynamicQR: d?.dynamicQR ?? false,
          whatsAppQRNumber: d?.whatsAppQRNumber ?? "",
          instagramHandle: d?.instagramHandle ?? "",
          phone: d?.phone ?? "",
          address: d?.address ?? "",
          GSTNumber: d?.GSTNumber ?? "",
          UENNumber: d?.UENNumber ?? "",
          receiptType: d?.receiptType ?? "",
          termsAndConditions: d?.termsAndConditions ?? "",
          hasDocVerification: d?.hasDocVerification ?? "",
          description: d?.description ?? "",
          businessCategory: d?.businessCategory ?? "",
          shopClosedFromDate: d?.shopClosedFromDate,
          shopClosedToDate: d?.shopClosedToDate,
          paymentURL: d?.paymentURL ?? "",
          bankTransferEnabled: d?.bankTransferEnabled ?? false,
          bankName: d?.bankName ?? "",
          bankAccountNumber: d?.bankAccountNumber ?? "",
          bankIfscCode: d?.bankIfscCode ?? "",
          bankSwiftCode: d?.bankSwiftCode ?? "",
          bankBranchCode: d?.bankBranchCode ?? "",
          bankBranch: d?.bankBranch ?? "",
          accountHolderName: d?.accountHolderName ?? "",
          bankAccountType: d?.bankAccountType ?? "",
          payNowId: d?.payNowId ?? "",
        }));

        setSelectedCountry(d?.country || "IN");
        setGlobalCountry(d?.country || "IN");

        setOrganizerClosedFromDate(
          d?.shopClosedFromDate ? new Date(d?.shopClosedFromDate) : undefined,
        );
        setOrganizerClosedToDate(
          d?.shopClosedToDate ? new Date(d?.shopClosedToDate) : undefined,
        );

        await fetchOperators(id, token);

        const couponsRes = await fetch(`${apiURL}/coupons/organizer/${id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!couponsRes.ok) {
          console.error("Failed to fetch coupons");
        }

        const couponsData = await couponsRes.json();
        setCoupons(couponsData?.data || []);
      } catch (err) {
        console.error("Failed to load shopkeeper profile:", err);
      }
    };

    fetchProfile();
  }, []);

  const daysOfWeek = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b py-4 -mx-6 px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground max-w-auto">
              Configure your Organization and business settings
            </p>
          </div>
          {/* ✅ SAVE BUTTON */}
          <div className="flex flex-col items-end">
            <Button
              onClick={handleSave}
              className="w-full sm:w-auto px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Save Profile
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="operator" className="flex items-center gap-2">
            <UserPlus2 className="w-4 h-4" />
            Operator
          </TabsTrigger>
          {/* <TabsTrigger value="branding" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Branding
          </TabsTrigger> */}
          {/* <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Products
          </TabsTrigger> */}
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Payments
          </TabsTrigger>
          {/* <TabsTrigger value="receipts" className="flex items-center gap-2">
            <ReceiptTextIcon className="w-4 h-4" />
            Receipts
          </TabsTrigger> */}
          <TabsTrigger value="coupons" className="flex items-center gap-2">
            <CopyPlusIcon className="w-4 h-4" />
            Coupons
          </TabsTrigger>

          {/* <TabsTrigger value="shipping" className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Shipping
          </TabsTrigger> */}
          {/* <TabsTrigger
            value="notifications"
            className="flex items-center gap-2"
          >
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger> */}
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shop Profile</CardTitle>
              <CardDescription>
                Manage shopkeeper details and public info
              </CardDescription>
            </CardHeader>

            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* COUNTRY SELECTION */}

              {/* ✅ ENTIRE SECTION - BLUR CONTENT BUT SHOW VALUES */}
              {shopProfile.hasDocVerification ? (
                /* ✅ VERIFIED - BLURRED BUT VISIBLE CONTENT */
                <div className="md:col-span-2 space-y-4">
                  {/* ✅ HEADER */}
                  <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-green-800">
                          Document Verified ✓
                        </h3>
                        <p className="text-sm text-green-600">
                          Secure & protected
                        </p>
                      </div>
                    </div>
                    {/* <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="border border-green-300 hover:bg-green-100 text-green-700"
                      onClick={() => {
                        setOrganizerProfile({
                          ...shopProfile,
                          hasDocVerification: false,
                        });
                        setGstVerified(false);
                        setUenVerified(false);
                        setGstError("");
                        setUenError("");
                      }}
                    >
                      Edit
                    </Button> */}
                  </div>

                  {/* ✅ BLURRED COUNTRY - SHOW SELECTED VALUE */}
                  <div className="grid gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <Label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                      <Globe className="w-4 h-4" />
                      Country
                    </Label>
                    <div className="flex items-center gap-3 p-3 bg-white border rounded-md opacity-60">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-700">
                        {COUNTRIES.find((c) => c.code === selectedCountry)
                          ?.name || "India"}
                        (
                        {COUNTRIES.find((c) => c.code === selectedCountry)
                          ?.countryCode || "+91"}
                        )
                      </span>
                    </div>
                  </div>

                  {/* ✅ BLURRED NUMBER - SHOW ACTUAL VALUE */}
                  <div className="grid gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <Label className="flex items-center gap-2 text-sm font-medium text-gray-600">
                      <CreditCard className="w-4 h-4" />
                      {selectedCountry === "IN" ? "GST Number" : "UEN Number"}
                    </Label>
                    <div className="flex items-center justify-between p-3 bg-white border rounded-md opacity-60">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <span className="font-mono text-lg font-semibold text-gray-700 tracking-wider">
                          {selectedCountry === "IN"
                            ? shopProfile.GSTNumber
                            : shopProfile.UENNumber}
                        </span>
                      </div>
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        Verified
                      </Badge>
                    </div>
                  </div>
                </div>
              ) : (
                /* ✅ NOT VERIFIED - FULLY EDITABLE (your original code) */
                <>
                  {/* COUNTRY SELECTION */}
                  <div className="grid gap-2">
                    <Label
                      htmlFor="country"
                      className="flex items-center gap-2"
                    >
                      <Globe className="w-4 h-4" />
                      Country
                    </Label>
                    <Select
                      value={selectedCountry}
                      onValueChange={(value) => {
                        setSelectedCountry(value);
                        setOrganizerProfile({
                          ...shopProfile,
                          country: value,
                          GSTNumber: "",
                          UENNumber: "",
                        });
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name} ({country.countryCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* GST NUMBER */}
                  {selectedCountry === "IN" && (
                    <div className="grid gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg md:col-span-2">
                      <Label
                        htmlFor="gstNumber"
                        className="flex items-center gap-2 font-semibold"
                      >
                        <CreditCard className="w-4 h-4" />
                        GST Number (15 characters)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="gstNumber"
                          value={shopProfile.GSTNumber || ""}
                          onChange={(e) =>
                            setOrganizerProfile({
                              ...shopProfile,
                              GSTNumber: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="e.g., 22AABCT1234A1Z0"
                          maxLength={15}
                          className="uppercase font-mono"
                          disabled={gstVerified}
                        />
                        {!gstVerified && (
                          <Button
                            type="button"
                            onClick={() =>
                              handleVerifyGST(shopProfile.GSTNumber)
                            }
                            disabled={!shopProfile.GSTNumber || gstVerifying}
                            className="whitespace-nowrap"
                          >
                            {gstVerifying ? "Verifying..." : "Verify"}
                          </Button>
                        )}
                      </div>
                      {gstError && (
                        <p className="text-xs text-red-600">{gstError}</p>
                      )}
                      {gstVerified && (
                        <p className="text-xs text-green-600">
                          ✓ GST verified successfully. Save profile to secure
                          it.
                        </p>
                      )}
                      <p className="text-xs text-gray-600">
                        Your GST Identification Number (GSTIN)
                      </p>
                    </div>
                  )}

                  {/* UEN NUMBER */}
                  {selectedCountry === "SG" && (
                    <div className="grid gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg md:col-span-2">
                      <Label
                        htmlFor="uenNumber"
                        className="flex items-center gap-2 font-semibold"
                      >
                        <CreditCard className="w-4 h-4" />
                        UEN Number (9-10 characters)
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="uenNumber"
                          value={shopProfile.UENNumber || ""}
                          onChange={(e) =>
                            setOrganizerProfile({
                              ...shopProfile,
                              UENNumber: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="e.g., 123456789A"
                          maxLength={10}
                          className="uppercase font-mono"
                          disabled={uenVerified}
                        />
                        {!uenVerified && (
                          <Button
                            type="button"
                            onClick={handleVerifyUEN}
                            disabled={!shopProfile.UENNumber || uenVerifying}
                            className="whitespace-nowrap"
                          >
                            {uenVerifying ? "Verifying..." : "Verify"}
                          </Button>
                        )}
                      </div>
                      {uenError && (
                        <p className="text-xs text-red-600">{uenError}</p>
                      )}
                      {uenVerified && (
                        <p className="text-xs text-green-600">
                          ✓ UEN verified successfully. Save profile to secure
                          it.
                        </p>
                      )}
                      <p className="text-xs text-gray-600">
                        Your Unique Entity Number (UEN)
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* ✅ GST/UEN VERIFICATION DETAILS BOX */}
              {shopProfile.hasDocVerification && gstDetails && (
                <div className="md:col-span-2 space-y-4">
                  {/* ✅ HEADER */}
                  <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-blue-800">
                          Verification Details
                        </h3>
                        <p className="text-sm text-blue-600">
                          Official business information
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ✅ BUSINESS INFO CARD */}
                  <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="w-5 h-5" />
                        Business Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-muted-foreground font-medium">
                            Legal Name
                          </span>
                          <p className="font-semibold">
                            {gstDetails.taxpayerInfo?.lgnm || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-medium">
                            Trade Name
                          </span>
                          <p className="font-semibold">
                            {gstDetails.taxpayerInfo?.tradeNam || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-medium">
                            Status
                          </span>
                          <Badge className="bg-green-100 text-green-800">
                            {gstDetails.taxpayerInfo?.sts || "N/A"}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-medium">
                            Entity Type
                          </span>
                          <p>{gstDetails.taxpayerInfo?.ctb || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-medium">
                            PAN
                          </span>
                          <p className="font-mono">
                            {gstDetails.taxpayerInfo?.panNo || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground font-medium">
                            Registered
                          </span>
                          <p>{gstDetails.taxpayerInfo?.rgdt || "N/A"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ✅ ADDRESS CARD */}
                  <Card className="border-blue-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Principal Address
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg">
                        <p className="font-mono text-sm tracking-wide text-gray-800">
                          {gstDetails.taxpayerInfo?.pradr?.addr?.bno || ""}{" "}
                          {gstDetails.taxpayerInfo?.pradr?.addr?.st || ""},{" "}
                          {gstDetails.taxpayerInfo?.pradr?.addr?.loc || ""},{" "}
                          {gstDetails.taxpayerInfo?.pradr?.addr?.dst || ""}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {gstDetails.taxpayerInfo?.pradr?.addr?.stcd || ""} -{" "}
                          {gstDetails.taxpayerInfo?.pradr?.addr?.pncd || ""}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground font-medium">
                            Jurisdiction
                          </span>
                          <p>{gstDetails.taxpayerInfo?.stj || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground font-medium">
                            Nature
                          </span>
                          <p>{gstDetails.taxpayerInfo?.pradr?.ntr || "N/A"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* OWNER NAME */}
              <div>
                <Label>Owner Name</Label>
                <Input
                  value={shopProfile.ownerName}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      ownerName: e.target.value,
                    }))
                  }
                  placeholder="Owner full name"
                />
              </div>

              {/* SHOP NAME */}
              <div>
                <Label>Organization Name</Label>
                <Input
                  value={shopProfile.organizationName}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      organizationName: e.target.value,
                    }))
                  }
                  placeholder="Business or storefront name"
                />
              </div>

              {/* PRIMARY EMAIL */}
              <div>
                <Label>Primary Email</Label>
                <Input
                  type="email"
                  value={shopProfile.email}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      email: e.target.value,
                    }))
                  }
                  placeholder="owner@example.com"
                />
              </div>

              {/* BUSINESS EMAIL */}
              <div>
                <Label>Business Email</Label>
                <Input
                  type="email"
                  value={shopProfile.businessEmail}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      businessEmail: e.target.value,
                    }))
                  }
                  placeholder="business@example.com"
                />
              </div>

              {/* WhatsApp Number with Country Code and Verification */}
              <div>
                <Label className="flex items-center justify-between mb-2">
                  <span>WhatsApp Number *</span>
                  {whatsappVerified && (
                    <Badge variant="default" className="ml-2">
                      Verified
                    </Badge>
                  )}
                </Label>
                <div className="flex items-center space-x-2">
                  <div className="w-32">
                    <Select value={countryCode} onValueChange={setCountryCode}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingCountries ? (
                          <SelectItem value="loading" disabled>
                            Loading...
                          </SelectItem>
                        ) : (
                          countries
                            .filter(
                              (country) =>
                                country.dialCode &&
                                country.dialCode.trim() !== "",
                            )
                            .map((country) => (
                              <SelectItem
                                key={`${country.code}-${country.dialCode}`}
                                value={country.dialCode}
                              >
                                {country.name} {country.dialCode}
                              </SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="tel"
                    maxLength={10}
                    placeholder="Enter number"
                    value={whatsAppNumber}
                    onChange={(e) =>
                      setwhatsAppNumber(e.target.value.replace(/\D/g, ""))
                    }
                    className="flex-grow"
                  />
                </div>
              </div>

              {/* PHONE */}
              <div>
                <Label>Phone</Label>
                <Input
                  value={shopProfile.phone}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      phone: e.target.value,
                    }))
                  }
                  placeholder="+91 98765 43210"
                />
              </div>

              {/* ADDRESS */}
              <div className="md:col-span-2">
                <Label>Address</Label>
                <Textarea
                  value={shopProfile.address}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      address: e.target.value,
                    }))
                  }
                  placeholder="Full business address"
                />
              </div>

              {/* BUSINESS CATEGORY */}
              <div className="md:col-span-2">
                <Label>Events Category</Label>
                <Select
                  value={shopProfile.businessCategory}
                  onValueChange={(val) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      businessCategory: val,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Music">Music</SelectItem>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Sports">Sports</SelectItem>
                    <SelectItem value="Arts">Arts</SelectItem>
                    <SelectItem value="Fashion">Fashion</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* TAX PERCENTAGE */}
              <div>
                <Label>Tax %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={shopProfile.taxPercentage}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      taxPercentage: parseFloat(e.target.value),
                    }))
                  }
                  placeholder="e.g., 5.0"
                />
              </div>

              <div>
                <Label>Overall Organization Based Discount Percentage %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={shopProfile.discountPercentage}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      discountPercentage: parseFloat(e.target.value),
                    }))
                  }
                  placeholder="e.g., 5.0"
                />
              </div>

              {/* DESCRIPTION */}
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={shopProfile.description}
                  onChange={(e) =>
                    setOrganizerProfile((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Tell customers about your shop and services"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="mb-2 block">Terms & Conditions</Label>
                <div className="bg-white dark:bg-slate-950 rounded-md">
                  <Suspense fallback={<div className="h-[150px] border rounded-md animate-pulse bg-muted" />}>
                    <ReactQuill
                      theme="snow"
                      value={shopProfile.termsAndConditions || ""}
                      modules={modules}
                      onChange={(content) =>
                        setOrganizerProfile((p) => ({
                          ...p,
                          termsAndConditions: content,
                        }))
                      }
                      placeholder="e.g. 1. Goods once sold are not returnable."
                      className="[&_.ql-editor]:min-h-[150px] [&_.ql-container]:rounded-b-md [&_.ql-toolbar]:rounded-t-md text-black dark:text-white"
                    />
                  </Suspense>
                </div>
                {/* <p className="text-xs text-muted-foreground mt-2">
                  These terms will appear at the bottom of your generated
                  invoices.
                </p> */}
              </div>


              {/* Bank Transfer Details */}
              <Separator className="my-6" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">Bank Transfer Details</h3>
                    <p className="text-sm text-muted-foreground">Enable bank transfers for international payments</p>
                  </div>
                  <Switch
                    checked={shopProfile.bankTransferEnabled}
                    onCheckedChange={(val) => setOrganizerProfile({ ...shopProfile, bankTransferEnabled: val })}
                  />
                </div>

                {shopProfile.bankTransferEnabled && (
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Account Holder Name *</Label>
                        <Input
                          value={shopProfile.accountHolderName}
                          onChange={(e) => setOrganizerProfile({ ...shopProfile, accountHolderName: e.target.value })}
                          placeholder="Full name as on bank account"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bank Name *</Label>
                        <Input
                          value={shopProfile.bankName}
                          onChange={(e) => setOrganizerProfile({ ...shopProfile, bankName: e.target.value })}
                          placeholder="e.g. HDFC Bank, DBS Bank"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Account Number *</Label>
                        <Input
                          value={shopProfile.bankAccountNumber}
                          onChange={(e) => setOrganizerProfile({ ...shopProfile, bankAccountNumber: e.target.value })}
                          placeholder="Bank account number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Branch</Label>
                        <Input
                          value={shopProfile.bankBranch}
                          onChange={(e) => setOrganizerProfile({ ...shopProfile, bankBranch: e.target.value })}
                          placeholder="Branch name"
                        />
                      </div>
                    </div>

                    {/* Country-specific fields */}
                    {selectedCountry === "IN" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>IFSC Code *</Label>
                          <Input
                            value={shopProfile.bankIfscCode}
                            onChange={(e) => setOrganizerProfile({ ...shopProfile, bankIfscCode: e.target.value.toUpperCase() })}
                            placeholder="e.g. HDFC0001234"
                            maxLength={11}
                          />
                          <p className="text-xs text-muted-foreground">11-character Indian Financial System Code</p>
                        </div>
                        <div className="space-y-2">
                          <Label>Account Type *</Label>
                          <select
                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={shopProfile.bankAccountType}
                            onChange={(e) => setOrganizerProfile({ ...shopProfile, bankAccountType: e.target.value })}
                          >
                            <option value="">Select Type</option>
                            <option value="Savings">Savings</option>
                            <option value="Current">Current</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>SWIFT / BIC Code *</Label>
                            <Input
                              value={shopProfile.bankSwiftCode}
                              onChange={(e) => setOrganizerProfile({ ...shopProfile, bankSwiftCode: e.target.value.toUpperCase() })}
                              placeholder="e.g. DBSSSGSG"
                              maxLength={11}
                            />
                            <p className="text-xs text-muted-foreground">8 or 11 character SWIFT code</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Bank Code + Branch Code</Label>
                            <Input
                              value={shopProfile.bankBranchCode}
                              onChange={(e) => setOrganizerProfile({ ...shopProfile, bankBranchCode: e.target.value })}
                              placeholder="e.g. 7171-003"
                            />
                            <p className="text-xs text-muted-foreground">Bank code (4 digits) - Branch code (3 digits)</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>PayNow ID (UEN / Mobile / NRIC)</Label>
                          <Input
                            value={shopProfile.payNowId}
                            onChange={(e) => setOrganizerProfile({ ...shopProfile, payNowId: e.target.value })}
                            placeholder="e.g. 202012345K or +65 9123 4567"
                          />
                          <p className="text-xs text-muted-foreground">PayNow registered UEN, mobile number, or NRIC for instant transfers</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operator">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus2 className="w-5 h-5" />
                Operator Settings
              </CardTitle>
              <CardDescription>
                Create and manage your shop operators here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Operators{" "}
                  {operators.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({operators.length})
                    </span>
                  )}
                </h3>
                <Button
                  onClick={() => {
                    setOperatorForm({
                      name: "",
                      operatorCountryCode: countryCode,
                      operatorEmail: "",
                      operatorLocalNumber: "",
                    });
                    setEditingOperatorIndex(null);
                    setOperatorDialogOpen(true);
                  }}
                >
                  <UserPlus2 className="w-4 h-4 mr-2" />
                  Add Operator
                </Button>
              </div>

              {operators.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  No Operators Found. Add your first operator.
                </div>
              ) : (
                <div className="space-y-3">
                  {operators.map((op, index) => (
                    <Card key={op._id ?? index}>
                      <CardContent className="flex items-center justify-between p-4">
                        <div>
                          <p className="font-semibold">{op.name}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {op.whatsAppNumber}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Split stored number back into country code + local
                              let splitCode = "+91";
                              let splitLocal = op.whatsAppNumber;
                              for (const c of countries) {
                                if (op.whatsAppNumber.startsWith(c.dialCode)) {
                                  splitCode = c.dialCode;
                                  splitLocal = op.whatsAppNumber.slice(
                                    c.dialCode.length,
                                  );
                                  break;
                                }
                              }
                              setOperatorForm({
                                name: op.name,
                                operatorCountryCode: splitCode,
                                operatorEmail: op.email,
                                operatorLocalNumber: splitLocal,
                              });
                              setEditingOperatorIndex(index);
                              setOperatorDialogOpen(true);
                            }}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              op._id && handleDeleteOperator(op._id)
                            }
                          >
                            <Trash className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add/Edit Operator Dialog */}
          <Dialog
            open={operatorDialogOpen}
            onOpenChange={setOperatorDialogOpen}
          >
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingOperatorIndex !== null
                    ? "Edit Operator"
                    : "Add Operator"}
                </DialogTitle>
                <DialogDescription>
                  Operators can manage orders on behalf of your shop.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1">
                  <Label>Operator Name *</Label>
                  <Input
                    placeholder="e.g. John Doe"
                    value={operatorForm.name}
                    onChange={(e) =>
                      setOperatorForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>WhatsApp Number *</Label>
                  <div className="flex items-center space-x-2">
                    <div className="w-32">
                      <Select
                        value={operatorForm.operatorCountryCode}
                        onValueChange={(val) =>
                          setOperatorForm((prev) => ({
                            ...prev,
                            operatorCountryCode: val,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                        <SelectContent>
                          {loadingCountries ? (
                            <SelectItem value="loading" disabled>
                              Loading...
                            </SelectItem>
                          ) : (
                            countries
                              .filter(
                                (c) => c.dialCode && c.dialCode.trim() !== "",
                              )
                              .map((c) => (
                                <SelectItem
                                  key={`${c.code}-${c.dialCode}`}
                                  value={c.dialCode}
                                >
                                  {c.name} {c.dialCode}
                                </SelectItem>
                              ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="tel"
                      placeholder="Enter number"
                      maxLength={10}
                      value={operatorForm.operatorLocalNumber}
                      onChange={(e) =>
                        setOperatorForm((prev) => ({
                          ...prev,
                          operatorLocalNumber: e.target.value.replace(
                            /\D/g,
                            "",
                          ),
                        }))
                      }
                      className="flex-grow"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Operator Email *</Label>
                  <Input
                    placeholder="e.g. John Doe"
                    value={operatorForm.operatorEmail}
                    onChange={(e) =>
                      setOperatorForm((prev) => ({
                        ...prev,
                        operatorEmail: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <Button
                className="w-full mt-4"
                onClick={handleSubmitOperator}
                disabled={isSavingOperators}
              >
                {isSavingOperators
                  ? "Saving..."
                  : editingOperatorIndex !== null
                    ? "Update Operator"
                    : "Add Operator"}
              </Button>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="branding">
          <BlurWrapper>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Store Branding
                </CardTitle>
                <CardDescription>
                  Customize your store's appearance and colors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Primary Color</Label>
                    <Input
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) =>
                        setBranding((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Secondary Color</Label>
                    <Input
                      type="color"
                      value={branding.secondaryColor}
                      onChange={(e) =>
                        setBranding((prev) => ({
                          ...prev,
                          secondaryColor: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurWrapper>
        </TabsContent>

        <TabsContent value="products">
          <BlurWrapper>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Product Settings
                </CardTitle>
                <CardDescription>
                  Configure product management options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Default Currency</Label>
                    <Select
                      value={productSettings.defaultCurrency}
                      onValueChange={(value) =>
                        setProductSettings((prev) => ({
                          ...prev,
                          defaultCurrency: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="INR">INR ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tax Rate (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={productSettings.taxRate}
                      onChange={(e) =>
                        setProductSettings((prev) => ({
                          ...prev,
                          taxRate: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurWrapper>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          {/* STATIC QR TOGGLE */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition bg-white">
            <div className="flex items-center gap-3">
              <QrCode className="w-5 h-5 text-blue-600" />
              <div>
                <Label className="font-semibold text-slate-900">
                  Static QR Code
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload a UPI/PayNow QR for offline scan payments
                </p>
              </div>
            </div>
            <Switch
              checked={paymentMethods.staticQR}
              onCheckedChange={(checked) =>
                setPaymentMethods((prev) => ({
                  ...prev,
                  staticQR: checked,
                  // dynamicQR: checked ? false : prev.dynamicQR,
                }))
              }
            />
          </div>

          {/* STATIC QR SECTION - APPEARS RIGHT BELOW TOGGLE */}
          {paymentMethods.staticQR && (
            <Card className="border-blue-200 bg-blue-50 animate-in slide-in-from-top">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <QrCode className="w-5 h-5" />
                  Upload Static QR
                </CardTitle>
                <CardDescription>
                  PNG or JPG format, recommended 512×512px
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  {/* QR PREVIEW */}
                  <div className="w-48 h-48 rounded-lg border-2 border-blue-300 flex items-center justify-center overflow-hidden bg-white flex-shrink-0">
                    {paymentQrPreview ? (
                      <img
                        src={paymentQrPreview}
                        alt="Payment QR preview"
                        className="w-full h-full object-contain"
                      />
                    ) : shopProfile?.paymentURL ? (
                      <img
                        src={apiURL + shopProfile.paymentURL}
                        alt="Payment QR"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 text-blue-300 mx-auto mb-2" />
                        <span className="text-xs text-muted-foreground">
                          No QR uploaded
                        </span>
                      </div>
                    )}
                  </div>

                  {/* UPLOAD SECTION */}
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="staticQrUpload" className="font-semibold">
                        Choose QR Image
                      </Label>
                      <Input
                        id="staticQrUpload"
                        type="file"
                        accept="image/*"
                        onChange={onPaymentQrChange}
                        className="cursor-pointer"
                      />
                      <p className="text-xs text-muted-foreground">
                        Max 5MB. PNG or JPG recommended.
                      </p>
                    </div>

                    {shopProfile?.paymentURL && (
                      <div className="space-y-2 p-3 bg-white rounded-lg border border-blue-200">
                        <p className="text-xs font-semibold text-slate-900">
                          Public URL (Read-only)
                        </p>
                        <Input
                          value={`${apiURL}${shopProfile.paymentURL}`}
                          readOnly
                          className="text-xs font-mono"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${apiURL}${shopProfile.paymentURL}`,
                            );
                            toast({ duration: 5000, title: "✅ URL copied" });
                          }}
                        >
                          Copy URL
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DYNAMIC QR TOGGLE */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition bg-white">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-600" />
              <div>
                <Label className="font-semibold text-slate-900">
                  Dynamic QR Code
                </Label>
                <p className="text-xs text-muted-foreground">
                  Auto-generate QR with exact amount at checkout
                </p>
              </div>
            </div>
            <Switch
              checked={shopProfile.dynamicQR}
              onCheckedChange={(checked) =>
                setOrganizerProfile((prev) => ({
                  ...prev,
                  dynamicQR: checked,
                  // staticQR: checked ? false : prev.staticQR,
                }))
              }
            />
          </div>

          {/* DYNAMIC QR SECTION - APPEARS RIGHT BELOW TOGGLE */}
          {shopProfile.dynamicQR && (
            <Card className="border-amber-200 bg-amber-50 animate-in slide-in-from-top">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-900">
                  <Zap className="w-5 h-5" />
                  Dynamic QR Configuration
                </CardTitle>
                <CardDescription>
                  QR codes auto-generate at checkout with exact order amount. To
                  get started just upload the PaymentQR image at the Static QR
                  Code Section
                </CardDescription>
                <CardDescription>
                  <p className="text-amber-900 font-semibold">
                    Please Check Your Store Order a Small Product and Verify the
                    Dynamic QR code *.
                  </p>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* HOW IT WORKS */}
                <div className="bg-white border border-amber-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900 space-y-2">
                      <p className="font-semibold">How Dynamic QR works:</p>
                      <ul className="list-disc list-inside text-xs space-y-1">
                        <li>
                          When customer checks out, unique QR generates with
                          exact amount
                        </li>
                        <li>
                          Customer scans to pay precise amount (no manual entry)
                        </li>
                        <li>Works with UPI (Google Pay, PhonePe, Paytm)</li>
                        {/* <li>Also works with PayNow (Singapore)</li> */}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* CARD PAYMENTS TOGGLE */}
          {/* <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition bg-white">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <div>
                <Label className="font-semibold text-slate-900">
                  Card Payments
                </Label>
                <p className="text-xs text-muted-foreground">
                  Accept Visa, Mastercard, Amex via Stripe
                </p>
              </div>
            </div>
            <Switch
              checked={paymentMethods.razorpayCards}
              onCheckedChange={(checked) =>
                setPaymentMethods((prev) => ({
                  ...prev,
                  razorpayCards: checked,
                }))
              }
            />
          </div> */}

          {/* CARD PAYMENTS SECTION - APPEARS RIGHT BELOW TOGGLE */}
          {/* 🔘 RAZORPAY CARD PAYMENTS TOGGLE */}
          <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition bg-white">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <div>
                <Label className="font-semibold text-slate-900">
                  Credit Cards Payments
                </Label>
                <p className="text-xs text-muted-foreground">
                  Accept cards, UPI, netbanking via Razorpay
                </p>
              </div>
            </div>
            <Switch
              checked={paymentMethods.razorpayCards}
              onCheckedChange={(checked) =>
                setPaymentMethods((prev) => ({
                  ...prev,
                  razorpayCards: checked,
                }))
              }
            />
          </div>

          {/* 🔧 RAZORPAY SETUP SECTION - INLINE BELOW TOGGLE */}
          {paymentMethods.razorpayCards && (
            <Card className="border-indigo-200 bg-indigo-50 animate-in slide-in-from-top">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-indigo-900">
                  <CreditCard className="w-5 h-5" />
                  Razorpay Payment Setup
                </CardTitle>
                <CardDescription>
                  Configure Razorpay to accept cards, UPI and netbanking from
                  your customers
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* CONNECTION STATUS */}
                {razorpaySettings?.isConnected ? (
                  <div className="bg-white border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold text-indigo-900">
                          ✅ Razorpay Account Connected
                        </p>
                        <p className="text-xs text-indigo-700 mt-1">
                          Account ID: {razorpaySettings.razorpayAccountId}
                        </p>
                        <p className="text-xs text-indigo-600 mt-2">
                          Your shop can now accept card, UPI and netbanking
                          payments.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-semibold text-indigo-900">
                          Setup Card Payments for this shop
                        </p>
                        <p className="text-xs text-indigo-700 mt-1 mb-4">
                          Enter your business and bank details below. Your
                          Razorpay account will be created and submitted for KYC
                          review.
                        </p>

                        {/* RAZORPAY SETUP FORM */}
                        <div className="space-y-3 p-3 bg-indigo-50 border border-indigo-200 rounded">
                          {/* BUSINESS INFO */}
                          <div className="space-y-1">
                            <Label
                              htmlFor="rzpBusinessName"
                              className="text-xs font-semibold"
                            >
                              Business Name
                            </Label>
                            <Input
                              id="rzpBusinessName"
                              placeholder="Registered business name"
                              value={razorpaySettings.businessName || ""}
                              onChange={(e) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  businessName: e.target.value,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label
                              htmlFor="rzpBusinessType"
                              className="text-xs font-semibold"
                            >
                              Business Type
                            </Label>
                            <Select
                              value={razorpaySettings.businessType || "sole"}
                              onValueChange={(value) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  businessType: value,
                                }))
                              }
                            >
                              <SelectTrigger
                                id="rzpBusinessType"
                                className="text-sm"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="proprietorship">
                                  Sole Proprietor
                                </SelectItem>
                                <SelectItem value="partnership">
                                  Partnership
                                </SelectItem>
                                <SelectItem value="private_limited">
                                  Private Limited
                                </SelectItem>
                                <SelectItem value="llp">LLP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* COUNTRY-SPECIFIC KYC */}
                          {shopProfile?.country === "IN" ? (
                            <>
                              <div className="space-y-1">
                                <Label
                                  htmlFor="rzpPan"
                                  className="text-xs font-semibold"
                                >
                                  PAN Number
                                </Label>
                                <Input
                                  id="rzpPan"
                                  placeholder="AAABP5055K"
                                  value={razorpaySettings.panNumber || ""}
                                  onChange={(e) =>
                                    setRazorpaySettings((prev) => ({
                                      ...prev,
                                      panNumber: e.target.value
                                        .toUpperCase()
                                        .replace(/[^A-Z0-9]/g, ""),
                                    }))
                                  }
                                  maxLength={10}
                                  className="text-sm font-mono uppercase"
                                />
                                <p className="text-xs text-muted-foreground">
                                  10 characters: 5 letters, 4 numbers, 1 letter
                                </p>
                              </div>

                              <div className="space-y-1">
                                <Label
                                  htmlFor="rzpGst"
                                  className="text-xs font-semibold"
                                >
                                  GST Number (Optional)
                                </Label>
                                <Input
                                  id="rzpGst"
                                  placeholder="27AAPFU0055F1Z5"
                                  value={razorpaySettings.gstNumber || ""}
                                  onChange={(e) =>
                                    setRazorpaySettings((prev) => ({
                                      ...prev,
                                      gstNumber: e.target.value
                                        .toUpperCase()
                                        .replace(/[^A-Z0-9]/g, ""),
                                    }))
                                  }
                                  maxLength={15}
                                  className="text-sm font-mono uppercase"
                                />
                              </div>
                            </>
                          ) : (
                            <div className="space-y-1">
                              <Label
                                htmlFor="rzpUen"
                                className="text-xs font-semibold"
                              >
                                UEN Number
                              </Label>
                              <Input
                                id="rzpUen"
                                placeholder="123456789A"
                                value={razorpaySettings.uenNumber || ""}
                                onChange={(e) =>
                                  setRazorpaySettings((prev) => ({
                                    ...prev,
                                    uenNumber: e.target.value
                                      .toUpperCase()
                                      .replace(/[^A-Z0-9]/g, ""),
                                  }))
                                }
                                maxLength={10}
                                className="text-sm font-mono uppercase"
                              />
                              <p className="text-xs text-muted-foreground">
                                9–10 characters: UEN
                              </p>
                            </div>
                          )}

                          {/* CONTACT */}
                          <div className="space-y-1">
                            <Label
                              htmlFor="rzpEmail"
                              className="text-xs font-semibold"
                            >
                              Business Email
                            </Label>
                            <Input
                              id="rzpEmail"
                              type="email"
                              placeholder="billing@yourbusiness.com"
                              value={razorpaySettings.businessEmail || ""}
                              onChange={(e) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  businessEmail: e.target.value,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label
                              htmlFor="rzpPhone"
                              className="text-xs font-semibold"
                            >
                              Business Phone
                            </Label>
                            <Input
                              id="rzpPhone"
                              placeholder="+91 98xxxxxx"
                              value={razorpaySettings.businessPhone || ""}
                              onChange={(e) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  businessPhone: e.target.value,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>

                          {/* BANK DETAILS */}
                          <div className="space-y-1">
                            <Label
                              htmlFor="rzpAccountHolder"
                              className="text-xs font-semibold"
                            >
                              Account Holder Name
                            </Label>
                            <Input
                              id="rzpAccountHolder"
                              placeholder="Name on bank account"
                              value={razorpaySettings.accountHolderName || ""}
                              onChange={(e) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  accountHolderName: e.target.value,
                                }))
                              }
                              className="text-sm"
                            />
                          </div>

                          <div className="space-y-1">
                            <Label
                              htmlFor="rzpBankName"
                              className="text-xs font-semibold"
                            >
                              Bank Name
                            </Label>
                            <Select
                              value={razorpaySettings.bankName || ""}
                              onValueChange={(value) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  bankName: value,
                                }))
                              }
                            >
                              <SelectTrigger
                                id="rzpBankName"
                                className="text-sm"
                              >
                                <SelectValue placeholder="Select bank" />
                              </SelectTrigger>
                              <SelectContent>
                                {shopProfile?.country === "IN" ? (
                                  <>
                                    <SelectItem value="HDFC">
                                      HDFC Bank
                                    </SelectItem>
                                    <SelectItem value="ICICI">
                                      ICICI Bank
                                    </SelectItem>
                                    <SelectItem value="SBI">
                                      State Bank of India
                                    </SelectItem>
                                    <SelectItem value="AXIS">
                                      Axis Bank
                                    </SelectItem>
                                    <SelectItem value="KOTAK">
                                      Kotak Mahindra
                                    </SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="DBS">
                                      DBS Bank
                                    </SelectItem>
                                    <SelectItem value="OCBC">
                                      OCBC Bank
                                    </SelectItem>
                                    <SelectItem value="UOB">
                                      UOB Bank
                                    </SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-1">
                            <Label
                              htmlFor="rzpAccountNumber"
                              className="text-xs font-semibold"
                            >
                              Account Number
                            </Label>
                            <Input
                              id="rzpAccountNumber"
                              type="password"
                              placeholder="Your bank account number"
                              value={razorpaySettings.bankAccountNumber || ""}
                              onChange={(e) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  bankAccountNumber: e.target.value,
                                }))
                              }
                              className="text-sm font-mono"
                            />
                            <p className="text-xs text-muted-foreground">
                              Encrypted and never shared
                            </p>
                          </div>

                          <div className="space-y-1">
                            <Label
                              htmlFor="rzpIfsc"
                              className="text-xs font-semibold"
                            >
                              {shopProfile?.country === "IN"
                                ? "IFSC Code"
                                : "Swift Code"}
                            </Label>
                            <Input
                              id="rzpIfsc"
                              placeholder={
                                shopProfile?.country === "IN"
                                  ? "HDFC0001234"
                                  : "DBSASGSG"
                              }
                              value={razorpaySettings.ifscCode || ""}
                              onChange={(e) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  ifscCode: e.target.value
                                    .toUpperCase()
                                    .replace(/[^A-Z0-9]/g, ""),
                                }))
                              }
                              maxLength={11}
                              className="text-sm font-mono uppercase"
                            />
                          </div>

                          {/* CONSENT */}
                          <div className="flex items-start gap-2 mt-2">
                            <input
                              id="rzpConsent"
                              type="checkbox"
                              checked={razorpaySettings.consent || false}
                              onChange={(e) =>
                                setRazorpaySettings((prev) => ({
                                  ...prev,
                                  consent: e.target.checked,
                                }))
                              }
                              className="mt-0.5"
                            />
                            <label
                              htmlFor="rzpConsent"
                              className="text-[11px] text-muted-foreground"
                            >
                              I agree to Razorpay’s Terms & Conditions and
                              authorize EventSH to submit my KYC and bank
                              details to Razorpay for payment gateway setup.
                            </label>
                          </div>

                          {/* CONNECT BUTTON */}
                          <Button
                            // onClick={handleConnectRazorpay}
                            disabled={
                              isConnectingRazorpay ||
                              !razorpaySettings.businessName ||
                              !razorpaySettings.accountHolderName ||
                              !razorpaySettings.bankAccountNumber ||
                              !razorpaySettings.ifscCode ||
                              !razorpaySettings.businessEmail ||
                              !razorpaySettings.businessPhone ||
                              (shopProfile?.country === "IN"
                                ? !razorpaySettings.panNumber
                                : !razorpaySettings.uenNumber) ||
                              !razorpaySettings.consent
                            }
                            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700"
                          >
                            {isConnectingRazorpay ? (
                              <>
                                <Loader className="w-4 h-4 animate-spin mr-2" />
                                Submitting details to Verify...
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                Setup Card Payments
                              </>
                            )}
                          </Button>

                          <p className="text-xs text-muted-foreground text-center mt-1">
                            Your details are encrypted and sent securely to
                            Razorpay. Activation usually takes 1–3 business
                            days.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* OPTIONAL SETTINGS AFTER CONNECT (similar to Stripe card settings) */}
                {razorpaySettings?.isConnected && (
                  <div className="space-y-4 p-4 bg-white border border-indigo-200 rounded-lg">
                    <h4 className="font-semibold text-slate-900">
                      Payment Options
                    </h4>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">
                        Enable payment methods
                      </Label>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={razorpaySettings.enableCards ?? true}
                            onChange={(e) =>
                              setRazorpaySettings((prev) => ({
                                ...prev,
                                enableCards: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded"
                          />
                          Cards (Visa, Mastercard, RuPay, Amex)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={razorpaySettings.enableUpi ?? true}
                            onChange={(e) =>
                              setRazorpaySettings((prev) => ({
                                ...prev,
                                enableUpi: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded"
                          />
                          UPI
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={razorpaySettings.enableNetbanking ?? true}
                            onChange={(e) =>
                              setRazorpaySettings((prev) => ({
                                ...prev,
                                enableNetbanking: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded"
                          />
                          Netbanking
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={razorpaySettings.enableWallets ?? false}
                            onChange={(e) =>
                              setRazorpaySettings((prev) => ({
                                ...prev,
                                enableWallets: e.target.checked,
                              }))
                            }
                            className="w-4 h-4 rounded"
                          />
                          Wallets
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 💾 SAVE BUTTON - BOTTOM */}
          {/* <Button
            onClick={handleSavePaymentSettings}
            disabled={
              isLoading ||
              (!paymentMethods.staticQR &&
                !paymentMethods.dynamicQR &&
                !paymentMethods.cardPayments)
            }
            className="w-full bg-blue-600 hover:bg-blue-700 font-semibold text-base"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Saving Payment Settings...
              </>
            ) : (
              "Save All Payment Methods"
            )}
          </Button> */}
        </TabsContent>

        <TabsContent value="shipping">
          <BlurWrapper>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5" />
                  Shipping Settings
                </CardTitle>
                <CardDescription>
                  Configure shipping options and rates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Free Shipping Threshold</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={shippingSettings.freeShippingThreshold}
                      onChange={(e) =>
                        setShippingSettings((prev) => ({
                          ...prev,
                          freeShippingThreshold:
                            parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Default Shipping Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={shippingSettings.defaultShippingCost}
                      onChange={(e) =>
                        setShippingSettings((prev) => ({
                          ...prev,
                          defaultShippingCost: parseFloat(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurWrapper>
        </TabsContent>

        <TabsContent value="receipts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptTextIcon className="w-5 h-5" />
                Receipt Settings
              </CardTitle>
              <CardDescription>
                Customize your order receipt appearance and details
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* RECEIPT TYPE */}
              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label className="text-sm font-medium">Receipt Type</Label>
                  <p className="text-xs text-muted-foreground">
                    Choose receipt paper size for printing
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* 58MM */}
                  <label
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition
      ${
        shopProfile.receiptType === "58MM"
          ? "border-blue-600 bg-blue-50"
          : "border-border hover:bg-muted"
      }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">58 mm</span>
                      <span className="text-xs text-muted-foreground">
                        Thermal receipt printer
                      </span>
                    </div>

                    <input
                      type="radio"
                      name="receiptType"
                      className="accent-blue-600"
                      checked={shopProfile.receiptType === "58MM"}
                      onChange={() =>
                        setOrganizerProfile((prev) => ({
                          ...prev,
                          receiptType: "58MM",
                        }))
                      }
                    />
                  </label>

                  {/* A4 */}
                  <label
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition
      ${
        shopProfile.receiptType === "A4"
          ? "border-blue-600 bg-blue-50"
          : "border-border hover:bg-muted"
      }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">A4</span>
                      <span className="text-xs text-muted-foreground">
                        Full page printer
                      </span>
                    </div>

                    <input
                      type="radio"
                      name="receiptType"
                      className="accent-blue-600"
                      checked={shopProfile.receiptType === "A4"}
                      onChange={() =>
                        setOrganizerProfile((prev) => ({
                          ...prev,
                          receiptType: "A4",
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              {/* QR CODE SETTINGS */}
              <div className="space-y-4 border-t pt-4">
                {/* WhatsApp QR */}
                <div className="space-y-4">
                  {/* TOGGLE */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">
                        Print Contact QR
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Prints WhatsApp QR on receipt
                      </p>
                    </div>

                    <Switch
                      checked={shopProfile.whatsAppQR}
                      onCheckedChange={(checked) =>
                        setOrganizerProfile((prev) => ({
                          ...prev,
                          whatsAppQR: checked,
                          // Auto-select default number when enabled
                          whatsAppQRNumber: checked
                            ? prev.whatsAppNumber || prev.phone
                            : "",
                        }))
                      }
                    />
                  </div>

                  {/* NUMBER SELECTION */}
                  {shopProfile.whatsAppQR && (
                    <div className="pl-4 space-y-3">
                      <Label className="text-xs text-muted-foreground">
                        Select WhatsApp number to print on receipt
                      </Label>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {/* WhatsApp Number */}
                        {shopProfile.whatsAppNumber && (
                          <label
                            className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition
            ${
              shopProfile.whatsAppQRNumber === shopProfile.whatsAppNumber
                ? "border-blue-600 bg-blue-50"
                : "border-border hover:bg-muted"
            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                WhatsApp
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {shopProfile.whatsAppNumber}
                              </span>
                            </div>

                            <input
                              type="radio"
                              name="whatsappQRNumber"
                              className="accent-blue-600"
                              checked={
                                shopProfile.whatsAppQRNumber ===
                                shopProfile.whatsAppNumber
                              }
                              onChange={() =>
                                setOrganizerProfile((prev) => ({
                                  ...prev,
                                  whatsAppQRNumber: prev.whatsAppNumber,
                                }))
                              }
                            />
                          </label>
                        )}

                        {/* Phone Number */}
                        {shopProfile.phone && (
                          <label
                            className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition
            ${
              shopProfile.whatsAppQRNumber === shopProfile.phone
                ? "border-blue-600 bg-blue-50"
                : "border-border hover:bg-muted"
            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">Phone</span>
                              <span className="text-xs text-muted-foreground">
                                {shopProfile.phone}
                              </span>
                            </div>

                            <input
                              type="radio"
                              name="whatsappQRNumber"
                              className="accent-blue-600"
                              checked={
                                shopProfile.whatsAppQRNumber ===
                                shopProfile.phone
                              }
                              onChange={() =>
                                setOrganizerProfile((prev) => ({
                                  ...prev,
                                  whatsAppQRNumber: prev.phone,
                                }))
                              }
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Instagram QR */}
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <Label className="text-sm font-medium">
                      Print Instagram QR
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Prints Instagram QR on receipt
                    </p>
                  </div>
                  <Switch
                    checked={shopProfile.instagramQR}
                    onCheckedChange={(checked) =>
                      setOrganizerProfile((prev) => ({
                        ...prev,
                        instagramQR: checked,
                      }))
                    }
                  />
                </div>

                {shopProfile.instagramQR && (
                  <div className="pl-4 space-y-1">
                    <Label htmlFor="instagramHandle" className="text-xs">
                      Instagram Handle
                    </Label>
                    <Input
                      id="instagramHandle"
                      placeholder="https://instagram.com/yourhandle"
                      value={shopProfile.instagramHandle}
                      onChange={(e) =>
                        setOrganizerProfile((prev) => ({
                          ...prev,
                          instagramHandle: e.target.value.replace("@", ""),
                        }))
                      }
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coupons">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptTextIcon className="w-5 h-5" />
                Coupon Settings
              </CardTitle>
              <CardDescription>
                Create and Manage your Coupons here
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Coupons</h3>

                <Button onClick={handleAddCoupon}>+ Add Coupon</Button>
              </div>

              {coupons.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
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
                            Expires: {new Date(c.expiryDate).toDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* ACTIVE */}
                          <Switch
                            checked={c.isActive}
                            onCheckedChange={() => {
                              handleToggleActiveCoupon(c._id, !c.isActive);
                            }}
                          />

                          {/* EDIT */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCoupon(c)}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>

                          {/* DELETE */}
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
            </CardContent>
          </Card>
        </TabsContent>

        <Dialog open={openCouponDialog} onOpenChange={setOpenCouponDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? "Update Coupon" : "Create Coupon"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {/* COUPON CODE */}
              <div className="flex flex-col-2 gap-4">
                <div className="space-y-1 flex-1">
                  <Label>Coupon Code</Label>
                  <Input
                    placeholder="SAVE20"
                    value={coupon.code}
                    onChange={(e) =>
                      handleChange("code", e.target.value.toUpperCase())
                    }
                    disabled={isEditMode} // don't allow code change on update
                  />
                </div>

                {/* DISCOUNT TYPE */}
                <div className="space-y-1 flex-1">
                  <Label>Discount Type</Label>
                  <Select
                    value={coupon.discountType}
                    onValueChange={(value) =>
                      handleChange("discountType", value)
                    }
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
                {/* DISCOUNT VALUE */}
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

                {/* MIN ORDER */}
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

                {/* EXPIRY DATE */}
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
              {/* MAX USAGE */}
            </div>

            {/* SELECT EVENT (OPTIONAL) */}
            <div className="space-y-1">
              <Label>Linked Event (Optional)</Label>
              <Select
                value={coupon.eventId}
                onValueChange={(value) => handleChange("eventId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (Global Coupon)</SelectItem>
                  {events.map((evt) => (
                    <SelectItem key={evt._id} value={evt._id}>
                      {evt.title} {/* Adjust based on your event object */}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Optional: Select an event if you are creating this coupon
                specifically for an exhibitor or stall booking at a certain
                event.
              </p>
            </div>

            <Button className="w-full mt-4" onClick={handleSubmitCoupon}>
              {isEditMode ? "Update Coupon" : "Create Coupon"}
            </Button>
          </DialogContent>
        </Dialog>

        {/* <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Choose which notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {Object.entries(notifications).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>
                        {key
                          .replace(/([A-Z])/g, " $1")
                          .replace(/^./, (str) => str.toUpperCase())}
                      </Label>
                    </div>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({
                          ...prev,
                          [key]: checked,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent> */}
      </Tabs>

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
