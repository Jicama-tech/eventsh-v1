import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Trash2,
  Plus,
  Minus,
  Calendar,
  MapPin,
  Clock,
  Users,
  CreditCard,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FaWhatsapp } from "react-icons/fa";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/hooks/useCurrencyhook";

interface TicketItem {
  id: string;
  eventId: string;
  eventTitle: string;
  ticketType: string;
  price: number;
  quantity: number;
  maxQuantity: number;
  organizerId: string;
  organizerName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  description?: string;
  validUntil: string;
}

interface EventInfo {
  id: string;
  title: string;
  organizerId: string;
  organizerName: string;
  organizationName: string;
  date: string;
  time: string;
  venue: string;
  description: string;
  category: string;
  ageRestriction?: string;
  dressCode?: string;
  image: string;
}

interface OrderSummary {
  subtotal: number;
  tax: number;
  total: number;
}

interface Country {
  name: string;
  code: string;
  dialCode: string;
}

export interface OrganizerToken {
  roles: string[];
}

const apiURL = __API_URL__;

export default function TicketCart() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponToProceed, setCouponToProceed] = useState("");
  const [discount, setDiscount] = useState(0);

  // Email and WhatsApp verification states
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);

  const [countryCode, setCountryCode] = useState("+91");
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappVerified, setWhatsappVerified] = useState(false);
  const [whatsappVerifying, setWhatsappVerifying] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [slug, setSlug] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);

  // Customer details
  const [customerDetails, setCustomerDetails] = useState({
    firstName: "",
    lastName: "",
  });
  const [isNameDisabled, setIsNameDisabled] = useState(false);

  const [whatsAppNumber, setWhatsappNumber] = useState("");
  const [organizerInfo, setOrganizerInfo] = useState(null);
  const { organizerId } = useParams<{ organizerId: string }>();
  const [emailId, setEmailId] = useState("");
  const [shopName, setShopName] = useState("");

  // New state for order tabs and fields
  const [orderFor, setOrderFor] = useState<"customer" | "self">("customer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // State for organizer verification
  const [organizerWhatsAppNumber, setOrganizerWhatsAppNumber] = useState("");
  const [organizerOtp, setOrganizerOtp] = useState("");
  const [isOrganizerOtpSent, setIsOrganizerOtpSent] = useState(false);
  const [isOrganizerVerified, setIsOrganizerVerified] = useState(false);
  const [isOrganizerVerifying, setIsOrganizerVerifying] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [completeWhatsAppNumber, setCompleteWhatsAppNumber] = useState("");
  const [country, setCountry] = useState("");
  const { formatPrice, getSymbol } = useCurrency(country);

  // Google Auth state
  const [googleAuthed, setGoogleAuthed] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Handle Google auth redirect callback
  useEffect(() => {
    const googleAuth = searchParams.get("google_auth");
    if (googleAuth === "success") {
      const gEmail = searchParams.get("email") || "";
      const gFirstName = searchParams.get("firstName") || "";
      const gLastName = searchParams.get("lastName") || "";
      const gName = searchParams.get("name") || "";
      const isExisting = searchParams.get("existing") === "true";

      setEmail(gEmail);
      setEmailVerified(true);
      setGoogleAuthed(true);

      if (isExisting) {
        // Existing user — fetch full details from backend
        fetchUserByEmail(gEmail).then((existingUser) => {
          setCustomerDetails({
            firstName: existingUser?.firstName || gFirstName || gName.split(" ")[0] || "",
            lastName: existingUser?.lastName || gLastName || gName.split(" ").slice(1).join(" ") || "",
          });
          setIsNameDisabled(true);
          toast({
            duration: 3000,
            title: "Welcome back!",
            description: "Your details have been auto-filled",
          });
        });
      } else {
        // New user — prefill from Google
        setCustomerDetails({
          firstName: gFirstName || gName.split(" ")[0] || "",
          lastName: gLastName || gName.split(" ").slice(1).join(" ") || "",
        });
        setIsNameDisabled(false);
        toast({
          duration: 3000,
          title: "Signed in with Google",
          description: "Please complete your details",
        });
      }

      // Clean URL params
      searchParams.delete("google_auth");
      searchParams.delete("email");
      searchParams.delete("firstName");
      searchParams.delete("lastName");
      searchParams.delete("name");
      searchParams.delete("existing");
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("error") === "auth_failed") {
      toast({
        duration: 3000,
        title: "Google Sign-in Failed",
        description: "Please try again or enter details manually",
        variant: "destructive",
      });
      searchParams.delete("error");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    // Save current cart to localStorage before redirect (it's already there)
    // Redirect to backend Google auth with return URL
    const returnUrl = encodeURIComponent(window.location.pathname);
    window.location.href = `${apiURL}/auth/google-buyer?state=${returnUrl}`;
  };

  useEffect(() => {
    async function getShopkeeper() {
      const token = sessionStorage.getItem("token");
      if (token) {
        const decode = jwtDecode<OrganizerToken>(token);
        const role = decode.roles[0];

        if (role === "organizer") {
          setIsOrganizerVerified(true);
        }
      }
    }

    getShopkeeper();
  }, []);

  // Fetch countries on component mount
  useEffect(() => {
    async function fetchCountries() {
      try {
        setLoadingCountries(true);
        const response = await fetch(
          "https://restcountries.com/v3.1/all?fields=name,cca2,idd",
        );
        const data = await response.json();
        const fetchedCountries: Country[] = data
          .map((country: any) => {
            const root = country.idd?.root ?? "";
            const suffixes = country.idd?.suffixes ?? [];
            let dial = "";
            if (root && suffixes.length === 1) dial = root + suffixes[0];
            else if (root) dial = root;
            return {
              name: country.name?.common || "",
              code: country.cca2 || "",
              dialCode: dial,
            };
          })
          .filter((c) => c.dialCode)
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountries(fetchedCountries);
      } catch (e) {
        toast({
          duration: 5000,
          title: "Error loading countries",
          description: "Failed to fetch country codes",
          variant: "destructive",
        });
      } finally {
        setLoadingCountries(false);
      }
    }
    fetchCountries();
  }, [toast]);

  useEffect(() => {
    fetchWhatsAppNumber();
    getSlug();
  }, [organizerId]);

  const handleBackToStore = () => {
    setIsNavigating(true);
    navigate(`/${slug}`);
  };

  useEffect(() => {
    async function getOrganizer() {
      const token = sessionStorage.getItem("token");
      if (token) {
        const decode = jwtDecode<OrganizerToken>(token);
        const role = decode.roles[0];

        if (role === "organizer") {
          setIsOrganizerVerified(true);
        }
      }
    }

    async function getSlug() {}

    getOrganizer();
  }, []);

  async function fetchWhatsAppNumber() {
    try {
      if (organizerId) {
        const response = await fetch(
          `${apiURL}/organizers/profile-get/${organizerId}`,
          {
            method: "GET",
          },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch store details");
        }

        const shopData = await response.json();
        setWhatsappNumber(shopData.data.whatsAppNumber);
        setOrganizerInfo(shopData.data);
        setCountry(shopData?.data?.country);
        setEmailId(shopData?.data?.email);
        setShopName(shopData?.data?._id);
      }
    } catch (error) {
      console.error("Error fetching store details:", error);
    }
  }

  async function getSlug() {
    try {
      const response = await fetch(
        `${apiURL}/organizer-stores/organizer-store-detail/${organizerId}`,
        { method: "GET" },
      );

      if (!response.ok) {
        throw new Error("Failed to get the slug");
      }

      const data = await response.json();
      setSlug(data.data.slug);
    } catch (error) {
      throw error;
    }
  }

  // Function to fetch user by email from backend
  async function fetchUserByEmail(email: string) {
    if (!email) return null;
    try {
      const res = await fetch(`${apiURL}/users/get-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data.success && data.user) {
        return {
          fullName: `${data.user.firstName} ${data.user.lastName}`,
          firstName: data.user.firstName,
          lastName: data.user.lastName,
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching user by email:", error);
      return null;
    }
  }

  async function findUserBywhatsAppNumber(
    countryCode: string,
    whatsAppNumber: string,
  ) {
    try {
      const fullWhatsAppNumber = `${countryCode}${whatsAppNumber}`;
      const res = await fetch(
        `${apiURL}/users/get-user-by-whatsAppNumber/${fullWhatsAppNumber}`,
        {
          method: "GET",
        },
      );
      if (!res.ok) {
        throw new Error("Failed to find user by WhatsApp number");
      }
      const data = await res.json();
      if (data.data) {
        setEmail(data.data.email);
        setFirstName(data.data.name.split(" ")[0] || "");
        setLastName(data.data.name.split(" ").slice(1).join(" "));
        setWhatsappVerified(true); // ✅ ADD THIS LINE
        toast({
          duration: 3000,
          title: "Customer Found",
          description: "Details auto-filled successfully",
        });
      } else {
        throw new Error(
          data.message || "No user found with this WhatsApp number",
        );
      }
    } catch (err) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  }

  // Watch email changes to populate names if user exists
  useEffect(() => {
    async function lookupUser() {
      if (!email) {
        setCustomerDetails((prev) => ({
          ...prev,
          firstName: "",
          lastName: "",
        }));
        setIsNameDisabled(false);
        return;
      }

      if (emailVerified) {
        const user = await fetchUserByEmail(email);
        if (user && user.fullName) {
          const nameParts = user.fullName.split(" ");
          // Extract first and last name
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";
          setCustomerDetails((prev) => ({
            ...prev,
            firstName,
            lastName,
          }));
          setIsNameDisabled(true);
        } else {
          setCustomerDetails((prev) => ({
            ...prev,
            firstName: "",
            lastName: "",
          }));
          setIsNameDisabled(false);
        }
      }
    }
    lookupUser();
  }, [email, emailVerified]);

  // Organizer OTP functions
  const handleRequestOrganizerOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizerWhatsAppNumber || organizerWhatsAppNumber.length < 6) {
      toast({
        duration: 5000,
        title: "Invalid Number",
        description: "Please enter a valid WhatsApp number",
        variant: "destructive",
      });
      return;
    }

    setIsOrganizerVerifying(true);
    try {
      const fullNumber = `${countryCode}${organizerWhatsAppNumber}`;
      const response = await fetch(`${apiURL}/otp/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: fullNumber,
          role: "organizer",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send OTP");
      }

      toast({
        duration: 5000,
        title: "OTP Sent Successfully",
        description: `OTP sent to WhatsApp number ${fullNumber}`,
      });

      setIsOrganizerOtpSent(true);
      setCountdown(60);
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message || "Failed to send OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsOrganizerVerifying(false);
    }
  };

  const handleVerifyOrganizerOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = organizerOtp;
    if (otpString.length !== 6) {
      toast({
        duration: 5000,
        title: "Invalid OTP",
        description: "Please enter all 6 digits",
        variant: "destructive",
      });
      return;
    }
    setIsOrganizerVerifying(true);
    try {
      const fullNumber = `${countryCode}${organizerWhatsAppNumber}`;
      const response = await fetch(`${apiURL}/otp/verify-chat-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: fullNumber,
          otp: otpString,
          role: "organizer",
          shopId: shopName,
          emailId: emailId,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "OTP verification failed");
      }
      const data = await response.json();
      if (data.data) {
        sessionStorage.setItem("token", data.data);
        setIsOrganizerVerified(true);
        toast({
          duration: 5000,
          title: "Organizer Verified",
          description: "You can now place the order for the customer.",
        });
      } else {
        throw new Error("No token received");
      }
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Verification Failed",
        description: err.message || "Invalid OTP. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsOrganizerVerifying(false);
    }
  };

  async function handleVerifyEmail() {
    if (!email) {
      toast({
        duration: 5000,
        title: "Please enter email",
        variant: "destructive",
      });
      return;
    }
    setEmailVerifying(true);

    try {
      const res = await fetch(`${apiURL}/users/verify-email-for-cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, whatsAppNumber: completeWhatsAppNumber }),
      });
      if (!res.ok) throw new Error("Failed to verify email");
      const data = await res.json();

      if (data.success) {
        setEmailVerified(true);
        setFirstName(data.user.name.split(" ")[0] || "");
        setLastName(data.user.name.split(" ").slice(1).join(" "));
        sessionStorage.setItem("usertoken", data.token);
        toast({
          duration: 5000,
          title: "Email Verified",
          description: data.message,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setEmailVerifying(false);
    }
  }

  // Simulate sending OTP to WhatsApp
  async function handleSendOtp(countryCode: string, whatsAppNumber: string) {
    // const token = sessionStorage.getItem("token");
    // const decoded = jwtDecode(token);
    // const userId = decoded.sub;

    const fullWhatsAppNumber = `${countryCode}${whatsAppNumber}`;
    setCompleteWhatsAppNumber(fullWhatsAppNumber);

    if (!fullWhatsAppNumber) {
      toast({
        duration: 5000,
        title: "Please enter WhatsApp number",
        variant: "destructive",
      });
      return;
    }
    // if (!userId) {
    //   toast({ duration: 5000, title: "Please verify email first", variant: "destructive" });
    //   return;
    // }

    setWhatsappVerifying(true);

    try {
      const res = await fetch(`${apiURL}/users/send-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsAppNumber: fullWhatsAppNumber }),
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
        setWhatsappVerifying(false);
        setWhatsappVerified(true);
        toast({
          duration: 5000,
          title: "Already Verified",
          description: data.message,
        });
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setWhatsappVerifying(false);
    }
  }

  async function handleVerifyOtp(countryCode: string, whatsAppNumber: string) {
    // const token = sessionStorage.getItem("token");
    // const decoded = jwtDecode(token);
    // const userId = decoded.sub;

    const fullWhatsAppNumber = `${countryCode}${whatsAppNumber}`;

    if (!otp) {
      toast({
        duration: 5000,
        title: "Please enter OTP",
        variant: "destructive",
      });
      return;
    }
    // if (!userId) {
    //   toast({ duration: 5000, title: "Please verify email first", variant: "destructive" });
    //   return;
    // }

    setWhatsappVerifying(true);
    try {
      const res = await fetch(`${apiURL}/users/verify-whatsapp-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // userId,
          whatsAppNumber: fullWhatsAppNumber,
          otp,
        }),
      });
      if (!res.ok) throw new Error("Failed to verify WhatsApp OTP");
      const data = await res.json();

      if (data.success) {
        setWhatsappVerified(true);
        toast({
          duration: 5000,
          title: "WhatsApp Verified",
          description: "Number verified successfully",
        });


        setEmail(data?.user?.email);
        setFirstName(data?.user?.name?.split(" ")[0] || "");
        setLastName(data?.user?.name?.split(" ").slice(1).join(" "));
      } else if (data.alreadyVerified) {
        setWhatsappVerified(true);
        toast({
          duration: 5000,
          title: "Already Verified",
          description: data.message,
        });


        setEmail(data?.user?.email);
        setFirstName(data?.user?.name?.split(" ")[0] || "");
        setLastName(data?.user?.name?.split(" ").slice(1).join(" "));
      } else {
        throw new Error(data.message);
      }
    } catch (err) {
      toast({
        duration: 5000,
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setWhatsappVerifying(false);
    }
  }
  // Load cart from localStorage on component mount
  useEffect(() => {
    const savedCart = localStorage.getItem("ticketCart");
    if (savedCart) {
      const cartData = JSON.parse(savedCart);
      setTicketItems(cartData.items || []);
      if (cartData.eventInfo) {
        setEventInfo(cartData.eventInfo);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    const cartData = {
      items: ticketItems,
      eventInfo: eventInfo,
      timestamp: Date.now(),
    };
    localStorage.setItem("ticketCart", JSON.stringify(cartData));
  }, [ticketItems, eventInfo]);

  // Calculate order summary
  const calculateOrderSummary = (): OrderSummary => {
    const subtotal = ticketItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const tax = 0; // Tax set to 0 as requested
    const discountAmount = subtotal * (discount / 100);
    const total = Math.max(0, subtotal + tax - discountAmount);

    return {
      subtotal: subtotal - discountAmount,
      tax,
      total,
    };
  };

  const updateQuantity = (ticketId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    setTicketItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === ticketId) {
          const maxQty = Math.min(newQuantity, item.maxQuantity);
          return { ...item, quantity: maxQty };
        }
        return item;
      }),
    );
  };

  const removeItem = (ticketId: string) => {
    setTicketItems((prevItems) =>
      prevItems.filter((item) => item.id !== ticketId),
    );
  };

  const clearCart = () => {
    setTicketItems([]);
    setEventInfo(null);
    localStorage.removeItem("ticketCart");
    toast({
      duration: 5000,
      title: "Cart cleared",
      description: "All tickets have been removed from your cart.",
    });
  };

  const applyCoupon = async () => {
    if (!couponCode.trim() || !eventInfo) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${apiURL}/coupons/Validate-Event-Coupon`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: couponCode.trim(),
          eventId: eventInfo.id,
          orderAmount: calculateOrderSummary().subtotal,
        }),
      });

      if (response.ok) {
        const couponData = await response.json();
        if (couponData.discountPercentage) {
          setDiscount(couponData.discountPercentage || 0);
        } else if (couponData.flatDiscountAmount) {
          const subtotal = calculateOrderSummary().subtotal;
          const discountPercent =
            (couponData.flatDiscountAmount / subtotal) * 100;
          setDiscount(discountPercent);
        }

        setCouponToProceed(couponCode.trim());

        toast({
          duration: 5000,
          title: "Coupon applied!",
          description: `You got ${couponData.discountPercentage ? `${couponData.discountPercentage}%` : `${formatPrice(couponData.flatDiscountAmount)}`} discount`,
        });
      } else {
        throw new Error("Invalid coupon code");
      }
    } catch (error) {
      toast({
        duration: 5000,
        title: "Invalid coupon",
        description: "Please check your coupon code and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  async function getShopkeeper() {
    const token = sessionStorage.getItem("token");
    if (token) {
      const decode = jwtDecode<OrganizerToken>(token);
      const role = decode.roles[0];
      if (role === "shopkeeper") {
        setIsOrganizerVerified(true);
        setOrderFor("self"); // <--- Add this to force the switch
      }
    }
  }

  const proceedToCheckout = async () => {
    if (ticketItems.length === 0) {
      toast({
        duration: 5000,
        title: "Cart is empty",
        description: "Please add some tickets before proceeding.",
        variant: "destructive",
      });
      return;
    }

    if (orderFor === "customer") {
      if (!email || !emailVerified || !whatsapp || !whatsappVerified) {
        toast({
          duration: 5000,
          title: "Verification required",
          description: "Please verify both email and WhatsApp number.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!firstName || !lastName) {
      toast({
        duration: 5000,
        title: "Missing details",
        description: "Please fill in first name and last name.",
        variant: "destructive",
      });
      return;
    }

    const ticketId = `Ticket-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    try {
      setIsLoading(true);
      const orderSummary = calculateOrderSummary();
      const paymentURL = organizerInfo?.paymentURL
        ? apiURL + organizerInfo?.paymentURL
        : "";

      // Create order data to pass to payment page
      const orderData = {
        paymentURL,
        eventId: eventInfo?.id,
        eventInfo: eventInfo,
        ticketId: ticketId,
        coupon: couponToProceed,
        organizerId: eventInfo?.organizerId,
        tickets: ticketItems.map((item) => ({
          ticketId: item.id,
          ticketType: item.ticketType,
          quantity: item.quantity,
          price: item.price,
          eventTitle: item.eventTitle,
          validUntil: item.validUntil,
        })),
        customerDetails: {
          email: email,
          whatsapp: `${countryCode}${whatsapp}`,
          firstName: firstName,
          lastName: lastName,
        },
        orderSummary,
        couponCode: couponCode || null,
        discount: discount,
        whatsAppNumber: whatsAppNumber, // Organizer's WhatsApp for contact
      };

      // Generate a temporary order ID for reference
      const tempOrderId = `TKT-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      // Navigate to payment page with order data
      navigate("/ticket-payment", {
        state: {
          orderId: tempOrderId,
          ...orderData,
          total: orderSummary.total,
          subtotal: orderSummary.subtotal,
          tax: orderSummary.tax,
        },
      });

      toast({
        duration: 5000,
        title: "Proceeding to payment",
        description: "Redirecting to payment page...",
      });
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        duration: 5000,
        title: "Checkout failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const orderSummary = calculateOrderSummary();

  if (ticketItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Your Ticket Cart</h1>
            <p className="text-muted-foreground">
              Review your tickets and complete your purchase
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Cart Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Event Information */}
              {eventInfo && (
                <Card
                  className="relative overflow-hidden"
                  style={{
                    backgroundImage: `url(${apiURL}${eventInfo.image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  <div className="absolute inset-0 bg-black bg-opacity-70 z-0"></div>

                  <CardHeader className="relative z-10">
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Calendar className="h-5 w-5" />
                      {eventInfo.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-4 text-white">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{eventInfo.venue}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>
                          {new Date(eventInfo.date).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}{" "}
                          at {eventInfo.time}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>By {eventInfo.organizationName}</span>
                      </div>
                    </div>
                    {eventInfo.description && (
                      <p className="text-sm">{eventInfo.description}</p>
                    )}
                    {(eventInfo.ageRestriction || eventInfo.dressCode) && (
                      <div className="flex gap-2 text-xs secondary">
                        {eventInfo.ageRestriction && (
                          <Badge variant="secondary">
                            Age: {eventInfo.ageRestriction}
                          </Badge>
                        )}
                        {eventInfo.dressCode && (
                          <Badge variant="secondary">
                            Dress: {eventInfo.dressCode}
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className="text-xs px-1.5 py-0.5 max-w-auto truncate"
                        >
                          {eventInfo.category}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Ticket Items */}
              <Card className="space-y-4">
                {ticketItems.map((item) => (
                  <div key={item.id} className="p-4 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-2">
                        <h4 className="font-semibold">{item.eventTitle}</h4>
                        {item.description && (
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>{formatPrice(item.price)} each</span>
                          <span>
                            Valid until:{" "}
                            {new Date(eventInfo.date).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 min-w-[3rem] text-center">
                          × 1
                        </span>
                        <div className="min-w-[4rem] font-semibold text-right">
                          = {formatPrice(item.price)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => clearCart()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Separator />
                  </div>
                ))}
                <div className="flex justify-between">
                  <Button
                    variant="buttonOutline"
                    className="mb-4 ml-4 mt-4 mb-4"
                    onClick={handleBackToStore}
                  >
                    Back to Store
                  </Button>
                  <Button
                    variant="buttonOutline"
                    className="mr-4 mt-4 mb-4 text-green-600"
                  >
                    <a
                      href={`https://wa.me/${whatsAppNumber.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-green-600 transition"
                    >
                      <FaWhatsapp size={24} />
                      <span className="font-medium">WhatsApp Contact</span>
                    </a>
                  </Button>
                </div>
              </Card>

              {/* Customer Details */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    Customer Details (To Be Printed On Ticket)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs
                    value={orderFor}
                    onValueChange={(value) =>
                      setOrderFor(value as "customer" | "self")
                    }
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger
                        value="customer"
                        // Disable if verified OR if a token is sitting in storage
                        disabled={
                          isOrganizerVerified ||
                          !!sessionStorage.getItem("token")
                        }
                        onClick={getShopkeeper}
                      >
                        Customer Order
                      </TabsTrigger>
                      <TabsTrigger value="self">Self Order</TabsTrigger>
                    </TabsList>
                    <TabsContent value="customer" className="space-y-4">
                      {/* Google Sign-in */}
                      {!googleAuthed && (
                        <div className="mb-4">
                          <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={googleLoading}
                            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
                          >
                            {googleLoading ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <svg viewBox="0 0 24 24" className="h-5 w-5">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                            )}
                            <span className="text-sm font-medium text-gray-700">
                              {googleLoading ? "Signing in..." : "Sign in with Google"}
                            </span>
                          </button>
                          <div className="relative my-4">
                            <div className="absolute inset-0 flex items-center">
                              <Separator />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-background px-2 text-muted-foreground">
                                or continue manually
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {googleAuthed && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          <span className="text-sm text-green-700 font-medium">Signed in as {email}</span>
                        </div>
                      )}

                      {/* WhatsApp Number */}
                      <div className="mb-6">
                        <Label
                          htmlFor="whatsapp"
                          className="flex items-center justify-between mb-2"
                        >
                          <span>WhatsApp Number *</span>
                          {whatsappVerified && (
                            <Badge variant="default" className="ml-2">
                              Verified
                            </Badge>
                          )}
                        </Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-28">
                            <Select
                              value={countryCode}
                              onValueChange={setCountryCode}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Code" />
                              </SelectTrigger>
                              <SelectContent>
                                {countries.map((country) => (
                                  <SelectItem
                                    key={country.code}
                                    value={country.dialCode}
                                  >
                                    {country.name} {country.dialCode}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            id="whatsapp"
                            type="tel"
                            placeholder="Enter number"
                            value={whatsapp}
                            onChange={(e) =>
                              setWhatsapp(e.target.value.replace(/\D/g, ""))
                            }
                            disabled={whatsappVerified}
                            className="flex-grow"
                          />
                          {!whatsappVerified && (
                            <Button
                              onClick={() =>
                                handleSendOtp(countryCode, whatsapp)
                              }
                              disabled={whatsapp === "" || whatsappVerifying}
                              size="sm"
                              variant="buttonOutline"
                            >
                              {whatsappVerifying ? "Sending..." : "Send OTP"}
                            </Button>
                          )}
                        </div>
                        {otpSent && !whatsappVerified && (
                          <div className="flex items-center mt-2 space-x-2">
                            <Input
                              id="otp"
                              placeholder="Enter OTP"
                              maxLength={6}
                              value={otp}
                              onChange={(e) => setOtp(e.target.value)}
                              className="flex-grow"
                            />
                            <Button
                              onClick={() =>
                                handleVerifyOtp(countryCode, whatsapp)
                              }
                              disabled={otp.length !== 6 || whatsappVerifying}
                              size="sm"
                              variant="buttonOutline"
                            >
                              {whatsappVerifying ? "Verifying..." : "Verify"}
                            </Button>
                          </div>
                        )}
                      </div>
                      {/* Email Address */}
                      <div className="mb-6">
                        <Label
                          htmlFor="email"
                          className="flex items-center justify-between mb-2"
                        >
                          <span>Email Address *</span>
                          {emailVerified && (
                            <Badge variant="default" className="ml-2">
                              Verified
                            </Badge>
                          )}
                        </Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            id="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setEmailVerified(false);
                            }}
                            disabled={emailVerified}
                            className="flex-grow"
                          />
                          {!emailVerified && (
                            <Button
                              onClick={handleVerifyEmail}
                              disabled={emailVerifying || email === ""}
                              size="sm"
                              variant="buttonOutline"
                            >
                              {emailVerifying ? "Verifying..." : "Verify"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* First Name and Last Name */}
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="firstName" className="mb-2">
                            First Name *
                          </Label>
                          <Input
                            id="firstName"
                            value={customerDetails.firstName}
                            onChange={(e) =>
                              setCustomerDetails((prev) => ({
                                ...prev,
                                firstName: e.target.value,
                              }))
                            }
                            placeholder="First Name"
                            disabled={isNameDisabled}
                          />
                        </div>

                        <div>
                          <Label htmlFor="lastName" className="mb-2">
                            Last Name *
                          </Label>
                          <Input
                            id="lastName"
                            value={customerDetails.lastName}
                            onChange={(e) =>
                              setCustomerDetails((prev) => ({
                                ...prev,
                                lastName: e.target.value,
                              }))
                            }
                            placeholder="Last Name"
                            disabled={isNameDisabled}
                          />
                        </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="self" className="space-y-4">
                      {/* Self Order Fields */}
                      {!isOrganizerVerified ? (
                        <form
                          onSubmit={
                            isOrganizerOtpSent
                              ? handleVerifyOrganizerOtp
                              : handleRequestOrganizerOtp
                          }
                        >
                          <div className="space-y-2">
                            <Label htmlFor="organizerWhatsApp">
                              Organizer WhatsApp Number *
                            </Label>
                            <div className="flex items-center space-x-2">
                              <div className="w-28">
                                <Select
                                  value={countryCode}
                                  onValueChange={setCountryCode}
                                  disabled={isOrganizerOtpSent}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Code" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {countries.map((country) => (
                                      <SelectItem
                                        key={country.code}
                                        value={country.dialCode}
                                      >
                                        {country.name} {country.dialCode}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Input
                                id="organizerWhatsApp"
                                type="tel"
                                placeholder="Enter number"
                                value={organizerWhatsAppNumber}
                                onChange={(e) =>
                                  setOrganizerWhatsAppNumber(
                                    e.target.value.replace(/\D/g, ""),
                                  )
                                }
                                disabled={isOrganizerOtpSent}
                              />
                            </div>
                            {isOrganizerOtpSent && (
                              <div className="space-y-2">
                                <Label htmlFor="organizerOtp">OTP *</Label>
                                <Input
                                  id="organizerOtp"
                                  placeholder="Enter OTP"
                                  maxLength={6}
                                  value={organizerOtp}
                                  onChange={(e) =>
                                    setOrganizerOtp(e.target.value)
                                  }
                                />
                              </div>
                            )}
                            <Button
                              type="submit"
                              className="w-full"
                              disabled={
                                isOrganizerVerifying ||
                                (isOrganizerOtpSent &&
                                  organizerOtp.length !== 6)
                              }
                            >
                              {isOrganizerVerifying ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isOrganizerOtpSent ? (
                                "Verify OTP"
                              ) : (
                                "Send OTP"
                              )}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-4">
                          {/* WhatsApp Number */}
                          <div className="mb-6">
                            <Label
                              htmlFor="whatsapp"
                              className="flex items-center justify-between mb-2"
                            >
                              <span>WhatsApp Number *</span>
                              {/* {whatsappVerified && (
                              <Badge variant="default" className="ml-2">
                                Verified
                              </Badge>
                            )} */}
                            </Label>
                            <div className="flex items-center space-x-2">
                              <div className="w-28">
                                <Select
                                  value={countryCode}
                                  onValueChange={setCountryCode}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Code" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {countries.map((country) => (
                                      <SelectItem
                                        key={country.code}
                                        value={country.dialCode}
                                      >
                                        {country.name} {country.dialCode}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Input
                                id="whatsapp"
                                type="tel"
                                placeholder="Enter number"
                                value={whatsapp}
                                onChange={(e) =>
                                  setWhatsapp(e.target.value.replace(/\D/g, ""))
                                }
                                className="flex-grow"
                              />
                              {/* {!whatsappVerified && (
                              <Button
                                onClick={() =>
                                  handleSendOtp(countryCode, whatsapp)
                                }
                                disabled={
                                  !emailVerified ||
                                  whatsapp === "" ||
                                  whatsappVerifying
                                }
                                size="sm"
                                variant="buttonOutline"
                              >
                                {whatsappVerifying ? "Sending..." : "Send OTP"}
                              </Button>
                            )} */}
                            </div>
                            {/* {otpSent && !whatsappVerified && (
                            <div className="flex items-center mt-2 space-x-2">
                              <Input
                                id="otp"
                                placeholder="Enter OTP"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="flex-grow"
                              />
                              <Button
                                onClick={() =>
                                  handleVerifyOtp(countryCode, whatsapp)
                                }
                                disabled={otp.length !== 6 || whatsappVerifying}
                                size="sm"
                                variant="buttonOutline"
                              >
                                {whatsappVerifying ? "Verifying..." : "Verify"}
                              </Button>
                            </div>
                          )} */}
                          </div>

                          {/* Email Address */}
                          <div className="mb-6">
                            <Label
                              htmlFor="email"
                              className="flex items-center justify-between mb-2"
                            >
                              <span>Email Address (Optional)</span>
                              {/* {emailVerified && (
                              <Badge variant="default" className="ml-2">
                                Verified
                              </Badge>
                            )} */}
                            </Label>
                            <div className="flex items-center space-x-2">
                              <Input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => {
                                  setEmail(e.target.value);
                                }}
                                className="flex-grow"
                              />
                              {/* {!emailVerified && (
                              <Button
                                onClick={handleVerifyEmail}
                                disabled={emailVerifying || email === ""}
                                size="sm"
                                variant="buttonOutline"
                              >
                                {emailVerifying ? "Verifying..." : "Verify"}
                              </Button>
                            )} */}
                            </div>
                          </div>

                          {/* First Name and Last Name */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="firstName" className="mb-2">
                                First Name *
                              </Label>
                              <Input
                                id="firstName"
                                value={customerDetails.firstName}
                                onChange={(e) =>
                                  setCustomerDetails((prev) => ({
                                    ...prev,
                                    firstName: e.target.value,
                                  }))
                                }
                                placeholder="First Name"
                                disabled={isNameDisabled}
                              />
                            </div>

                            <div>
                              <Label htmlFor="lastName" className="mb-2">
                                Last Name *
                              </Label>
                              <Input
                                id="lastName"
                                value={customerDetails.lastName}
                                onChange={(e) =>
                                  setCustomerDetails((prev) => ({
                                    ...prev,
                                    lastName: e.target.value,
                                  }))
                                }
                                placeholder="Last Name"
                                disabled={isNameDisabled}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatPrice(orderSummary.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>{formatPrice(orderSummary.tax)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount ({discount}%)</span>
                        <span>
                          -
                          {formatPrice(
                            calculateOrderSummary().subtotal * (discount / 100),
                          )}
                        </span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span>{formatPrice(orderSummary.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Coupon Code */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Coupon Code</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                    />
                    <Button
                      onClick={applyCoupon}
                      disabled={!couponCode.trim() || isLoading}
                      size="sm"
                    >
                      Apply
                    </Button>
                  </div>
                  {discount > 0 && (
                    <p className="text-sm text-green-600">
                      Coupon applied! {discount}% discount
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Checkout Button */}
              <Button
                className="w-full"
                size="lg"
                onClick={proceedToCheckout}
                disabled={isLoading || ticketItems.length === 0}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {isLoading ? "Processing..." : `Proceed to Payment`}
              </Button>

              <div className="text-xs text-center text-muted-foreground">
                <p>🔒 Secure payment • No hidden charges</p>
                <p>Your tickets will be sent via email after payment</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Ticket Cart</h1>
          <p className="text-muted-foreground">
            Review your tickets and complete your purchase
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Cart Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Information */}
            {eventInfo && (
              <Card
                className="relative overflow-hidden"
                style={{
                  backgroundImage: `url(${apiURL}${eventInfo.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <div className="absolute inset-0 bg-black bg-opacity-70 z-0"></div>

                <CardHeader className="relative z-10">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Calendar className="h-5 w-5" />
                    {eventInfo.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative z-10 space-y-4 text-white">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{eventInfo.venue}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>
                        {new Date(eventInfo.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}{" "}
                        at {eventInfo.time}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>By {eventInfo.organizationName}</span>
                    </div>
                  </div>
                  {eventInfo.description && (
                    <p className="text-sm line-clamp-2">
                      {eventInfo.description}
                    </p>
                  )}
                  {(eventInfo.ageRestriction || eventInfo.dressCode) && (
                    <div className="flex gap-2 text-xs secondary">
                      {eventInfo.ageRestriction && (
                        <Badge variant="secondary">
                          Age: {eventInfo.ageRestriction}
                        </Badge>
                      )}
                      {eventInfo.dressCode && (
                        <Badge variant="secondary">
                          Dress: {eventInfo.dressCode}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className="text-xs px-1.5 py-0.5 max-w-auto truncate"
                      >
                        {eventInfo.category}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ticket Items */}
            <Card className="space-y-4">
              {ticketItems.map((item) => (
                <div key={item.id} className="p-4 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <h4 className="font-semibold">{item.eventTitle}</h4>
                      {item.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{formatPrice(item.price)} each</span>
                        <span>
                          Valid until:{" "}
                          {new Date(eventInfo.date).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 min-w-[3rem] text-center">
                        × 1
                      </span>
                      <div className="min-w-[4rem] font-semibold text-right">
                        = {formatPrice(item.price)}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => clearCart()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Separator />
                </div>
              ))}
              <div className="flex justify-between">
                <Button
                  variant="buttonOutline"
                  className="mb-4 ml-4"
                  onClick={handleBackToStore}
                >
                  Back to Store
                </Button>
                <Button variant="buttonOutline" className="mr-4 text-green-600">
                  <a
                    href={`https://wa.me/${whatsAppNumber.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-green-600 transition"
                  >
                    <FaWhatsapp size={24} />
                    <span className="font-medium">WhatsApp Contact</span>
                  </a>
                </Button>
              </div>
            </Card>

            {/* Customer Details */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Customer Details (To Be Printed On Ticket)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs
                  value={orderFor}
                  onValueChange={(value) =>
                    setOrderFor(value as "customer" | "self")
                  }
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger
                      value="customer"
                      // Disable if verified OR if a token is sitting in storage
                      disabled={
                        isOrganizerVerified || !!sessionStorage.getItem("token")
                      }
                      onClick={getShopkeeper}
                    >
                      Customer Order
                    </TabsTrigger>
                    <TabsTrigger value="self">Self Order</TabsTrigger>
                  </TabsList>
                  <TabsContent value="customer" className="space-y-4">
                    {/* WhatsApp Number */}
                    <div className="mb-6">
                      <Label
                        htmlFor="whatsapp"
                        className="flex items-center justify-between mb-2"
                      >
                        <span>WhatsApp Number *</span>
                        {whatsappVerified && (
                          <Badge variant="default" className="ml-2">
                            Verified
                          </Badge>
                        )}
                      </Label>
                      <div className="flex items-center space-x-2">
                        <div className="w-28">
                          <Select
                            value={countryCode}
                            onValueChange={setCountryCode}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Code" />
                            </SelectTrigger>
                            <SelectContent>
                              {countries.map((country) => (
                                <SelectItem
                                  key={country.code}
                                  value={country.dialCode}
                                >
                                  {country.name} {country.dialCode}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input
                          id="whatsapp"
                          type="tel"
                          placeholder="Enter number"
                          value={whatsapp}
                          onChange={(e) =>
                            setWhatsapp(e.target.value.replace(/\D/g, ""))
                          }
                          disabled={whatsappVerified}
                          className="flex-grow"
                        />
                        {!whatsappVerified && (
                          <Button
                            onClick={() => handleSendOtp(countryCode, whatsapp)}
                            disabled={whatsapp === "" || whatsappVerifying}
                            size="sm"
                            variant="buttonOutline"
                          >
                            {whatsappVerifying ? "Sending..." : "Send OTP"}
                          </Button>
                        )}
                      </div>
                      {otpSent && !whatsappVerified && (
                        <div className="flex items-center mt-2 space-x-2">
                          <Input
                            id="otp"
                            placeholder="Enter OTP"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            className="flex-grow"
                          />
                          <Button
                            onClick={() =>
                              handleVerifyOtp(countryCode, whatsapp)
                            }
                            disabled={otp.length !== 6 || whatsappVerifying}
                            size="sm"
                            variant="buttonOutline"
                          >
                            {whatsappVerifying ? "Verifying..." : "Verify"}
                          </Button>
                        </div>
                      )}
                    </div>
                    {/* Email Address */}
                    <div className="mb-6">
                      <Label
                        htmlFor="email"
                        className="flex items-center justify-between mb-2"
                      >
                        <span>Email Address *</span>
                        {emailVerified && (
                          <Badge variant="default" className="ml-2">
                            Verified
                          </Badge>
                        )}
                      </Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setEmailVerified(false);
                          }}
                          disabled={emailVerified}
                          className="flex-grow"
                        />
                        {!emailVerified && (
                          <Button
                            onClick={handleVerifyEmail}
                            disabled={emailVerifying || email === ""}
                            size="sm"
                            variant="buttonOutline"
                          >
                            {emailVerifying ? "Verifying..." : "Verify"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* First Name and Last Name */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName" className="mb-2">
                          First Name *
                        </Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First Name"
                          disabled={isNameDisabled}
                        />
                      </div>

                      <div>
                        <Label htmlFor="lastName" className="mb-2">
                          Last Name *
                        </Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last Name"
                          disabled={isNameDisabled}
                        />
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="self" className="space-y-4">
                    {/* Self Order Fields */}
                    {!isOrganizerVerified ? (
                      <form
                        onSubmit={
                          isOrganizerOtpSent
                            ? handleVerifyOrganizerOtp
                            : handleRequestOrganizerOtp
                        }
                      >
                        <div className="space-y-2">
                          <Label htmlFor="organizerWhatsApp">
                            Organizer WhatsApp Number *
                          </Label>
                          <div className="flex items-center space-x-2">
                            <div className="w-28">
                              <Select
                                value={countryCode}
                                onValueChange={setCountryCode}
                                disabled={isOrganizerOtpSent}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Code" />
                                </SelectTrigger>
                                <SelectContent>
                                  {countries.map((country) => (
                                    <SelectItem
                                      key={country.code}
                                      value={country.dialCode}
                                    >
                                      {country.name} {country.dialCode}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Input
                              id="organizerWhatsApp"
                              type="tel"
                              placeholder="Enter number"
                              value={organizerWhatsAppNumber}
                              onChange={(e) =>
                                setOrganizerWhatsAppNumber(
                                  e.target.value.replace(/\D/g, ""),
                                )
                              }
                              disabled={isOrganizerOtpSent}
                            />
                          </div>
                          {isOrganizerOtpSent && (
                            <div className="space-y-2">
                              <Label htmlFor="organizerOtp">OTP *</Label>
                              <Input
                                id="organizerOtp"
                                placeholder="Enter OTP"
                                maxLength={6}
                                value={organizerOtp}
                                onChange={(e) =>
                                  setOrganizerOtp(e.target.value)
                                }
                              />
                            </div>
                          )}
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={
                              isOrganizerVerifying ||
                              (isOrganizerOtpSent && organizerOtp.length !== 6)
                            }
                          >
                            {isOrganizerVerifying ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isOrganizerOtpSent ? (
                              "Verify OTP"
                            ) : (
                              "Send OTP"
                            )}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <Label
                            htmlFor="whatsapp"
                            className="flex items-center justify-between mb-2"
                          >
                            <span>WhatsApp Number *</span>
                            {whatsappVerified && (
                              <Badge variant="default">Verified</Badge>
                            )}
                          </Label>
                          <div className="flex items-center space-x-2">
                            <div className="w-28">
                              <Select
                                value={countryCode}
                                onValueChange={setCountryCode}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Code" />
                                </SelectTrigger>
                                <SelectContent>
                                  {countries.map((country) => (
                                    <SelectItem
                                      key={country.code}
                                      value={country.dialCode}
                                    >
                                      {country.name} {country.dialCode}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Input
                              id="whatsapp"
                              type="tel"
                              placeholder="Enter number"
                              maxLength={10}
                              value={whatsapp}
                              onChange={(e) =>
                                setWhatsapp(e.target.value.replace(/\D/g, ""))
                              }
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                findUserBywhatsAppNumber(countryCode, whatsapp)
                              }
                            >
                              {whatsappVerified ? "Validated" : "Validate"}
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">First Name *</Label>
                            <Input
                              id="firstName"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder="John"
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name *</Label>
                            <Input
                              id="lastName"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              placeholder="Doe"
                            />
                          </div>
                        </div>

                        <div>
                          <Label
                            htmlFor="email"
                            className="flex items-center justify-between mb-2"
                          >
                            <span>Customer Email (Optional)</span>
                          </Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              id="email"
                              type="email"
                              placeholder="Enter customer email"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                setEmailVerified(false);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatPrice(orderSummary.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax</span>
                    <span>{formatPrice(orderSummary.tax)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({discount}%)</span>
                      <span>
                        -
                        {formatPrice(
                          calculateOrderSummary().subtotal * (discount / 100),
                        )}
                      </span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatPrice(orderSummary.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Coupon Code */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Coupon Code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter coupon code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <Button
                    onClick={applyCoupon}
                    disabled={!couponCode.trim() || isLoading}
                    size="sm"
                  >
                    Apply
                  </Button>
                </div>
                {discount > 0 && (
                  <p className="text-sm text-green-600">
                    Coupon applied! {discount}% discount
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Checkout Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={proceedToCheckout}
              disabled={isLoading || ticketItems.length === 0}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              {isLoading ? "Processing..." : `Proceed to Payment`}
            </Button>

            <div className="text-xs text-center text-muted-foreground">
              <p>🔒 Secure payment • No hidden charges</p>
              <p>Your tickets will be sent via email after payment</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
