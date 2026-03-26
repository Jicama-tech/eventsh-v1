import { useState, useRef } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Eye,
  Palette,
  Image as ImageIcon,
  Type,
  Layout,
  Upload,
  Trash2,
  Camera,
  ImagePlus,
  X,
  Share2,
  Share,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jwtDecode } from "jwt-decode";
import { useEffect } from "react";
import ImageCropModal from "../ui/imageCropModal";

interface OrganizerStorefrontCustomizerProps {
  onBack: () => void;
  onSave: (settings: any) => void;
}

interface shopkeeperStore {
  sub: string;
}

export function OrganizerStorefrontCustomizer({
  onBack,
  onSave,
}: OrganizerStorefrontCustomizerProps) {
  const apiUrl = __API_URL__;
  const { toast } = useToast();
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const heroBannerFileInputRef = useRef<HTMLInputElement>(null);
  const aboutUsFileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExistingStore, setIsExistingStore] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string>("");
  const [bannerDesign, setBannerDesign] = useState<string | boolean>();
  const [visibleAdvertisementBar, setVisibleAdvertisement] = useState<
    string | boolean
  >();
  const [visibleAboutUs, setVisibleAboutUs] = useState<string | boolean>();
  const [heroBannerFile, setHeroBannerFile] = useState<File | null>(null);
  const [heroBannerPreview, setHeroBannerPreview] = useState<string>("");
  const [aboutUsFile, setAboutUsFile] = useState<File | null>(null);
  const [aboutUsPreview, setAboutUsPreview] = useState<string>("");
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropTarget, setCropTarget] = useState<
    "banner" | "hero" | "aboutUs" | null
  >(null);

  // Default settings for new shopkeepers
  const defaultSettings = {
    slug: "",
    general: {
      storeName: "My Store",
      tagline: "Welcome to my amazing store",
      description: "Discover our wonderful products and services",
      logo: "",
      favicon: "",
      contactInfo: {
        phone: "",
        email: "",
        address: "",
        hours: "Mon-Fri: 9AM-6PM",
        website: "",
        showInstagram: false,
        showFacebook: false,
        showTwitter: false,
        showTiktok: false,
        instagramLink: "",
        facebookLink: "",
        twitterLink: "",
        tiktokLink: "",
      },
    },
    design: {
      theme: "light",
      primaryColor: "#6366f1",
      secondaryColor: "#8b5cf6",
      fontFamily: "Inter",
      layout: {
        header: "modern",
        allProducts: "modern",
        visibleAdvertismentBar: true,
        advertiseText: "Flat 10% Off",
        visibleStatisticsSection: true,
        visibleFeaturedProducts: true,
        adBarBgcolor: "#000000",
        adBarTextColor: "#ffffff",
        visibleQuickPicks: true,
        visibleAboutUs: true,
        visibleContactUs: true,
        aboutUsHeading: "A Passion for Creating Memorable Experiences",
        aboutUsText:
          "Creating unforgettable experiences through exceptional events.",
        featuredProducts: "modern",
        quickPicks: "modern",
        banner: "modern",
        footer: "modern",
      },
      bannerImage:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
      heroBannerImage:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
      aboutUsImage:
        "https://images.unsplash.com/photo-1441986300917-64674bd600d8",
      showBanner: true,
      bannerHeight: "large",
    },
    features: {
      showSearch: true,
      showFilters: true,
      showReviews: false,
      showWishlist: false,
      showQuickView: true,
      showSocialMedia: true,
      enableChat: false,
      showNewsletter: false,
    },
    seo: {
      metaTitle: "My Store - Quality Products",
      metaDescription:
        "Discover quality products at My Store. Best prices and service guaranteed.",
      keywords: "store, shop, products, quality",
      customCode: "",
    },
  };

  const [settings, setSettings] = useState(defaultSettings);
  const [slug, setSlug] = useState("");

  useEffect(() => {
    const fetchOrCreateSettings = async () => {
      setLoading(true);
      setError(null);

      const token = sessionStorage.getItem("token");
      if (!token) {
        setError("Unauthorized");
        setLoading(false);
        toast({
          duration: 5000,
          title: "Token Not Found",
          description: "Please Login First",
        });
        return;
      }

      try {
        const decoded = jwtDecode<shopkeeperStore>(token);
        const shopkeeperId = decoded.sub;

        const response = await fetch(
          `${apiUrl}/organizer-stores/organizer-store-detail`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data && data.data && data.data.settings) {
            setSlug(data.data.slug);
            setSettings(data.data.settings);

            setBannerDesign(data.data.settings.design.layout.banner);
            setVisibleAdvertisement(
              data.data.settings.design.layout.visibleAdvertismentBar,
            );
            setVisibleAboutUs(data.data.settings.design.layout.visibleAboutUs);

            setIsExistingStore(true);
          } else {
            await createDefaultSettings(shopkeeperId, token);
          }
        } else if (response.status === 404) {
          await createDefaultSettings(shopkeeperId, token);
        } else {
          throw new Error("Failed to fetch settings");
        }
      } catch (error: any) {
        console.error("Error in fetchOrCreateSettings:", error);
        try {
          const decoded = jwtDecode<shopkeeperStore>(token);
          const shopkeeperId = decoded.sub;
          await createDefaultSettings(shopkeeperId, token);
        } catch (createError: any) {
          setError(
            createError.message || "Failed to initialize store settings",
          );
        }
      }
      setLoading(false);
    };

    const createDefaultSettings = async (
      shopkeeperId: string,
      token: string,
    ) => {
      const createData = {
        shopkeeperId,
        ...defaultSettings,
      };

      const createResponse = await fetch(
        `${apiUrl}/organizer-stores/add-store-settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(createData),
        },
      );

      if (createResponse.ok) {
        const result = await createResponse.json();
        toast({
          duration: 5000,
          title: "Store Initialized",
          description:
            "Your store has been created with default settings. You can customize it anytime!",
        });

        return result;
      } else {
        const errorData = await createResponse.json();
        throw new Error(errorData.message || "Failed to create store settings");
      }
    };

    fetchOrCreateSettings();
  }, []);

  const handleBannerUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate type & size
    if (!file.type.startsWith("image/")) {
      toast({
        duration: 5000,
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        duration: 5000,
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Open crop modal instead of directly setting preview
    setCropTarget("banner"); // 🔑 VERY IMPORTANT
    setCropImage(URL.createObjectURL(file));
    setCropOpen(true);

    event.target.value = "";
  };

  const onShare = async () => {
    const shareUrl = `https://eventsh.com/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Check out ${settings.general.storeName} on EventSH`,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      // Fallback for browsers that don't support navigator.share
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Store link copied to clipboard: " + shareUrl);
      } catch {
        alert("Sharing is not supported on this device.");
      }
    }
  };

  const removeBannerImage = () => {
    setBannerFile(null);
    setBannerPreview("");
    handleInputChange("design", "bannerImage", "");

    // Clean up preview URL
    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview);
    }

    toast({
      duration: 5000,
      title: "Banner Removed",
      description: "Banner image has been removed.",
    });
  };

  const handleHeroBannerUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setCropTarget("hero");
    setCropImage(URL.createObjectURL(file));
    setCropOpen(true);
  };

  const removeHeroBannerImage = () => {
    setHeroBannerFile(null);
    setHeroBannerPreview("");
    handleInputChange("design", "heroBannerImage", "");

    // Clean up preview URL
    if (heroBannerPreview) {
      URL.revokeObjectURL(heroBannerPreview);
    }

    toast({
      duration: 5000,
      title: "Banner Removed",
      description: "Banner image has been removed.",
    });
  };

  const handleAboutUsUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setCropTarget("aboutUs");
    setCropImage(URL.createObjectURL(file));
    setCropOpen(true);
  };

  const removeAboutUsImage = () => {
    setAboutUsFile(null);
    setAboutUsPreview("");
    handleInputChange("design", "aboutUsImage", "");

    // Clean up preview URL
    if (aboutUsPreview) {
      URL.revokeObjectURL(aboutUsPreview);
    }

    toast({
      duration: 5000,
      title: "Banner Removed",
      description: "Banner image has been removed.",
    });
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("token");
      if (!token) {
        toast({
          duration: 5000,
          title: "Unauthorized",
          description: "Please login first.",
          variant: "destructive",
        });
        return;
      }

      const decoded = jwtDecode<shopkeeperStore>(token);
      const shopkeeperId = decoded.sub;

      // Create FormData for file upload
      const formData = new FormData();

      // Add settings as JSON strings for each section
      if (settings.general) {
        formData.append("general", JSON.stringify(settings.general));
      }
      if (slug) {
        formData.append("slug", JSON.stringify(slug));
      }
      if (settings.design) {
        formData.append("design", JSON.stringify(settings.design));
      }
      if (settings.features) {
        formData.append("features", JSON.stringify(settings.features));
      }
      if (settings.seo) {
        formData.append("seo", JSON.stringify(settings.seo));
      }

      // Add banner file if exists
      if (bannerFile) {
        formData.append("bannerImage", bannerFile);
      }

      if (heroBannerFile) {
        formData.append("heroBannerImage", heroBannerFile);
      }

      if (aboutUsFile) {
        formData.append("aboutUsImage", aboutUsFile);
      }
      const response = await fetch(
        `${apiUrl}/organizer-stores/update-store-settings`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to save settings");
      }

      const result = await response.json();

      // Update local state with server response
      if (result.data && result.data.settings) {
        setSettings(result.data.settings);

        // If banner was uploaded, update the preview to use server URL
        if (result.data.settings.design.bannerImage && bannerFile) {
          // Clean up old preview URL
          if (bannerPreview) {
            URL.revokeObjectURL(bannerPreview);
          }
          setBannerPreview("");
          setBannerFile(null);
        }

        onSave?.(result.data);
      } else {
        onSave?.(settings);
      }

      toast({
        duration: 5000,
        title: "Success",
        description: bannerFile
          ? "Settings and banner image updated successfully!"
          : "Settings updated successfully.",
      });

      setTimeout(() => {
        onBack();
      }, 1000);
    } catch (error: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: error.message || "Failed to save settings.",
        variant: "destructive",
      });
      console.error("Save error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getBannerSrc = (raw: string | undefined | null) => {
    if (!raw) return "";
    // If already absolute (http or https), use as-is
    if (/^https?:\/\//i.test(raw)) return raw;
    // Otherwise treat as relative path on your API
    return `${apiUrl.replace(/\/$/, "")}/${raw.replace(/^\/?/, "")}`;
  };

  const handleInputChange = (section: string, field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value,
      },
    }));
  };

  const handleNestedInputChange = (
    section: string,
    nestedSection: string,
    field: string,
    value: any,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],

        [nestedSection]: {
          ...(prev[section as keyof typeof prev] as any)[nestedSection],
          [field]: value,
        },
      },
    }));
  };

  const handleLayoutChange = (
    part:
      | "header"
      | "allProducts"
      | "footer"
      | "featuredProducts"
      | "quickPicks"
      | "banner"
      | "visibleFeaturedProducts"
      | "visibleQuickPicks"
      | "visibleAdvertismentBar"
      | "visibleStatisticsSection"
      | "visibleContactUs"
      | "visibleAboutUs"
      | "advertiseText"
      | "aboutUsHeading"
      | "aboutUsText"
      | "adBarBgcolor"
      | "adBarTextColor",
    value: string | boolean,
  ) => {
    setSettings((prev) => ({
      ...prev,
      design: {
        ...prev.design,
        layout: {
          ...prev.design.layout,
          [part]: value,
        },
      },
    }));
    if (part === "banner") {
      setBannerDesign(value);
    }
    if (part === "visibleAdvertismentBar") {
      setVisibleAdvertisement(value);
    }
    if (part === "visibleAboutUs") {
      setVisibleAboutUs(value);
    }
  };

  const handleCropComplete = (file: File) => {
    const previewUrl = URL.createObjectURL(file);

    if (cropTarget === "banner") {
      setBannerFile(file);
      setBannerPreview(previewUrl);
      handleInputChange("design", "bannerImage", file);
    }

    if (cropTarget === "hero") {
      setHeroBannerFile(file);
      setHeroBannerPreview(previewUrl);
      handleInputChange("design", "heroBannerImage", file);
    }

    if (cropTarget === "aboutUs") {
      setAboutUsFile(file);
      setAboutUsPreview(previewUrl);
      handleInputChange("design", "aboutUsImage", file);
    }

    setCropOpen(false);
    setCropImage(null);
    setCropTarget(null);

    toast({
      title: "Image Cropped",
      description: "Image is ready to upload.",
    });
  };

  const colorSchemes = [
    // {
    //   name: "Custom",
    //   primary: settings.design.primaryColor,
    //   secondary: settings.design.secondaryColor,
    // },
  ];

  const fontOptions = [
    "Inter",
    "Roboto",
    "Open Sans",
    "Lato",
    "Poppins",
    "Montserrat",
    "Playfair Display",
    "Arial",
    "Georgia",
    "Times New Roman",
    "Helvetica",
    "Source Sans Pro",
  ];

  const layoutOptions = [
    {
      value: "modern",
      label: "Modern",
      description: "Clean grid layout with rounded corners and shadows",
    },
    {
      value: "classic",
      label: "Classic",
      description: "Traditional layout with structured sections and borders",
    },
    {
      value: "magazine",
      label: "Magazine",
      description: "Editorial style with large images and bold typography",
    },
    {
      value: "minimal",
      label: "Minimal",
      description: "Ultra-clean with lots of white space and simple elements",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading store settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center text-destructive">
          <p className="mb-4">Error: {error}</p>
          <Button onClick={onBack}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div>
              <h1 className="text-3xl font-bold">Store Customizer</h1>
              <p className="text-sm text-muted-foreground">
                Design your perfect store experience
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-primary hover:bg-primary/90"
            >
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Update Changes"}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Layout className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="design" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Design
            </TabsTrigger>
            <TabsTrigger value="features" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="seo" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              SEO
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Store Information</CardTitle>
                <CardDescription>
                  Basic information about your store
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName">Store Name</Label>
                    <Input
                      id="storeName"
                      value={settings.general.storeName}
                      onChange={(e) =>
                        handleInputChange(
                          "general",
                          "storeName",
                          e.target.value,
                        )
                      }
                      placeholder="Your Store Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website URL</Label>
                    <Input
                      id="website"
                      value={settings.general.contactInfo.website}
                      onChange={(e) =>
                        handleNestedInputChange(
                          "general",
                          "contactInfo",
                          "website",
                          e.target.value,
                        )
                      }
                      placeholder="www.yourstore.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={settings.general.tagline}
                    onChange={(e) =>
                      handleInputChange("general", "tagline", e.target.value)
                    }
                    placeholder="A brief description of your store"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Store Description</Label>
                  <Textarea
                    id="description"
                    value={settings.general.description}
                    onChange={(e) =>
                      handleInputChange(
                        "general",
                        "description",
                        e.target.value,
                      )
                    }
                    placeholder="Detailed description of your store"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>How customers can reach you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Phone & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={settings.general.contactInfo.phone}
                      onChange={(e) =>
                        handleNestedInputChange(
                          "general",
                          "contactInfo",
                          "phone",
                          e.target.value,
                        )
                      }
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={settings.general.contactInfo.email}
                      onChange={(e) =>
                        handleNestedInputChange(
                          "general",
                          "contactInfo",
                          "email",
                          e.target.value,
                        )
                      }
                      placeholder="hello@yourstore.com"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={settings.general.contactInfo.address}
                    onChange={(e) =>
                      handleNestedInputChange(
                        "general",
                        "contactInfo",
                        "address",
                        e.target.value,
                      )
                    }
                    placeholder="123 Main Street, City, State 12345"
                  />
                </div>

                {/* Hours & Slug */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hours">
                      Business Hours:{" "}
                      <span className="text-l text-gray-400">
                        (Mon-Fri: 9AM-6PM, Sat-Sun: 10AM-4PM)
                      </span>
                    </Label>
                    <Input
                      id="hours"
                      value={settings.general.contactInfo.hours}
                      onChange={(e) =>
                        handleNestedInputChange(
                          "general",
                          "contactInfo",
                          "hours",
                          e.target.value,
                        )
                      }
                      placeholder="Mon-Fri: 9AM-6PM, Sat-Sun: 10AM-4PM"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">Store Link (slug)</Label>
                    <div className="flex items-center">
                      <span className="text-muted-foreground mr-1 text-sm">
                        [www.eventsh.com/]
                      </span>
                      <Input
                        id="slug"
                        value={slug ?? ""}
                        onChange={(e) =>
                          setSlug(e.target.value.replace(/[^a-zA-Z0-9-_]/g, ""))
                        }
                        placeholder="your-store"
                        className="flex-1"
                      />
                    </div>
                    <div className="flex flex-row justify-between">
                      <p className="text-xs text-muted-foreground">
                        Use only letters, numbers, dashes, and underscores.
                      </p>
                      <Button
                        variant="outline1"
                        className="p-3 lg:p-4 transition-all"
                        onClick={onShare}
                        aria-label="Share store link"
                      >
                        <Share2 className="transition-all" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
                <CardDescription>How Customers Can Connect You</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Social Media Toggles */}
                <div className="space-y-4">
                  {/* Instagram */}
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Instagram</div>
                        <p className="text-xs text-muted-foreground">
                          Show Instagram link in footer
                        </p>
                      </div>
                      <Switch
                        checked={
                          settings.general.contactInfo.showInstagram ?? false
                        }
                        onCheckedChange={(checked) =>
                          handleNestedInputChange(
                            "general",
                            "contactInfo",
                            "showInstagram",
                            checked,
                          )
                        }
                      />
                    </div>
                    {settings.general.contactInfo.showInstagram && (
                      <Input
                        value={settings.general.contactInfo.instagramLink ?? ""}
                        onChange={(e) =>
                          handleNestedInputChange(
                            "general",
                            "contactInfo",
                            "instagramLink",
                            e.target.value,
                          )
                        }
                        placeholder="https://www.instagram.com/yourprofile"
                      />
                    )}
                  </div>

                  {/* Facebook */}
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Facebook</div>
                        <p className="text-xs text-muted-foreground">
                          Show Facebook link in footer
                        </p>
                      </div>
                      <Switch
                        checked={
                          settings.general.contactInfo.showFacebook ?? false
                        }
                        onCheckedChange={(checked) =>
                          handleNestedInputChange(
                            "general",
                            "contactInfo",
                            "showFacebook",
                            checked,
                          )
                        }
                      />
                    </div>
                    {settings.general.contactInfo.showFacebook && (
                      <Input
                        value={settings.general.contactInfo.facebookLink ?? ""}
                        onChange={(e) =>
                          handleNestedInputChange(
                            "general",
                            "contactInfo",
                            "facebookLink",
                            e.target.value,
                          )
                        }
                        placeholder="https://www.facebook.com/yourpage"
                      />
                    )}
                  </div>

                  {/* Twitter/X */}
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Twitter / X</div>
                        <p className="text-xs text-muted-foreground">
                          Show Twitter/X link in footer
                        </p>
                      </div>
                      <Switch
                        checked={
                          settings.general.contactInfo.showTwitter ?? false
                        }
                        onCheckedChange={(checked) =>
                          handleNestedInputChange(
                            "general",
                            "contactInfo",
                            "showTwitter",
                            checked,
                          )
                        }
                      />
                    </div>
                    {settings.general.contactInfo.showTwitter && (
                      <Input
                        value={settings.general.contactInfo.twitterLink ?? ""}
                        onChange={(e) =>
                          handleNestedInputChange(
                            "general",
                            "contactInfo",
                            "twitterLink",
                            e.target.value,
                          )
                        }
                        placeholder="https://x.com/yourhandle"
                      />
                    )}
                  </div>

                  {/* TikTok */}
                  <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">TikTok</div>
                        <p className="text-xs text-muted-foreground">
                          Show TikTok link in footer
                        </p>
                      </div>
                      <Switch
                        checked={
                          settings.general.contactInfo.showTiktok ?? false
                        }
                        onCheckedChange={(checked) =>
                          handleNestedInputChange(
                            "general",
                            "contactInfo",
                            "showTiktok",
                            checked,
                          )
                        }
                      />
                    </div>
                    {settings.general.contactInfo.showTiktok && (
                      <Input
                        value={settings.general.contactInfo.tiktokLink ?? ""}
                        onChange={(e) =>
                          handleNestedInputChange(
                            "general",
                            "contactInfo",
                            "tiktokLink",
                            e.target.value,
                          )
                        }
                        placeholder="https://www.tiktok.com/@yourhandle"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Design Tab */}
          <TabsContent value="design" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Theme & Colors</CardTitle>
                <CardDescription>
                  Customize the visual appearance of your store
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="grid grid-cols-1 gap-3">
                      {colorSchemes.map((scheme, index) => (
                        <div
                          key={index}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            settings.design.primaryColor === scheme.primary
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => {
                            handleInputChange(
                              "design",
                              "primaryColor",
                              scheme.primary,
                            );
                            handleInputChange(
                              "design",
                              "secondaryColor",
                              scheme.secondary,
                            );
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex space-x-1">
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: scheme.primary }}
                              />
                              <div
                                className="w-6 h-6 rounded-full border"
                                style={{ backgroundColor: scheme.secondary }}
                              />
                            </div>
                            <span className="text-sm font-medium">
                              {scheme.name}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <Label>Custom Colors</Label>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Label className="w-20">Primary</Label>
                          <input
                            type="color"
                            value={settings.design.primaryColor}
                            onChange={(e) =>
                              handleInputChange(
                                "design",
                                "primaryColor",
                                e.target.value,
                              )
                            }
                            className="w-20 h-8 p-1 rounded border"
                          />
                          <Input
                            value={settings.design.primaryColor}
                            onChange={(e) =>
                              handleInputChange(
                                "design",
                                "primaryColor",
                                e.target.value,
                              )
                            }
                            placeholder="#6366f1"
                            className="text-xs h-8"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <Label className="w-20">Secondary</Label>
                          <input
                            type="color"
                            value={settings.design.secondaryColor}
                            onChange={(e) =>
                              handleInputChange(
                                "design",
                                "secondaryColor",
                                e.target.value,
                              )
                            }
                            className="w-20 h-8 p-1 rounded border"
                          />
                          <Input
                            value={settings.design.secondaryColor}
                            onChange={(e) =>
                              handleInputChange(
                                "design",
                                "secondaryColor",
                                e.target.value,
                              )
                            }
                            placeholder="#8b5cf6"
                            className="text-xs h-8"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="fontFamily">Font Family</Label>
                      <Select
                        value={settings.design.fontFamily}
                        onValueChange={(value) =>
                          handleInputChange("design", "fontFamily", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {fontOptions.map((font) => (
                            <SelectItem key={font} value={font}>
                              <span style={{ fontFamily: font }}>{font}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* <div className="space-y-2">
                      <Label htmlFor="theme">Theme Mode</Label>
                      <Select
                        value={settings.design.theme}
                        onValueChange={(value) =>
                          handleInputChange("design", "theme", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div> */}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Layout & Banner</CardTitle>
                <CardDescription>
                  Choose your store layout and banner settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="relative">
                  {/* Advertisement Bar */}
                  <div className="flex items-center justify-between mt-4">
                    <Label>Advertisement Bar</Label>
                    <Switch
                      checked={settings.design.layout.visibleAdvertismentBar}
                      onCheckedChange={(checked) =>
                        handleLayoutChange("visibleAdvertismentBar", checked)
                      }
                    />
                  </div>

                  {visibleAdvertisementBar && (
                    <div className="space-y-3 mt-2">
                      <div>
                        <Label htmlFor="advertiseText">Announcement Text</Label>
                        <Input
                          id="advertiseText"
                          value={settings.design.layout.advertiseText ?? ""}
                          onChange={(e) =>
                            handleLayoutChange("advertiseText", e.target.value)
                          }
                          placeholder="e.g. ✨ Special Offer: Get 20% off on all new arrivals! ✨"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          This text will appear in the scrolling announcement
                          bar.
                        </p>
                      </div>

                      <div className="space-y-4 p-4 border border-border rounded-xl bg-gradient-to-r bg-muted/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Background Color */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground tracking-tight">
                              Background Color
                            </Label>
                            <div className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                              <input
                                type="color"
                                value={
                                  settings.design.layout.adBarBgcolor ??
                                  "#000000"
                                }
                                onChange={(e) =>
                                  handleLayoutChange(
                                    "adBarBgcolor",
                                    e.target.value,
                                  )
                                }
                                className="w-14 h-14 p-0 rounded-xl border-2 border-border hover:border-primary/80 shadow-lg hover:shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.05]"
                              />
                              <Input
                                value={
                                  settings.design.layout.adBarBgcolor ??
                                  "#000000"
                                }
                                onChange={(e) =>
                                  handleLayoutChange(
                                    "adBarBgcolor",
                                    e.target.value,
                                  )
                                }
                                placeholder="#000000"
                                className="h-12 flex-1 text-sm font-mono"
                              />
                              <div
                                className="w-16 h-16 rounded-xl border-2 border-border/50 shadow-lg flex items-center justify-center"
                                style={{
                                  backgroundColor:
                                    settings.design.layout.adBarBgcolor ??
                                    "#000000",
                                }}
                              />
                            </div>
                          </div>

                          {/* Text Color */}
                          <div className="space-y-2">
                            <Label className="text-sm font-semibold text-foreground tracking-tight">
                              Text Color
                            </Label>
                            <div className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
                              <input
                                type="color"
                                value={
                                  settings.design.layout.adBarTextColor ??
                                  "#ffffff"
                                }
                                onChange={(e) =>
                                  handleLayoutChange(
                                    "adBarTextColor",
                                    e.target.value,
                                  )
                                }
                                className="w-14 h-14 p-0 rounded-xl border-2 border-border hover:border-primary/80 shadow-lg hover:shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.05]"
                              />
                              <Input
                                value={
                                  settings.design.layout.adBarTextColor ??
                                  "#ffffff"
                                }
                                onChange={(e) =>
                                  handleLayoutChange(
                                    "adBarTextColor",
                                    e.target.value,
                                  )
                                }
                                placeholder="#ffffff"
                                className="h-12 flex-1 text-sm font-mono"
                              />
                              <div
                                className="w-16 h-16 rounded-xl border-2 border-border/50 shadow-lg flex items-center justify-center text-xs font-semibold px-2"
                                style={{
                                  backgroundColor:
                                    settings.design.layout.adBarBgcolor ??
                                    "#000000",
                                  color:
                                    settings.design.layout.adBarTextColor ??
                                    "#ffffff",
                                }}
                              >
                                Aa
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground px-1">
                          Live preview shows exact announcement bar appearance
                        </p>
                      </div>
                    </div>
                  )}

                  {/* HEADER DESIGN */}
                  <div className="space-y-4 mt-4">
                    <Label>Header Design</Label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Modern */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.header === "modern"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => handleLayoutChange("header", "modern")}
                      >
                        <h4 className="font-medium">Modern</h4>

                        <p className="text-sm text-muted-foreground">
                          Bold top bar with logo, navigation and primary actions
                          highlighted.
                        </p>
                      </div>

                      {/* Minimal */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.header === "minimal"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => handleLayoutChange("header", "minimal")}
                      >
                        <h4 className="font-medium">Minimal</h4>
                        <p className="text-sm text-muted-foreground">
                          Clean header with compact logo and simple navigation
                          for a focused look.
                        </p>
                      </div>

                      {/* Mega */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.header === "mega"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => handleLayoutChange("header", "mega")}
                      >
                        <h4 className="font-medium">Mega</h4>
                        <p className="text-sm text-muted-foreground">
                          Expanded header with space for menus, categories and
                          promos.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5 mt-4 mb-4">
                      <Label>Show Banner (Hero Section)</Label>
                      <p className="text-sm text-muted-foreground">
                        Display a hero banner on your homepage
                      </p>
                    </div>
                    <Switch
                      checked={settings.design.showBanner}
                      onCheckedChange={(checked) =>
                        handleInputChange("design", "showBanner", checked)
                      }
                    />
                  </div>

                  {settings.design.showBanner && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Banner Image</Label>
                        {bannerPreview || settings.design.bannerImage ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <img
                                src={
                                  bannerPreview
                                    ? bannerPreview
                                    : getBannerSrc(settings.design.bannerImage)
                                }
                                alt="Banner preview"
                                className="w-full h-64 object-cover rounded-lg border cursor-pointer"
                                onClick={() => {
                                  const src = bannerPreview
                                    ? bannerPreview
                                    : getBannerSrc(settings.design.bannerImage);
                                  setCropTarget("banner");
                                  setCropImage(src);
                                  setCropOpen(true);
                                }}
                              />

                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={removeBannerImage}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              {bannerPreview && (
                                <div className="absolute bottom-2 left-2">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    New Image Selected
                                  </Badge>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="buttonOutline"
                              onClick={() =>
                                bannerFileInputRef.current?.click()
                              }
                              className="w-full"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Change Banner
                            </Button>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-border rounded-lg p-6">
                            <div className="text-center">
                              <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                              <p className="text-muted-foreground mb-2">
                                No banner image uploaded
                              </p>
                              <Button
                                variant="buttonOutline"
                                onClick={() =>
                                  bannerFileInputRef.current?.click()
                                }
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Banner
                              </Button>
                            </div>
                          </div>
                        )}

                        <input
                          ref={bannerFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBannerUpload}
                          className="hidden"
                        />

                        <p className="text-xs text-muted-foreground">
                          Recommended size: 1920x600px. Maximum file size: 5MB.
                          {bannerFile && (
                            <span className="text-primary block mt-1">
                              ✓ New banner ready to upload: {bannerFile.name}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="space-y-4 mt-4">
                        <div className="flex items-center justify-between mt-4">
                          <Label>Banner Design (Hero Design)</Label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Modern */}
                          <div
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              settings.design.layout.banner === "modern"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() =>
                              handleLayoutChange("banner", "modern")
                            }
                          >
                            <h4 className="font-medium">Full Width</h4>
                            <p className="text-sm text-muted-foreground">
                              Single large hero banner spanning full viewport
                              width. Perfect for maximum visual impact.
                            </p>
                          </div>

                          {/* Minimal */}
                          <div
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              settings.design.layout.banner === "minimal"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() =>
                              handleLayoutChange("banner", "minimal")
                            }
                          >
                            <h4 className="font-medium">Compact</h4>
                            <p className="text-sm text-muted-foreground">
                              Smaller banner optimized for text overlay and
                              quick navigation focus.
                            </p>
                          </div>

                          {/* Mega */}
                          <div
                            className={`p-4 border rounded-lg cursor-pointer transition-all ${
                              settings.design.layout.banner === "mega"
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => handleLayoutChange("banner", "mega")}
                          >
                            <h4 className="font-medium">Dual Slider</h4>
                            <p className="text-sm text-muted-foreground">
                              Supports 2 banner images with carousel slider for
                              multiple promotions.
                            </p>
                          </div>
                        </div>
                      </div>

                      {bannerDesign === "mega" && (
                        <div className="space-y-2">
                          <Label>
                            Hero Banner For Mega Hero Section (The Banner image
                            will be shown as your card Image and this will be
                            shown as the Main Banner image *)
                          </Label>
                          {heroBannerPreview ||
                          settings.design.heroBannerImage ? (
                            <div className="space-y-2">
                              <div className="relative">
                                <img
                                  src={
                                    heroBannerPreview
                                      ? heroBannerPreview
                                      : getBannerSrc(
                                          settings.design.heroBannerImage,
                                        )
                                  }
                                  alt="Hero Banner preview"
                                  className="w-full h-64 object-cover rounded-lg border cursor-pointer"
                                  onClick={() => {
                                    const src = heroBannerPreview
                                      ? heroBannerPreview
                                      : getBannerSrc(
                                          settings.design.heroBannerImage,
                                        );
                                    setCropTarget("hero");
                                    setCropImage(src);
                                    setCropOpen(true);
                                  }}
                                />

                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="absolute top-2 right-2"
                                  onClick={removeHeroBannerImage}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                {heroBannerPreview && (
                                  <div className="absolute bottom-2 left-2">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      New Image Selected
                                    </Badge>
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="buttonOutline"
                                onClick={() =>
                                  heroBannerFileInputRef.current?.click()
                                }
                                className="w-full"
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Change Banner
                              </Button>
                            </div>
                          ) : (
                            <div className="border-2 border-dashed border-border rounded-lg p-6">
                              <div className="text-center">
                                <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground mb-2">
                                  No banner image uploaded
                                </p>
                                <Button
                                  variant="buttonOutline"
                                  onClick={() =>
                                    heroBannerFileInputRef.current?.click()
                                  }
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Upload Banner
                                </Button>
                              </div>
                            </div>
                          )}

                          <input
                            ref={heroBannerFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleHeroBannerUpload}
                            className="hidden"
                          />

                          <p className="text-xs text-muted-foreground">
                            Recommended size: 1920x600px. Maximum file size:
                            5MB.
                            {bannerFile && (
                              <span className="text-primary block mt-1">
                                ✓ New banner ready to upload: {bannerFile.name}
                              </span>
                            )}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="bannerHeight">Banner Height</Label>
                        <Select
                          value={settings.design.bannerHeight}
                          onValueChange={(value) =>
                            handleInputChange("design", "bannerHeight", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small (300px)</SelectItem>
                            <SelectItem value="medium">
                              Medium (400px)
                            </SelectItem>
                            <SelectItem value="large">Large (500px)</SelectItem>
                            <SelectItem value="xl">
                              Extra Large (600px)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between mt-4">
                      <Label>Show Statistics</Label>
                      <Switch
                        checked={
                          settings.design.layout.visibleStatisticsSection
                        }
                        onCheckedChange={(checked) =>
                          handleLayoutChange(
                            "visibleStatisticsSection",
                            checked,
                          )
                        }
                      />
                    </div>
                  </div>

                  {/* FEATURED PRODUCT DESIGN */}
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between mt-4">
                      <Label>Featured Product Design</Label>
                      <Switch
                        checked={settings.design.layout.visibleFeaturedProducts}
                        onCheckedChange={(checked) =>
                          handleLayoutChange("visibleFeaturedProducts", checked)
                        }
                      />
                    </div>
                  </div>

                  {/* Quick Picks DESIGN */}
                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between mt-4">
                      <Label>Quick Picks Design</Label>
                      <Switch
                        checked={settings.design.layout.visibleQuickPicks}
                        onCheckedChange={(checked) =>
                          handleLayoutChange("visibleQuickPicks", checked)
                        }
                      />
                    </div>
                  </div>

                  {/* All Products DESIGN */}
                  <div className="space-y-4 mt-4">
                    <Label>All Products Card Design</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Modern */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.allProducts === "modern"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() =>
                          handleLayoutChange("allProducts", "modern")
                        }
                      >
                        <h4 className="font-medium">Single Card</h4>
                        <p className="text-sm text-muted-foreground">
                          Large single product card per row with bigger images,
                          bold pricing and clear primary actions.
                        </p>
                      </div>

                      {/* Minimal */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.allProducts === "minimal"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() =>
                          handleLayoutChange("allProducts", "minimal")
                        }
                      >
                        <h4 className="font-medium">Double Cards</h4>
                        <p className="text-sm text-muted-foreground">
                          Two product cards per row for a balanced grid that
                          keeps details readable while showing more items.
                        </p>
                      </div>

                      {/* Mega */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.allProducts === "mega"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() =>
                          handleLayoutChange("allProducts", "mega")
                        }
                      >
                        <h4 className="font-medium">Triple Cards</h4>
                        <p className="text-sm text-muted-foreground">
                          Three compact product cards per row, optimized for
                          fast browsing and higher product density.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between mt-4">
                      <Label>Show About Us</Label>
                      <Switch
                        checked={settings.design.layout.visibleAboutUs}
                        onCheckedChange={(checked) =>
                          handleLayoutChange("visibleAboutUs", checked)
                        }
                      />
                    </div>
                  </div>

                  {visibleAboutUs && (
                    <>
                      <div className="space-y-3 mt-2">
                        <div>
                          <Label htmlFor="aboutUsHeading">
                            About Us Heading
                          </Label>
                          <Input
                            id="aboutUsHeading"
                            value={settings.design.layout.aboutUsHeading ?? ""}
                            onChange={(e) =>
                              handleLayoutChange(
                                "aboutUsHeading",
                                e.target.value,
                              )
                            }
                            placeholder="e.g. Who We Are?"
                          />
                        </div>

                        <div className="space-y-4 p-4 border border-border rounded-xl bg-gradient-to-r bg-muted/30">
                          <Label htmlFor="aboutUsText">About Us Text</Label>
                          <textarea
                            id="aboutUsText"
                            value={settings.design.layout.aboutUsText ?? ""}
                            onChange={(e) =>
                              handleLayoutChange("aboutUsText", e.target.value)
                            }
                            placeholder="Tell us about your business..."
                            className="w-full p-2 border border-border rounded-md"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>About US Image</Label>
                        {aboutUsPreview || settings.design.aboutUsImage ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <img
                                src={
                                  aboutUsPreview
                                    ? aboutUsPreview
                                    : getBannerSrc(settings.design.aboutUsImage)
                                }
                                alt="About Us preview"
                                className="w-full h-64 object-cover rounded-lg border cursor-pointer"
                                onClick={() => {
                                  const src = aboutUsPreview
                                    ? aboutUsPreview
                                    : getBannerSrc(
                                        settings.design.aboutUsImage,
                                      );
                                  setCropTarget("aboutUs");
                                  setCropImage(src);
                                  setCropOpen(true);
                                }}
                              />

                              <Button
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={removeAboutUsImage}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              {aboutUsPreview && (
                                <div className="absolute bottom-2 left-2">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    New Image Selected
                                  </Badge>
                                </div>
                              )}
                            </div>
                            <Button
                              variant="buttonOutline"
                              onClick={() =>
                                aboutUsFileInputRef.current?.click()
                              }
                              className="w-full"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              Change Banner
                            </Button>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-border rounded-lg p-6">
                            <div className="text-center">
                              <ImagePlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                              <p className="text-muted-foreground mb-2">
                                No banner image uploaded
                              </p>
                              <Button
                                variant="buttonOutline"
                                onClick={() =>
                                  aboutUsFileInputRef.current?.click()
                                }
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Upload Banner
                              </Button>
                            </div>
                          </div>
                        )}

                        <input
                          ref={aboutUsFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAboutUsUpload}
                          className="hidden"
                        />

                        <p className="text-xs text-muted-foreground">
                          Recommended size: 1920x600px. Maximum file size: 5MB.
                          {bannerFile && (
                            <span className="text-primary block mt-1">
                              ✓ New banner ready to upload: {bannerFile.name}
                            </span>
                          )}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between mt-4">
                      <Label>Show Contact Us</Label>
                      <Switch
                        checked={settings.design.layout.visibleContactUs}
                        onCheckedChange={(checked) =>
                          handleLayoutChange("visibleContactUs", checked)
                        }
                      />
                    </div>
                  </div>

                  {/* FOOTER DESIGN */}
                  <div className="space-y-4 mt-4">
                    <Label>Footer Design</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Modern */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.footer === "modern"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => handleLayoutChange("footer", "modern")}
                      >
                        <h4 className="font-medium">Modern</h4>
                        <p className="text-sm text-muted-foreground">
                          Multi‑column footer with links, social icons and
                          newsletter.
                        </p>
                      </div>

                      {/* Minimal */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.footer === "minimal"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => handleLayoutChange("footer", "minimal")}
                      >
                        <h4 className="font-medium">Minimal</h4>
                        <p className="text-sm text-muted-foreground">
                          Simple single‑row footer with basic links and
                          copyright.
                        </p>
                      </div>

                      {/* Mega */}
                      <div
                        className={`p-4 border rounded-lg cursor-pointer transition-all ${
                          settings.design.layout.footer === "mega"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => handleLayoutChange("footer", "mega")}
                      >
                        <h4 className="font-medium">Mega</h4>
                        <p className="text-sm text-muted-foreground">
                          Detailed footer with multiple sections for navigation
                          and info.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* HERO DESIGN */}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-6">
            <div className="filter blur-sm select-none pointer-events-none">
              <Card>
                <CardHeader>
                  <CardTitle>Store Features</CardTitle>
                  <CardDescription>
                    Enable or disable features for your storefront
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(settings.features).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <Label className="capitalize">
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (str) => str.toUpperCase())}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {getFeatureDescription(key)}
                          </p>
                        </div>
                        <Switch
                          checked={value as boolean}
                          onCheckedChange={(checked) =>
                            handleInputChange("features", key, checked)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="relative space-y-6">
            {/* Blurred container */}
            <div className="filter blur-sm select-none pointer-events-none">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Settings</CardTitle>
                  <CardDescription>
                    Optimize your store for search engines
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="metaTitle">Meta Title</Label>
                    <Input
                      id="metaTitle"
                      value={settings.seo.metaTitle}
                      onChange={(e) =>
                        handleInputChange("seo", "metaTitle", e.target.value)
                      }
                      placeholder="Your Store - Product Category"
                    />
                    <p className="text-xs text-muted-foreground">
                      Recommended: 50-60 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metaDescription">Meta Description</Label>
                    <Textarea
                      id="metaDescription"
                      value={settings.seo.metaDescription}
                      onChange={(e) =>
                        handleInputChange(
                          "seo",
                          "metaDescription",
                          e.target.value,
                        )
                      }
                      placeholder="A brief description of your store for search results"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Recommended: 150-160 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords</Label>
                    <Input
                      id="keywords"
                      value={settings.seo.keywords}
                      onChange={(e) =>
                        handleInputChange("seo", "keywords", e.target.value)
                      }
                      placeholder="keyword1, keyword2, keyword3"
                    />
                    <p className="text-xs text-muted-foreground">
                      Separate keywords with commas
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customCode">
                      Custom Code (Analytics, etc.)
                    </Label>
                    <Textarea
                      id="customCode"
                      value={settings.seo.customCode}
                      onChange={(e) =>
                        handleInputChange("seo", "customCode", e.target.value)
                      }
                      placeholder="<!-- Analytics code, custom CSS, etc. -->"
                      rows={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      This code will be added to the head section
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overlay to indicate "In Development" */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-xl pointer-events-none select-none">
              <div className="inline-flex items-center space-x-2 rounded-full bg-orange-600 px-4 py-2 text-white font-semibold shadow-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1 4v1m0-1a1 1 0 100-2 1 1 0 000 2z"
                  />
                </svg>
                <span>This feature is under development</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {cropImage && (
        <ImageCropModal
          open={cropOpen}
          image={cropImage}
          onClose={() => {
            setCropOpen(false);
            setCropImage(null);
            setCropTarget(null);
          }}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}

function getFeatureDescription(key: string): string {
  const descriptions: { [key: string]: string } = {
    showSearch: "Allow customers to search for products",
    showFilters: "Enable product filtering options",
    showReviews: "Display customer reviews and ratings",
    showWishlist: "Allow customers to save favorite items",
    showQuickView: "Quick product preview without leaving the page",
    showSocialMedia: "Display social media links and sharing",
    enableChat: "Enable live chat support",
    showNewsletter: "Display newsletter signup form",
  };
  return descriptions[key] || "Toggle this feature on or off";
}
