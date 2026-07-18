import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import VenueAnnotationLayer, {
  type VenueAnnotation,
  type AnnotationTool,
} from "./VenueAnnotationLayer";
import VenuePreview from "./VenuePreview";
import SponsorMarquee from "@/components/ui/SponsorMarquee";
import { useCountry } from "@/hooks/useCountry";
import { useSubscription } from "@/hooks/useSubscription";
import { subtypesFor, eventTypeLabel } from "@/lib/eventTypes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectItem,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import AnnouncementBar from "@/components/ui/AnnouncementBar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  Plus,
  Trash2,
  Download,
  Share2,
  RotateCw,
  Move3D,
  Ruler,
  Grid3x3,
  DollarSign,
  Users,
  Calendar,
  IndianRupee,
  Undo2,
  Image,
  Mic,
  Circle,
  Sparkles,
  Maximize2,
  Minimize2,
  GripVertical,
  Pencil,
  ChevronDown,
  ChevronUp,
  Facebook,
  Instagram,
  CopyPlus as CopyPlusIcon,
  MousePointer2,
  Minus,
  Square,
  ArrowUpRight,
  Eye,
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { jwtDecode } from "jwt-decode";
import BlurOverlay from "../ui/blurOverlay";
import { ModuleGate } from "../ui/ModuleGate";
import { AIVenueDesignerDialog } from "./AIVenueDesignerDialog";
import { EventUrlImporter, type ImportedEventFields } from "./EventUrlImporter";
import { useCurrency } from "@/hooks/useCurrencyhook";
import ImageCropModal from "../ui/imageCropModal";
import { lazy, Suspense } from "react";

import "react-quill/dist/quill.snow.css";
const ReactQuill = lazy(() => import("react-quill"));

interface VisitorFeatureAccess {
  food: boolean;
  parking: boolean;
  wifi: boolean;
  photography: boolean;
  security: boolean;
  accessibility: boolean;
}

interface VisitorType {
  id: string;
  name: string;
  price: number;
  maxCount?: number;
  description?: string;
  featureAccess: VisitorFeatureAccess;
  isActive: boolean;
}

const DEFAULT_VISITOR_FEATURES: VisitorFeatureAccess = {
  food: false,
  parking: false,
  wifi: false,
  photography: false,
  security: false,
  accessibility: false,
};

const DEFAULT_FEATURE_NAMES = [
  "food",
  "parking",
  "wifi",
  "photography",
  "security",
  "accessibility",
];

export const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["clean"],
  ],
};

interface OrganizerTokenPayload {
  sub: string;
  name?: string;
  email?: string;
}

function getOrganizerFromToken(token: string): OrganizerTokenPayload | null {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}

/**
 * Curated 15-swatch palette used by the AddOn color picker (and reusable for
 * other small markers). Module scope so child components like TableManagement
 * can reference it without prop-drilling.
 */
const ADDON_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#6b7280",
];

interface CreateEventFormProps {
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  editMode?: boolean;
  /**
   * When true, the form pre-fills from `initialData` (banner, gallery, all
   * field state) but submits as a NEW event — bottom button reads "Create
   * Event" and the parent does POST. The original event is untouched.
   */
  duplicateMode?: boolean;
  initialData?: any;
  /** Save under this organizer id instead of the token subject (admin demo). */
  organizerIdOverride?: string;
}

interface TableTemplate {
  id: string;
  name: string;
  type: "Straight" | "Corner" | "Round" | "Square";
  width: number;
  height: number;
  rowNumber: number;
  tablePrice: number;
  bookingPrice: number;
  depositPrice: number;
  // Member-tier pricing. Optional everywhere — when unset, every
  // exhibitor pays the regular tier. Only surfaced when the
  // organizer's subscription has the membership module enabled.
  memberPrice?: number;
  memberBookingPrice?: number;
  memberDepositPrice?: number;
  // Master switch for offering the minimum/partial payment plan on this space.
  // When false, exhibitors can only pay in full at checkout (the minimum-payment
  // option is hidden). Defaults to true (absent === enabled) so existing
  // templates keep offering minimum payment.
  minimumPaymentEnabled?: boolean;
  // Whether the security deposit is part of Option 1 (minimum payment). When
  // false (default), Option 1 is the booking amount only and the deposit is
  // collected with the remaining balance — matching the long-standing booking
  // behavior. Turn on to make Option 1 = Booking + Deposit. Only meaningful
  // when `minimumPaymentEnabled` is true.
  depositInOption1?: boolean;
  color?: string;
  forSale?: boolean;
  isBooked?: boolean;
  bookedBy?: string;
  customDimensions?: boolean;
  // Max number of THIS space type an exhibitor may select in one booking.
  // Undefined / 0 = unlimited.
  maxPerBooking?: number;
}

interface PositionedTable extends TableTemplate {
  positionId: string;
  x: number;
  y: number;
  rotation: number;
  isPlaced: boolean;
  // Legacy single-category field — kept readable for older placed
  // tables. Empty or "Other" meant open to every category. New writes
  // use `exhibitorCategories` (plural, multi-select).
  exhibitorCategory?: string;
  // Multi-select exhibitor business categories this placed space is
  // reserved for. Empty array (or undefined) = open to every category.
  // Used on the exhibitor side to filter which spaces a vendor of a
  // given category may book.
  exhibitorCategories?: string[];
  // Layout-only overrides written by the canvas corner-resize handles.
  // `width`/`height` (inherited from TableTemplate) stay locked to the
  // template's authored size — they're what shows up on the receipt and
  // anywhere a vendor reads the stall's actual dimensions. When these
  // overrides are set, the designer / eventfront canvas renders the
  // stall at the new visual size, but no money or contract amount keys
  // off them.
  displayWidth?: number;
  displayHeight?: number;
}

// Exhibitor business categories a space can be allotted to — kept in sync with
// the stall form's BUSINESS_CATEGORIES. "Other" means the space is open to
// every category.
const SPACE_CATEGORIES = [
  "Technology",
  "Music",
  "Food",
  "Sports",
  "Arts",
  "Fashion",
  "Electronics",
  "Other",
];

// Find this (around line 52):
interface AddOnItem {
  id: string;
  name: string;
  price: number;
  description: string;
  image?: string; // Add this
  preview?: string; // Add this for the local UI preview
  rawFile?: File; // Add this for the actual file upload
  hasNewImage?: boolean; // Add this flag for the backend
  /** Hex color used to identify this add-on on the venue layout (one dot per
   *  purchased add-on on each booked stall). */
  color?: string;
  /** General cap on how many of THIS add-on a vendor may select per booked
   *  space. Undefined / 0 = unlimited. */
  maxPerSpace?: number;
  /** Per-space-template caps: templateId → max count of this add-on allowed
   *  per booked space of that template. Overrides `maxPerSpace` for that
   *  template only. */
  maxPerTemplate?: Record<string, number>;
}

interface RoundTableTemplate {
  id: string;
  name: string;
  numberOfChairs: number;
  sellingMode: "table" | "chair";
  tablePrice: number;
  chairPrice: number;
  bookingPrice?: number;
  depositPrice?: number;
  memberTablePrice?: number;
  memberChairPrice?: number;
  memberBookingPrice?: number;
  memberDepositPrice?: number;
  category: string;
  color: string;
  tableDiameter: number;
  // A "not for sale" round table is a layout reference only (e.g. a
  // standing cocktail table / decoration) and cannot be booked.
  forSale?: boolean;
}

interface PositionedRoundTable extends RoundTableTemplate {
  positionId: string;
  templateId: string;
  x: number;
  y: number;
  rotation: number;
  isPlaced: boolean;
  venueConfigId: string;
  bookedChairs: number[];
  isFullyBooked: boolean;
}

interface StallTermsCondition {
  id: string;
  termsAndConditionsforStalls: string;
  isMandatory: boolean;
}

interface VenueConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  scale: number;
  gridSize: number;
  showGrid: boolean;
  hasMainStage: boolean;
  hasEntrance?: boolean;
  hasExit?: boolean;
  // Default shape new entrance / exit markers spawn with. Each placed
  // door also stores its own `shape`, so changing the default later
  // doesn't retroactively reshape existing markers. Undefined = circle
  // (preserves the pre-shape-picker behavior).
  entranceShape?: "circle" | "square";
  exitShape?: "circle" | "square";
  // Organizer-defined door types beyond Entrance / Exit (e.g. "Fire Exit",
  // "Loading Bay"). Each carries its own label, default shape and colour,
  // and gets its own "add" template button in the designer.
  customDoorTypes?: {
    id: string;
    label: string;
    shape: "circle" | "square";
    color?: string;
  }[];
  // Crop is a SEPARATE display boundary — it never overwrites the real
  // width/height (those stay the reference venue size shown to users).
  // When `cropped` is true the visitor views render exactly cropWidth ×
  // cropHeight (items outside are hidden); width/height are untouched.
  cropped?: boolean;
  cropWidth?: number;
  cropHeight?: number;
  totalRows: number; // NEW: Total number of rows
  // When false, this venue is hidden from the public eventfront and the
  // vendor/round-table selection tabs. Defaults to true (published).
  published?: boolean;
}

// Placed entrance/exit markers on the venue canvas — multiple per venue allowed.
interface PositionedDoor {
  id: string;
  x: number;
  y: number;
  type: "entrance" | "exit" | "custom";
  /** For custom doors: id of the VenueConfig.customDoorTypes entry. */
  customTypeId?: string;
  /** Marker colour. Entrance/exit fall back to green/red; custom uses this. */
  color?: string;
  rotation: number; // degrees, multiples of 90
  label?: string;
  // Shape and footprint. Square doors expose the same 8 resize handles
  // as Spaces so the organizer can stretch them to match a real door
  // span (e.g. a 4m wide entrance hall). Circular doors render at the
  // legacy 50×50 footprint unless width/height are explicitly set.
  shape?: "circle" | "square";
  width?: number;
  height?: number;
}

interface VenueLayout {
  tables: PositionedTable[];
  image: string;
}

export interface GalleryImage {
  id: string;
  file: File;
  preview: string;
  description: string;
}

// A single event sponsor logo. `file` is set for a freshly picked upload;
// `preview` is a blob: URL for new files or the stored /uploads URL on edit.
interface SponsorLogo {
  id: string;
  file: File | null;
  preview: string;
}

// Event Banner Component
export const EventBanner = ({
  bannerFile,
  setBannerFile,
  bannerPreview,
  setBannerPreview,
}: {
  bannerFile: File | null;
  setBannerFile: (file: File | null) => void;
  bannerPreview: string;
  setBannerPreview: (preview: string) => void;
}) => {
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Instead of setting directly, open the cropper
      setCropImage(URL.createObjectURL(file));
      setCropOpen(true);
    }
  };

  const handleCroppedImage = (croppedFile: File) => {
    setBannerFile(croppedFile);
    // Create preview for the cropped result
    const newPreview = URL.createObjectURL(croppedFile);
    setBannerPreview(newPreview);

    // Cleanup
    if (cropImage && cropImage.startsWith("blob:")) {
      URL.revokeObjectURL(cropImage);
    }
    setCropOpen(false);
    setCropImage(null);
  };

  const removeBanner = () => {
    if (bannerPreview.startsWith("blob:")) {
      URL.revokeObjectURL(bannerPreview);
    }
    setBannerFile(null);
    setBannerPreview("");
  };

  const getImageUrl = (preview: string): string => {
    if (preview.startsWith("blob:") || preview.startsWith("http"))
      return preview;
    return `${__API_URL__}${preview}`;
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Event Banner</Label>
      <p className="text-sm text-gray-600">
        Main banner (recommended: 1920x1080)
      </p>

      {/* Hide the dropzone once a banner is present — same UX as the
          gallery uploader, which collapses its picker after 5 images.
          Clicking the X on the preview clears bannerPreview and the
          dropzone reappears. */}
      {!bannerPreview && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
          <input
            type="file"
            accept="image/*"
            onChange={handleBannerChange}
            className="hidden"
            id="upload-banner"
          />
          <label
            htmlFor="upload-banner"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className="h-12 w-12 text-gray-400 mb-3" />
            <span className="text-sm text-gray-600 font-medium">
              Click to upload event banner
            </span>
          </label>
        </div>
      )}

      {bannerPreview && (
        <div className="relative rounded-lg overflow-hidden group">
          <img
            src={getImageUrl(bannerPreview)}
            alt="Banner Preview"
            className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition"
            onClick={() => {
              setCropImage(getImageUrl(bannerPreview));
              setCropOpen(true);
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition">
            <span className="bg-black/50 text-white px-2 py-1 rounded text-xs">
              Click to Re-crop
            </span>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={removeBanner}
          >
            <X size={14} />
          </Button>
        </div>
      )}

      {cropImage && (
        <ImageCropModal
          open={cropOpen}
          image={cropImage}
          onClose={() => {
            setCropOpen(false);
            setCropImage(null);
          }}
          onCropComplete={handleCroppedImage}
          // Free cropping by default — drag any of the 8 handles. Use the
          // ratio-lock buttons in the cropper if a fixed ratio is wanted.
        />
      )}
    </div>
  );
};

// Gallery Component with Navigation
export const EventGallery = ({
  galleryImages,
  setGalleryImages,
  maxImages = 5,
}: {
  galleryImages: GalleryImage[];
  setGalleryImages: (images: GalleryImage[]) => void;
  // Upload cap. Commercial events default to 5; the marriage form raises it.
  maxImages?: number;
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Index currently being dragged in the thumbnail strip (for reordering).
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Cropping States
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // Move a gallery image from one position to another and keep the moved
  // image selected so the big preview follows it.
  const moveImage = (from: number, to: number) => {
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= galleryImages.length ||
      to >= galleryImages.length
    )
      return;
    const updated = [...galleryImages];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setGalleryImages(updated);
    setCurrentImageIndex(to);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (galleryImages.length + files.length > maxImages) {
      alert(`Maximum ${maxImages} images allowed`);
      return;
    }

    if (files.length > 0) {
      setCropQueue(files);
      openNextCrop(files);
    }
  };

  const openNextCrop = (queue: File[]) => {
    if (queue.length === 0) return;
    const file = queue[0];
    setCropImage(URL.createObjectURL(file));
    setCropOpen(true);
  };

  const handleCroppedImage = (croppedFile: File) => {
    const previewUrl = URL.createObjectURL(croppedFile);

    if (editIndex !== null) {
      // Updating an existing image
      const updated = [...galleryImages];
      updated[editIndex] = {
        ...updated[editIndex],
        file: croppedFile,
        preview: previewUrl,
      };
      setGalleryImages(updated);
      setEditIndex(null);
    } else {
      // Adding new image
      const newImg: GalleryImage = {
        id: Math.random().toString(36).slice(2, 15),
        file: croppedFile,
        preview: previewUrl,
        description: "",
      };
      setGalleryImages([...galleryImages, newImg]);
    }

    // Clean up current crop
    if (cropImage?.startsWith("blob:")) URL.revokeObjectURL(cropImage);

    // Process next in queue
    const remaining = cropQueue.slice(1);
    setCropQueue(remaining);

    if (remaining.length > 0) {
      openNextCrop(remaining);
    } else {
      setCropOpen(false);
      setCropImage(null);
    }
  };

  const removeImage = (imageId: string) => {
    const imageToRemove = galleryImages.find((img) => img.id === imageId);
    if (imageToRemove?.preview.startsWith("blob:")) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    const newImages = galleryImages.filter((img) => img.id !== imageId);
    setGalleryImages(newImages);
    if (currentImageIndex >= newImages.length && newImages.length > 0) {
      setCurrentImageIndex(newImages.length - 1);
    }
  };

  const getImageUrl = (preview: string): string => {
    if (!preview) return "";
    if (preview.startsWith("blob:") || preview.startsWith("http"))
      return preview;
    return `${__API_URL__}${preview}`;
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">
        Event Gallery ({galleryImages.length}/{maxImages})
      </Label>

      {galleryImages.length < maxImages && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
            id="upload-gallery"
          />
          <label
            htmlFor="upload-gallery"
            className="flex flex-col items-center justify-center cursor-pointer"
          >
            <Upload className="h-8 w-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">Add gallery images</span>
          </label>
        </div>
      )}

      {galleryImages.length > 0 && (
        <div className="space-y-4">
          <div className="relative rounded-lg overflow-hidden group">
            <img
              src={getImageUrl(galleryImages[currentImageIndex]?.preview)}
              alt="Gallery Preview"
              className="w-full h-64 object-cover cursor-pointer"
              onClick={() => {
                setEditIndex(currentImageIndex);
                setCropImage(
                  getImageUrl(galleryImages[currentImageIndex].preview),
                );
                setCropOpen(true);
              }}
            />
            {/* Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition bg-black/20">
              <span className="bg-white/80 text-black px-3 py-1 rounded-full text-xs font-bold">
                Click to Crop Image
              </span>
            </div>

            {/* Navigation and Remove buttons remain the same... */}
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={(e) => {
                e.stopPropagation();
                removeImage(galleryImages[currentImageIndex].id);
              }}
            >
              <X size={14} />
            </Button>
          </div>

          {/* Thumbnail strip — preview every image, click to view, drag to
              reorder, and delete individually. The order here is the order
              attendees see in the gallery. */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Drag thumbnails to reorder. Click one to preview it above.
            </p>
            <div className="flex flex-wrap gap-3">
              {galleryImages.map((img, idx) => (
                <div
                  key={img.id}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null) moveImage(dragIndex, idx);
                    setDragIndex(null);
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`relative h-20 w-20 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border-2 transition ${
                    idx === currentImageIndex
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-gray-300"
                  } ${dragIndex === idx ? "opacity-40" : ""}`}
                >
                  <img
                    src={getImageUrl(img.preview)}
                    alt={`Gallery image ${idx + 1}`}
                    className="pointer-events-none h-full w-full object-cover"
                  />
                  {/* Sequence number */}
                  <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] leading-none text-white">
                    {idx + 1}
                  </span>
                  {/* Drag affordance */}
                  <span className="absolute bottom-0.5 left-0.5 text-white/80 drop-shadow">
                    <GripVertical size={12} />
                  </span>
                  {/* Delete */}
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(img.id);
                    }}
                    className="absolute right-0.5 top-0.5 rounded-full bg-red-600 p-0.5 text-white hover:bg-red-700"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {cropImage && (
        <ImageCropModal
          open={cropOpen}
          image={cropImage}
          onClose={() => {
            setCropOpen(false);
            setCropImage(null);
            setCropQueue([]);
            setEditIndex(null);
          }}
          onCropComplete={handleCroppedImage}
        />
      )}
    </div>
  );
};

// Venue Configuration Component
const VenueConfiguration = ({
  venueConfigurations,
  setVenueConfigurations,
  selectedVenueConfigId,
  setSelectedVenueConfigId,
}: {
  venueConfigurations: VenueConfig[];
  setVenueConfigurations: (configs: VenueConfig[]) => void;
  selectedVenueConfigId: string;
  setSelectedVenueConfigId: (id: string) => void;
}) => {
  const selectedConfig =
    venueConfigurations.find((config) => config.id === selectedVenueConfigId) ||
    venueConfigurations[0];

  // Local text state for the dimension inputs so the organizer can clear them
  // completely (leave the field empty) and retype, instead of the value
  // snapping back to a default the moment it's emptied. Stored in meters to
  // match what's shown; pushed to the config (×10) only when it's a valid
  // number. Re-synced when switching between venue configs.
  const [widthInput, setWidthInput] = useState<string>(
    selectedConfig ? String(selectedConfig.width / 10) : "",
  );
  const [lengthInput, setLengthInput] = useState<string>(
    selectedConfig ? String(selectedConfig.height / 10) : "",
  );
  useEffect(() => {
    if (!selectedConfig) return;
    setWidthInput(String(selectedConfig.width / 10));
    setLengthInput(String(selectedConfig.height / 10));
    // Only re-sync on config switch, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenueConfigId]);

  const updateSelectedConfig = (updates: Partial<VenueConfig>) => {
    setVenueConfigurations(
      venueConfigurations.map((config) =>
        config.id === selectedVenueConfigId
          ? { ...config, ...updates }
          : config,
      ),
    );
  };

  const addNewVenueConfig = () => {
    const newConfig: VenueConfig = {
      id: Math.random().toString(36).slice(2, 15),
      name: `Hall ${venueConfigurations.length + 1}`,
      width: 800,
      height: 500,
      scale: 0.75,
      gridSize: 20,
      showGrid: true,
      hasMainStage: true,
      totalRows: 3,
    };
    setVenueConfigurations([...venueConfigurations, newConfig]);
    setSelectedVenueConfigId(newConfig.id);
  };

  const removeVenueConfig = (id: string) => {
    if (venueConfigurations.length > 1) {
      const newConfigs = venueConfigurations.filter(
        (config) => config.id !== id,
      );
      setVenueConfigurations(newConfigs);
      if (selectedVenueConfigId === id) {
        setSelectedVenueConfigId(newConfigs[0].id);
      }
    }
  };

  const updateConfigName = (id: string, name: string) => {
    setVenueConfigurations(
      venueConfigurations.map((config) =>
        config.id === id ? { ...config, name } : config,
      ),
    );
  };

  return (
    <div className="space-y-6">
      {/* Venue Config Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Ruler size={20} />
              Venue Configurations
            </span>
            <Button type="button" onClick={addNewVenueConfig} size="sm">
              <Plus size={16} className="mr-2" />
              Add Venue
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Venue Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {venueConfigurations.map((config) => (
                <div key={config.id} className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={
                      selectedVenueConfigId === config.id
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedVenueConfigId(config.id)}
                    className="whitespace-nowrap"
                  >
                    {config.name}
                    {config.published === false && (
                      <span className="ml-1.5 rounded bg-gray-200 px-1 text-[10px] font-medium text-gray-600">
                        Hidden
                      </span>
                    )}
                  </Button>
                  {venueConfigurations.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVenueConfig(config.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Venue Name Editor */}
            <div>
              <Label>Venue Name</Label>
              <Input
                value={selectedConfig.name}
                onChange={(e) =>
                  updateConfigName(selectedVenueConfigId, e.target.value)
                }
                placeholder="e.g., Main Hall, Conference Room A"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Venue Measurements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ruler size={20} />
            {selectedConfig.name} Measurements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Width (meters)</Label>
              <Input
                type="number"
                value={widthInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setWidthInput(raw);
                  const n = parseInt(raw, 10);
                  // Only commit a real positive number; an empty field stays
                  // empty so it can be cleared and retyped.
                  if (raw !== "" && !isNaN(n) && n > 0) {
                    updateSelectedConfig({ width: n * 10 });
                  }
                }}
                placeholder="e.g. 80"
                min="0"
                max="200"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Length (meters)</Label>
              <Input
                type="number"
                value={lengthInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setLengthInput(raw);
                  const n = parseInt(raw, 10);
                  if (raw !== "" && !isNaN(n) && n > 0) {
                    updateSelectedConfig({ height: n * 10 });
                  }
                }}
                placeholder="e.g. 50"
                min="0"
                max="200"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Scale</Label>
              <Select
                value={selectedConfig.scale.toString()}
                onValueChange={(v) =>
                  updateSelectedConfig({ scale: parseFloat(v) })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">50%</SelectItem>
                  <SelectItem value="0.75">75%</SelectItem>
                  <SelectItem value="1">100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* <div>
              <Label>Total Spaces</Label>
              <Input
                type="number"
                value={selectedConfig.totalRows}
                onChange={(e) =>
                  updateSelectedConfig({
                    totalRows: parseInt(e.target.value) || 3,
                  })
                }
                min="1"
                max="10"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of rows for pricing tiers (1-10)
              </p>
            </div> */}
            {/* Span the full grid width so the toggles + Entrance/Exit +
                Custom Doors get room instead of being squeezed into a single
                1/5-width measurements cell. */}
            <div className="flex flex-col gap-2 col-span-full">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedConfig.showGrid}
                  onCheckedChange={(checked) =>
                    updateSelectedConfig({ showGrid: !!checked })
                  }
                />
                <Label className="text-sm">Show Grid</Label>
              </div>
              {selectedConfig.showGrid && (
                <div className="flex items-center gap-2 ml-6">
                  <Label
                    htmlFor="grid-size-input"
                    className="text-xs text-muted-foreground whitespace-nowrap"
                  >
                    Box size (m)
                  </Label>
                  <Input
                    id="grid-size-input"
                    type="number"
                    min={0.5}
                    max={50}
                    step={0.5}
                    // 1 m = 10 px convention, matching the Width/Height inputs
                    // above. User types meters, we store px.
                    value={(selectedConfig.gridSize / 10).toFixed(1)}
                    onChange={(e) => {
                      const meters = Number(e.target.value);
                      if (!Number.isFinite(meters) || meters <= 0) return;
                      updateSelectedConfig({
                        gridSize: Math.max(
                          5,
                          Math.min(500, Math.round(meters * 10)),
                        ),
                      });
                    }}
                    className="h-7 w-20 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">m</span>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedConfig.hasMainStage}
                  onCheckedChange={(checked) =>
                    updateSelectedConfig({ hasMainStage: !!checked })
                  }
                />
                <Label className="text-sm">Main Stage</Label>
              </div>
              {/* Custom door types — Entrance, Exit, Fire Exit, Loading Bay,
                  etc. Each gets its own draggable marker (with chosen shape +
                  colour) in the designer. Entrance/Exit are no longer special-
                  cased toggles; add them here like any other door type. */}
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Doors</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => {
                      const list = selectedConfig.customDoorTypes || [];
                      updateSelectedConfig({
                        customDoorTypes: [
                          ...list,
                          {
                            id: Math.random().toString(36).slice(2, 10),
                            label: "",
                            shape: "circle",
                            color: "#f97316",
                          },
                        ],
                      });
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </div>
                {(selectedConfig.customDoorTypes || []).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    Add any door type — <strong>Entrance</strong>,{" "}
                    <strong>Exit</strong>, <strong>Fire Exit</strong>,{" "}
                    <strong>Loading Bay</strong>, etc. They appear as draggable
                    markers in the designer with your chosen shape and colour.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(selectedConfig.customDoorTypes || []).map((d) => {
                      const update = (patch: Partial<typeof d>) =>
                        updateSelectedConfig({
                          customDoorTypes: (
                            selectedConfig.customDoorTypes || []
                          ).map((x) =>
                            x.id === d.id ? { ...x, ...patch } : x,
                          ),
                        });
                      return (
                        <div
                          key={d.id}
                          className="rounded-lg border bg-white p-3 space-y-2.5"
                        >
                          {/* Line 1 — colour swatch + name + remove */}
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={d.color || "#f97316"}
                              onChange={(e) =>
                                update({ color: e.target.value })
                              }
                              className="h-9 w-9 flex-shrink-0 cursor-pointer rounded border border-gray-300 p-0"
                              title="Marker colour"
                            />
                            <Input
                              value={d.label}
                              placeholder="e.g. Fire Exit"
                              onChange={(e) =>
                                update({ label: e.target.value })
                              }
                              className="h-9 text-sm flex-1 min-w-0"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-9 w-9 flex-shrink-0 text-red-500 hover:text-red-600"
                              onClick={() =>
                                updateSelectedConfig({
                                  customDoorTypes: (
                                    selectedConfig.customDoorTypes || []
                                  ).filter((x) => x.id !== d.id),
                                })
                              }
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          {/* Line 2 — shape picker on its own row, full width */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Shape
                            </span>
                            <div className="inline-flex h-9 flex-1 overflow-hidden rounded-md border bg-white">
                              {(["circle", "square"] as const).map((s) => {
                                const active = (d.shape || "circle") === s;
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => update({ shape: s })}
                                    className={`inline-flex h-full flex-1 items-center justify-center gap-1.5 border-r text-xs capitalize last:border-r-0 transition-colors ${
                                      active
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-muted"
                                    }`}
                                    title={`${s} marker`}
                                  >
                                    <span
                                      aria-hidden
                                      className={`inline-block h-3.5 w-3.5 border ${
                                        s === "circle"
                                          ? "rounded-full"
                                          : "rounded-[2px]"
                                      } ${
                                        active
                                          ? "border-primary-foreground bg-primary-foreground/30"
                                          : "border-current bg-current/20"
                                      }`}
                                    />
                                    {s}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Compact picker for previously-saved Space templates. Inserted above the
// Space form so the organizer can prefill all fields from a past event with
// one click. Editing any field after picking will create a NEW variant when
// the event is saved (server-side dedupe on signature).
// Lets an organizer re-import a whole saved venue layout (its canvas config +
// the stall types it uses + the placed stalls). Fetches the organizer's
// venueLayout templates and calls onImport with the chosen template. Picking
// again adds another venue — so selecting several layouts builds a multi-venue
// event.
const VenueTemplatePicker: React.FC<{
  onImport: (payload: any, name: string) => void;
}> = ({ onImport }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = sessionStorage.getItem("token");
      if (!token) return;
      const decoded: any = (() => {
        try {
          return jwtDecode(token);
        } catch {
          return null;
        }
      })();
      if (!decoded?.sub) return;
      setLoading(true);
      try {
        const res = await fetch(
          `${__API_URL__}/templates/by-organizer/${decoded.sub}?type=venueLayout`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setTemplates(json?.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = (id: string) => {
    const t = templates.find((x) => String(x._id) === id);
    if (!t) return;
    onImport(t.payload || {}, t.name || "Venue");
  };

  const isEmpty = !loading && templates.length === 0;

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 mb-5">
      <Label className="text-sm font-medium text-purple-900 flex items-center gap-2">
        <Grid3x3 size={14} /> Import a saved venue layout
      </Label>
      {isEmpty ? (
        <p className="mt-1 text-xs text-muted-foreground">
          No saved layouts yet — save an event that has placed stalls, and each
          of its venues becomes a reusable layout you can import here.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Adds a new venue pre-filled with that layout's config, stall types
            and placed stalls. Pick more than one to add several venues.
          </p>
          {/* Uncontrolled value — always resets so the SAME layout can be
              imported again (e.g. two copies of one hall). */}
          <Select value="" onValueChange={apply}>
            <SelectTrigger className="bg-white mt-2">
              <SelectValue
                placeholder={
                  loading
                    ? "Loading…"
                    : `Pick from ${templates.length} saved layout${
                        templates.length === 1 ? "" : "s"
                      }`
                }
              />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {templates.map((t) => {
                const p = t.payload || {};
                const tableCount = Array.isArray(p.venueTables)
                  ? p.venueTables.length
                  : 0;
                const w = p.venueConfig?.width;
                const h = p.venueConfig?.height;
                return (
                  <SelectItem key={String(t._id)} value={String(t._id)}>
                    {t.name}
                    {tableCount
                      ? ` · ${tableCount} stall${tableCount === 1 ? "" : "s"}`
                      : ""}
                    {w && h
                      ? ` · ${Math.round(w / 10)}×${Math.round(h / 10)}m`
                      : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
};

const SavedSpaceTemplatePicker: React.FC<{
  setCurrentTable: React.Dispatch<React.SetStateAction<any>>;
}> = ({ setCurrentTable }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = sessionStorage.getItem("token");
      if (!token) return;
      const decoded: any = (() => {
        try {
          return jwtDecode(token);
        } catch {
          return null;
        }
      })();
      if (!decoded?.sub) return;
      setLoading(true);
      try {
        const res = await fetch(
          `${__API_URL__}/templates/by-organizer/${decoded.sub}?type=space`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setTemplates(json?.data || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = (id: string) => {
    setSelectedId(id);
    const t = templates.find((x) => String(x._id) === id);
    if (!t) return;
    const p = t.payload || {};
    setCurrentTable((prev: any) => ({
      ...prev,
      name: p.name ?? prev.name,
      type: p.type ?? prev.type ?? "Straight",
      width: p.width != null ? String(p.width) : prev.width,
      height: p.height != null ? String(p.height) : prev.height,
      rowNumber: p.rowNumber != null ? String(p.rowNumber) : prev.rowNumber,
      tablePrice: p.tablePrice != null ? String(p.tablePrice) : prev.tablePrice,
      bookingPrice:
        p.bookingPrice != null ? String(p.bookingPrice) : prev.bookingPrice,
      depositPrice:
        p.depositPrice != null ? String(p.depositPrice) : prev.depositPrice,
      minimumPaymentEnabled: p.minimumPaymentEnabled !== false,
      depositInOption1: p.depositInOption1 === true,
      color: p.color ?? prev.color,
      forSale: prev.forSale,
    }));
  };

  if (!loading && templates.length === 0) return null;

  // Filter for large lists. Show the search input only above ~10 templates so
  // small libraries don't get noisy chrome.
  const visible = filter
    ? templates.filter((t) => {
        const f = filter.toLowerCase();
        const p = t.payload || {};
        return (
          (t.name || "").toLowerCase().includes(f) ||
          String(p.tablePrice ?? "").includes(f)
        );
      })
    : templates;

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3">
      <Label className="text-sm font-medium text-purple-900 flex items-center gap-2">
        <Grid3x3 size={14} /> Reuse a saved Space template
      </Label>
      <div className="flex gap-2 mt-2">
        <Select value={selectedId} onValueChange={apply}>
          <SelectTrigger className="bg-white">
            <SelectValue
              placeholder={
                loading
                  ? "Loading…"
                  : `Pick from ${templates.length} saved template${templates.length === 1 ? "" : "s"}`
              }
            />
          </SelectTrigger>
          {/* Cap height + scroll the inner viewport so 50+ entries are
              comfortably navigable instead of relying on Radix scroll
              chevrons alone. */}
          <SelectContent className="max-h-80">
            {templates.length > 10 && (
              <div
                className="sticky top-0 bg-popover px-2 py-1.5 border-b z-10"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Input
                  autoFocus
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search templates…"
                  className="h-8 text-xs"
                />
              </div>
            )}
            <div className="max-h-64 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No matches.
                </div>
              ) : (
                visible.map((t) => {
                  const p = t.payload || {};
                  const sub = [
                    p.tablePrice != null ? `Price ${p.tablePrice}` : null,
                    p.width && p.height ? `${p.width}×${p.height}cm` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <SelectItem key={String(t._id)} value={String(t._id)}>
                      {t.name}
                      {sub ? ` — ${sub}` : ""}
                    </SelectItem>
                  );
                })
              )}
            </div>
          </SelectContent>
        </Select>
        {selectedId && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedId("");
              setFilter("");
            }}
          >
            Clear
          </Button>
        )}
      </div>
      <p className="text-xs text-purple-700 mt-2">
        Picking fills the form below. Change the price (or any field) and save —
        it'll be stored as a new template variant.
      </p>
    </div>
  );
};

// Professional Table Management Component
const TableManagement = ({
  tableTemplates,
  setTableTemplates,
  addOnItems,
  setAddOnItems,
  currentTable,
  setCurrentTable,
  currentAddOn,
  setCurrentAddOn,
  venueConfigurations,
  selectedVenueConfigId,
  maxSpacesPerVendor,
  setMaxSpacesPerVendor,
}: {
  tableTemplates: TableTemplate[];
  setTableTemplates: (templates: TableTemplate[]) => void;
  addOnItems: AddOnItem[];
  setAddOnItems: (items: AddOnItem[]) => void;
  currentTable: {
    name: string;
    type: "Straight" | "Corner" | "Round" | "Square";
    width: string;
    height: string;
    rowNumber: string;
    tablePrice: string;
    bookingPrice: string;
    depositPrice: string;
    // Member-tier prices (strings while the form is active; converted on
    // save). Optional — empty strings mean "same as regular price".
    memberPrice?: string;
    memberBookingPrice?: string;
    memberDepositPrice?: string;
    minimumPaymentEnabled: boolean;
    depositInOption1: boolean;
    color: string;
    forSale: boolean;
    maxPerBooking?: string;
  };
  setCurrentTable: React.Dispatch<
    React.SetStateAction<{
      name: string;
      type: "Straight" | "Corner" | "Round" | "Square";
      width: string;
      height: string;
      rowNumber: string;
      tablePrice: string;
      bookingPrice: string;
      depositPrice: string;
      memberPrice?: string;
      memberBookingPrice?: string;
      memberDepositPrice?: string;
      minimumPaymentEnabled: boolean;
      depositInOption1: boolean;
      color: string;
      forSale: boolean;
      maxPerBooking?: string;
    }>
  >;
  // Update the currentAddOn prop type in TableManagement:
  currentAddOn: {
    name: string;
    price: string;
    description: string;
    rawFile?: File | null;
    preview?: string;
    color?: string;
    maxPerSpace?: string;
    maxPerTemplate?: Record<string, string>;
  };
  setCurrentAddOn: React.Dispatch<
    React.SetStateAction<{
      name: string;
      price: string;
      description: string;
      rawFile?: File | null;
      preview?: string;
      color?: string;
      maxPerSpace?: string;
      maxPerTemplate?: Record<string, string>;
    }>
  >;
  venueConfigurations: VenueConfig[];
  selectedVenueConfigId: string;
  maxSpacesPerVendor: string;
  setMaxSpacesPerVendor: (v: string) => void;
}) => {
  // const { toast } = useToast();

  const { country } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);
  // Membership module gate — when off, the Member-price inputs are
  // hidden so the form stays simple for plans without the feature.
  const { isModuleEnabled } = useSubscription();
  const isMembershipEnabled = isModuleEnabled("membership");
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);
  // Ids of the template/add-on being edited in place (null = adding new).
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingAddOnId, setEditingAddOnId] = useState<string | null>(null);

  const handleAddOnImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCropImage(URL.createObjectURL(file));
      setCropOpen(true);
    }
  };

  const handleAddOnCropComplete = (croppedFile: File) => {
    setCurrentAddOn((prev) => ({
      ...prev,
      rawFile: croppedFile,
      preview: URL.createObjectURL(croppedFile),
    }));
    setCropOpen(false);
    setCropImage(null);
  };

  // Helper functions for row-based pricing
  const getSelectedVenueConfig = () => {
    return (
      venueConfigurations.find(
        (config) => config.id === selectedVenueConfigId,
      ) || venueConfigurations[0]
    );
  };

  const getRowOptions = () => {
    const selectedConfig = getSelectedVenueConfig();
    const rows = [];
    for (let i = 1; i <= selectedConfig.totalRows; i++) {
      rows.push(i);
    }
    return rows;
  };

  const getRowLabel = (rowNumber: number) => {
    const selectedConfig = getSelectedVenueConfig();
    if (rowNumber === 1) return "Premium (Front)";
    if (rowNumber === selectedConfig.totalRows) return "Budget (Back)";
    return `Standard (Row ${rowNumber})`;
  };

  const calculateSuggestedBookingPrice = (tablePrice: number) => {
    return Math.round(tablePrice * 0.4);
  };

  const calculateSuggestedDepositPrice = (tablePrice: number) => {
    return Math.round(tablePrice * 0.5);
  };

  const handleTablePriceChange = (value: string) => {
    setCurrentTable((prev) => ({
      ...prev,
      tablePrice: value,
    }));

    const price = parseFloat(value);
    if (!isNaN(price) && price > 0) {
      if (!currentTable.bookingPrice) {
        setCurrentTable((prev) => ({
          ...prev,
          bookingPrice: calculateSuggestedBookingPrice(price).toString(),
        }));
      }
      if (!currentTable.depositPrice) {
        setCurrentTable((prev) => ({
          ...prev,
          depositPrice: calculateSuggestedDepositPrice(price).toString(),
        }));
      }
    }
  };
  const { toast } = useToast();

  const getDefaultDimensions = (type: string) => {
    switch (type) {
      case "Round":
        return { width: 150, height: 150 };
      case "Square":
        return { width: 120, height: 120 };
      case "Corner":
        return { width: 100, height: 100 };
      case "Straight":
        return { width: 200, height: 80 };
      default:
        return { width: 120, height: 120 };
    }
  };

  const addTable = () => {
    // Validate required fields
    if (!currentTable.name) {
      toast({
        duration: 5000,
        title: "Name is required",
        variant: "destructive",
      });
      return;
    }

    if (
      currentTable.forSale &&
      (!currentTable.tablePrice ||
        !currentTable.bookingPrice ||
        !currentTable.depositPrice)
    ) {
      toast({
        duration: 5000,
        title: "Please fill in all pricing fields",
        description:
          "Table Price, Booking Price, and Deposit are required for spaces that are for sale",
        variant: "destructive",
      });
      return;
    }

    // Validate booking price <= table price
    const tablePrice = parseFloat(currentTable.tablePrice);
    const bookingPrice = parseFloat(currentTable.bookingPrice);
    const depositPrice = parseFloat(currentTable.depositPrice);

    if (bookingPrice > tablePrice) {
      toast({
        duration: 5000,
        title: "Invalid Booking Price",
        description: "Booking price cannot exceed table price",
        variant: "destructive",
      });
      return;
    }

    if (tablePrice < 0 || bookingPrice < 0 || depositPrice < 0) {
      toast({
        duration: 5000,
        title: "Invalid Prices",
        description: "All prices must be positive numbers",
        variant: "destructive",
      });
      return;
    }

    const dimensions =
      currentTable.type === "Straight" &&
      currentTable.width &&
      currentTable.height
        ? {
            width: parseInt(currentTable.width),
            height: parseInt(currentTable.height),
          }
        : getDefaultDimensions(currentTable.type);

    // Member-tier prices: parsed only when the form supplied a value.
    // Undefined → exhibitors with active memberships pay the regular
    // tablePrice/bookingPrice/depositPrice. Membership-disabled plans
    // never populate these fields.
    const parseOptionalNum = (v?: string) => {
      if (v == null) return undefined;
      const s = String(v).trim();
      if (!s) return undefined;
      const n = parseFloat(s);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const memberPrice = parseOptionalNum(currentTable.memberPrice);
    const memberBookingPrice = parseOptionalNum(
      currentTable.memberBookingPrice,
    );
    const memberDepositPrice = parseOptionalNum(
      currentTable.memberDepositPrice,
    );

    const tableData = {
      name: currentTable.name,
      type: currentTable.type,
      width: dimensions.width,
      height: dimensions.height,
      rowNumber: parseInt(currentTable.rowNumber),
      tablePrice: tablePrice,
      bookingPrice: bookingPrice,
      depositPrice: depositPrice,
      memberPrice,
      memberBookingPrice,
      memberDepositPrice,
      minimumPaymentEnabled: currentTable.minimumPaymentEnabled,
      // Deposit can only ride Option 1 when the minimum-payment plan exists.
      depositInOption1:
        currentTable.minimumPaymentEnabled && currentTable.depositInOption1,
      color: currentTable.color || "#6b7280",
      forSale: currentTable.forSale,
      customDimensions: currentTable.type === "Straight",
      maxPerBooking: parseOptionalNum(currentTable.maxPerBooking),
    };

    if (editingTableId) {
      // Update the existing template in place, keeping id / booking state.
      setTableTemplates(
        tableTemplates.map((t) =>
          t.id === editingTableId ? { ...t, ...tableData } : t,
        ),
      );
      toast({
        duration: 5000,
        title: "Space template updated",
        description: `${tableData.name} saved`,
      });
    } else {
      const newTable: TableTemplate = {
        id: Math.random().toString(36).slice(2, 15),
        ...tableData,
        isBooked: false,
      };
      setTableTemplates([...tableTemplates, newTable]);
      toast({
        duration: 5000,
        title: "Space template created",
        description: `${newTable.name} added to templates`,
      });
    }

    resetTableForm();
  };

  const resetTableForm = () => {
    setCurrentTable({
      name: "",
      type: "Straight",
      width: "",
      height: "",
      rowNumber: "1",
      tablePrice: "",
      bookingPrice: "",
      depositPrice: "",
      memberPrice: "",
      memberBookingPrice: "",
      memberDepositPrice: "",
      minimumPaymentEnabled: true,
      depositInOption1: false,
      color: "#6b7280",
      forSale: true,
      maxPerBooking: "",
    });
    setEditingTableId(null);
  };

  // Load an existing space template back into the form for editing.
  const editTable = (id: string) => {
    const t = tableTemplates.find((x) => x.id === id);
    if (!t) return;
    setCurrentTable({
      name: t.name,
      type: t.type,
      width: t.width != null ? String(t.width) : "",
      height: t.height != null ? String(t.height) : "",
      rowNumber: t.rowNumber != null ? String(t.rowNumber) : "1",
      tablePrice: t.tablePrice != null ? String(t.tablePrice) : "",
      bookingPrice: t.bookingPrice != null ? String(t.bookingPrice) : "",
      depositPrice: t.depositPrice != null ? String(t.depositPrice) : "",
      memberPrice: t.memberPrice != null ? String(t.memberPrice) : "",
      memberBookingPrice:
        t.memberBookingPrice != null ? String(t.memberBookingPrice) : "",
      memberDepositPrice:
        t.memberDepositPrice != null ? String(t.memberDepositPrice) : "",
      minimumPaymentEnabled: t.minimumPaymentEnabled !== false,
      depositInOption1: t.depositInOption1 === true,
      color: t.color || "#6b7280",
      forSale: t.forSale !== false,
      maxPerBooking: t.maxPerBooking != null ? String(t.maxPerBooking) : "",
    });
    setEditingTableId(id);
  };

  const addAddOn = () => {
    if (!currentAddOn.name || !currentAddOn.price) {
      toast({
        title: "Please fill in add-on name and price",
        variant: "destructive",
      });
      return;
    }

    // Optional general per-space quantity cap (0 / blank = unlimited).
    const maxPerSpace = (() => {
      const n = parseInt(currentAddOn.maxPerSpace || "", 10);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })();
    // Optional per-space-template overrides → { templateId: number }.
    const maxPerTemplate = (() => {
      const src = currentAddOn.maxPerTemplate || {};
      const out: Record<string, number> = {};
      Object.keys(src).forEach((k) => {
        const n = parseInt(src[k] || "", 10);
        if (Number.isFinite(n) && n > 0) out[k] = n;
      });
      return Object.keys(out).length ? out : undefined;
    })();

    if (editingAddOnId) {
      // Update in place. Only touch image fields if a new file was picked,
      // otherwise keep the add-on's existing image untouched.
      const changedImage = !!currentAddOn.rawFile;
      setAddOnItems(
        addOnItems.map((it) =>
          it.id === editingAddOnId
            ? {
                ...it,
                name: currentAddOn.name,
                price: parseFloat(currentAddOn.price),
                description: currentAddOn.description,
                color: currentAddOn.color || "#6b7280",
                maxPerSpace,
                maxPerTemplate,
                ...(changedImage
                  ? {
                      rawFile: currentAddOn.rawFile || undefined,
                      preview: currentAddOn.preview || undefined,
                      hasNewImage: true,
                    }
                  : {}),
              }
            : it,
        ),
      );
      toast({ title: "Add-on updated successfully!" });
    } else {
      const newAddOn: AddOnItem = {
        id: Math.random().toString(36).slice(2, 15),
        name: currentAddOn.name,
        price: parseFloat(currentAddOn.price),
        description: currentAddOn.description,
        rawFile: currentAddOn.rawFile || undefined,
        preview: currentAddOn.preview || undefined,
        color: currentAddOn.color || "#6b7280",
        maxPerSpace,
        maxPerTemplate,
      };
      setAddOnItems([...addOnItems, newAddOn]);
      toast({ title: "Add-on created successfully!" });
    }

    resetAddOnForm();
  };

  const resetAddOnForm = () => {
    setCurrentAddOn({
      name: "",
      price: "",
      description: "",
      rawFile: null,
      preview: "",
      color: "#6b7280",
      maxPerSpace: "",
      maxPerTemplate: {},
    });
    setEditingAddOnId(null);
  };

  // Load an existing add-on back into the form for editing. The existing
  // image is shown via preview; leaving the uploader untouched preserves it.
  const editAddOn = (id: string) => {
    const a = addOnItems.find((x) => x.id === id);
    if (!a) return;
    setCurrentAddOn({
      name: a.name,
      price: a.price != null ? String(a.price) : "",
      description: a.description || "",
      rawFile: null,
      preview: a.preview || (a.image ? `${__API_URL__}${a.image}` : ""),
      color: a.color || "#6b7280",
      maxPerSpace: a.maxPerSpace != null ? String(a.maxPerSpace) : "",
      maxPerTemplate: a.maxPerTemplate
        ? Object.fromEntries(
            Object.entries(a.maxPerTemplate).map(([k, v]) => [k, String(v)]),
          )
        : {},
    });
    setEditingAddOnId(id);
  };

  return (
    <div className="space-y-6">
      {/* Table Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3x3 size={20} />
            Create Space Templates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Saved templates picker — pulls from /templates collection so the
              organizer can reuse a previous Space without retyping. Editing
              fields after picking will create a new variant on save. */}
          <SavedSpaceTemplatePicker setCurrentTable={setCurrentTable} />

          {/* Replace the "Create Table Templates" grid layout with this to remove the "Table Type" selector and enforce Straight tables. */}
          <div className="grid grid-cols-1 gap-4">
            <div className="md:col-span-1">
              <Label>Space Name *</Label>
              <Input
                value={currentTable.name}
                onChange={(e) =>
                  setCurrentTable((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g., Standard Space A"
              />
            </div>
          </div>

          {currentTable.type === "Straight" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Length (cm) *</Label>
                <Input
                  type="number"
                  value={currentTable.width}
                  onChange={(e) =>
                    setCurrentTable((prev) => ({
                      ...prev,
                      width: e.target.value,
                    }))
                  }
                  placeholder="200"
                />
              </div>
              <div>
                <Label>Width (cm) *</Label>
                <Input
                  type="number"
                  value={currentTable.height}
                  onChange={(e) =>
                    setCurrentTable((prev) => ({
                      ...prev,
                      height: e.target.value,
                    }))
                  }
                  placeholder="80"
                />
              </div>
            </div>
          )}

          {/* Row Number Selection */}
          {/* <div>
            <Label>Row Number *</Label>
            <Select
              value={currentTable.rowNumber}
              onValueChange={(v) =>
                setCurrentTable((prev) => ({
                  ...prev,
                  rowNumber: v,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select row" />
              </SelectTrigger>
              <SelectContent>
                {getRowOptions().map((row) => (
                  <SelectItem key={row} value={row.toString()}>
                    Row {row} - {getRowLabel(row)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              Select which row this Space belongs to. Different rows can have
              different prices.
            </p>
          </div> */}

          {/* Pricing Section */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2">
              {country === "IN" ? (
                <IndianRupee size={18} className="text-blue-600" />
              ) : (
                <DollarSign size={18} className="text-blue-600" />
              )}
              <h4 className="font-semibold text-blue-900">Pricing</h4>
            </div>

            {!currentTable.forSale && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                This space is <strong>not for sale</strong> — it will appear on
                the venue layout as a reference point (e.g., Food Court,
                Registration Desk) but cannot be booked by exhibitors.
              </div>
            )}

            {currentTable.forSale && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Table Price */}
                <div>
                  <Label className="flex items-center gap-1">
                    Space Price ({getSymbol()}) *
                  </Label>

                  <Input
                    type="number"
                    min="0"
                    value={currentTable.tablePrice}
                    onChange={(e) => handleTablePriceChange(e.target.value)}
                    placeholder="10000"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Full rental price for this table
                  </p>
                </div>

                {/* Booking Price */}
                <div>
                  <Label className="flex items-center gap-1">
                    Booking Price ({getSymbol()}) *
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max={currentTable.tablePrice || undefined}
                    value={currentTable.bookingPrice}
                    onChange={(e) =>
                      setCurrentTable((prev) => ({
                        ...prev,
                        bookingPrice: e.target.value,
                      }))
                    }
                    placeholder="4000"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Partial payment (≤ Space Price)
                  </p>
                  {currentTable.tablePrice && (
                    <p className="text-xs text-blue-600 mt-1">
                      Suggested:
                      {formatPrice(
                        calculateSuggestedBookingPrice(
                          parseFloat(currentTable.tablePrice),
                        ),
                      )}
                    </p>
                  )}
                </div>

                {/* Deposit Price */}
                <div>
                  <Label className="flex items-center gap-1">
                    Deposit Price ({getSymbol()}) *
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={currentTable.depositPrice}
                    onChange={(e) =>
                      setCurrentTable((prev) => ({
                        ...prev,
                        depositPrice: e.target.value,
                      }))
                    }
                    placeholder="5000"
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Security deposit (refundable)
                  </p>
                  {currentTable.tablePrice && (
                    <p className="text-xs text-blue-600 mt-1">
                      Suggested:
                      {formatPrice(
                        calculateSuggestedDepositPrice(
                          parseFloat(currentTable.tablePrice),
                        ),
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {currentTable.forSale && (
              <div>
                <Label className="flex items-center gap-1">
                  Max per booking (per exhibitor)
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={currentTable.maxPerBooking || ""}
                  onChange={(e) =>
                    setCurrentTable((prev) => ({
                      ...prev,
                      maxPerBooking: e.target.value,
                    }))
                  }
                  placeholder="Unlimited"
                  className="max-w-xs"
                />
                <p className="text-xs text-gray-600 mt-1">
                  Most spaces of <strong>this type</strong> one exhibitor can
                  select in a single booking (e.g. 1 large, 2 small). Leave
                  blank for unlimited.
                </p>
              </div>
            )}

            {/* Member-tier pricing — only surfaced when the organizer's
                subscription has the membership module enabled. Empty
                fields fall through to the regular price at booking
                time, so existing templates don't need updating. */}
            {currentTable.forSale && isMembershipEnabled && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Member price (optional)
                </div>
                <p className="text-[11px] text-emerald-700/80">
                  Exhibitors with an active membership at this event see these
                  prices. Leave blank to charge the regular price.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">
                      Member Space Price ({getSymbol()})
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentTable.memberPrice ?? ""}
                      onChange={(e) =>
                        setCurrentTable((prev) => ({
                          ...prev,
                          memberPrice: e.target.value,
                        }))
                      }
                      placeholder={
                        currentTable.tablePrice
                          ? `Reg: ${currentTable.tablePrice}`
                          : "—"
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      Member Booking Price ({getSymbol()})
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentTable.memberBookingPrice ?? ""}
                      onChange={(e) =>
                        setCurrentTable((prev) => ({
                          ...prev,
                          memberBookingPrice: e.target.value,
                        }))
                      }
                      placeholder={
                        currentTable.bookingPrice
                          ? `Reg: ${currentTable.bookingPrice}`
                          : "—"
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      Member Deposit ({getSymbol()})
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={currentTable.memberDepositPrice ?? ""}
                      onChange={(e) =>
                        setCurrentTable((prev) => ({
                          ...prev,
                          memberDepositPrice: e.target.value,
                        }))
                      }
                      placeholder={
                        currentTable.depositPrice
                          ? `Reg: ${currentTable.depositPrice}`
                          : "—"
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Minimum-payment master toggle. Controls whether the partial /
                minimum-payment plan is offered at checkout at all. When off,
                exhibitors must pay in full and the deposit-in-Option-1 toggle
                below is hidden (it only matters when Option 1 exists). */}
            {currentTable.forSale && (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
                <div>
                  <Label className="text-sm">
                    Offer minimum payment option
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {currentTable.minimumPaymentEnabled
                      ? "Exhibitors can pay the booking amount now and the balance later"
                      : "Exhibitors must pay the full amount at checkout"}
                  </p>
                </div>
                <Switch
                  checked={currentTable.minimumPaymentEnabled}
                  onCheckedChange={(checked) =>
                    setCurrentTable((prev) => ({
                      ...prev,
                      minimumPaymentEnabled: checked,
                      // Deposit-in-Option-1 is meaningless without Option 1.
                      depositInOption1: checked ? prev.depositInOption1 : false,
                    }))
                  }
                />
              </div>
            )}

            {/* Include-deposit-in-Option-1 toggle. Controls whether the
                minimum-payment option (Option 1) is Booking + Deposit (on) or
                Booking only (off, deposit collected with the balance). Only
                shown when the minimum-payment plan is enabled above. */}
            {currentTable.forSale && currentTable.minimumPaymentEnabled && (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
                <div>
                  <Label className="text-sm">
                    Include deposit in Option 1 (minimum payment)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {currentTable.depositInOption1
                      ? "Option 1 = Booking + Deposit"
                      : "Option 1 = Booking only (deposit paid with the balance)"}
                  </p>
                </div>
                <Switch
                  checked={currentTable.depositInOption1}
                  onCheckedChange={(checked) =>
                    setCurrentTable((prev) => ({
                      ...prev,
                      depositInOption1: checked,
                    }))
                  }
                />
              </div>
            )}

            {/* For Sale Toggle */}
            <div>
              <Label className="flex items-center gap-1 mb-2">Space Type</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-all ${currentTable.forSale ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  onClick={() =>
                    setCurrentTable((prev) => ({ ...prev, forSale: true }))
                  }
                >
                  For Sale
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-all ${!currentTable.forSale ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  onClick={() =>
                    setCurrentTable((prev) => ({
                      ...prev,
                      forSale: false,
                      tablePrice: "0",
                      bookingPrice: "0",
                      depositPrice: "0",
                    }))
                  }
                >
                  Not for Sale
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">
                {currentTable.forSale
                  ? "Exhibitors can book this space"
                  : "Reference only (Food Court, Registration Desk, etc.)"}
              </p>
            </div>

            {/* Color Picker */}
            <div>
              <Label className="flex items-center gap-1 mb-2">
                Space Color
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  "#6b7280",
                  "#ef4444",
                  "#f59e0b",
                  "#10b981",
                  "#3b82f6",
                  "#8b5cf6",
                  "#ec4899",
                  "#14b8a6",
                  "#f97316",
                  "#6366f1",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${currentTable.color === c ? "border-gray-800 scale-110 shadow-md" : "border-gray-200 hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                    onClick={() =>
                      setCurrentTable((prev) => ({ ...prev, color: c }))
                    }
                  />
                ))}
                <input
                  type="color"
                  value={currentTable.color}
                  onChange={(e) =>
                    setCurrentTable((prev) => ({
                      ...prev,
                      color: e.target.value,
                    }))
                  }
                  className="w-8 h-8 rounded-full cursor-pointer border-2 border-gray-200"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Pricing Summary */}
            {currentTable.forSale &&
              currentTable.tablePrice &&
              currentTable.bookingPrice &&
              currentTable.depositPrice && (
                <div className="bg-white p-3 rounded border border-blue-200">
                  <p className="text-sm font-semibold mb-2">
                    Payment Options for Exhibitors:
                  </p>
                  <div
                    className={`grid grid-cols-1 gap-3 text-sm ${
                      currentTable.minimumPaymentEnabled ? "md:grid-cols-2" : ""
                    }`}
                  >
                    {/* Option 1 only exists when the minimum-payment plan is
                        enabled for this space. */}
                    {currentTable.minimumPaymentEnabled && (
                      <div className="bg-green-50 p-2 rounded">
                        <p className="font-medium text-green-800">
                          Option 1: Minimum Payment
                        </p>
                        <p className="text-green-700">
                          {currentTable.depositInOption1
                            ? "Booking + Deposit = "
                            : "Booking only = "}
                          {formatPrice(
                            parseFloat(currentTable.bookingPrice) +
                              (currentTable.depositInOption1
                                ? parseFloat(currentTable.depositPrice)
                                : 0),
                          )}
                        </p>
                        <p className="text-xs text-green-600">
                          Remaining:
                          {formatPrice(
                            parseFloat(currentTable.tablePrice) -
                              parseFloat(currentTable.bookingPrice) +
                              (currentTable.depositInOption1
                                ? 0
                                : parseFloat(currentTable.depositPrice)),
                          )}
                        </p>
                      </div>
                    )}
                    <div className="bg-purple-50 p-2 rounded">
                      <p className="font-medium text-purple-800">
                        {currentTable.minimumPaymentEnabled
                          ? "Option 2: Full Payment"
                          : "Full Payment (minimum payment disabled)"}
                      </p>
                      <p className="text-purple-700">
                        Deposit + Space Price =
                        {formatPrice(
                          parseFloat(currentTable.depositPrice) +
                            parseFloat(currentTable.tablePrice),
                        )}
                      </p>
                      <p className="text-xs text-purple-600">
                        Remaining: {getSymbol()}0
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* Member-tier payment options. Mirrors the regular summary
                above but uses the member prices the organizer entered.
                Empty member fields fall through to the corresponding
                regular price — so a half-filled member tier still
                produces a sensible breakdown. Hidden when the
                membership module is off or no member space-price has
                been set. */}
            {currentTable.forSale &&
              isMembershipEnabled &&
              currentTable.tablePrice &&
              currentTable.bookingPrice &&
              currentTable.depositPrice &&
              (currentTable.memberPrice ||
                currentTable.memberBookingPrice ||
                currentTable.memberDepositPrice) && (
                <div className="bg-white p-3 rounded border border-emerald-200">
                  <p className="text-sm font-semibold mb-2 flex items-center gap-2 text-emerald-800">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    Member Payment Options
                  </p>
                  {(() => {
                    const memSpace =
                      parseFloat(
                        currentTable.memberPrice ||
                          currentTable.tablePrice ||
                          "0",
                      ) || 0;
                    const memBooking =
                      parseFloat(
                        currentTable.memberBookingPrice ||
                          currentTable.bookingPrice ||
                          "0",
                      ) || 0;
                    const memDeposit =
                      parseFloat(
                        currentTable.memberDepositPrice ||
                          currentTable.depositPrice ||
                          "0",
                      ) || 0;
                    const opt1 =
                      memBooking +
                      (currentTable.depositInOption1 ? memDeposit : 0);
                    const opt1Remaining =
                      memSpace -
                      memBooking +
                      (currentTable.depositInOption1 ? 0 : memDeposit);
                    const opt2 = memSpace + memDeposit;
                    return (
                      <div
                        className={`grid grid-cols-1 gap-3 text-sm ${
                          currentTable.minimumPaymentEnabled
                            ? "md:grid-cols-2"
                            : ""
                        }`}
                      >
                        {currentTable.minimumPaymentEnabled && (
                          <div className="bg-emerald-50 p-2 rounded">
                            <p className="font-medium text-emerald-800">
                              Option 1: Minimum Payment
                            </p>
                            <p className="text-emerald-700">
                              {currentTable.depositInOption1
                                ? "Booking + Deposit = "
                                : "Booking only = "}
                              {formatPrice(opt1)}
                            </p>
                            <p className="text-xs text-emerald-600">
                              Remaining: {formatPrice(opt1Remaining)}
                            </p>
                          </div>
                        )}
                        <div className="bg-teal-50 p-2 rounded">
                          <p className="font-medium text-teal-800">
                            {currentTable.minimumPaymentEnabled
                              ? "Option 2: Full Payment"
                              : "Full Payment (minimum payment disabled)"}
                          </p>
                          <p className="text-teal-700">
                            Deposit + Space Price = {formatPrice(opt2)}
                          </p>
                          <p className="text-xs text-teal-600">
                            Remaining: {getSymbol()}0
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={addTable} className="flex-1">
              {editingTableId ? (
                <>
                  <Pencil size={16} className="mr-2" /> Update Space Template
                </>
              ) : (
                <>
                  <Plus size={16} className="mr-2" /> Create Space Template
                </>
              )}
            </Button>
            {editingTableId && (
              <Button type="button" variant="outline" onClick={resetTableForm}>
                Cancel
              </Button>
            )}
          </div>

          {tableTemplates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Space Templates ({tableTemplates.length})
              </Label>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {tableTemplates.map((table) => (
                  <div
                    key={table.id}
                    className={`flex items-center justify-between p-3 bg-gray-50 rounded border-l-4 ${
                      editingTableId === table.id ? "ring-2 ring-primary" : ""
                    }`}
                    style={{ borderLeftColor: table.color || "#6b7280" }}
                  >
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: table.color || "#6b7280" }}
                        />
                        {table.name}
                        {table.forSale === false && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-orange-300 text-orange-600 bg-orange-50"
                          >
                            Not for Sale
                          </Badge>
                        )}
                        {/* <Badge variant="buttonOutline">
                          Row {table.rowNumber}
                        </Badge> */}
                        {table.isBooked && (
                          <Badge variant="destructive">Booked</Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        {table.type} • {table.width}x{table.height}cm
                      </div>
                      <div className="text-sm text-gray-700 font-medium">
                        Space: {formatPrice(table.tablePrice)} • Booking:
                        {formatPrice(table.bookingPrice)} • Deposit:
                        {formatPrice(table.depositPrice)}
                      </div>
                      {table.isBooked && table.bookedBy && (
                        <div className="text-xs text-gray-500">
                          Booked by: {table.bookedBy}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="buttonOutline"
                        size="sm"
                        onClick={() => editTable(table.id)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="buttonOutline"
                        size="sm"
                        onClick={() => {
                          setTableTemplates(
                            tableTemplates.filter((t) => t.id !== table.id),
                          );
                          if (editingTableId === table.id) resetTableForm();
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking rule: max spaces a single vendor may book. Drives the
          quantity-based preferred-space picker on the stall form. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spaces per vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex w-full flex-col gap-1">
            <Label>Maximum spaces per vendor</Label>
            <Input
              type="number"
              min={1}
              step={1}
              className="w-full"
              value={maxSpacesPerVendor}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setMaxSpacesPerVendor(
                  e.target.value === ""
                    ? ""
                    : String(!Number.isFinite(n) || n < 1 ? 1 : n),
                );
              }}
              placeholder="1"
            />
            <p className="text-xs text-muted-foreground">
              On the stall form a vendor picks preferred space types up to this
              total — e.g. set 2 to allow 2 of one type or 1 each of two types.
              Defaults to 1 per type.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add-Ons Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus size={20} />
            Create Add-Ons
          </CardTitle>
        </CardHeader>
        {/* Replace the current <CardContent className="space-y-4"> for Create Add-Ons with this: */}
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Image Uploader */}
            <div className="col-span-1 border-2 border-dashed border-gray-300 rounded-lg p-2 flex flex-col items-center justify-center relative min-h-[100px]">
              <input
                type="file"
                accept="image/*"
                onChange={handleAddOnImageChange}
                className="hidden"
                id="upload-addon"
              />
              {currentAddOn.preview ? (
                <>
                  <img
                    src={currentAddOn.preview}
                    alt="Add-on preview"
                    className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-80"
                    onClick={() => {
                      setCropImage(currentAddOn.preview!);
                      setCropOpen(true);
                    }}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentAddOn((prev) => ({
                        ...prev,
                        rawFile: null,
                        preview: "",
                      }));
                    }}
                  >
                    <X size={12} />
                  </Button>
                </>
              ) : (
                <label
                  htmlFor="upload-addon"
                  className="flex flex-col items-center cursor-pointer w-full h-full justify-center"
                >
                  <Upload className="h-6 w-6 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-500 text-center">
                    Add Image
                  </span>
                </label>
              )}
            </div>

            {/* The rest of your Add-on Inputs */}
            <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Add-On Name *</Label>
                <Input
                  value={currentAddOn.name}
                  onChange={(e) =>
                    setCurrentAddOn((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Power Supply, WiFi"
                />
              </div>
              <div>
                <Label>Price ({getSymbol()}) *</Label>
                <Input
                  type="number"
                  value={currentAddOn.price}
                  onChange={(e) =>
                    setCurrentAddOn((prev) => ({
                      ...prev,
                      price: e.target.value,
                    }))
                  }
                  placeholder="500"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Color</Label>
                <div className="flex items-center flex-wrap gap-2 mt-1">
                  {/* Native color input — opens the browser's full picker
                      so you can pick any hex, not just the presets. */}
                  <input
                    type="color"
                    aria-label="Pick add-on color"
                    value={currentAddOn.color || "#6b7280"}
                    onChange={(e) =>
                      setCurrentAddOn((prev) => ({
                        ...prev,
                        color: e.target.value,
                      }))
                    }
                    className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
                  />
                  <Input
                    type="text"
                    value={currentAddOn.color || "#6b7280"}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                        setCurrentAddOn((prev) => ({ ...prev, color: v }));
                      }
                    }}
                    placeholder="#6b7280"
                    className="h-8 w-24 font-mono text-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    or pick a preset:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ADDON_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        aria-label={`Pick color ${c}`}
                        onClick={() =>
                          setCurrentAddOn((prev) => ({ ...prev, color: c }))
                        }
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          (currentAddOn.color || "").toLowerCase() ===
                          c.toLowerCase()
                            ? "border-gray-800 scale-110"
                            : "border-gray-200 hover:border-gray-400"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              {/* Per-space quantity cap for this add-on */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="pr-3">
                    <Label className="text-sm font-medium">
                      Maximum Number Allowed
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cap how many of this add-on a vendor can select per booked
                      space. Off = unlimited.
                    </p>
                  </div>
                  <Switch
                    checked={
                      currentAddOn.maxPerSpace != null &&
                      currentAddOn.maxPerSpace !== ""
                    }
                    onCheckedChange={(v) =>
                      setCurrentAddOn((prev) => ({
                        ...prev,
                        maxPerSpace: v ? "1" : "",
                      }))
                    }
                  />
                </div>
                {currentAddOn.maxPerSpace != null &&
                  currentAddOn.maxPerSpace !== "" && (
                    <div className="mt-2">
                      <Label>
                        Maximum Number of Add-Ons Allowed Per Vendor per Space
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={currentAddOn.maxPerSpace}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const n = parseInt(raw, 10);
                          setCurrentAddOn((prev) => ({
                            ...prev,
                            maxPerSpace:
                              raw === ""
                                ? ""
                                : String(!Number.isFinite(n) || n < 1 ? 1 : n),
                          }));
                        }}
                        placeholder="e.g., 2 (general limit)"
                        className="mt-1"
                      />

                      {/* Per-space-template overrides */}
                      <div className="mt-3">
                        <Label className="text-xs text-muted-foreground">
                          Limit per space template (optional — overrides the
                          general limit for that template):
                        </Label>
                        <div className="mt-1.5 space-y-1.5">
                          {tableTemplates.filter(
                            (tpl) => (tpl as any).forSale !== false,
                          ).length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              Add sellable space templates first to set
                              per-template limits.
                            </p>
                          )}
                          {tableTemplates
                            .filter((tpl) => (tpl as any).forSale !== false)
                            .map((tpl) => (
                            <div
                              key={tpl.id}
                              className="flex items-center gap-2"
                            >
                              <span
                                className="inline-block h-3 w-3 shrink-0 rounded-sm border"
                                style={{
                                  backgroundColor: tpl.color || "#e5e7eb",
                                }}
                              />
                              <span className="flex-1 truncate text-sm">
                                {tpl.name || "Unnamed"}
                              </span>
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={
                                  currentAddOn.maxPerTemplate?.[tpl.id] ?? ""
                                }
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const n = parseInt(raw, 10);
                                  const val =
                                    raw === ""
                                      ? ""
                                      : String(
                                          !Number.isFinite(n) || n < 1 ? 1 : n,
                                        );
                                  setCurrentAddOn((prev) => ({
                                    ...prev,
                                    maxPerTemplate: {
                                      ...(prev.maxPerTemplate || {}),
                                      [tpl.id]: val,
                                    },
                                  }));
                                }}
                                placeholder="—"
                                className="h-8 w-20"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <div className="flex gap-2">
                  <Input
                    value={currentAddOn.description}
                    onChange={(e) =>
                      setCurrentAddOn((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description of the add-on"
                    className="flex-1"
                  />
                  <Button type="button" onClick={addAddOn}>
                    {editingAddOnId ? (
                      <>
                        <Pencil size={16} className="mr-2" /> Update
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" /> Add
                      </>
                    )}
                  </Button>
                  {editingAddOnId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetAddOnForm}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Display Available Add-Ons List */}
          {addOnItems.length > 0 && (
            <div className="space-y-2 pt-4">
              <Label className="text-sm font-medium">
                Available Add-Ons ({addOnItems.length})
              </Label>
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {addOnItems.map((addOn) => (
                  <div
                    key={addOn.id}
                    className={`flex items-center justify-between p-3 bg-gray-50 rounded border ${
                      editingAddOnId === addOn.id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Click the dot to change this add-on's color — same
                          15-swatch palette as the create-form picker. */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-4 h-4 rounded-full border border-gray-300 shrink-0 hover:scale-110 transition-transform"
                            style={{
                              backgroundColor: addOn.color || "#6b7280",
                            }}
                            title="Change color"
                          />
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-3 space-y-2"
                          align="start"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              aria-label="Pick add-on color"
                              value={addOn.color || "#6b7280"}
                              onChange={(e) =>
                                setAddOnItems(
                                  addOnItems.map((it) =>
                                    it.id === addOn.id
                                      ? { ...it, color: e.target.value }
                                      : it,
                                  ),
                                )
                              }
                              className="h-8 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5"
                            />
                            <Input
                              type="text"
                              value={addOn.color || "#6b7280"}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                                  setAddOnItems(
                                    addOnItems.map((it) =>
                                      it.id === addOn.id
                                        ? { ...it, color: v }
                                        : it,
                                    ),
                                  );
                                }
                              }}
                              className="h-8 w-24 font-mono text-xs"
                            />
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                            {ADDON_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                title={c}
                                onClick={() =>
                                  setAddOnItems(
                                    addOnItems.map((it) =>
                                      it.id === addOn.id
                                        ? { ...it, color: c }
                                        : it,
                                    ),
                                  )
                                }
                                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                                  (addOn.color || "#6b7280").toLowerCase() ===
                                  c.toLowerCase()
                                    ? "border-gray-800 scale-110"
                                    : "border-gray-200 hover:border-gray-400"
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {addOn.preview || addOn.image ? (
                        <img
                          src={addOn.preview || `${__API_URL__}${addOn.image}`}
                          alt={addOn.name}
                          className="w-10 h-10 rounded object-cover border"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded border flex items-center justify-center">
                          <Image className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{addOn.name}</div>
                        <div className="text-sm text-gray-600">
                          {formatPrice(addOn.price)} - {addOn.description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="buttonOutline"
                        size="sm"
                        onClick={() => editAddOn(addOn.id)}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="buttonOutline"
                        size="sm"
                        onClick={() => {
                          setAddOnItems(
                            addOnItems.filter((item) => item.id !== addOn.id),
                          );
                          if (editingAddOnId === addOn.id) resetAddOnForm();
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Make sure the Crop Modal is rendered inside the Component! */}
          {cropImage && (
            <ImageCropModal
              open={cropOpen}
              image={cropImage}
              onClose={() => {
                setCropOpen(false);
                setCropImage(null);
              }}
              onCropComplete={handleAddOnCropComplete}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Enhanced Venue Designer with Improved Drag & Drop
interface VenueDesignerProps {
  tableTemplates: TableTemplate[];
  venueTables: Record<string, PositionedTable[]>;
  setVenueTables: (tables: Record<string, PositionedTable[]>) => void;
  venueConfigurations: VenueConfig[];
  setVenueConfigurations: (configs: VenueConfig[]) => void;
  selectedVenueConfigId: string;
  setSelectedVenueConfigId: (id: string) => void;
  /** CAD annotations keyed by venueConfigId. */
  venueAnnotations: Record<string, VenueAnnotation[]>;
  setVenueAnnotations: (a: Record<string, VenueAnnotation[]>) => void;
  venueRef: React.RefObject<HTMLDivElement>;
  venueLayoutImages: Record<string, string>;
  setVenueLayoutImages: (images: Record<string, string>) => void;
  speakerSlotTemplates: any[];
  venueSpeakerZones: Record<string, any[]>;
  setVenueSpeakerZones: (zones: Record<string, any[]>) => void;
  roundTableTemplates: RoundTableTemplate[];
  venueRoundTables: Record<string, PositionedRoundTable[]>;
  setVenueRoundTables: (tables: Record<string, PositionedRoundTable[]>) => void;
  venueDoors: Record<string, PositionedDoor[]>;
  setVenueDoors: (doors: Record<string, PositionedDoor[]>) => void;
  /** Booked-stall lookup (positionId → vendor + add-ons). Used to render
   *  small colored dots on each booked stall and a hover popover that lists
   *  the add-ons the vendor purchased. Empty in create mode. */
  stallBookings?: Record<
    string,
    {
      vendorName: string;
      vendorEmail?: string;
      addOns: { id: string; name: string; quantity: number }[];
    }
  >;
  /** Event-level add-ons (id → color/name). Used to color the dots. */
  addOnItems?: AddOnItem[];
}

// Wraps the venue design surface. When `active`, it renders full-screen
// through a portal to <body> so the overlay escapes the Create-Event
// dialog's transform/overflow-hidden context (a `position: fixed` element
// is otherwise trapped inside the dialog box and never fills the viewport).
// When inactive it renders inline exactly as before.
const MaximizableSurface = ({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) => {
  if (active) {
    return createPortal(
      // pointer-events-auto: a modal Radix dialog sets `pointer-events: none`
      // on <body>; without this the portaled overlay would inherit it and be
      // unclickable.
      <div className="fixed inset-0 z-[100] bg-white overflow-auto p-4 space-y-4 pointer-events-auto">
        {children}
      </div>,
      document.body,
    );
  }
  return <div className="space-y-4">{children}</div>;
};

// Floating action button the organizer can reposition by pressing and
// dragging, so it never blocks part of the grid. A plain click (no drag)
// fires onClick. Used in the maximized venue designer to open the template
// list. Rendered inside the (portaled) full-screen surface, so `fixed`
// positioning is relative to the viewport.
const DraggableFab = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => {
  const [pos, setPos] = useState(() => ({
    x: typeof window !== "undefined" ? window.innerWidth - 184 : 24,
    y: typeof window !== "undefined" ? window.innerHeight - 88 : 24,
  }));
  const drag = useRef({
    active: false,
    moved: false,
    offX: 0,
    offY: 0,
    startX: 0,
    startY: 0,
  });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current.active) return;
      // Only treat it as a move (vs a click) once it passes a small threshold.
      if (
        Math.abs(e.clientX - drag.current.startX) +
          Math.abs(e.clientY - drag.current.startY) >
        4
      ) {
        drag.current.moved = true;
      }
      const x = Math.max(
        8,
        Math.min(e.clientX - drag.current.offX, window.innerWidth - 64),
      );
      const y = Math.max(
        8,
        Math.min(e.clientY - drag.current.offY, window.innerHeight - 56),
      );
      setPos({ x, y });
    };
    const onUp = () => {
      drag.current.active = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        drag.current = {
          active: true,
          moved: false,
          offX: e.clientX - pos.x,
          offY: e.clientY - pos.y,
          startX: e.clientX,
          startY: e.clientY,
        };
      }}
      onClick={() => {
        // Suppress the click that ends a drag — only a genuine tap opens it.
        if (!drag.current.moved) onClick();
      }}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 112 }}
      className="flex cursor-grab select-none items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-2xl hover:bg-indigo-700 active:cursor-grabbing"
      title="Click to add spaces · press and drag to move this button"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
  );
};

// Hosts the venue template list. Inline (its normal bar) when the designer is
// in standard mode; inside a lightweight centered modal when the canvas is
// maximized — so full-screen mode shows only the grid until the organizer taps
// the floating button. The modal lives inside the full-screen surface, so its
// z-index sits above the grid without fighting the dialog stack.
const TemplatesHost = ({
  maximized,
  open,
  onClose,
  children,
}: {
  maximized: boolean;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) => {
  if (!maximized) return <>{children}</>;
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[115] flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="mt-10 w-full max-w-3xl rounded-xl bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold">Add to venue</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const VenueDesigner = ({
  tableTemplates,
  venueTables,
  setVenueTables,
  venueConfigurations,
  setVenueConfigurations,
  selectedVenueConfigId,
  setSelectedVenueConfigId,
  venueAnnotations,
  setVenueAnnotations,
  venueRef,
  venueLayoutImages,
  setVenueLayoutImages,
  speakerSlotTemplates,
  venueSpeakerZones,
  setVenueSpeakerZones,
  roundTableTemplates,
  venueRoundTables,
  setVenueRoundTables,
  venueDoors,
  setVenueDoors,
  stallBookings,
  addOnItems,
}: VenueDesignerProps) => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  // --- CAD annotation tool state ---
  const [annotationTool, setAnnotationTool] = useState<AnnotationTool>("none");
  const [annotationColor, setAnnotationColor] = useState("#1e293b");
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);

  // --- Unified undo (Ctrl/Cmd+Z) ----------------------------------------
  // ONE history stack covering every kind of canvas edit: placing / moving /
  // resizing / deleting / duplicating Spaces, round tables, speaker zones and
  // doors, AND the AutoCAD annotation drawings (line / arrow / box /
  // dimension). Each discrete edit commits a fresh snapshot of all of these
  // collections (drags commit once on drop, so a move is a single entry), and
  // Ctrl+Z pops back to the previous snapshot.
  const undoStackRef = useRef<
    Array<{
      venueTables: Record<string, PositionedTable[]>;
      venueRoundTables: Record<string, PositionedRoundTable[]>;
      venueSpeakerZones: Record<string, any[]>;
      venueDoors: Record<string, PositionedDoor[]>;
      venueAnnotations: Record<string, VenueAnnotation[]>;
    }>
  >([]);
  // Set while applying an undo so the recording effect below doesn't capture
  // the restored state as a brand-new edit.
  const isRestoringRef = useRef(false);
  // Drives the toolbar Undo button's enabled state.
  const [undoDepth, setUndoDepth] = useState(0);

  useEffect(() => {
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    undoStackRef.current.push({
      venueTables,
      venueRoundTables,
      venueSpeakerZones,
      venueDoors,
      venueAnnotations,
    });
    // Keep memory bounded — 60 steps of history is plenty.
    if (undoStackRef.current.length > 60) undoStackRef.current.shift();
    setUndoDepth(undoStackRef.current.length);
  }, [
    venueTables,
    venueRoundTables,
    venueSpeakerZones,
    venueDoors,
    venueAnnotations,
  ]);

  const undoLastChange = () => {
    // Need the current snapshot plus at least one prior to step back.
    if (undoStackRef.current.length <= 1) {
      toast({ title: "Nothing to undo" });
      return;
    }
    undoStackRef.current.pop(); // drop the current state
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    isRestoringRef.current = true;
    setVenueTables(prev.venueTables);
    setVenueRoundTables(prev.venueRoundTables);
    setVenueSpeakerZones(prev.venueSpeakerZones);
    setVenueDoors(prev.venueDoors);
    setVenueAnnotations(prev.venueAnnotations);
    setSelectedTable(null);
    setSelectedAnnId(null);
    setUndoDepth(undoStackRef.current.length);
  };
  // Eventfront-style preview modal + a ref to the preview "sheet" so we can
  // rasterise it to a PDF.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  // Collapsible "Click to add to venue" palette — open by default; the
  // organizer can hide the whole list of spaces/templates when they just
  // want the canvas, then re-open it to add more.
  const [spacesListOpen, setSpacesListOpen] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);
  // Live crop/resize drag of the venue boundary (drag the bottom-right
  // handle to set how big the venue area is).
  const [canvasResize, setCanvasResize] = useState<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    w: number;
    h: number;
  } | null>(null);
  const canvasResizeRef = useRef<typeof canvasResize>(null);
  canvasResizeRef.current = canvasResize;
  // Live position of the item being dragged. Updated every frame during a drag
  // so only THIS component re-renders — the final position is committed to the
  // parent's venue state once on drop. This keeps dragging smooth instead of
  // re-rendering the whole (very large) event form on every mouse move.
  const [dragPreview, setDragPreview] = useState<{
    key: string;
    x: number;
    y: number;
  } | null>(null);
  const dragPreviewRef = useRef<typeof dragPreview>(null);
  dragPreviewRef.current = dragPreview;
  // Live resize state for placed Spaces. Mirrors the dragPreview model:
  // we mutate this on every mouse-move frame for a smooth visual, then
  // commit the final width/height/x/y to the parent collection on mouse-up.
  const [resize, setResize] = useState<{
    positionId: string;
    // 8 handles — 4 corners + 4 mid-edges so the stall can be reshaped
    // from any side.
    handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
    startMouseX: number;
    startMouseY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    // Rotation (deg) of the item being resized, so the drag math can map the
    // screen-space mouse delta into the item's own (unrotated) axes.
    rotation?: number;
    // Live (in-progress) values shown until commit.
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const resizeRef = useRef<typeof resize>(null);
  resizeRef.current = resize;
  const [aiOpen, setAiOpen] = useState(false);
  const [isCanvasMaximized, setIsCanvasMaximized] = useState(false);
  // Whether the floating "Add to venue" template modal is open (maximized mode).
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);

  // Always points at the latest processDragMove closure, so the window-level
  // drag listener (attached once when a drag starts) reads fresh state without
  // having to re-subscribe on every position change.
  const processDragMoveRef = useRef<(clientX: number, clientY: number) => void>(
    () => {},
  );
  // Latest commit-on-drop closure, called once when a drag ends.
  const commitDragRef = useRef<() => void>(() => {});

  // Dynamic exhibitor-category pool — same `/categories` collection the
  // Event Category multi-select uses. Loaded once on mount and kept in
  // sync as the organizer (or any exhibitor) adds new categories
  // elsewhere in the app. Empty selection on a placed space means "open
  // to every category".
  const [exhibitorCategoryOptions, setExhibitorCategoryOptions] = useState<
    string[]
  >([
    "Technology",
    "Music",
    "Food",
    "Sports",
    "Arts",
    "Fashion",
    "Electronics",
  ]);
  const [newExhibitorCategoryInput, setNewExhibitorCategoryInput] =
    useState("");
  const [addingExhibitorCategory, setAddingExhibitorCategory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${__API_URL__}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        const names: string[] = Array.isArray(data)
          ? data
              .map((c: any) => c?.name)
              .filter((n: any) => typeof n === "string")
          : [];
        if (cancelled || names.length === 0) return;
        setExhibitorCategoryOptions((prev) => {
          const seen = new Set(prev.map((c) => c.toLowerCase()));
          const extras = names.filter((n) => !seen.has(n.toLowerCase()));
          return extras.length ? [...prev, ...extras] : prev;
        });
      } catch {
        // non-fatal — baseline options still usable offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddExhibitorCategory = async (
    onAdded?: (name: string) => void,
  ) => {
    const name = newExhibitorCategoryInput.trim();
    if (!name || addingExhibitorCategory) return;
    const existing = exhibitorCategoryOptions.find(
      (c) => c.toLowerCase() === name.toLowerCase(),
    );
    const canonical = existing || name;
    setAddingExhibitorCategory(true);
    try {
      if (!existing) {
        try {
          const token = sessionStorage.getItem("token");
          await fetch(`${__API_URL__}/categories`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ name }),
          });
        } catch {
          // non-fatal — keep it local even if persist fails
        }
        setExhibitorCategoryOptions((prev) => [...prev, name]);
      }
      onAdded?.(canonical);
      setNewExhibitorCategoryInput("");
    } finally {
      setAddingExhibitorCategory(false);
    }
  };

  // Lock body scroll while the canvas is maximized so background doesn't slide.
  // Also let Escape exit full-screen, matching common dialog conventions.
  useEffect(() => {
    if (!isCanvasMaximized) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsCanvasMaximized(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isCanvasMaximized]);
  const { country } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);

  // Get current config
  const venueConfig =
    venueConfigurations.find((vc) => vc.id === selectedVenueConfigId) ||
    venueConfigurations[0];

  const currentTables = venueTables[selectedVenueConfigId] || [];
  const currentSpeakerZones = venueSpeakerZones[selectedVenueConfigId] || [];
  const currentRoundTables = venueRoundTables[selectedVenueConfigId] || [];
  const currentDoors = venueDoors[selectedVenueConfigId] || [];
  const currentAnnotations = venueAnnotations[selectedVenueConfigId] || [];

  // Replace the current layout's annotation list.
  const updateAnnotations = (next: VenueAnnotation[]) => {
    setVenueAnnotations({
      ...venueAnnotations,
      [selectedVenueConfigId]: next,
    });
  };

  // Update fields on the selected venue config (used by the crop handle).
  const patchVenueConfig = (updates: Partial<VenueConfig>) => {
    setVenueConfigurations(
      venueConfigurations.map((vc) =>
        vc.id === selectedVenueConfigId ? { ...vc, ...updates } : vc,
      ),
    );
  };

  // Crop/resize the venue boundary by dragging the bottom-right handle.
  // Listeners attach once per drag; geometry is read from the ref so we
  // never re-bind mid-drag. Committed to venueConfig.width/height on mouse-up.
  const isResizingCanvas = canvasResize !== null;
  useEffect(() => {
    if (!isResizingCanvas) return;
    const onMove = (e: MouseEvent) => {
      const r = canvasResizeRef.current;
      const sc = venueConfig?.scale || 1;
      if (!r) return;
      const dw = (e.clientX - r.startX) / sc;
      const dh = (e.clientY - r.startY) / sc;
      setCanvasResize({
        ...r,
        w: Math.max(200, Math.round(r.origW + dw)),
        h: Math.max(200, Math.round(r.origH + dh)),
      });
    };
    const onUp = () => {
      const r = canvasResizeRef.current;
      // Commit to the SEPARATE crop fields — never the real width/height.
      if (r)
        patchVenueConfig({
          cropWidth: r.w,
          cropHeight: r.h,
          cropped: true,
        });
      setCanvasResize(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizingCanvas]);

  // Designer canvas size — the canvas IS the venue. It starts at the
  // configured venue dimensions and grows ONLY to contain the spaces /
  // round tables / zones / doors actually placed (plus a small working
  // margin so a new item can be dropped near the edge). No giant fixed
  // floor — an empty venue shows a tight grid, not an endless sheet.
  const CANVAS_MIN_W = Math.max(
    600,
    venueConfig?.width || 1000,
    venueConfig?.cropWidth || 0,
  );
  const CANVAS_MIN_H = Math.max(
    400,
    venueConfig?.height || 700,
    venueConfig?.cropHeight || 0,
  );
  const currentItemsForCanvas =
    (selectedVenueConfigId && venueTables[selectedVenueConfigId]) || [];
  const currentRoundsForCanvas =
    (selectedVenueConfigId && venueRoundTables[selectedVenueConfigId]) || [];
  const currentZonesForCanvas =
    (selectedVenueConfigId && venueSpeakerZones[selectedVenueConfigId]) || [];
  const currentDoorsForCanvas =
    (selectedVenueConfigId && venueDoors[selectedVenueConfigId]) || [];
  // Ignore stray items dragged absurdly far out (a known data glitch) so a
  // single bad coordinate can't inflate the canvas into endless empty grid.
  const OUTLIER_X = Math.max((venueConfig?.width || 1000) * 5, 6000);
  const OUTLIER_Y = Math.max((venueConfig?.height || 700) * 5, 6000);
  let itemsMaxX = 0;
  let itemsMaxY = 0;
  const growX = (v: number) => {
    if (v <= OUTLIER_X) itemsMaxX = Math.max(itemsMaxX, v);
  };
  const growY = (v: number) => {
    if (v <= OUTLIER_Y) itemsMaxY = Math.max(itemsMaxY, v);
  };
  for (const t of currentItemsForCanvas) {
    const w = (t as any).displayWidth ?? t.width ?? 0;
    const h = (t as any).displayHeight ?? t.height ?? 0;
    growX((t.x || 0) + w);
    growY((t.y || 0) + h);
  }
  for (const r of currentRoundsForCanvas) {
    const d = (r as any).tableDiameter || 120;
    growX((r.x || 0) + d);
    growY((r.y || 0) + d);
  }
  for (const z of currentZonesForCanvas as any[]) {
    growX((z.x || 0) + (z.width || 0));
    growY((z.y || 0) + (z.height || 0));
  }
  for (const d of currentDoorsForCanvas as any[]) {
    const dw = Number(d.width) > 0 ? Number(d.width) : 50;
    const dh = Number(d.height) > 0 ? Number(d.height) : 50;
    growX((d.x || 0) + dw);
    growY((d.y || 0) + dh);
  }
  // Small working margin past the furthest-placed item so there's room to
  // drop / nudge the next space. The canvas grows by this much beyond the
  // content — it does NOT pre-inflate with a big empty buffer.
  const ITEMS_MARGIN = 160;
  const canvasW = Math.max(CANVAS_MIN_W, itemsMaxX + ITEMS_MARGIN);
  const canvasH = Math.max(CANVAS_MIN_H, itemsMaxY + ITEMS_MARGIN);

  const applyAILayout = (result: {
    positionedTables: PositionedTable[];
    positionedRoundTables: PositionedRoundTable[];
    positionedSpeakerZones: any[];
  }) => {
    if (!venueConfig) return;
    setVenueTables({
      ...venueTables,
      [selectedVenueConfigId]: result.positionedTables.map((t) => ({
        ...t,
        venueConfigId: selectedVenueConfigId,
      })) as PositionedTable[],
    });
    setVenueRoundTables({
      ...venueRoundTables,
      [selectedVenueConfigId]: result.positionedRoundTables.map((rt) => ({
        ...rt,
        venueConfigId: selectedVenueConfigId,
      })) as PositionedRoundTable[],
    });
    setVenueSpeakerZones({
      ...venueSpeakerZones,
      [selectedVenueConfigId]: result.positionedSpeakerZones.map((z) => ({
        ...z,
        venueConfigId: selectedVenueConfigId,
      })),
    });
  };

  // --- Actions ---

  // Add an entrance/exit door to the current venue. Multiple per type allowed.
  // Shape defaults to whatever was picked in Venue Setup (circle if unset).
  // Square doors spawn wider than tall so they look like a doorway, not a
  // box; the organizer can then drag the 8 resize handles to match the
  // real opening.
  const addDoorToVenue = (
    type: "entrance" | "exit" | "custom",
    customType?: {
      id: string;
      label: string;
      shape: "circle" | "square";
      color?: string;
    },
  ) => {
    if (!venueConfig) return;
    const existing = currentDoors.filter((d) =>
      type === "custom" ? d.customTypeId === customType?.id : d.type === type,
    ).length;
    const shape: "circle" | "square" =
      type === "custom"
        ? customType?.shape || "circle"
        : (type === "entrance"
            ? venueConfig.entranceShape
            : venueConfig.exitShape) || "circle";
    const width = shape === "square" ? 80 : 50;
    const height = shape === "square" ? 40 : 50;
    const baseLabel =
      type === "entrance"
        ? "IN"
        : type === "exit"
          ? "OUT"
          : (customType?.label || "DOOR").toUpperCase().slice(0, 8);
    const newDoor: PositionedDoor = {
      id: Math.random().toString(36).slice(2, 15),
      type,
      customTypeId: type === "custom" ? customType?.id : undefined,
      color: type === "custom" ? customType?.color : undefined,
      shape,
      width,
      height,
      rotation: 0,
      label: `${baseLabel}${existing > 0 ? " " + (existing + 1) : ""}`,
      x:
        type === "exit"
          ? venueConfig.width - width - 40 - existing * 30
          : 50 + existing * 30,
      y: venueConfig.height / 2,
    };
    setVenueDoors({
      ...venueDoors,
      [selectedVenueConfigId]: [...currentDoors, newDoor],
    });
    setSelectedTable("door-" + newDoor.id);
  };

  const removeDoorFromVenue = (id: string) => {
    setVenueDoors({
      ...venueDoors,
      [selectedVenueConfigId]: currentDoors.filter((d) => d.id !== id),
    });
    setSelectedTable(null);
  };

  const rotateDoor = (id: string) => {
    setVenueDoors({
      ...venueDoors,
      [selectedVenueConfigId]: currentDoors.map((d) =>
        d.id === id ? { ...d, rotation: ((d.rotation || 0) + 90) % 360 } : d,
      ),
    });
  };

  const addTableToVenue = (template: TableTemplate) => {
    if (!venueConfig) return;
    const newTable: PositionedTable = {
      ...template,
      positionId: Math.random().toString(36).slice(2, 15),
      x: (venueConfig.width - template.width) / 2,
      y: (venueConfig.height - template.height) / 2,
      rotation: 0,
      isPlaced: true,
    };

    setVenueTables({
      ...venueTables,
      [selectedVenueConfigId]: [...currentTables, newTable],
    });

    setSelectedTable(newTable.positionId);

    toast({
      title: "Table Added",
      description: `${template.name} added to ${venueConfig.name}`,
    });
  };

  const handleUpdateTable = (
    positionId: string,
    updates: Partial<PositionedTable>,
  ) => {
    const updatedTables = currentTables.map((t) =>
      t.positionId === positionId ? { ...t, ...updates } : t,
    );
    setVenueTables({
      ...venueTables,
      [selectedVenueConfigId]: updatedTables,
    });
  };

  const removeTableFromVenue = (positionId: string) => {
    const updatedTables = currentTables.filter(
      (t) => t.positionId !== positionId,
    );
    setVenueTables({
      ...venueTables,
      [selectedVenueConfigId]: updatedTables,
    });
    setSelectedTable(null);
  };

  // Clone the currently selected space (or a specific positionId) and
  // drop the copy a few units down-right of the original. Carries every
  // template + resize-override property so the duplicate is visually
  // identical to the source — including any custom `displayWidth` /
  // `displayHeight` the corner-resize handles wrote. Booking state is
  // reset on the copy so a duplicate of a booked stall doesn't claim
  // someone else's vendor.
  const duplicateTable = (positionId?: string) => {
    const targetId = positionId || selectedTable;
    if (!targetId || !venueConfig) return;
    const original = currentTables.find((t) => t.positionId === targetId);
    if (!original) return;
    const w = original.displayWidth ?? original.width;
    const h = original.displayHeight ?? original.height;
    const OFFSET = 24;
    // Place the copy down-right of the original; clamp inside canvas
    // bounds so it can't land off-screen on small layouts.
    let nx = original.x + OFFSET;
    let ny = original.y + OFFSET;
    if (nx + w > canvasW) nx = Math.max(0, canvasW - w);
    if (ny + h > canvasH) ny = Math.max(0, canvasH - h);
    const newTable: PositionedTable = {
      ...original,
      positionId: Math.random().toString(36).slice(2, 15),
      x: nx,
      y: ny,
      isBooked: false,
      bookedBy: undefined,
    };
    setVenueTables({
      ...venueTables,
      [selectedVenueConfigId]: [...currentTables, newTable],
    });
    setSelectedTable(newTable.positionId);
    toast({
      title: "Space duplicated",
      description: `Cloned "${original.name}" — drag to reposition.`,
    });
  };

  // Clone the selected round table (or a specific positionId) a few units
  // down-right of the original. Carries every property — including the
  // resized `tableDiameter` — so the copy is visually identical. Booking
  // state (bookedChairs / isFullyBooked) is reset so the copy starts fully
  // available. Mirrors duplicateTable for Spaces.
  const duplicateRoundTable = (positionId?: string) => {
    const targetId = (positionId || selectedTable || "").replace(/^rt-/, "");
    if (!targetId || !venueConfig) return;
    const original = currentRoundTables.find((r) => r.positionId === targetId);
    if (!original) return;
    const size = original.tableDiameter || 120;
    const OFFSET = 24;
    let nx = original.x + OFFSET;
    let ny = original.y + OFFSET;
    if (nx + size > canvasW) nx = Math.max(0, canvasW - size);
    if (ny + size > canvasH) ny = Math.max(0, canvasH - size);
    const newRT: PositionedRoundTable = {
      ...original,
      positionId: Math.random().toString(36).slice(2, 15),
      x: nx,
      y: ny,
      bookedChairs: [],
      isFullyBooked: false,
    };
    setVenueRoundTables({
      ...venueRoundTables,
      [selectedVenueConfigId]: [...currentRoundTables, newRT],
    });
    setSelectedTable(`rt-${newRT.positionId}`);
    toast({
      title: "Round table duplicated",
      description: `Cloned "${original.name}" — drag to reposition.`,
    });
  };

  // Keyboard shortcut: Ctrl/Cmd + D duplicates the selected space.
  // We skip when focus is inside a text field so the shortcut doesn't
  // hijack the browser's "Add Bookmark" behaviour AND doesn't fire
  // while the organizer is editing a field name / price.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      // Ctrl/Cmd+Z → undo the last canvas edit (spaces OR annotations).
      // Shift+Z is left alone (no redo) so it can't clobber anything.
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undoLastChange();
        return;
      }
      if (e.key.toLowerCase() === "d") {
        if (!selectedTable) return;
        // Round tables have their own placement collection — duplicate via
        // the dedicated handler.
        if (selectedTable.startsWith("rt-")) {
          e.preventDefault();
          duplicateRoundTable();
          return;
        }
        // Speaker zones / doors aren't wired for duplication yet — skip
        // silently when the selected item isn't a Space.
        if (
          selectedTable.startsWith("sz-") ||
          selectedTable.startsWith("door-")
        ) {
          return;
        }
        e.preventDefault();
        duplicateTable();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTable, currentTables, currentRoundTables, canvasW, canvasH]);

  const rotateTable = (positionId: string) => {
    const table = currentTables.find((t) => t.positionId === positionId);
    if (table) {
      handleUpdateTable(positionId, { rotation: (table.rotation + 90) % 360 });
    }
  };

  const addSpeakerZoneToVenue = (template: any) => {
    if (!venueConfig) return;
    const newZone = {
      ...template,
      templateId: template.id,
      positionId: Math.random().toString(36).slice(2, 15),
      x: 50,
      y: template.isMainStage ? 10 : (venueConfig.height - template.height) / 2,
      rotation: 0,
      isPlaced: true,
      venueConfigId: selectedVenueConfigId,
    };
    setVenueSpeakerZones({
      ...venueSpeakerZones,
      [selectedVenueConfigId]: [...currentSpeakerZones, newZone],
    });
    toast({
      title: "Speaker Zone Added",
      description: `${template.name} added to ${venueConfig.name}`,
    });
  };

  const removeSpeakerZone = (positionId: string) => {
    setVenueSpeakerZones({
      ...venueSpeakerZones,
      [selectedVenueConfigId]: currentSpeakerZones.filter(
        (z) => z.positionId !== positionId,
      ),
    });
    setSelectedTable(null);
  };

  const handleSpeakerZoneMouseDown = (e: React.MouseEvent, zone: any) => {
    const containerRect = venueRef.current?.getBoundingClientRect();
    if (!containerRect || !venueConfig) return;
    setDragOffset({
      x: e.clientX - containerRect.left - zone.x * venueConfig.scale,
      y: e.clientY - containerRect.top - zone.y * venueConfig.scale,
    });
    setSelectedTable(`sz-${zone.positionId}`);
    setIsDragging(true);
  };

  // --- Round Table Actions ---
  const addRoundTableToVenue = (template: RoundTableTemplate) => {
    if (!venueConfig) return;
    const diameter = template.tableDiameter || 120;
    const newRT: PositionedRoundTable = {
      ...template,
      positionId: Math.random().toString(36).slice(2, 15),
      templateId: template.id,
      x: (venueConfig.width - diameter) / 2,
      y: (venueConfig.height - diameter) / 2,
      rotation: 0,
      isPlaced: true,
      venueConfigId: selectedVenueConfigId,
      bookedChairs: [],
      isFullyBooked: false,
    };
    setVenueRoundTables({
      ...venueRoundTables,
      [selectedVenueConfigId]: [...currentRoundTables, newRT],
    });
    setSelectedTable(`rt-${newRT.positionId}`);
    toast({
      title: "Round Table Added",
      description: `${template.name} added to ${venueConfig.name}`,
    });
  };

  const removeRoundTable = (positionId: string) => {
    setVenueRoundTables({
      ...venueRoundTables,
      [selectedVenueConfigId]: currentRoundTables.filter(
        (rt) => rt.positionId !== positionId,
      ),
    });
    setSelectedTable(null);
  };

  const handleRoundTableMouseDown = (
    e: React.MouseEvent,
    rt: PositionedRoundTable,
  ) => {
    const containerRect = venueRef.current?.getBoundingClientRect();
    if (!containerRect || !venueConfig) return;
    setDragOffset({
      x: e.clientX - containerRect.left - rt.x * venueConfig.scale,
      y: e.clientY - containerRect.top - rt.y * venueConfig.scale,
    });
    setSelectedTable(`rt-${rt.positionId}`);
    setIsDragging(true);
  };

  // --- Drag & Drop Logic ---

  const handleMouseDown = (e: React.MouseEvent, table: PositionedTable) => {
    const containerRect = venueRef.current?.getBoundingClientRect();
    if (!containerRect || !venueConfig) return;

    setDragOffset({
      x: e.clientX - containerRect.left - table.x * venueConfig.scale,
      y: e.clientY - containerRect.top - table.y * venueConfig.scale,
    });

    setSelectedTable(table.positionId);
    setIsDragging(true);
  };

  // Compute the clamped logical position for the item currently being dragged
  // and stash it in local `dragPreview` state. This does NOT touch the parent
  // venue collections — that happens once on drop (commitDrag) — so dragging
  // re-renders only the designer, keeping it smooth.
  const processDragMove = (clientX: number, clientY: number) => {
    if (!selectedTable || !venueConfig) return;
    const rect = venueRef.current?.getBoundingClientRect();
    if (!rect) return;

    // The item's footprint, used to clamp it inside the venue bounds.
    let w = 0;
    let h = 0;
    if (selectedTable.startsWith("door-")) {
      const door = currentDoors.find(
        (d) => d.id === selectedTable.replace("door-", ""),
      );
      // Default 50×50 keeps legacy circles working when width/height are
      // absent on older saved data. Square doors carry their own size.
      w = door?.width ?? 50;
      h = door?.height ?? 50;
    } else if (selectedTable.startsWith("rt-")) {
      const rt = currentRoundTables.find(
        (r) => r.positionId === selectedTable.replace("rt-", ""),
      );
      if (!rt) return;
      w = h = rt.tableDiameter || 120;
    } else if (selectedTable.startsWith("sz-")) {
      const zone = currentSpeakerZones.find(
        (z) => z.positionId === selectedTable.replace("sz-", ""),
      );
      if (!zone) return;
      w = zone.width;
      h = zone.height;
    } else {
      const table = currentTables.find((t) => t.positionId === selectedTable);
      if (!table) return;
      // Use the resize override when present so a previously-resized
      // stall is clamped to its current visual footprint, not the
      // template's original dimensions.
      w = table.displayWidth ?? table.width;
      h = table.displayHeight ?? table.height;
    }

    const newX = Math.max(
      0,
      Math.min(
        (clientX - rect.left - dragOffset.x) / venueConfig.scale,
        canvasW - w,
      ),
    );
    const newY = Math.max(
      0,
      Math.min(
        (clientY - rect.top - dragOffset.y) / venueConfig.scale,
        canvasH - h,
      ),
    );
    setDragPreview({ key: selectedTable, x: newX, y: newY });
  };

  // Commit the final dragged position to the appropriate parent collection.
  // Called once on mouse-up so the canonical venue state stays in sync without
  // paying a full re-render on every frame.
  const commitDrag = () => {
    const preview = dragPreviewRef.current;
    if (!preview) return;
    const { key, x, y } = preview;
    if (key.startsWith("door-")) {
      const doorId = key.replace("door-", "");
      setVenueDoors({
        ...venueDoors,
        [selectedVenueConfigId]: currentDoors.map((d) =>
          d.id === doorId ? { ...d, x, y } : d,
        ),
      });
    } else if (key.startsWith("rt-")) {
      const rtId = key.replace("rt-", "");
      setVenueRoundTables({
        ...venueRoundTables,
        [selectedVenueConfigId]: currentRoundTables.map((r) =>
          r.positionId === rtId ? { ...r, x, y } : r,
        ),
      });
    } else if (key.startsWith("sz-")) {
      const zoneId = key.replace("sz-", "");
      setVenueSpeakerZones({
        ...venueSpeakerZones,
        [selectedVenueConfigId]: currentSpeakerZones.map((z) =>
          z.positionId === zoneId ? { ...z, x, y } : z,
        ),
      });
    } else {
      handleUpdateTable(key, { x, y });
    }
    setDragPreview(null);
  };

  // Keep the refs pointing at the freshest closures every render.
  processDragMoveRef.current = processDragMove;
  commitDragRef.current = commitDrag;

  // Returns the position to render an item at: the live drag preview while it's
  // the one being dragged, otherwise its committed position.
  const livePos = (key: string, x: number, y: number) =>
    dragPreview && dragPreview.key === key
      ? { x: dragPreview.x, y: dragPreview.y }
      : { x, y };

  // Resize-handle mousedown — captures the table's original geometry so the
  // window-level mousemove can compute new dims without re-reading state.
  // Stops propagation so the underlying drag handler doesn't also fire.
  const beginResize = (
    e: React.MouseEvent,
    table: PositionedTable,
    handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedTable(table.positionId);
    // Resume from the current display override if there is one — so
    // dragging a handle on a previously-resized stall starts from
    // where it currently looks, not from the template's original size.
    const curW = table.displayWidth ?? table.width;
    const curH = table.displayHeight ?? table.height;
    setResize({
      positionId: table.positionId,
      handle,
      rotation: table.rotation || 0,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX: table.x,
      origY: table.y,
      origW: curW,
      origH: curH,
      x: table.x,
      y: table.y,
      w: curW,
      h: curH,
    });
  };

  // Per-frame resize update — translates mouse delta into logical-unit
  // delta (1 / scale), applies it to the appropriate edge(s) for the
  // dragged handle, and clamps to a 20-unit minimum so the stall can't
  // be made unusably small. Edge handles (n/e/s/w) move ONE dimension;
  // corner handles (nw/ne/sw/se) move BOTH.
  const processResizeMove = (clientX: number, clientY: number) => {
    const r = resizeRef.current;
    if (!r || !venueConfig) return;
    const dx = (clientX - r.startMouseX) / venueConfig.scale;
    const dy = (clientY - r.startMouseY) / venueConfig.scale;
    const MIN = 20;
    // Round tables stay circular — a single SE handle grows/shrinks the
    // diameter (kept square) while the top-left stays anchored.
    if (r.positionId.startsWith("rt-")) {
      const delta = Math.max(dx, dy);
      let size = Math.max(MIN, r.origW + delta);
      size = Math.min(size, canvasW - r.origX, canvasH - r.origY);
      setResize({ ...r, x: r.origX, y: r.origY, w: size, h: size });
      return;
    }
    const handle = r.handle;
    // The space is rendered with `transform: rotate(θ)` around its center, so
    // a handle the user grabs is visually rotated. Map the screen-space mouse
    // delta into the space's OWN (unrotated) axes so dragging an edge always
    // resizes the dimension that edge actually represents — then move the
    // rotation centre so the edge OPPOSITE the handle stays put on screen.
    const th = (((r.rotation || 0) % 360) * Math.PI) / 180;
    const cos = Math.cos(th);
    const sin = Math.sin(th);
    // screen delta → local delta  (rotate by -θ)
    const ldx = dx * cos + dy * sin;
    const ldy = -dx * sin + dy * cos;

    let w = r.origW;
    let h = r.origH;
    if (handle === "ne" || handle === "e" || handle === "se") {
      w = Math.max(MIN, r.origW + ldx);
    }
    if (handle === "nw" || handle === "w" || handle === "sw") {
      w = Math.max(MIN, r.origW - ldx);
    }
    if (handle === "sw" || handle === "s" || handle === "se") {
      h = Math.max(MIN, r.origH + ldy);
    }
    if (handle === "nw" || handle === "n" || handle === "ne") {
      h = Math.max(MIN, r.origH - ldy);
    }

    // Keep the opposite edge anchored: shift the centre by half the size
    // change, in the direction of the moved edge, expressed in local axes…
    const dw = w - r.origW;
    const dh = h - r.origH;
    let shiftLX = 0;
    let shiftLY = 0;
    if (handle === "ne" || handle === "e" || handle === "se") shiftLX = dw / 2;
    if (handle === "nw" || handle === "w" || handle === "sw") shiftLX = -dw / 2;
    if (handle === "sw" || handle === "s" || handle === "se") shiftLY = dh / 2;
    if (handle === "nw" || handle === "n" || handle === "ne") shiftLY = -dh / 2;
    // …then rotate that centre shift back into screen axes (rotate by +θ).
    const cx = r.origX + r.origW / 2 + (shiftLX * cos - shiftLY * sin);
    const cy = r.origY + r.origH / 2 + (shiftLX * sin + shiftLY * cos);
    let x = cx - w / 2;
    let y = cy - h / 2;

    // Keep the (unrotated) box within the canvas extents. For θ = 0 this is
    // identical to the original clamp; for rotated items it's an approximation
    // that simply prevents the stored box from running off-canvas.
    if (x < 0) {
      w += x;
      x = 0;
    }
    if (y < 0) {
      h += y;
      y = 0;
    }
    if (x + w > canvasW) w = canvasW - x;
    if (y + h > canvasH) h = canvasH - y;
    setResize({ ...r, x, y, w, h });
  };

  // Begin a resize on a placed door. Mirrors beginResize but seeds from
  // door.width/height instead of the Space's displayWidth/displayHeight.
  // The shared processResizeMove handles the drag math identically; the
  // commit path branches in commitResize based on the positionId prefix.
  const beginDoorResize = (
    e: React.MouseEvent,
    door: PositionedDoor,
    handle: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const positionId = "door-" + door.id;
    setSelectedTable(positionId);
    const curW = door.width ?? 50;
    const curH = door.height ?? 50;
    setResize({
      positionId,
      handle,
      rotation: door.rotation || 0,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX: door.x,
      origY: door.y,
      origW: curW,
      origH: curH,
      x: door.x,
      y: door.y,
      w: curW,
      h: curH,
    });
  };

  // Begin a circular resize on a placed round table. Seeds the shared
  // resize state from the table's current diameter; processResizeMove has a
  // dedicated rt- branch that keeps width == height, and commitResize writes
  // the result back to tableDiameter.
  const beginRoundTableResize = (
    e: React.MouseEvent,
    rt: PositionedRoundTable,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const positionId = "rt-" + rt.positionId;
    setSelectedTable(positionId);
    const size = rt.tableDiameter || 120;
    setResize({
      positionId,
      handle: "se",
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX: rt.x,
      origY: rt.y,
      origW: size,
      origH: size,
      x: rt.x,
      y: rt.y,
      w: size,
      h: size,
    });
  };

  const commitResize = () => {
    const r = resizeRef.current;
    if (!r) return;
    // Round-table resize commits the new diameter (kept circular).
    if (r.positionId.startsWith("rt-")) {
      const rtId = r.positionId.replace("rt-", "");
      setVenueRoundTables({
        ...venueRoundTables,
        [selectedVenueConfigId]: currentRoundTables.map((rt) =>
          rt.positionId === rtId
            ? { ...rt, tableDiameter: Math.round(r.w) }
            : rt,
        ),
      });
      setResize(null);
      return;
    }
    // Door resize commits straight to PositionedDoor.width/height (and
    // x/y) — doors don't have a template/display split because they're
    // canvas-only and never appear on a receipt.
    if (r.positionId.startsWith("door-")) {
      const doorId = r.positionId.replace("door-", "");
      setVenueDoors({
        ...venueDoors,
        [selectedVenueConfigId]: currentDoors.map((d) =>
          d.id === doorId
            ? { ...d, x: r.x, y: r.y, width: r.w, height: r.h }
            : d,
        ),
      });
      setResize(null);
      return;
    }
    // Write to displayWidth/displayHeight only — keep `width`/`height`
    // (the template-authored size) untouched so receipts and the
    // exhibitor-facing size pill don't shift to the new canvas size.
    handleUpdateTable(r.positionId, {
      x: r.x,
      y: r.y,
      displayWidth: r.w,
      displayHeight: r.h,
    });
    setResize(null);
  };

  // Snapshot of a table's currently-rendered geometry (drag preview OR
  // resize preview OR committed values), so the JSX can read one source.
  // Falls back to template `width`/`height` when no resize override exists.
  const liveTableGeom = (t: PositionedTable) => {
    const pos = livePos(t.positionId, t.x, t.y);
    if (resize && resize.positionId === t.positionId) {
      return { x: resize.x, y: resize.y, w: resize.w, h: resize.h };
    }
    return {
      x: pos.x,
      y: pos.y,
      w: t.displayWidth ?? t.width,
      h: t.displayHeight ?? t.height,
    };
  };

  // Keep refs fresh so the window-level resize listener (attached once) reads
  // the latest closures without resubscribing.
  const processResizeMoveRef = useRef<
    (clientX: number, clientY: number) => void
  >(() => {});
  const commitResizeRef = useRef<() => void>(() => {});
  processResizeMoveRef.current = processResizeMove;
  commitResizeRef.current = commitResize;

  // While a drag is active, listen on the window (not the canvas) so the item
  // keeps following the cursor even when it strays outside the canvas — and
  // the drop is always caught, no matter where the mouse is released. Moves
  // are coalesced into one update per animation frame for smoothness with many
  // items. Subscribes only when a drag begins, unsubscribes when it ends.
  useEffect(() => {
    if (!isDragging) return;
    let rafId: number | null = null;
    let pending: { x: number; y: number } | null = null;

    const onMove = (ev: MouseEvent) => {
      pending = { x: ev.clientX, y: ev.clientY };
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pending) {
          processDragMoveRef.current(pending.x, pending.y);
          pending = null;
        }
      });
    };
    const onUp = () => {
      // Flush the final position to the parent venue state once, then stop.
      commitDragRef.current();
      setIsDragging(false);
    };

    // Suppress text/element selection while dragging so the cursor doesn't
    // highlight the canvas — a common cause of jerky-feeling drags.
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = prevUserSelect;
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, [isDragging]);

  // Mirror of the drag-window listener but for resize. Same rAF-coalesced
  // mouse-move + window-level mouse-up so the resize keeps tracking even
  // when the cursor strays outside the canvas.
  useEffect(() => {
    if (!resize) return;
    let rafId: number | null = null;
    let pending: { x: number; y: number } | null = null;

    const onMove = (ev: MouseEvent) => {
      pending = { x: ev.clientX, y: ev.clientY };
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (pending) {
          processResizeMoveRef.current(pending.x, pending.y);
          pending = null;
        }
      });
    };
    const onUp = () => {
      commitResizeRef.current();
    };
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = prevUserSelect;
      if (rafId != null) cancelAnimationFrame(rafId);
    };
    // Only re-subscribe when resize transitions between null and non-null.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!resize]);

  // --- Export Logic ---

  const captureVenueAsImage = async () => {
    if (!venueRef.current || !selectedVenueConfigId) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(venueRef.current, {
        backgroundColor: "#ffffff",
        // Lower scale + JPEG (not PNG) keeps this layout snapshot small. It's
        // stored INLINE in the event document; a full-res PNG can be several
        // MB each, and multiple layouts then blow past MongoDB's 16MB
        // per-document limit (which was causing event saves to fail).
        scale: 1.5,
        useCORS: true,
      });
      const imageDataUrl = canvas.toDataURL("image/jpeg", 0.7);
      setVenueLayoutImages({
        ...venueLayoutImages,
        [selectedVenueConfigId]: imageDataUrl,
      });
    } catch (error) {
      console.error("Error capturing layout:", error);
    }
  };

  const downloadVenueLayout = async () => {
    if (!venueRef.current || !venueConfig) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(venueRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `${venueConfig.name}-layout.png`;
      link.href = canvas.toDataURL();
      link.click();
      toast({ title: "Downloaded Successfully" });
    } catch (error) {
      toast({ title: "Download Failed", variant: "destructive" });
    }
  };

  // Rasterise the eventfront-style preview sheet and save it as a PDF, so the
  // organizer can share/print exactly what visitors will see.
  const downloadVenuePdf = async () => {
    if (!previewRef.current || !venueConfig) return;
    setPdfBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");
      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });
      const img = canvas.toDataURL("image/png");
      const pxW = canvas.width;
      const pxH = canvas.height;
      const pdf = new jsPDF({
        orientation: pxW >= pxH ? "landscape" : "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const titleY = margin + 6;
      const maxW = pageW - margin * 2;
      const maxH = pageH - titleY - margin;
      const ratio = Math.min(maxW / pxW, maxH / pxH);
      const drawW = pxW * ratio;
      const drawH = pxH * ratio;
      const x = (pageW - drawW) / 2;
      const y = titleY + 16;
      pdf.setFontSize(14);
      pdf.text(`${venueConfig.name || "Venue"} — Venue Layout`, margin, titleY);
      pdf.addImage(img, "PNG", x, y, drawW, drawH);
      pdf.save(`${venueConfig.name || "venue"}-layout.pdf`);
      toast({ title: "PDF downloaded" });
    } catch (error) {
      toast({ title: "PDF export failed", variant: "destructive" });
    } finally {
      setPdfBusy(false);
    }
  };

  // Snapshot the venue as a PNG whenever the layout actually changes
  // (item count, venue dimensions, or active config). The old version
  // depended on the `currentTables` / `currentRoundTables` array
  // references themselves — those are re-derived inline every render
  // (`venueTables[id] || []`), so each render produced a new array
  // identity and the effect re-fired in a hot loop, calling
  // html2canvas every ~1s forever (see the #315 / #316 / #317 spam
  // in the console). Switching the deps to scalar values (length +
  // venue config id) means the effect only fires when something
  // meaningful changes.
  useEffect(() => {
    if (currentTables.length > 0 || currentRoundTables.length > 0) {
      const timeoutId = setTimeout(captureVenueAsImage, 1000);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTables.length,
    currentRoundTables.length,
    venueConfig?.width,
    venueConfig?.height,
    selectedVenueConfigId,
  ]);

  // --- Styles ---

  const getTableStyle = (table: PositionedTable) => {
    let borderRadius = "4px";
    if (table.type === "Round") borderRadius = "50%";
    if (table.type === "Corner") borderRadius = "4px 4px 4px 50%";

    const isSelected = selectedTable === table.positionId;
    const geom = liveTableGeom(table);

    return {
      position: "absolute" as const,
      left: geom.x * venueConfig.scale,
      top: geom.y * venueConfig.scale,
      width: geom.w * venueConfig.scale,
      height: geom.h * venueConfig.scale,
      borderRadius,
      transform: `rotate(${table.rotation}deg)`,
      backgroundColor: table.isBooked
        ? "#ef4444"
        : isSelected
          ? "#3b82f6"
          : table.color || "#6b7280",
      color: "white",
      border: isSelected
        ? "3px solid #1d4ed8"
        : `2px solid ${table.color ? table.color + "88" : "#374151"}`,
      ...(table.forSale === false &&
        !isSelected && {
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.3) 3px, rgba(255,255,255,0.3) 6px)",
        }),
      cursor: isDragging ? "grabbing" : "grab",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: Math.max(7, 9 * venueConfig.scale) + "px",
      fontWeight: "bold",
      userSelect: "none" as const,
      zIndex: isSelected ? 10 : 1,
      transition: isDragging ? "none" : "all 0.1s ease",
      boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
    };
  };

  // Resize cursors are authored for the UNROTATED box. When a space/door is
  // rotated, the handle the user grabs points in a different screen direction,
  // so the cursor must rotate too — otherwise a vertical (rotated) space shows
  // a ↕ cursor on the side handle that actually resizes horizontally. Snaps to
  // the nearest of the four resize-cursor types.
  const rotatedCursor = (handle: string, rotationDeg = 0): string => {
    const base: Record<string, number> = {
      e: 0,
      se: 45,
      s: 90,
      sw: 135,
      w: 180,
      nw: 225,
      n: 270,
      ne: 315,
    };
    const a = ((((base[handle] ?? 0) + rotationDeg) % 360) + 360) % 360;
    const snapped = (Math.round((a % 180) / 45) * 45) % 180;
    return snapped === 0
      ? "ew-resize"
      : snapped === 45
        ? "nwse-resize"
        : snapped === 90
          ? "ns-resize"
          : "nesw-resize";
  };

  if (!venueConfig)
    return (
      <Card>
        <CardContent>No Venue Configuration Found.</CardContent>
      </Card>
    );

  return (
    <div className="space-y-4">
      {/* Top Bar: Venue Selector + Export */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-semibold text-muted-foreground mr-2">
            Venue:
          </span>
          {venueConfigurations.map((config) => (
            <Button
              key={config.id}
              size="sm"
              variant={
                selectedVenueConfigId === config.id ? "default" : "outline"
              }
              onClick={() => setSelectedVenueConfigId(config.id)}
            >
              {config.name}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {/* AI Layout button hidden pending UX polish — the action wiring,
              dialog, and applyAILayout handler are kept so re-enabling
              this is a one-line revert. */}
          {false && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAiOpen(true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-50"
              title="Auto-arrange a layout from a brief"
            >
              <Sparkles size={14} className="mr-2" /> AI Layout
            </Button>
          )}
          {/* Per-venue Publish toggle — controls whether THIS venue shows on
              the public eventfront + vendor selection tabs. Lives on the canvas
              toolbar so it's toggled right where the layout is designed. */}
          <div
            className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
              venueConfig?.published !== false
                ? "border-emerald-300 bg-emerald-50"
                : "border-gray-300 bg-gray-50"
            }`}
            title="When on, this venue is visible on the eventfront and vendor selection"
          >
            <Switch
              id="venue-published-toggle"
              checked={venueConfig?.published !== false}
              onCheckedChange={(v) => patchVenueConfig({ published: v })}
            />
            <Label
              htmlFor="venue-published-toggle"
              className={`text-xs font-semibold cursor-pointer ${
                venueConfig?.published !== false
                  ? "text-emerald-700"
                  : "text-gray-500"
              }`}
            >
              {venueConfig?.published !== false ? "Published" : "Hidden"}
            </Label>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={downloadVenueLayout}
            disabled={
              currentTables.length === 0 &&
              currentSpeakerZones.length === 0 &&
              currentRoundTables.length === 0
            }
          >
            <Download size={14} className="mr-2" /> Export
          </Button>
        </div>
      </div>

      {venueConfig && (
        <AIVenueDesignerDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          venueConfig={{
            id: venueConfig.id,
            name: venueConfig.name,
            width: venueConfig.width,
            height: venueConfig.height,
            scale: venueConfig.scale,
            gridSize: venueConfig.gridSize,
          }}
          templates={{
            stalls: tableTemplates,
            roundTables: roundTableTemplates,
            speakerZones: speakerSlotTemplates,
          }}
          existingCounts={{
            tables: currentTables.length,
            rounds: currentRoundTables.length,
            zones: currentSpeakerZones.length,
          }}
          onApply={applyAILayout}
        />
      )}

      {/* Maximize-aware design surface. When `isCanvasMaximized` is true the
          templates panel + canvas render full-screen via a portal to <body>
          (see MaximizableSurface) so the overlay covers the whole viewport
          instead of being clipped inside the Create-Event dialog. Same JSX in
          both modes — drag/click handlers don't change. */}
      <MaximizableSurface active={isCanvasMaximized}>
        {isCanvasMaximized && (
          <>
            {/* Only the grid shows in full screen. These two controls float on
              top: a fixed Exit button (top-right) and a draggable "Add Spaces"
              button that opens the template modal and can be moved out of the
              way so every part of the grid is reachable. */}
            <button
              type="button"
              onClick={() => setIsCanvasMaximized(false)}
              style={{ position: "fixed", top: 16, right: 16, zIndex: 112 }}
              className="flex items-center gap-1 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-lg hover:bg-slate-50"
              title="Exit full screen (Esc)"
            >
              <Minimize2 className="h-4 w-4" /> Exit
            </button>
            <DraggableFab
              label="Add Spaces"
              onClick={() => setTemplatesDialogOpen(true)}
            />
          </>
        )}
        {/* Templates Row — an inline bar in normal mode; in maximized mode it
          moves into the draggable FAB's "Add to venue" modal so only the grid
          is visible until the organizer opens it. */}
        <TemplatesHost
          maximized={isCanvasMaximized}
          open={templatesDialogOpen}
          onClose={() => setTemplatesDialogOpen(false)}
        >
          <div className="border rounded-xl bg-slate-50 p-4">
            <button
              type="button"
              onClick={() => setSpacesListOpen((v) => !v)}
              aria-expanded={spacesListOpen}
              className="flex w-full items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 hover:text-foreground transition-colors"
            >
              <span>Click to add to venue</span>
              <span className="ml-auto flex items-center gap-1 normal-case font-medium text-[10px] text-slate-400">
                {spacesListOpen ? "Hide" : "Show"}
                {spacesListOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </span>
            </button>
            {spacesListOpen && (
              <div className="flex flex-wrap gap-3 overflow-x-auto pb-2">
                {/* Space Templates */}
                {tableTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex-shrink-0 w-36 p-3 border-2 rounded-xl cursor-pointer hover:shadow-md transition-all bg-white"
                    style={{
                      borderColor: (template.color || "#6b7280") + "44",
                    }}
                    onClick={() => addTableToVenue(template)}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: template.color || "#6b7280" }}
                      />
                      <span className="font-bold text-xs truncate">
                        {template.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {template.width}×{template.height}
                    </p>
                    <p
                      className="text-[10px] font-semibold"
                      style={{ color: template.color || "#6b7280" }}
                    >
                      {formatPrice(template.tablePrice)}
                    </p>
                  </div>
                ))}

                {/* Divider */}
                {tableTemplates.length > 0 &&
                  speakerSlotTemplates.length > 0 && (
                    <div className="flex-shrink-0 w-px bg-gray-300 mx-1" />
                  )}

                {/* Speaker Zone Templates */}
                {speakerSlotTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex-shrink-0 w-40 p-3 border-2 border-purple-200 rounded-xl cursor-pointer hover:border-purple-500 hover:shadow-md transition-all bg-purple-50/50"
                    onClick={() => addSpeakerZoneToVenue(template)}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <span className="font-bold text-xs truncate text-purple-800">
                        {template.name}
                      </span>
                      {template.isMainStage && (
                        <Badge className="bg-purple-200 text-purple-700 text-[8px] px-1 py-0 ml-auto">
                          STAGE
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-purple-600">
                      {template.startTime && template.endTime
                        ? `${template.startTime} - ${template.endTime}`
                        : "Time TBD"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {template.isMainStage
                        ? "Main Stage"
                        : `${template.width}×${template.height}`}
                    </p>
                  </div>
                ))}

                {/* Divider */}
                {(tableTemplates.length > 0 ||
                  speakerSlotTemplates.length > 0) &&
                  roundTableTemplates.length > 0 && (
                    <div className="flex-shrink-0 w-px bg-gray-300 mx-1" />
                  )}

                {/* Round Table Templates */}
                {roundTableTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="flex-shrink-0 w-40 p-3 border-2 rounded-xl cursor-pointer hover:shadow-md transition-all bg-white"
                    style={{ borderColor: template.color + "66" }}
                    onClick={() => addRoundTableToVenue(template)}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: template.color }}
                      />
                      <span className="font-bold text-xs truncate">
                        {template.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {template.numberOfChairs} chairs
                    </p>
                    <p
                      className="text-[10px] font-semibold"
                      style={{ color: template.color }}
                    >
                      {template.sellingMode === "table"
                        ? "Whole Table"
                        : "Per Chair"}
                    </p>
                  </div>
                ))}

                {/* Divider before doors */}
                {(tableTemplates.length > 0 ||
                  speakerSlotTemplates.length > 0 ||
                  roundTableTemplates.length > 0) &&
                  (venueConfig?.customDoorTypes || []).length > 0 && (
                    <div className="flex-shrink-0 w-px bg-gray-300 mx-1" />
                  )}

                {/* Door templates (Entrance, Exit, Fire Exit, …) — one per type
              defined in the Venue Setup "Doors" section. */}
                {(venueConfig?.customDoorTypes || []).map((ct) => (
                  <div
                    key={`door-custom-${ct.id}`}
                    className="flex-shrink-0 w-32 p-3 border-2 rounded-xl cursor-pointer hover:shadow-md transition-all"
                    style={{
                      borderColor: (ct.color || "#f97316") + "88",
                      backgroundColor: (ct.color || "#f97316") + "14",
                    }}
                    onClick={() => addDoorToVenue("custom", ct)}
                    title={`Click to drop ${ct.label || "a door"} on the venue`}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <div
                        className={`w-3 h-3 ${ct.shape === "square" ? "rounded-[2px]" : "rounded-full"}`}
                        style={{ backgroundColor: ct.color || "#f97316" }}
                      />
                      <span
                        className="font-bold text-xs truncate"
                        style={{ color: ct.color || "#f97316" }}
                      >
                        {ct.label || "Custom Door"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Click to add → drag
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Multiple allowed
                    </p>
                  </div>
                ))}

                {tableTemplates.length === 0 &&
                  speakerSlotTemplates.length === 0 &&
                  roundTableTemplates.length === 0 &&
                  (venueConfig?.customDoorTypes || []).length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 w-full text-center">
                      No templates yet. Create Spaces in "Space / AddOns" tab,
                      Speaker Slots in "Speakers" tab, or Round Tables in "Round
                      Tables" tab first. Or enable Entrance / Exit / custom
                      doors in Venue Setup.
                    </p>
                  )}
              </div>
            )}
          </div>
        </TemplatesHost>

        {/* Full Width Canvas */}
        <Card className="border-2">
          <CardContent className="p-3 space-y-2">
            {!isCanvasMaximized && (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Canvas
                  </span>
                  {/* Grid reference — sits in the toolbar, OUTSIDE the design
                  surface, so it never obstructs items placed near the edges
                  of the canvas. Width/Height inputs in Venue Setup use a
                  1 m = 10 px convention; we show the same scale here so
                  values match what the organizer typed. */}
                  {venueConfig.showGrid && (
                    <div className="flex items-center gap-2 border rounded-md bg-slate-50 px-2 py-1 text-[10px] leading-tight">
                      <div>
                        <div className="font-semibold text-slate-700">
                          Grid: {(venueConfig.gridSize / 10).toFixed(1)} m
                        </div>
                        <div className="text-slate-500">
                          Venue: {(venueConfig.width / 10).toFixed(0)} ×{" "}
                          {(venueConfig.height / 10).toFixed(0)} m
                        </div>
                      </div>
                      <div
                        className="border-2 border-slate-400 bg-slate-200/50 flex items-center justify-center text-[8px] font-bold text-slate-600"
                        style={{
                          width: venueConfig.gridSize * venueConfig.scale,
                          height: venueConfig.gridSize * venueConfig.scale,
                          minWidth: 14,
                          minHeight: 14,
                        }}
                        title="One grid box at the current zoom"
                      >
                        1×
                      </div>
                      {/* Keyboard shortcut hint — discoverability for the
                      Ctrl/Cmd+D duplicate and Ctrl/Cmd+Z undo. */}
                      <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 border-l pl-2 ml-1">
                        <kbd className="px-1 py-0.5 bg-white border rounded text-slate-700 font-mono">
                          Ctrl+D
                        </kbd>
                        <span>duplicate</span>
                        <kbd className="px-1 py-0.5 bg-white border rounded text-slate-700 font-mono ml-1">
                          Ctrl+Z
                        </kbd>
                        <span>undo</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Preview + Maximize grouped together as one control cluster. */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewOpen(true)}
                    title="Preview how this layout looks on the event page"
                  >
                    <Eye className="h-4 w-4 mr-1" /> Preview
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCanvasMaximized((v) => !v)}
                    title={
                      isCanvasMaximized
                        ? "Exit full-screen design"
                        : "Maximize to full screen for design"
                    }
                  >
                    {isCanvasMaximized ? (
                      <>
                        <Minimize2 className="h-4 w-4 mr-1" /> Minimize
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-4 w-4 mr-1" /> Maximize
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
            {/* Legend — one swatch per FOR-SALE space template (its colour → the
                type it represents), then the two non-sellable states. Mirrors
                the vendor-facing legend on the event page so the organizer
                designs against the exact colours vendors will see. */}
            {(() => {
              const forSaleTemplates: { name: string; color: string }[] = [];
              tableTemplates.forEach((t) => {
                if (!t || (t as any).forSale === false) return;
                const color = t.color || "#22c55e";
                const name = t.name || "Space";
                if (
                  !forSaleTemplates.some(
                    (e) => e.name === name && e.color === color,
                  )
                )
                  forSaleTemplates.push({ name, color });
              });
              const hasNotForSale = tableTemplates.some(
                (t) => (t as any).forSale === false,
              );
              if (forSaleTemplates.length === 0 && !hasNotForSale) return null;
              return (
                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-white px-3 py-2 text-xs">
                  <span className="font-semibold uppercase tracking-wide text-slate-400">
                    Legend
                  </span>
                  {forSaleTemplates.map((entry) => (
                    <div
                      key={`${entry.name}-${entry.color}`}
                      className="flex items-center gap-1.5"
                    >
                      <span
                        className="h-4 w-4 rounded border-2"
                        style={{
                          backgroundColor: entry.color + "80",
                          borderColor: entry.color,
                        }}
                      />
                      <span className="text-slate-700">{entry.name}</span>
                    </div>
                  ))}
                  {hasNotForSale && (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-4 w-4 rounded border-2 border-amber-500"
                        style={{
                          backgroundColor: "#f59e0b59",
                          backgroundImage:
                            "repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 6px)",
                        }}
                      />
                      <span className="text-slate-700">Not for sale</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded border-2 border-gray-500 bg-gray-300" />
                    <span className="text-slate-700">Booked</span>
                  </div>
                </div>
              );
            })()}
            {/* CAD annotation toolbar — switch between moving Spaces and the
              drawing tools (line / text / rectangle / dimension). Inline in
              normal mode; floats at top-center in maximized mode so the tools
              stay reachable over the full-screen canvas. */}
            {
              <div
                className={
                  isCanvasMaximized
                    ? "fixed top-3 left-1/2 -translate-x-1/2 z-[113] flex flex-wrap items-center gap-1 rounded-lg border bg-white p-1.5 shadow-xl max-w-[95vw]"
                    : "mb-2 flex flex-wrap items-center gap-1 rounded-lg border bg-white p-1.5 shadow-sm"
                }
              >
                {(
                  [
                    { t: "none", label: "Move", Icon: Move3D },
                    { t: "select", label: "Select", Icon: MousePointer2 },
                    { t: "line", label: "Line", Icon: Minus },
                    { t: "arrow", label: "Arrow", Icon: ArrowUpRight },
                    { t: "rect", label: "Box", Icon: Square },
                    { t: "dimension", label: "Dimension", Icon: Ruler },
                  ] as const
                ).map(({ t, label, Icon }) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setAnnotationTool(t as AnnotationTool);
                      setSelectedAnnId(null);
                    }}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      annotationTool === t
                        ? "bg-primary text-primary-foreground"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                    title={
                      t === "none"
                        ? "Move / book spaces"
                        : `Draw ${label.toLowerCase()}`
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
                <div className="mx-1 h-5 w-px bg-gray-200" />
                {/* Stroke / text colour for new shapes. */}
                <label
                  className="flex items-center gap-1.5 text-xs text-gray-500"
                  title="Drawing colour"
                >
                  <input
                    type="color"
                    value={annotationColor}
                    onChange={(e) => setAnnotationColor(e.target.value)}
                    className="h-6 w-7 cursor-pointer rounded border border-gray-300 bg-white p-0"
                  />
                </label>
                <div className="mx-1 h-5 w-px bg-gray-200" />
                {/* Single undo for everything on the canvas — spaces, round
                  tables, doors AND the drawn annotations. Mirrors Ctrl/Cmd+Z. */}
                <button
                  type="button"
                  onClick={undoLastChange}
                  disabled={undoDepth <= 1}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Undo last change (Ctrl/Cmd+Z) — spaces & drawings"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Undo
                </button>
                {/* Selected-item actions (Rotate / Copy / Delete) live HERE in
                  the toolbar — not floating over the canvas — so the venue grid
                  stays clean for designing. Dispatches to the right handler
                  based on the selected item's type (space / round table /
                  speaker zone / door). */}
                {selectedTable &&
                  (() => {
                    const id = selectedTable;
                    let kind = "Space";
                    let onRotate: (() => void) | null = null;
                    let onCopy: (() => void) | null = null;
                    let onDelete: (() => void) | null = null;
                    if (id.startsWith("sz-")) {
                      const realId = id.slice(3);
                      kind = "Speaker zone";
                      onRotate = () => {
                        const updated = currentSpeakerZones.map((z) =>
                          z.positionId === realId
                            ? { ...z, rotation: ((z.rotation || 0) + 90) % 360 }
                            : z,
                        );
                        setVenueSpeakerZones({
                          ...venueSpeakerZones,
                          [selectedVenueConfigId]: updated,
                        });
                      };
                      onDelete = () => removeSpeakerZone(realId);
                    } else if (id.startsWith("rt-")) {
                      const realId = id.slice(3);
                      kind = "Round table";
                      onCopy = () => duplicateRoundTable(realId);
                      onDelete = () => removeRoundTable(realId);
                    } else if (id.startsWith("door-")) {
                      const realId = id.slice(5);
                      kind = "Door";
                      onRotate = () => rotateDoor(realId);
                      onDelete = () => removeDoorFromVenue(realId);
                    } else {
                      kind = "Space";
                      onRotate = () => rotateTable(id);
                      onCopy = () => duplicateTable(id);
                      onDelete = () => removeTableFromVenue(id);
                    }
                    const actBtn =
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100";
                    return (
                      <>
                        <div className="mx-1 h-5 w-px bg-gray-200" />
                        <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {kind}
                        </span>
                        {onRotate && (
                          <button
                            type="button"
                            onClick={onRotate}
                            className={actBtn}
                            title="Rotate 90°"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            Rotate
                          </button>
                        )}
                        {onCopy && (
                          <button
                            type="button"
                            onClick={onCopy}
                            className={actBtn}
                            title="Duplicate (Ctrl+D)"
                          >
                            <CopyPlusIcon className="h-3.5 w-3.5" />
                            Copy
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onDelete ?? undefined}
                          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Delete selected"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </>
                    );
                  })()}
                {selectedAnnId && annotationTool === "select" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => {
                      updateAnnotations(
                        currentAnnotations.filter(
                          (a) => a.id !== selectedAnnId,
                        ),
                      );
                      setSelectedAnnId(null);
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                )}
                {annotationTool !== "none" && (
                  <span className="ml-auto pr-1 text-[11px] text-gray-400">
                    {annotationTool === "select"
                      ? "Click a drawing to select · Del to remove"
                      : "Click-drag on the canvas to draw"}
                  </span>
                )}
              </div>
            }
            <div
              // Wrapper carries the grid background. Scrolling behavior:
              //  - Inline mode → wrapper is its own scroll container
              //    (`overflow-auto`) so the surrounding form can scroll
              //    independently.
              //  - Maximized mode → wrapper has `overflow-visible` so
              //    the OUTER MaximizableSurface portal becomes the
              //    single scroll container. Two nested scroll boxes
              //    confused mouse-wheel events (wheel landed on the
              //    inner one which had nothing more to scroll, never
              //    bubbled up to the outer), forcing the user to grab
              //    the scrollbar by hand. With one scroll container
              //    the wheel just works anywhere on the canvas.
              className={`relative border border-gray-200 rounded-xl flex justify-start items-start p-6 ${
                isCanvasMaximized ? "overflow-visible" : "overflow-auto"
              }`}
              style={{
                minHeight: isCanvasMaximized ? "calc(100vh - 48px)" : "700px",
                // Neutral backdrop — the venue "sheet" (venueRef) sits on top
                // of it, so the grid is clearly the venue and not an endless
                // surface.
                backgroundColor: "#eef2f7",
              }}
            >
              <div
                ref={venueRef}
                // The canvas IS the venue: sized exactly to canvasW×canvasH
                // (which tracks the placed items), drawn as a white "sheet"
                // with a subtle border + shadow so its bounds are obvious.
                className="relative"
                style={{
                  width: canvasW * venueConfig.scale,
                  height: canvasH * venueConfig.scale,
                  flex: "none",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
                  // CAD graph-paper grid: faint minor lines every cell plus
                  // stronger major lines every 5 cells, for a professional
                  // blueprint feel.
                  backgroundColor: "#ffffff",
                  backgroundImage:
                    "linear-gradient(to right, rgba(37,99,235,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,0.16) 1px, transparent 1px), linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)",
                  // Grid is scaled to match item coordinates (items render at
                  // x*scale), so one cell == gridSize venue-units on screen and
                  // the axis rulers below line up with the major gridlines.
                  backgroundSize: `${(venueConfig.gridSize || 40) * 5 * venueConfig.scale}px ${(venueConfig.gridSize || 40) * 5 * venueConfig.scale}px, ${(venueConfig.gridSize || 40) * 5 * venueConfig.scale}px ${(venueConfig.gridSize || 40) * 5 * venueConfig.scale}px, ${(venueConfig.gridSize || 40) * venueConfig.scale}px ${(venueConfig.gridSize || 40) * venueConfig.scale}px, ${(venueConfig.gridSize || 40) * venueConfig.scale}px ${(venueConfig.gridSize || 40) * venueConfig.scale}px`,
                }}
              >
                {/* ── Scale rulers ─────────────────────────────────────────
                  Distance markers along the X (top) and Y (left) axes so the
                  organizer can read how big the venue is. Labels are in
                  metres (the venue uses a 1 m = 10 unit convention). Ticks
                  sit on every MAJOR gridline (every 5 cells). pointer-events-
                  none so they never block placing or dragging items. */}
                {(() => {
                  const cell = venueConfig.gridSize || 40;
                  const major = cell * 5; // venue-units between major lines
                  const s = venueConfig.scale;
                  const fmt = (units: number) => {
                    const m = units / 10;
                    return Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
                  };
                  const xCount = Math.max(0, Math.floor(canvasW / major));
                  const yCount = Math.max(0, Math.floor(canvasH / major));
                  return (
                    <div className="pointer-events-none absolute inset-0 z-30">
                      {/* X axis — top */}
                      {Array.from({ length: xCount + 1 }).map((_, i) => (
                        <div
                          key={`rx-${i}`}
                          className="absolute top-0"
                          style={{ left: i * major * s }}
                        >
                          <div className="h-2 w-px bg-blue-500/50" />
                          {i > 0 && (
                            <span className="absolute left-0.5 top-1.5 rounded bg-white/80 px-0.5 text-[9px] font-medium leading-none text-slate-500">
                              {fmt(i * major)}
                            </span>
                          )}
                        </div>
                      ))}
                      {/* Y axis — left */}
                      {Array.from({ length: yCount + 1 }).map((_, i) => (
                        <div
                          key={`ry-${i}`}
                          className="absolute left-0"
                          style={{ top: i * major * s }}
                        >
                          <div className="h-px w-2 bg-blue-500/50" />
                          {i > 0 && (
                            <span className="absolute left-0.5 top-0.5 rounded bg-white/80 px-0.5 text-[9px] font-medium leading-none text-slate-500">
                              {fmt(i * major)}
                            </span>
                          )}
                        </div>
                      ))}
                      {/* Origin label */}
                      <span className="absolute left-0.5 top-0.5 rounded bg-white/80 px-0.5 text-[9px] font-semibold leading-none text-slate-600">
                        0
                      </span>
                    </div>
                  );
                })()}
                {/* Stage Indicator */}
                {venueConfig.hasMainStage && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-purple-100 border border-purple-300 px-6 py-2 rounded-lg text-[10px] font-bold text-purple-700 shadow-sm">
                    MAIN STAGE
                  </div>
                )}
                {/* Placed Entrance / Exit doors — draggable, rotatable, and
                  (for square doors) resizable via 8 corner/edge handles
                  exactly like a Space. Circles render at their stored
                  width/height (legacy doors fall back to 50×50). Live
                  resize geometry from `resize` state takes precedence so
                  the box visibly stretches with the mouse. */}
                {currentDoors.map((door) => {
                  const positionId = "door-" + door.id;
                  const isSelected = selectedTable === positionId;
                  const isEntrance = door.type === "entrance";
                  const isSquare = door.shape === "square";
                  // Marker colour: entrance green, exit red, custom uses its
                  // own colour (falls back to amber).
                  const doorColor =
                    door.type === "entrance"
                      ? "#16a34a"
                      : door.type === "exit"
                        ? "#dc2626"
                        : door.color || "#f97316";
                  const doorTypeLabel =
                    door.type === "entrance"
                      ? "Entrance"
                      : door.type === "exit"
                        ? "Exit"
                        : door.label || "Door";
                  const liveResize =
                    resize && resize.positionId === positionId ? resize : null;
                  const pos = liveResize
                    ? { x: liveResize.x, y: liveResize.y }
                    : livePos(positionId, door.x, door.y);
                  const w = liveResize ? liveResize.w : (door.width ?? 50);
                  const h = liveResize ? liveResize.h : (door.height ?? 50);
                  return (
                    <div
                      key={door.id}
                      onMouseDown={(e) => {
                        const containerRect =
                          venueRef.current?.getBoundingClientRect();
                        if (!containerRect) return;
                        setDragOffset({
                          x:
                            e.clientX -
                            containerRect.left -
                            door.x * venueConfig.scale,
                          y:
                            e.clientY -
                            containerRect.top -
                            door.y * venueConfig.scale,
                        });
                        setSelectedTable(positionId);
                        setIsDragging(true);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTable(positionId);
                      }}
                      className={`absolute flex items-center justify-center text-[10px] font-bold text-white cursor-grab shadow-md select-none border-2 ${
                        isSquare ? "rounded-md" : "rounded-full"
                      } ${
                        isDragging && isSelected ? "cursor-grabbing" : ""
                      } ${isSelected ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
                      style={{
                        left: pos.x * venueConfig.scale,
                        top: pos.y * venueConfig.scale,
                        width: w * venueConfig.scale,
                        height: h * venueConfig.scale,
                        backgroundColor: doorColor,
                        borderColor: "rgba(0,0,0,0.25)",
                        transform: `rotate(${door.rotation || 0}deg)`,
                        transformOrigin: "center center",
                      }}
                      title={`${doorTypeLabel} — drag to move, click to select`}
                    >
                      <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[10px] leading-none">
                        ▲
                      </span>
                      <span className="px-0.5 truncate">
                        {door.label ||
                          (door.type === "entrance"
                            ? "IN"
                            : door.type === "exit"
                              ? "OUT"
                              : "DOOR")}
                      </span>
                      {/* 8 resize handles for square doors only — circles
                        keep their fixed 50×50 footprint to preserve the
                        legacy round look. */}
                      {isSelected && isSquare && (
                        <>
                          {(
                            [
                              ["nw", "nwse-resize", { top: -5, left: -5 }],
                              [
                                "n",
                                "ns-resize",
                                { top: -5, left: "50%", marginLeft: -5 },
                              ],
                              ["ne", "nesw-resize", { top: -5, right: -5 }],
                              [
                                "e",
                                "ew-resize",
                                { top: "50%", right: -5, marginTop: -5 },
                              ],
                              ["se", "nwse-resize", { bottom: -5, right: -5 }],
                              [
                                "s",
                                "ns-resize",
                                { bottom: -5, left: "50%", marginLeft: -5 },
                              ],
                              ["sw", "nesw-resize", { bottom: -5, left: -5 }],
                              [
                                "w",
                                "ew-resize",
                                { top: "50%", left: -5, marginTop: -5 },
                              ],
                            ] as const
                          ).map(([handle, cur, posStyle]) => (
                            <div
                              key={handle}
                              onMouseDown={(e) =>
                                beginDoorResize(e, door, handle)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="absolute rounded-sm bg-white border-2 border-blue-600 shadow z-40"
                              style={{
                                ...(posStyle as React.CSSProperties),
                                width: 10,
                                height: 10,
                                cursor: rotatedCursor(handle, door.rotation),
                              }}
                              title="Drag to resize"
                            />
                          ))}
                        </>
                      )}
                      {/* Door actions moved to the fixed toolbar. */}
                    </div>
                  );
                })}

                {/* Placed Tables */}
                {currentTables.map((table) => {
                  // Booking lookup — only populated in edit mode where the
                  // event has a Stalls collection. Drives both the hover popover
                  // and the colored add-on dots on the stall.
                  const booking = stallBookings?.[table.positionId];
                  const addOnColorMap = new Map(
                    (addOnItems || []).map((a) => [
                      a.id,
                      { color: a.color || "#6b7280", name: a.name },
                    ]),
                  );
                  const dots = (booking?.addOns || []).map((a) => ({
                    id: a.id,
                    name: addOnColorMap.get(a.id)?.name || a.name,
                    color: addOnColorMap.get(a.id)?.color || "#6b7280",
                    quantity: a.quantity,
                  }));
                  const tableNode = (
                    <div
                      key={table.positionId}
                      style={getTableStyle(table)}
                      onMouseDown={(e) => handleMouseDown(e, table)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTable(table.positionId);
                      }}
                    >
                      <div className="text-center p-1 overflow-hidden">
                        <div className="truncate">{table.name}</div>
                        {table.isBooked && (
                          <div className="text-[8px] mt-0.5">BOOKED</div>
                        )}
                      </div>
                      {/* Add-on color dots — one per purchased add-on, stacked
                      along the bottom edge of the booked stall. */}
                      {dots.length > 0 && (
                        <div
                          className="absolute left-1/2 -translate-x-1/2 flex gap-0.5 pointer-events-none"
                          style={{ bottom: 2 }}
                        >
                          {dots.slice(0, 8).map((d, i) => (
                            <span
                              key={i}
                              className="rounded-full border border-white/80 shadow"
                              style={{
                                width: 6,
                                height: 6,
                                backgroundColor: d.color,
                              }}
                            />
                          ))}
                          {dots.length > 8 && (
                            <span className="text-[7px] font-bold text-white/90 ml-0.5">
                              +{dots.length - 8}
                            </span>
                          )}
                        </div>
                      )}
                      {/* 8 resize handles — 4 corners + 4 mid-edges so the
                      stall can be reshaped from any side. Each handle
                      stops propagation so the stall's drag handler
                      doesn't also fire. Hidden for booked stalls so a
                      paid vendor's slot can't be accidentally shrunk
                      under them. */}
                      {selectedTable === table.positionId &&
                        !table.isBooked && (
                          <>
                            {(
                              [
                                // [handle, cursor, inline style for absolute position]
                                ["nw", "nwse-resize", { top: -5, left: -5 }],
                                [
                                  "n",
                                  "ns-resize",
                                  { top: -5, left: "50%", marginLeft: -5 },
                                ],
                                ["ne", "nesw-resize", { top: -5, right: -5 }],
                                [
                                  "e",
                                  "ew-resize",
                                  { top: "50%", right: -5, marginTop: -5 },
                                ],
                                [
                                  "se",
                                  "nwse-resize",
                                  { bottom: -5, right: -5 },
                                ],
                                [
                                  "s",
                                  "ns-resize",
                                  { bottom: -5, left: "50%", marginLeft: -5 },
                                ],
                                ["sw", "nesw-resize", { bottom: -5, left: -5 }],
                                [
                                  "w",
                                  "ew-resize",
                                  { top: "50%", left: -5, marginTop: -5 },
                                ],
                              ] as const
                            ).map(([h, cur, posStyle]) => (
                              <div
                                key={h}
                                onMouseDown={(e) => beginResize(e, table, h)}
                                onClick={(e) => e.stopPropagation()}
                                className="absolute rounded-sm bg-white border-2 border-blue-600 shadow z-40"
                                style={{
                                  ...(posStyle as React.CSSProperties),
                                  width: 10,
                                  height: 10,
                                  cursor: rotatedCursor(h, table.rotation),
                                }}
                                title="Drag to resize"
                              />
                            ))}
                          </>
                        )}
                      {/* Per-space actions now live in the fixed toolbar (Rotate /
                      Copy / Delete) instead of floating over the canvas. */}
                    </div>
                  );
                  // Wrap booked stalls in a HoverCard so the organizer gets a
                  // quick popover with the vendor name and the add-ons they
                  // bought (colored circle + name). Unbooked stalls render as-is
                  // to avoid the popover firing while empty stalls are dragged.
                  if (booking) {
                    return (
                      <HoverCard key={table.positionId} openDelay={120}>
                        <HoverCardTrigger asChild>{tableNode}</HoverCardTrigger>
                        <HoverCardContent
                          side="top"
                          align="center"
                          className="w-72 p-3"
                        >
                          <div className="space-y-2">
                            <div>
                              <div className="font-semibold text-sm">
                                {booking.vendorName}
                              </div>
                              {booking.vendorEmail && (
                                <div className="text-xs text-muted-foreground">
                                  {booking.vendorEmail}
                                </div>
                              )}
                            </div>
                            {dots.length === 0 ? (
                              <div className="text-xs italic text-muted-foreground">
                                No add-ons purchased.
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                  Add-ons ({dots.length})
                                </div>
                                <ul className="space-y-1">
                                  {dots.map((d, i) => (
                                    <li
                                      key={`${d.id}-${i}`}
                                      className="flex items-center gap-2 text-xs"
                                    >
                                      <span
                                        className="w-3 h-3 rounded-full border border-gray-300 shrink-0"
                                        style={{ backgroundColor: d.color }}
                                      />
                                      <span className="flex-1 truncate">
                                        {d.name}
                                      </span>
                                      {d.quantity > 1 && (
                                        <span className="text-muted-foreground">
                                          × {d.quantity}
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <div className="text-[10px] text-muted-foreground border-t pt-1">
                              Full vendor details in the Participants tab.
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  }
                  return tableNode;
                })}

                {/* Placed Speaker Zones */}
                {currentSpeakerZones.map((zone) => {
                  const isSelected = selectedTable === `sz-${zone.positionId}`;
                  return (
                    <div
                      key={`sz-${zone.positionId}`}
                      style={{
                        position: "absolute",
                        left:
                          livePos(`sz-${zone.positionId}`, zone.x, zone.y).x *
                          venueConfig.scale,
                        top:
                          livePos(`sz-${zone.positionId}`, zone.x, zone.y).y *
                          venueConfig.scale,
                        width: zone.width * venueConfig.scale,
                        height: zone.height * venueConfig.scale,
                        background: isSelected
                          ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                          : "linear-gradient(135deg, #a855f7, #8b5cf6)",
                        border: isSelected
                          ? "3px solid #5b21b6"
                          : "2px solid #7c3aed",
                        borderRadius: "10px",
                        cursor: isDragging ? "grabbing" : "grab",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: Math.max(8, 10 * venueConfig.scale) + "px",
                        fontWeight: "bold",
                        color: "white",
                        userSelect: "none" as const,
                        zIndex: isSelected ? 10 : 2,
                        transition: isDragging ? "none" : "all 0.1s ease",
                        boxShadow: isSelected
                          ? "0 6px 20px rgba(124,58,237,0.4)"
                          : "0 2px 8px rgba(124,58,237,0.15)",
                      }}
                      onMouseDown={(e) => handleSpeakerZoneMouseDown(e, zone)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTable(`sz-${zone.positionId}`);
                      }}
                    >
                      <div className="text-center p-1 overflow-hidden">
                        <div className="truncate">{zone.name}</div>
                        <div
                          style={{
                            fontSize: Math.max(6, 8 * venueConfig.scale) + "px",
                            opacity: 0.85,
                          }}
                        >
                          {zone.startTime
                            ? `${zone.startTime} - ${zone.endTime}`
                            : "SPEAKER ZONE"}
                        </div>
                      </div>
                      {/* Speaker-zone actions moved to the fixed toolbar. */}
                    </div>
                  );
                })}

                {/* Placed Round Tables */}
                {currentRoundTables.map((rt) => {
                  const isSelected = selectedTable === `rt-${rt.positionId}`;
                  // While this table is being resized, render from the live
                  // resize value so the circle + chair ring update in real time.
                  const liveD =
                    resize && resize.positionId === `rt-${rt.positionId}`
                      ? resize.w
                      : rt.tableDiameter || 120;
                  const diameter = liveD * venueConfig.scale;
                  const chairSize = Math.max(8, 12 * venueConfig.scale);
                  const chairOffset = diameter / 2 + chairSize / 2 + 2;
                  const centerX = diameter / 2;
                  const centerY = diameter / 2;

                  return (
                    <div
                      key={`rt-${rt.positionId}`}
                      style={{
                        position: "absolute",
                        left:
                          livePos(`rt-${rt.positionId}`, rt.x, rt.y).x *
                          venueConfig.scale,
                        top:
                          livePos(`rt-${rt.positionId}`, rt.x, rt.y).y *
                          venueConfig.scale,
                        width: diameter + chairSize + 4,
                        height: diameter + chairSize + 4,
                        cursor: isDragging ? "grabbing" : "grab",
                        userSelect: "none" as const,
                        zIndex: isSelected ? 10 : 2,
                      }}
                      onMouseDown={(e) => handleRoundTableMouseDown(e, rt)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTable(`rt-${rt.positionId}`);
                      }}
                    >
                      {/* The table circle */}
                      <div
                        style={{
                          position: "absolute",
                          left: chairSize / 2 + 2,
                          top: chairSize / 2 + 2,
                          width: diameter,
                          height: diameter,
                          borderRadius: "50%",
                          backgroundColor: rt.color + "33",
                          border: isSelected
                            ? `3px solid ${rt.color}`
                            : `2px solid ${rt.color}88`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                          boxShadow: isSelected
                            ? `0 4px 12px ${rt.color}44`
                            : "none",
                          transition: isDragging ? "none" : "all 0.1s ease",
                        }}
                      >
                        <span
                          style={{
                            fontSize: Math.max(7, 9 * venueConfig.scale) + "px",
                            fontWeight: "bold",
                            color: rt.color,
                            textAlign: "center",
                            lineHeight: 1.1,
                          }}
                        >
                          {rt.name}
                        </span>
                        <span
                          style={{
                            fontSize: Math.max(5, 7 * venueConfig.scale) + "px",
                            color: rt.color + "BB",
                            marginTop: 1,
                          }}
                        >
                          {rt.category}
                        </span>
                      </div>

                      {/* Chair circles */}
                      {Array.from({ length: rt.numberOfChairs }).map((_, i) => {
                        const angle =
                          (2 * Math.PI * i) / rt.numberOfChairs - Math.PI / 2;
                        const cx =
                          centerX +
                          chairOffset * Math.cos(angle) +
                          chairSize / 2 +
                          2;
                        const cy =
                          centerY +
                          chairOffset * Math.sin(angle) +
                          chairSize / 2 +
                          2;
                        const isBooked = (rt.bookedChairs || []).includes(i);

                        return (
                          <div
                            key={i}
                            style={{
                              position: "absolute",
                              left: cx - chairSize / 2,
                              top: cy - chairSize / 2,
                              width: chairSize,
                              height: chairSize,
                              borderRadius: "50%",
                              backgroundColor: isBooked ? "#9ca3af" : rt.color,
                              border: "1px solid white",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize:
                                Math.max(5, 6 * venueConfig.scale) + "px",
                              color: "white",
                              fontWeight: "bold",
                            }}
                          >
                            {i + 1}
                          </div>
                        );
                      })}

                      {/* SE resize handle — drags the table diameter. */}
                      {isSelected && (
                        <div
                          onMouseDown={(e) => beginRoundTableResize(e, rt)}
                          onClick={(e) => e.stopPropagation()}
                          title="Drag to resize"
                          style={{
                            position: "absolute",
                            left: chairSize / 2 + 2 + diameter - 6,
                            top: chairSize / 2 + 2 + diameter - 6,
                            width: 12,
                            height: 12,
                            borderRadius: 3,
                            background: "white",
                            border: `2px solid ${rt.color}`,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                            cursor: "nwse-resize",
                            zIndex: 50,
                          }}
                        />
                      )}

                      {/* Round-table actions moved to the fixed toolbar. */}
                    </div>
                  );
                })}

                {/* Venue boundary + crop handle. The dashed rectangle is the
                  venue's actual size; the grey area beyond it is just working
                  room. Drag the bottom-right handle to crop / resize the
                  venue so you can place a space flush to the edge. Hidden
                  while a drawing tool is active so it doesn't fight drawing. */}
                {annotationTool === "none" &&
                  (() => {
                    // The crop boundary defaults to the real venue size until
                    // the organizer crops; cropping stores cropWidth/cropHeight
                    // separately and never changes width/height.
                    const baseW = venueConfig.cropWidth ?? venueConfig.width;
                    const baseH = venueConfig.cropHeight ?? venueConfig.height;
                    const liveW = canvasResize ? canvasResize.w : baseW;
                    const liveH = canvasResize ? canvasResize.h : baseH;
                    const bw = liveW * venueConfig.scale;
                    const bh = liveH * venueConfig.scale;
                    return (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: bw,
                            height: bh,
                            border: "2px dashed #64748b",
                            borderRadius: 4,
                            pointerEvents: "none",
                            zIndex: 3,
                          }}
                        />
                        <div
                          className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
                          style={{
                            position: "absolute",
                            left: bw,
                            top: bh + 4,
                            transform: "translateX(-100%)",
                            pointerEvents: "none",
                            zIndex: 41,
                          }}
                        >
                          Crop {Math.round(liveW)} × {Math.round(liveH)}
                        </div>
                        <div
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCanvasResize({
                              startX: e.clientX,
                              startY: e.clientY,
                              origW: baseW,
                              origH: baseH,
                              w: baseW,
                              h: baseH,
                            });
                          }}
                          title="Drag to crop / resize the venue area"
                          style={{
                            position: "absolute",
                            left: bw - 9,
                            top: bh - 9,
                            width: 18,
                            height: 18,
                            background: "#2563eb",
                            border: "2px solid white",
                            borderRadius: 4,
                            cursor: "nwse-resize",
                            zIndex: 42,
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                          }}
                        />
                      </>
                    );
                  })()}

                {/* CAD annotation layer — Konva overlay over the whole canvas.
                  Pointer-events pass through in Move mode so space booking /
                  dragging is untouched; captures events only while a drawing
                  tool is active. */}
                <VenueAnnotationLayer
                  width={canvasW * venueConfig.scale}
                  height={canvasH * venueConfig.scale}
                  scale={venueConfig.scale}
                  annotations={currentAnnotations}
                  onChange={updateAnnotations}
                  tool={annotationTool}
                  color={annotationColor}
                  onSelect={setSelectedAnnId}
                  metersPerUnit={0.1}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </MaximizableSurface>
      {/* /maximize-aware design surface */}

      {/* Eventfront preview modal — shows the venue exactly as visitors see
          it (cropped, solid-colour spaces), with a one-click PDF export. */}
      {previewOpen &&
        venueConfig &&
        createPortal(
          (() => {
            const pcW =
              (venueConfig.cropped
                ? venueConfig.cropWidth
                : venueConfig.width) ||
              venueConfig.width ||
              800;
            const previewScale = Math.max(0.2, Math.min(900 / pcW, 1.5));
            return (
              <div
                className="fixed inset-0 z-[120] flex flex-col bg-black/60 p-4 pointer-events-auto"
                onClick={() => setPreviewOpen(false)}
              >
                <div
                  className="mx-auto mb-3 flex w-full max-w-5xl items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-sm font-semibold text-white">
                    Event Page Preview — {venueConfig.name}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={downloadVenuePdf}
                      disabled={pdfBusy}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      {pdfBusy ? "Preparing…" : "Download PDF"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <div
                  className="mx-auto w-full max-w-5xl flex-1 min-h-0 overflow-auto rounded-xl bg-white p-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="mb-3 text-xs text-gray-500">
                    This is how the venue layout will appear on the event page
                    {venueConfig.cropped ? " (cropped area)" : ""}.
                  </p>
                  <VenuePreview
                    ref={previewRef}
                    config={venueConfig}
                    tables={currentTables}
                    roundTables={currentRoundTables}
                    doors={currentDoors}
                    annotations={currentAnnotations}
                    scale={previewScale}
                  />
                </div>
              </div>
            );
          })(),
          document.body,
        )}

      {/* Inventory Summary - Full Width */}
      {(currentTables.length > 0 ||
        currentSpeakerZones.length > 0 ||
        currentRoundTables.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Placed Items (
              {currentTables.length +
                currentSpeakerZones.length +
                currentRoundTables.length}
              )
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {currentTables.map((table) => (
                <div
                  key={table.positionId}
                  className={`p-3 border rounded-lg transition-all cursor-pointer ${selectedTable === table.positionId ? "ring-2 ring-blue-500 bg-blue-50" : "bg-slate-50 hover:bg-slate-100"}`}
                  onClick={() => setSelectedTable(table.positionId)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-sm bg-blue-500" />
                    <Input
                      className="h-6 text-xs bg-white border-0 p-0 font-semibold"
                      value={table.name}
                      placeholder="Name"
                      onChange={(e) =>
                        handleUpdateTable(table.positionId, {
                          name: e.target.value,
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 uppercase font-bold">
                    <span>{table.type}</span>
                    <span
                      className={
                        table.isBooked ? "text-red-500" : "text-green-600"
                      }
                    >
                      {table.isBooked ? "Booked" : "Open"}
                    </span>
                  </div>
                  {/* Exhibitor categories this space is reserved for.
                      Empty selection means open to every category.
                      Dynamic + multi-select with checkboxes; new
                      categories added here are persisted to the shared
                      /categories pool so exhibitors see them too. */}
                  <div onClick={(e) => e.stopPropagation()} className="mt-2">
                    {(() => {
                      // Hydrate from the new array field, falling back to
                      // the legacy single-value field on older placed
                      // tables. "Other" was the legacy sentinel for
                      // "any category" — treat it as an empty list.
                      const selected: string[] = (() => {
                        const arr = (table as any).exhibitorCategories;
                        if (Array.isArray(arr)) return arr;
                        const legacy = table.exhibitorCategory;
                        if (!legacy || legacy === "Other") return [];
                        return [legacy];
                      })();
                      const writeSelection = (next: string[]) => {
                        handleUpdateTable(table.positionId, {
                          exhibitorCategories: next,
                          // Also write the legacy single field so older
                          // consumers (e.g. server-rendered receipts)
                          // still see a category label. Falls back to
                          // "Other" when the list is empty.
                          exhibitorCategory: next[0] ?? "Other",
                        });
                      };
                      const label =
                        selected.length === 0
                          ? "Open to all"
                          : selected.length === 1
                            ? selected[0]
                            : `${selected.length} categories`;
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-7 w-full justify-between text-[10px] font-normal px-2"
                            >
                              <span className="truncate">{label}</span>
                              <ChevronDown className="h-3 w-3 opacity-50 ml-1 flex-shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-0" align="start">
                            <div className="max-h-48 overflow-y-auto py-1">
                              {exhibitorCategoryOptions.map((cat) => {
                                const checked = selected.includes(cat);
                                return (
                                  <label
                                    key={cat}
                                    className="flex items-center gap-2 px-3 py-1 hover:bg-primary/10 hover:text-primary cursor-pointer text-xs"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      className="rounded-none"
                                      onCheckedChange={(c) => {
                                        const set = new Set(selected);
                                        if (c) set.add(cat);
                                        else set.delete(cat);
                                        writeSelection(Array.from(set));
                                      }}
                                    />
                                    <span>{cat}</span>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="border-t p-2 flex gap-2 bg-muted/30">
                              <Input
                                value={newExhibitorCategoryInput}
                                onChange={(e) =>
                                  setNewExhibitorCategoryInput(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddExhibitorCategory((name) =>
                                      writeSelection(
                                        Array.from(
                                          new Set([...selected, name]),
                                        ),
                                      ),
                                    );
                                  }
                                }}
                                placeholder="Add new"
                                className="h-7 text-xs"
                                disabled={addingExhibitorCategory}
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() =>
                                  handleAddExhibitorCategory((name) =>
                                    writeSelection(
                                      Array.from(new Set([...selected, name])),
                                    ),
                                  )
                                }
                                disabled={
                                  addingExhibitorCategory ||
                                  !newExhibitorCategoryInput.trim()
                                }
                                className="h-7 px-2 shrink-0"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            {selected.length > 0 && (
                              <div className="border-t p-2 flex items-center justify-between text-[10px] bg-muted/30">
                                <span className="text-muted-foreground">
                                  {selected.length} selected
                                </span>
                                <button
                                  type="button"
                                  className="text-blue-600 hover:underline"
                                  onClick={() => writeSelection([])}
                                >
                                  Clear (open to all)
                                </button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {currentSpeakerZones.map((zone) => (
                <div
                  key={`inv-${zone.positionId}`}
                  className={`p-3 border-2 border-purple-200 rounded-lg transition-all cursor-pointer ${selectedTable === `sz-${zone.positionId}` ? "ring-2 ring-purple-500 bg-purple-50" : "bg-purple-50/30 hover:bg-purple-50"}`}
                  onClick={() => setSelectedTable(`sz-${zone.positionId}`)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-xs font-semibold text-purple-800 truncate">
                      {zone.name}
                    </span>
                  </div>
                  <p className="text-[9px] text-purple-600">
                    {zone.startTime
                      ? `${zone.startTime}-${zone.endTime}`
                      : "Speaker Zone"}
                  </p>
                </div>
              ))}
              {currentRoundTables.map((rt) => (
                <div
                  key={`inv-rt-${rt.positionId}`}
                  className={`p-3 border-2 rounded-lg transition-all cursor-pointer ${selectedTable === `rt-${rt.positionId}` ? "ring-2 bg-opacity-20" : "bg-opacity-5 hover:bg-opacity-10"}`}
                  style={{
                    borderColor: rt.color + "66",
                    backgroundColor: rt.color + "11",
                  }}
                  onClick={() => setSelectedTable(`rt-${rt.positionId}`)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: rt.color }}
                    />
                    {/* Inline rename — same as Spaces: edit the placed
                        round table's name directly after allocation. */}
                    <Input
                      className="h-6 text-xs bg-white/70 border-0 p-0 font-semibold flex-1 min-w-0"
                      value={rt.name}
                      placeholder="Name"
                      onChange={(e) =>
                        setVenueRoundTables({
                          ...venueRoundTables,
                          [selectedVenueConfigId]: currentRoundTables.map(
                            (r) =>
                              r.positionId === rt.positionId
                                ? { ...r, name: e.target.value }
                                : r,
                          ),
                        })
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    {rt.numberOfChairs === 0
                      ? "Standing"
                      : `${rt.numberOfChairs} chairs`}{" "}
                    &middot; {rt.category}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export function CreateEventForm({
  onClose,
  onSave,
  editMode = false,
  duplicateMode = false,
  initialData,
  organizerIdOverride,
}: CreateEventFormProps) {
  const { toast } = useToast();
  const venueRef = useRef<HTMLDivElement>(null);

  // Individual accounts have no payment integration (no Razorpay /
  // Stripe / bank). Force every visitor-type price to 0 in the UI so
  // they can't even type a non-zero price. The backend mirrors this
  // guard in events.controller.createEvent / updateEvent.
  const isIndividualAccount = (() => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return false;
      const decoded: any = jwtDecode(token);
      const roles: string[] = Array.isArray(decoded?.roles)
        ? decoded.roles
        : [];
      return roles.includes("individual") && !roles.includes("organizer");
    } catch {
      return false;
    }
  })();

  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState("basic");
  const [currentTag, setCurrentTag] = useState("");
  const [blurActive, setblurActive] = useState(false);
  const [termsForStalls, setTermsForStalls] = useState("");
  const [isTermsMandatory, setIsTermsMandatory] = useState(false);

  // Media States
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [sponsorLogos, setSponsorLogos] = useState<SponsorLogo[]>([]);
  // Max total spaces a single vendor may book (drives the quantity-based
  // preferred-space picker on the stall form). Stored as a string while editing.
  const [maxSpacesPerVendor, setMaxSpacesPerVendor] = useState<string>("1");

  // Add freshly picked sponsor logo files (multiple, no limit).
  const handleSponsorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const additions: SponsorLogo[] = files.map((f) => ({
      id: `sponsor-${Math.random().toString(36).slice(2, 11)}`,
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setSponsorLogos((prev) => [...prev, ...additions]);
    e.target.value = "";
  };
  const removeSponsor = (id: string) => {
    setSponsorLogos((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target?.file && target.preview.startsWith("blob:")) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((s) => s.id !== id);
    });
  };
  // Instagram reel URLs — surfaced as a click-to-play carousel on the
  // eventfront. Capped at 10 in the UI; empty strings are filtered out
  // before submit so a half-typed row doesn't get persisted.
  const [reelLinks, setReelLinks] = useState<string[]>(
    Array.isArray(initialData?.reelLinks) ? initialData.reelLinks : [],
  );

  // Announcement / Ad Bar — sticky marquee strip that renders at the
  // top of the eventfront. Same shape as kioscart-v1's storefront
  // adBar so the look-and-feel matches. Defaults: hidden, empty
  // message, black on white. Persisted on the event as
  // `event.adBar = { visible, message, bgColor, textColor }`.
  const [adBar, setAdBar] = useState<{
    visible: boolean;
    message: string;
    bgColor: string;
    textColor: string;
  }>({
    visible: !!initialData?.adBar?.visible,
    message: initialData?.adBar?.message || "",
    bgColor: initialData?.adBar?.bgColor || "#000000",
    textColor: initialData?.adBar?.textColor || "#ffffff",
  });
  // Public Eventfront AI assistant. When enabled, a floating chat widget
  // shows on the event's public page so visitors/vendors/speakers/round-table
  // guests can ask questions grounded in this event's data. Persisted as
  // `event.chatbot = { enabled, name }`.
  const [chatbot, setChatbot] = useState<{
    enabled: boolean;
    name: string;
    accentColor: string;
  }>({
    enabled: !!initialData?.chatbot?.enabled,
    name: initialData?.chatbot?.name || "Event Assistant",
    accentColor: initialData?.chatbot?.accentColor || "#2563eb",
  });
  const [stallTerms, setStallTerms] = useState<StallTermsCondition[]>(
    initialData?.termsAndConditionsforStalls?.map((t: any, i: number) => ({
      id: `term-${i}`,
      termsAndConditionsforStalls: t.termsAndConditionsforStalls,
      isMandatory: t.isMandatory,
    })) ?? [],
  );

  // Venue Layout Images State (one per venue config)
  const [venueLayoutImages, setVenueLayoutImages] = useState<
    Record<string, string>
  >({});

  // Table Management States
  const [tableTemplates, setTableTemplates] = useState<TableTemplate[]>([]);
  const [addOnItems, setAddOnItems] = useState<AddOnItem[]>([]);

  // Venue Configurations (multiple)
  const [venueConfigurations, setVenueConfigurations] = useState<VenueConfig[]>(
    [
      {
        id: "default",
        name: "Main Hall",
        width: 800,
        height: 500,
        scale: 0.75,
        gridSize: 20,
        showGrid: true,
        hasMainStage: true,
        totalRows: 3,
      },
    ],
  );

  // Venue Tables (per config)
  const [venueTables, setVenueTables] = useState<
    Record<string, PositionedTable[]>
  >({});

  // Current selected venue config for design
  const [selectedVenueConfigId, setSelectedVenueConfigId] =
    useState<string>("default");

  // Import a saved venue-layout template as a NEW venue: fresh id, its stall
  // types merged into the palette (deduped by name), and its placed stalls
  // re-keyed to the new venue with fresh position ids. Selecting several
  // layouts adds several venues. Lives at the top of the Venue Setup tab.
  const importVenueTemplate = (payload: any, tplName: string) => {
    const srcConfig = payload?.venueConfig || {};
    const newId = Math.random().toString(36).slice(2, 15);
    const existingNames = new Set(venueConfigurations.map((c) => c.name));
    let name =
      srcConfig.name || tplName || `Hall ${venueConfigurations.length + 1}`;
    while (existingNames.has(name)) name = `${name} (copy)`;

    const newConfig: VenueConfig = {
      ...srcConfig,
      id: newId,
      name,
      published: srcConfig.published !== false,
      totalRows: srcConfig.totalRows ?? 3,
    };

    const incomingTemplates: TableTemplate[] = Array.isArray(
      payload?.tableTemplates,
    )
      ? payload.tableTemplates
      : [];
    setTableTemplates((prev) => {
      const have = new Set(prev.map((t) => String(t.name || "").toLowerCase()));
      return [
        ...prev,
        ...incomingTemplates.filter(
          (t) => !have.has(String(t.name || "").toLowerCase()),
        ),
      ];
    });

    const incomingTables: PositionedTable[] = Array.isArray(
      payload?.venueTables,
    )
      ? payload.venueTables
      : [];
    setVenueTables((prev) => ({
      ...prev,
      [newId]: incomingTables.map((t, i) => ({
        ...t,
        venueConfigId: newId,
        positionId: `${Math.random().toString(36).slice(2, 10)}${i.toString(36)}`,
        isPlaced: true,
        // Fresh event — imported spaces must start available, never carrying
        // over the source event's sold/booked state.
        isBooked: false,
        bookedBy: undefined,
      })),
    }));

    // --- Round tables: merge palette (by name) + place this venue's tables ---
    const incomingRoundTemplates: any[] = Array.isArray(
      payload?.roundTableTemplates,
    )
      ? payload.roundTableTemplates
      : [];
    setRoundTableTemplates((prev) => {
      const have = new Set(prev.map((t) => String(t.name || "").toLowerCase()));
      return [
        ...prev,
        ...incomingRoundTemplates.filter(
          (t) => !have.has(String(t.name || "").toLowerCase()),
        ),
      ];
    });
    const incomingRoundTables: any[] = Array.isArray(payload?.venueRoundTables)
      ? payload.venueRoundTables
      : [];
    setVenueRoundTables((prev) => ({
      ...prev,
      [newId]: incomingRoundTables.map((t, i) => ({
        ...t,
        venueConfigId: newId,
        id: `${Math.random().toString(36).slice(2, 10)}r${i.toString(36)}`,
        // Reset booking state so imported round tables start fully available.
        isBooked: false,
        bookedBy: undefined,
        bookedChairs: [],
      })),
    }));

    // --- Speaker zones: same treatment ---
    const incomingSpeakerTemplates: any[] = Array.isArray(
      payload?.speakerSlotTemplates,
    )
      ? payload.speakerSlotTemplates
      : [];
    setSpeakerSlotTemplates((prev) => {
      const have = new Set(prev.map((t) => String(t.name || "").toLowerCase()));
      return [
        ...prev,
        ...incomingSpeakerTemplates.filter(
          (t) => !have.has(String(t.name || "").toLowerCase()),
        ),
      ];
    });
    const incomingSpeakerZones: any[] = Array.isArray(
      payload?.venueSpeakerZones,
    )
      ? payload.venueSpeakerZones
      : [];
    setVenueSpeakerZones((prev) => ({
      ...prev,
      [newId]: incomingSpeakerZones.map((z, i) => ({
        ...z,
        venueConfigId: newId,
        id: `${Math.random().toString(36).slice(2, 10)}s${i.toString(36)}`,
      })),
    }));

    // Auto-enable the Event Sections toggles for whatever the layout contains,
    // so imported round tables / speaker zones actually show (their tabs +
    // canvas are gated on these flags). Only turns flags ON, never off.
    const hasSpaces = incomingTables.length > 0;
    const hasRounds = incomingRoundTables.length > 0;
    const hasSpeak = incomingSpeakerZones.length > 0;
    setFormData((old) => ({
      ...old,
      features: {
        ...old.features,
        hasStalls: old.features.hasStalls || hasSpaces,
        hasRoundTables: old.features.hasRoundTables || hasRounds,
        hasSpeakers: old.features.hasSpeakers || hasSpeak,
      },
    }));

    setVenueConfigurations((prev) => [...prev, newConfig]);
    setSelectedVenueConfigId(newId);
    const parts = [
      hasSpaces && "spaces",
      hasRounds && "round tables",
      hasSpeak && "speaker spaces",
    ].filter(Boolean);
    toast({
      title: `Imported "${name}"`,
      description: parts.length
        ? `Venue added with ${parts.join(", ")}.`
        : "Venue added from the saved layout.",
    });
  };

  // Current form states
  const [currentTable, setCurrentTable] = useState({
    name: "",
    type: "Straight" as "Straight" | "Corner" | "Round" | "Square",
    width: "",
    height: "",
    rowNumber: "1",
    tablePrice: "",
    bookingPrice: "",
    depositPrice: "",
    memberPrice: "",
    memberBookingPrice: "",
    memberDepositPrice: "",
    minimumPaymentEnabled: true,
    depositInOption1: false,
    color: "#6b7280",
    forSale: true,
    maxPerBooking: "",
  });

  // Replace your currentAddOn state with this:
  const [currentAddOn, setCurrentAddOn] = useState<{
    name: string;
    price: string;
    description: string;
    rawFile?: File | null;
    preview?: string;
    color?: string;
    maxPerSpace?: string;
    maxPerTemplate?: Record<string, string>;
  }>({
    name: "",
    price: "",
    description: "",
    color: "#6b7280",
    maxPerSpace: "",
    maxPerTemplate: {},
  });

  const { country, setCountry } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);
  // Membership module gate — when off, the Member-price inputs on the
  // round-table form are hidden (mirrors the Spaces form behaviour).
  const { isModuleEnabled } = useSubscription();
  const isMembershipEnabled = isModuleEnabled("membership");

  const getOrganizerIdFromToken = () => {
    try {
      const token = sessionStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.sub;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };

  const fetchOrganizer = async () => {
    try {
      const organizerId = getOrganizerIdFromToken();
      if (!organizerId) return;
      const response = await fetch(
        `${__API_URL__}/organizers/profile-get/${organizerId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setCountry(data.data.country || "IN");
      }
    } catch (error) {
      console.error("Error fetching organizer profile", error);
    }
  };

  useEffect(() => {
    fetchOrganizer();
  }, []);

  // Enhanced Options. Held in state so URL-imported categories can be
  // appended on the fly. Seeded with a static baseline so the dropdown
  // isn't empty before the /categories fetch resolves; saved categories
  // from the API are merged in on mount.
  const [categoryOptions, setCategoryOptions] = useState<string[]>([
    "Technology",
    "Food & Beverage",
    "Fashion",
    "Automotive",
    "Healthcare",
    "Education",
    "Finance",
    "Real Estate",
    "Travel",
    "Sports",
    "Art & Crafts",
    "Beauty & Wellness",
    "Home & Garden",
    "Electronics",
    "Books & Media",
    "Trade Show",
    "Exhibition",
    "Fair",
    "Market",
    "Conference",
    "Networking",
  ]);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Merge any categories saved by other organizers into the local options
  // (case-insensitive dedupe) so every organizer sees what's been added.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${__API_URL__}/categories`);
        if (!res.ok) return;
        const data = await res.json();
        const names: string[] = Array.isArray(data)
          ? data
              .map((c: any) => c?.name)
              .filter((n: any) => typeof n === "string")
          : [];
        if (cancelled || names.length === 0) return;
        setCategoryOptions((prev) => {
          const seen = new Set(prev.map((c) => c.toLowerCase()));
          const extras = names.filter((n) => !seen.has(n.toLowerCase()));
          return extras.length ? [...prev, ...extras] : prev;
        });
      } catch {
        // non-fatal — baseline options still work offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Add a user-typed category from inside the dropdown. Persists to
  // /categories so it's available to every organizer next time, then
  // adds it locally and auto-selects it. Treats 409 (already exists) as
  // success so a duplicate add still ends up selected.
  const handleAddCustomCategory = async () => {
    const name = newCategoryInput.trim();
    if (!name || addingCategory) return;
    const alreadyExists = categoryOptions.some(
      (c) => c.toLowerCase() === name.toLowerCase(),
    );
    const canonical =
      categoryOptions.find((c) => c.toLowerCase() === name.toLowerCase()) ||
      name;
    setAddingCategory(true);
    try {
      if (!alreadyExists) {
        try {
          const token = sessionStorage.getItem("token");
          await fetch(`${__API_URL__}/categories`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ name }),
          });
        } catch {
          // Non-fatal — keep it local for this session even if the
          // persist fails (offline, auth, etc.).
        }
        setCategoryOptions((prev) => [...prev, name]);
      }
      // Single-select category — newly-added category becomes THE
      // selection (overwrites whatever was previously picked).
      // `categories` stays in sync as a one-element array for
      // backward-compat with any reader that still uses the plural
      // shape.
      setFormData((old) => ({
        ...old,
        category: canonical,
        categories: [canonical],
      }));
      setNewCategoryInput("");
    } finally {
      setAddingCategory(false);
    }
  };

  const ageRestrictionOptions = [
    "All Ages",
    "3+",
    "7+",
    "12+",
    "16+",
    "18+",
    "21+",
    "25+",
    "30+",
    "50+",
  ];

  const dressCodeOptions = [
    "No restriction",
    "Casual",
    "Business Casual",
    "Formal",
    "Cocktail Attire",
    "Black Tie",
    "White Tie",
    "Themed",
    "Festival Wear",
    "Smart Casual",
    "Traditional / Cultural Wear",
    "Uniform / Branded Apparel",
  ];

  const [formData, setFormData] = useState({
    title: initialData?.title ?? "",
    // Top-level event grouping ("commercial" | "personal") chosen in the
    // pre-step before the form opens. Empty for legacy events created before
    // this field existed — those fall back to the free-form category picker.
    eventType: initialData?.eventType ?? "",
    category: initialData?.category ?? "",
    categories:
      Array.isArray(initialData?.categories) &&
      initialData.categories.length > 0
        ? initialData.categories
        : initialData?.category
          ? [initialData.category]
          : [],
    description: initialData?.description ?? "",
    startDate: initialData?.startDate
      ? new Date(initialData.startDate).toISOString().slice(0, 10)
      : "",
    time: initialData?.time ?? "",
    endDate: initialData?.endDate
      ? new Date(initialData.endDate).toISOString().slice(0, 10)
      : "",
    endTime: initialData?.endTime ?? "",
    location: initialData?.location ?? "",
    address: initialData?.address ?? "",
    ticketPrice: initialData?.ticketPrice ?? "",
    totalTickets: initialData?.totalTickets ?? "",
    visibility: initialData?.visibility ?? "public",
    inviteLink: initialData?.inviteLink ?? "",
    tags: initialData?.tags ?? [],
    features: {
      food: initialData?.features?.food ?? false,
      parking: initialData?.features?.parking ?? false,
      wifi: initialData?.features?.wifi ?? false,
      photography: initialData?.features?.photography ?? false,
      security: initialData?.features?.security ?? false,
      accessibility: initialData?.features?.accessibility ?? false,
      // Section toggles — control which tabs appear in this form. For existing
      // events without explicit values, infer from whether related data exists
      // so editing an old event doesn't suddenly hide its filled-in sections.
      hasStalls:
        initialData?.features?.hasStalls ??
        (Array.isArray(initialData?.venueTables)
          ? initialData.venueTables.length > 0
          : !!initialData?.venueTables),
      hasRoundTables:
        initialData?.features?.hasRoundTables ??
        (Array.isArray(initialData?.venueRoundTables) &&
          initialData.venueRoundTables.length > 0),
      hasSpeakers:
        initialData?.features?.hasSpeakers ??
        (Array.isArray(initialData?.speakerSlotTemplates) &&
          initialData.speakerSlotTemplates.length > 0),
    },
    ageRestriction: initialData?.ageRestriction ?? "All Ages",
    ageRestrictions: Array.isArray(initialData?.ageRestrictions)
      ? initialData.ageRestrictions
      : [],
    dresscode: initialData?.dresscode ?? "Business Casual",
    dressCodeTheme: initialData?.dressCodeTheme ?? "",
    specialInstructions: initialData?.specialInstructions ?? "",
    refundPolicy: initialData?.refundPolicy ?? "",
    termsAndConditions: initialData?.termsAndConditions ?? "",
    // Per-section eventfront visibility. Missing key = visible (so existing
    // events keep showing everything). Custom sections are keyed by their id.
    // Only accept a plain { key: boolean } object. Guard against a corrupted
    // array/garbage value (a past bug let this field self-concatenate into
    // megabytes) by keeping just the boolean entries.
    sectionVisibility: (() => {
      const sv = initialData?.sectionVisibility as unknown;
      if (!sv || typeof sv !== "object" || Array.isArray(sv))
        return {} as Record<string, boolean>;
      const clean: Record<string, boolean> = {};
      for (const [k, val] of Object.entries(sv as Record<string, unknown>)) {
        if (typeof val === "boolean") clean[k] = val;
      }
      return clean;
    })(),
    socialMedia: initialData?.socialMedia ?? {
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
    },
    status: initialData?.status ?? "published",
    featured: initialData?.featured ?? false,
    setupTime: initialData?.setupTime ?? "",
    breakdownTime: initialData?.breakdownTime ?? "",
    termsForStalls:
      initialData?.termsAndConditionsforStalls?.termsAndConditionsforStalls ??
      "",
  });

  // Free-form custom Basic-Info sections (heading + Quill HTML body).
  // Mirrors the fixed Special Instructions / Refund Policy / Terms
  // sections but lets the organizer add as many additional sections
  // as they need. Persisted on the event as `customSections` and
  // rendered on the eventfront alongside the other info blocks.
  const [customSections, setCustomSections] = useState<
    { id: string; heading: string; content: string }[]
  >(
    Array.isArray(initialData?.customSections)
      ? initialData.customSections
      : [],
  );

  const [speakers, setSpeakers] = useState<any[]>(initialData?.speakers ?? []);
  // Volunteers allow-listed to sign in to the scanner page via Google.
  const [volunteers, setVolunteers] = useState<
    { name: string; email: string; phoneNumber: string }[]
  >(
    (initialData?.volunteers ?? []).map((v: any) => ({
      name: v?.name ?? "",
      email: v?.email ?? "",
      phoneNumber: v?.phoneNumber ?? "",
    })),
  );
  const addVolunteer = () =>
    setVolunteers((prev) => [
      ...prev,
      { name: "", email: "", phoneNumber: "" },
    ]);
  const removeVolunteer = (idx: number) =>
    setVolunteers((prev) => prev.filter((_, i) => i !== idx));
  const updateVolunteer = (
    idx: number,
    field: "name" | "email" | "phoneNumber",
    value: string,
  ) =>
    setVolunteers((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    );
  const [visitorTypes, setVisitorTypes] = useState<VisitorType[]>(
    initialData?.visitorTypes?.map((v: any) => ({ ...v })) ?? [],
  );
  const [currentVisitor, setCurrentVisitor] = useState({
    name: "",
    price: "0",
    maxCount: "",
    description: "",
    featureAccess: { ...DEFAULT_VISITOR_FEATURES },
  });
  // When set, the visitor-type form is editing this existing type in place
  // (Update) instead of creating a new one (Add).
  const [editingVisitorId, setEditingVisitorId] = useState<string | null>(null);

  // Speaker Slot Templates (like table templates but for speaker zones)
  const [speakerSlotTemplates, setSpeakerSlotTemplates] = useState<any[]>(
    initialData?.speakerSlotTemplates?.map((s: any) => ({ ...s })) ?? [],
  );
  const [currentSpeakerSlot, setCurrentSpeakerSlot] = useState({
    name: "",
    startTime: "",
    endTime: "",
    isMainStage: false,
    maxVisitors: "0",
    width: "200",
    height: "100",
    slotPrice: "0",
    maxSpeakers: "1",
    description: "",
    openForApplications: true,
  });
  // When set, the speaker-space form edits this existing space in place.
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);

  // Positioned speaker zones on venue canvas
  const [venueSpeakerZones, setVenueSpeakerZones] = useState<
    Record<string, any[]>
  >(
    initialData?.venueSpeakerZones
      ? Array.isArray(initialData.venueSpeakerZones)
        ? initialData.venueSpeakerZones.reduce((acc: any, z: any) => {
            const key = z.venueConfigId || "default";
            if (!acc[key]) acc[key] = [];
            acc[key].push(z);
            return acc;
          }, {})
        : initialData.venueSpeakerZones
      : {},
  );

  // Stall bookings keyed by positionId. Each entry holds vendor info + the
  // add-ons that vendor purchased — surfaced by the venue designer to colour
  // the booked stalls and power the on-hover popover. Only fetched in edit
  // mode (a brand-new event has no Stalls collection rows yet).
  const [stallBookings, setStallBookings] = useState<
    Record<
      string,
      {
        vendorName: string;
        vendorEmail?: string;
        addOns: { id: string; name: string; quantity: number }[];
      }
    >
  >({});
  useEffect(() => {
    if (!editMode || !initialData?._id) return;
    let cancelled = false;
    (async () => {
      try {
        const token = sessionStorage.getItem("token");
        const res = await fetch(
          `${__API_URL__}/stalls/event/${initialData._id}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!res.ok) return;
        const json = await res.json();
        const stalls: any[] = json?.data || json || [];
        const map: Record<string, any> = {};
        for (const stall of stalls) {
          const positions: any[] = stall?.selectedTables || [];
          const addOns = (stall?.selectedAddOns || []).map((a: any) => ({
            id: a.addOnId,
            name: a.name,
            quantity: a.quantity ?? 1,
          }));
          const vendorName =
            stall?.shopkeeper?.name ||
            stall?.shopkeeperName ||
            stall?.vendorName ||
            "Vendor";
          const vendorEmail =
            stall?.shopkeeper?.email || stall?.shopkeeperEmail;
          for (const p of positions) {
            const positionId = p?.positionId || p?._id;
            if (!positionId) continue;
            map[positionId] = { vendorName, vendorEmail, addOns };
          }
        }
        if (!cancelled) setStallBookings(map);
      } catch {
        // Non-fatal — designer just won't show booking dots/popovers.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editMode, initialData?._id]);

  // Placed entrance / exit markers per venue config. Empty array = none placed.
  const [venueDoors, setVenueDoors] = useState<
    Record<string, PositionedDoor[]>
  >(() => {
    const init = initialData?.venueDoors;
    if (!init) return {};
    if (Array.isArray(init)) {
      return init.reduce((acc: Record<string, PositionedDoor[]>, d: any) => {
        const key = d.venueConfigId || "default";
        if (!acc[key]) acc[key] = [];
        acc[key].push(d);
        return acc;
      }, {});
    }
    return init;
  });

  // CAD annotations (lines / text / rects / dimensions), grouped by
  // venueConfigId — same flat-array-on-load shape as venueDoors.
  const [venueAnnotations, setVenueAnnotations] = useState<
    Record<string, VenueAnnotation[]>
  >(() => {
    const init = (initialData as any)?.venueAnnotations;
    if (!init) return {};
    if (Array.isArray(init)) {
      return init.reduce((acc: Record<string, VenueAnnotation[]>, a: any) => {
        const key = a.venueConfigId || "default";
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
      }, {});
    }
    return init;
  });

  // Round Table states
  const [roundTableTemplates, setRoundTableTemplates] = useState<
    RoundTableTemplate[]
  >(initialData?.roundTableTemplates || []);
  const [venueRoundTables, setVenueRoundTables] = useState<
    Record<string, PositionedRoundTable[]>
  >(
    initialData?.venueRoundTables
      ? Array.isArray(initialData.venueRoundTables)
        ? initialData.venueRoundTables.reduce((acc: any, rt: any) => {
            const key = rt.venueConfigId || "default";
            if (!acc[key]) acc[key] = [];
            acc[key].push(rt);
            return acc;
          }, {})
        : initialData.venueRoundTables
      : {},
  );
  const [currentRoundTable, setCurrentRoundTable] = useState({
    name: "",
    numberOfChairs: "8",
    sellingMode: "chair" as "table" | "chair",
    tablePrice: "",
    chairPrice: "",
    bookingPrice: "",
    depositPrice: "",
    memberTablePrice: "",
    memberChairPrice: "",
    memberBookingPrice: "",
    memberDepositPrice: "",
    category: "Standard",
    color: "#8B5CF6",
    tableDiameter: "120",
    forSale: true,
  });
  // When set, the round-table form edits this existing template in place.
  const [editingRoundTableId, setEditingRoundTableId] = useState<string | null>(
    null,
  );

  // Load initial data for editing or duplicating. Same field-by-field copy
  // either way; the difference is the submit URL/method (handled in parent).
  useEffect(() => {
    if ((editMode || duplicateMode) && initialData) {
      // Load existing data
      if (initialData.image) {
        setBannerPreview(initialData.image);
        // Duplicate mode needs a real File for the multipart POST. Edit mode
        // can submit without re-uploading because the backend keeps the
        // original. Fetch + convert here so the new event ships with a banner.
        if (duplicateMode) {
          (async () => {
            try {
              const fullUrl = initialData.image.startsWith("http")
                ? initialData.image
                : `${__API_URL__}${
                    initialData.image.startsWith("/") ? "" : "/"
                  }${initialData.image}`;
              const res = await fetch(fullUrl);
              if (res.ok) {
                const blob = await res.blob();
                const ext = (initialData.image.split(".").pop() || "jpg").split(
                  "?",
                )[0];
                setBannerFile(
                  new File([blob], `duplicated-banner.${ext}`, {
                    type: blob.type || "image/jpeg",
                  }),
                );
              }
            } catch {
              // Non-fatal — organizer can re-upload from the Media tab.
            }
          })();
        }
      }
      if (initialData.gallery) {
        // Convert existing gallery URLs to GalleryImage objects
        const existingGallery = initialData.gallery.map(
          (url: string, index: number) => ({
            id: `existing-${index}`,
            file: null, // No file for existing images
            preview: url,
            description: "",
          }),
        );
        setGalleryImages(existingGallery);
      }
      if (Array.isArray(initialData.sponsors)) {
        setSponsorLogos(
          initialData.sponsors.map((url: string, index: number) => ({
            id: `existing-sponsor-${index}`,
            file: null,
            preview: url,
          })),
        );
      }
      if (initialData.maxSpacesPerVendor != null) {
        setMaxSpacesPerVendor(String(initialData.maxSpacesPerVendor));
      }
      if (initialData.tableTemplates) {
        setTableTemplates(initialData.tableTemplates);
      }
      if (initialData.venueTables) {
        setVenueTables(initialData.venueTables);
      }
      if (initialData.addOnItems) {
        setAddOnItems(initialData.addOnItems);
      }
      if (Array.isArray(initialData.customSections)) {
        setCustomSections(initialData.customSections);
      }
      if (initialData.venueConfig) {
        setVenueConfigurations(initialData.venueConfig);
      }
      if (initialData.speakers) {
        setSpeakers(initialData.speakers);
      }
      if (initialData.visitorTypes) {
        setVisitorTypes(initialData.visitorTypes);
      }
      if (initialData.speakerSlotTemplates) {
        setSpeakerSlotTemplates(initialData.speakerSlotTemplates);
      }
      if (initialData.venueLayoutImage) {
        setVenueLayoutImages(initialData.venueLayoutImage);
      }
      if (initialData.termsAndConditionsforStalls) {
        setStallTerms(
          initialData.termsAndConditionsforStalls.map((t: any, i: number) => ({
            id: `term-${i}-${Date.now()}`,
            termsAndConditionsforStalls: t.termsAndConditionsforStalls,
            isMandatory: t.isMandatory,
          })),
        );
      }
      if (initialData.roundTableTemplates) {
        setRoundTableTemplates(initialData.roundTableTemplates);
      }
      if (initialData.venueRoundTables) {
        if (Array.isArray(initialData.venueRoundTables)) {
          const grouped = initialData.venueRoundTables.reduce(
            (acc: any, rt: any) => {
              const key = rt.venueConfigId || "default";
              if (!acc[key]) acc[key] = [];
              acc[key].push(rt);
              return acc;
            },
            {},
          );
          setVenueRoundTables(grouped);
        } else {
          setVenueRoundTables(initialData.venueRoundTables);
        }
      }
    }
    // Depend on `initialData?._id` (a stable string), NOT the full
    // `initialData` object. Without this, every parent re-render
    // creates a new `initialData` reference, fires this effect, and
    // overwrites the form's local state with whatever the parent
    // last cached — which is exactly what was wiping the freshly-
    // added add-ons (and other fields) after clicking "Update Event"
    // while the form stays open. Hydration now runs once per event
    // id; switching events still re-fires correctly because the id
    // changes. The other hydration effect above (line ~5524) already
    // uses this pattern.
  }, [editMode, duplicateMode, initialData?._id]);

  const addStallTerm = () => {
    setStallTerms((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 10),
        termsAndConditionsforStalls: "",
        isMandatory: false,
      },
    ]);
  };

  const updateStallTerm = (
    id: string,
    field: keyof StallTermsCondition,
    value: any,
  ) => {
    setStallTerms((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)),
    );
  };

  const removeStallTerm = (id: string) => {
    setStallTerms((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    // Admin creating/editing a demo event (Showcase page) bypasses the
    // subscription gate, so the venue configuration (spaces, tables, layout)
    // is fully editable instead of blurred/locked.
    if (organizerIdOverride) {
      setblurActive(true);
      return;
    }
    async function fetchData() {
      try {
        const token = sessionStorage.getItem("token");
        if (!token) return;
        const decoded = getOrganizerFromToken(token);
        if (!decoded?.sub) return;

        const result = await fetch(
          `${__API_URL__}/organizers/profile-get/${decoded.sub}`,
          {
            method: "GET",
          },
        );

        if (!result) {
          return;
        }

        const data = await result.json();
        if (data.data.subscribed === true) setblurActive(true);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    }
    fetchData();
  }, [organizerIdOverride]);

  // ─── Venue-name autocomplete (Geoapify Places via /users/places-autocomplete)
  type VenueSuggestion = {
    placeId: string;
    name: string;
    formattedAddress: string;
    lat?: number;
    lon?: number;
  };
  const [venueSuggestions, setVenueSuggestions] = useState<VenueSuggestion[]>(
    [],
  );
  const [venueLoading, setVenueLoading] = useState(false);
  const [venueDropdownOpen, setVenueDropdownOpen] = useState(false);
  // Skip the next debounced fetch after a click — otherwise the moment we
  // setFormData(location = picked.name), the effect refires and queries
  // Geoapify with the venue name we just chose, briefly reopening the
  // dropdown with that same suggestion at the top.
  const venueSkipNextFetchRef = useRef(false);
  const venueAutocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (venueSkipNextFetchRef.current) {
      venueSkipNextFetchRef.current = false;
      return;
    }
    const q = (formData.location || "").trim();
    if (q.length < 2) {
      setVenueSuggestions([]);
      setVenueLoading(false);
      return;
    }
    const ctl = new AbortController();
    setVenueLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${__API_URL__}/users/places-autocomplete?q=${encodeURIComponent(q)}`,
          { signal: ctl.signal },
        );
        if (!res.ok) {
          setVenueSuggestions([]);
          return;
        }
        const json = await res.json();
        setVenueSuggestions(Array.isArray(json.results) ? json.results : []);
      } catch (err: any) {
        if (err?.name !== "AbortError") setVenueSuggestions([]);
      } finally {
        setVenueLoading(false);
      }
    }, 250);
    return () => {
      ctl.abort();
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.location]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        venueAutocompleteRef.current &&
        !venueAutocompleteRef.current.contains(e.target as Node)
      ) {
        setVenueDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pickVenueSuggestion = (s: VenueSuggestion) => {
    venueSkipNextFetchRef.current = true;
    setFormData((old) => ({
      ...old,
      location: s.name || old.location,
      address: s.formattedAddress || old.address,
    }));
    setVenueDropdownOpen(false);
    setVenueSuggestions([]);
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((old) => {
      const next: any = { ...old, [field]: value };
      // When the user moves the start date forward past the current end date,
      // bump the end date to match so we never end up with end < start. Only
      // touches endDate when it actually trails behind — empty endDate stays
      // empty (it's optional).
      if (
        field === "startDate" &&
        typeof value === "string" &&
        value &&
        old.endDate &&
        old.endDate < value
      ) {
        next.endDate = value;
      }
      return next;
    });
  };

  // Per-section eventfront visibility helpers. Missing key = visible.
  const isSectionVisible = (key: string) =>
    (formData.sectionVisibility as Record<string, boolean>)?.[key] !== false;
  const setSectionVisible = (key: string, val: boolean) =>
    setFormData((old) => ({
      ...old,
      sectionVisibility: {
        ...((old.sectionVisibility as Record<string, boolean>) || {}),
        [key]: val,
      },
    }));

  // Today's date as YYYY-MM-DD, used as the min for the Start Date picker on
  // brand-new events (and duplicates). In Edit mode we don't constrain — an
  // active event's startDate can legitimately be in the past.
  const todayDateString = new Date().toISOString().slice(0, 10);
  const startDateMin = editMode ? undefined : todayDateString;
  // End date floor: at minimum the chosen start date (so end < start is
  // physically blocked by the picker), or today if start isn't picked yet.
  const endDateMin = formData.startDate || startDateMin;

  const applyImportedFields = async (
    payload: {
      fields: ImportedEventFields;
      imageUrl?: string;
      sourceUrl: string;
    },
    options: { overwriteExisting: boolean },
  ) => {
    const { fields, imageUrl } = payload;
    const isEmpty = (v: any) =>
      v === undefined ||
      v === null ||
      v === "" ||
      (Array.isArray(v) && v.length === 0);

    // 1. If the imported category isn't in our local options, append it. We
    //    also try to persist it via /categories so future events get it
    //    natively — failure is non-fatal (e.g. 409 if it already exists
    //    server-side, or 401 if the user isn't authorized to create one).
    const importedCategory = fields.category;
    if (
      importedCategory &&
      !categoryOptions.some(
        (c) => c.toLowerCase() === importedCategory.toLowerCase(),
      )
    ) {
      setCategoryOptions((prev) => [...prev, importedCategory]);
      try {
        const token = sessionStorage.getItem("token");
        await fetch(`${__API_URL__}/categories`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ name: importedCategory }),
        });
      } catch {
        // Non-fatal; the category is still usable locally for this form.
      }
    }

    // 2. Apply scalar fields to the form state.
    setFormData((old) => {
      const next = { ...old } as Record<string, any>;
      (Object.keys(fields) as (keyof ImportedEventFields)[]).forEach((k) => {
        const v = fields[k];
        if (v === undefined) return;
        if (!options.overwriteExisting && !isEmpty(next[k as string])) return;
        next[k as string] = v;
      });
      // Mirror the imported singular category into the new `categories`
      // array so the multi-select UI reflects what was imported.
      if (
        importedCategory &&
        (options.overwriteExisting || isEmpty(next.categories))
      ) {
        next.categories = [importedCategory];
      }
      return next as typeof old;
    });

    // 3. Fetch the imported image (served from our own /uploads, so no CORS)
    //    and turn it into a File so the existing multipart submit picks it up.
    if (imageUrl && (options.overwriteExisting || !bannerFile)) {
      try {
        const fullUrl = imageUrl.startsWith("http")
          ? imageUrl
          : `${__API_URL__}${imageUrl}`;
        const res = await fetch(fullUrl);
        if (res.ok) {
          const blob = await res.blob();
          const ext = imageUrl.split(".").pop() || "jpg";
          const file = new File([blob], `imported-banner.${ext}`, {
            type: blob.type || "image/jpeg",
          });
          setBannerFile(file);
          setBannerPreview(URL.createObjectURL(blob));
        }
      } catch {
        // Non-fatal — user can upload a banner manually.
      }
    }

    // 4. Venue dimensions: update the currently-selected venue config
    //    (defaults to the auto-created "Main Hall"). We never replace an
    //    existing custom width/height unless overwrite is set.
    if (fields.venue) {
      setVenueConfigurations((prev) => {
        const targetId = selectedVenueConfigId || prev[0]?.id;
        if (!targetId) return prev;
        return prev.map((vc) => {
          if (vc.id !== targetId) return vc;
          const next: typeof vc = { ...vc };
          if (
            fields.venue!.width &&
            (options.overwriteExisting ||
              vc.width === 800 /* default */ ||
              !vc.width)
          ) {
            next.width = fields.venue!.width;
          }
          if (
            fields.venue!.height &&
            (options.overwriteExisting ||
              vc.height === 500 /* default */ ||
              !vc.height)
          ) {
            next.height = fields.venue!.height;
          }
          if (typeof fields.venue!.hasMainStage === "boolean") {
            next.hasMainStage = fields.venue!.hasMainStage;
          }
          return next;
        });
      });
    }

    // 5. Stall / round-table / speaker-zone templates: append new ones whose
    //    name doesn't already exist (case-insensitive). Generate IDs the same
    //    way the existing handlers do.
    const newId = () => Math.random().toString(36).slice(2, 15);
    if (fields.stalls && fields.stalls.length > 0) {
      setTableTemplates((prev) => {
        const seen = new Set(prev.map((t) => (t.name || "").toLowerCase()));
        const fresh = fields
          .stalls!.filter((s) => s.name && !seen.has(s.name.toLowerCase()))
          .map((s) => ({
            id: newId(),
            name: s.name,
            type: "Square" as const,
            width: s.width ?? 80,
            height: s.height ?? 80,
            rowNumber: 1,
            tablePrice: s.tablePrice ?? 0,
            bookingPrice: s.bookingPrice ?? s.tablePrice ?? 0,
            depositPrice: s.depositPrice ?? 0,
            color: "#3B82F6",
            forSale: true,
          }));
        return [...prev, ...fresh];
      });
    }
    if (fields.roundTables && fields.roundTables.length > 0) {
      setRoundTableTemplates((prev) => {
        const seen = new Set(prev.map((t) => (t.name || "").toLowerCase()));
        const fresh = fields
          .roundTables!.filter((r) => r.name && !seen.has(r.name.toLowerCase()))
          .map((r) => ({
            id: newId(),
            name: r.name,
            numberOfChairs: r.numberOfChairs ?? 8,
            sellingMode: r.sellingMode ?? ("table" as const),
            tablePrice: r.tablePrice ?? 0,
            chairPrice: r.chairPrice ?? 0,
            category: "",
            color: "#8B5CF6",
            tableDiameter: r.tableDiameter ?? 120,
            forSale: true,
          }));
        return [...prev, ...fresh];
      });
    }
    if (fields.speakerZones && fields.speakerZones.length > 0) {
      setSpeakerSlotTemplates((prev) => {
        const seen = new Set(
          prev.map((t: any) => (t.name || "").toLowerCase()),
        );
        const fresh = fields
          .speakerZones!.filter(
            (z) => z.name && !seen.has(z.name.toLowerCase()),
          )
          .map((z) => ({
            id: newId(),
            name: z.name,
            isMainStage: !!z.isMainStage,
            width: z.width ?? 240,
            height: z.height ?? 140,
            slotPrice: z.slotPrice ?? 0,
            maxSpeakers: z.maxSpeakers ?? 1,
            maxVisitors: z.maxVisitors ?? 100,
            description: "",
            openForApplications: true,
            sessions: [],
          }));
        return [...prev, ...fresh];
      });
    }

    // 6. Reference venue auto-size. If the import didn't give us an explicit
    //    venue width/height but DID give us spaces, compute a starter canvas
    //    big enough to fit them comfortably with aisles. This is a REFERENCE
    //    layout — the user redesigns it on the Venue Setup tab.
    const importedExplicitDims = !!(
      fields.venue?.width || fields.venue?.height
    );
    const totalSpaces =
      (fields.stalls || []).reduce((s, t) => s + (t.count ?? 10), 0) +
      (fields.roundTables || []).reduce((s, t) => s + (t.count ?? 8), 0);
    if (!importedExplicitDims && totalSpaces > 0) {
      // Estimate footprint area in sq px and target a 3:2 canvas around it
      // with 40% slack for aisles, stage band, and circulation.
      let footprint = 0;
      for (const s of fields.stalls || []) {
        const c = s.count ?? 10;
        const w = s.width ?? 80;
        const h = s.height ?? 80;
        footprint += c * w * h;
      }
      for (const r of fields.roundTables || []) {
        const c = r.count ?? 8;
        const d = (r.tableDiameter ?? 120) + 30; // include chair ring
        footprint += c * d * d;
      }
      const target = footprint * 1.4;
      // 3:2 aspect → width = sqrt(target * 1.5), height = width / 1.5
      let w = Math.round(Math.sqrt(target * 1.5));
      let h = Math.round(w / 1.5);
      // Snap to 50-px multiples and clamp.
      w = Math.max(800, Math.min(2400, Math.round(w / 50) * 50));
      h = Math.max(500, Math.min(1600, Math.round(h / 50) * 50));

      setVenueConfigurations((prev) => {
        const targetId = selectedVenueConfigId || prev[0]?.id;
        if (!targetId) return prev;
        return prev.map((vc) => {
          if (vc.id !== targetId) return vc;
          // Only auto-resize if the user is still on the default canvas. Don't
          // stomp dimensions they've already customized.
          if (vc.width !== 800 || vc.height !== 500) return vc;
          return { ...vc, width: w, height: h };
        });
      });
      toast({
        title: "Starter venue layout ready",
        description: `Sized canvas to ${w}×${h} to fit imported spaces. This is a REFERENCE — drag and resize anything on the Venue Setup tab to match your real venue.`,
      });
    }
  };

  const handleNestedInputChange = (
    parent: string,
    field: string,
    value: any,
  ) => {
    setFormData((old) => ({
      ...old,
      [parent]: { ...(old[parent] ?? {}), [field]: value },
    }));
  };

  const handleFeatureChange = (feature: string, checked: boolean) => {
    setFormData((old) => ({
      ...old,
      features: { ...old.features, [feature]: checked },
    }));
  };

  // If the user toggles off the section they're currently viewing, bounce them
  // back to Basic Info so they don't end up looking at an empty pane.
  useEffect(() => {
    const f = formData.features;
    const anyDoors = venueConfigurations.some(
      (v) => v.hasEntrance || v.hasExit || (v.customDoorTypes || []).length > 0,
    );
    const hidden =
      (currentTab === "tables" && !f.hasStalls) ||
      (currentTab === "speakers" && !f.hasSpeakers) ||
      (currentTab === "roundtables" && !f.hasRoundTables) ||
      (currentTab === "layout" &&
        !f.hasStalls &&
        !f.hasSpeakers &&
        !f.hasRoundTables &&
        !anyDoors);
    if (hidden) setCurrentTab("basic");
  }, [
    currentTab,
    formData.features.hasStalls,
    formData.features.hasSpeakers,
    formData.features.hasRoundTables,
    venueConfigurations,
  ]);

  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData((old) => ({
        ...old,
        tags: [...old.tags, currentTag.trim()],
      }));
      setCurrentTag("");
    }
  };

  const removeTag = (tag: string) => {
    setFormData((old) => ({
      ...old,
      tags: old.tags.filter((t) => t !== tag),
    }));
  };

  const resetSpeakerForm = () => {
    setCurrentSpeakerSlot({
      name: "",
      startTime: "",
      endTime: "",
      isMainStage: false,
      maxVisitors: "0",
      width: "200",
      height: "100",
      slotPrice: "0",
      maxSpeakers: "1",
      description: "",
      openForApplications: true,
    });
    setEditingSpeakerId(null);
  };

  const addSpeakerSlot = () => {
    if (!currentSpeakerSlot.name.trim()) {
      toast({ title: "Space name is required", variant: "destructive" });
      return;
    }
    const slotData = {
      name: currentSpeakerSlot.name.trim(),
      isMainStage: currentSpeakerSlot.isMainStage,
      width: currentSpeakerSlot.isMainStage
        ? 300
        : parseInt(currentSpeakerSlot.width) || 200,
      height: currentSpeakerSlot.isMainStage
        ? 80
        : parseInt(currentSpeakerSlot.height) || 100,
      slotPrice: parseFloat(currentSpeakerSlot.slotPrice) || 0,
      maxSpeakers: parseInt(currentSpeakerSlot.maxSpeakers) || 1,
      maxVisitors: parseInt(currentSpeakerSlot.maxVisitors) || 0,
      description: currentSpeakerSlot.description,
      openForApplications: currentSpeakerSlot.openForApplications,
    };

    if (editingSpeakerId) {
      // Update in place, preserving the space's id and its session slots.
      setSpeakerSlotTemplates((prev) =>
        prev.map((s) =>
          s.id === editingSpeakerId ? { ...s, ...slotData } : s,
        ),
      );
      toast({ title: "Speaker space updated" });
    } else {
      const newSlot = {
        id: Math.random().toString(36).slice(2, 10),
        ...slotData,
        sessions: [],
      };
      setSpeakerSlotTemplates((prev) => [...prev, newSlot]);
    }
    resetSpeakerForm();
  };

  // Load an existing speaker space back into the form for editing.
  const editSpeakerSlot = (id: string) => {
    const s = speakerSlotTemplates.find((x) => x.id === id);
    if (!s) return;
    setCurrentSpeakerSlot({
      name: s.name ?? "",
      startTime: "",
      endTime: "",
      isMainStage: !!s.isMainStage,
      maxVisitors: s.maxVisitors != null ? String(s.maxVisitors) : "0",
      width: s.width != null ? String(s.width) : "200",
      height: s.height != null ? String(s.height) : "100",
      slotPrice: s.slotPrice != null ? String(s.slotPrice) : "0",
      maxSpeakers: s.maxSpeakers != null ? String(s.maxSpeakers) : "1",
      description: s.description ?? "",
      openForApplications: s.openForApplications !== false,
    });
    setEditingSpeakerId(id);
  };

  const removeSpeakerSlot = (id: string) => {
    setSpeakerSlotTemplates((prev) => prev.filter((s) => s.id !== id));
    if (editingSpeakerId === id) resetSpeakerForm();
  };

  const resetRoundTableForm = () => {
    setCurrentRoundTable({
      name: "",
      numberOfChairs: "8",
      sellingMode: "chair",
      tablePrice: "",
      chairPrice: "",
      bookingPrice: "",
      depositPrice: "",
      memberTablePrice: "",
      memberChairPrice: "",
      memberBookingPrice: "",
      memberDepositPrice: "",
      category: "Standard",
      color: "#8B5CF6",
      tableDiameter: "120",
      forSale: true,
    });
    setEditingRoundTableId(null);
  };

  // Add a new round-table template, or update the one being edited in place.
  const addRoundTableTemplate = () => {
    if (!currentRoundTable.name) {
      toast({ title: "Table name is required", variant: "destructive" });
      return;
    }
    const chairs = parseInt(currentRoundTable.numberOfChairs);
    const chairsSafe = Number.isFinite(chairs) ? chairs : 0;
    if (chairsSafe < 0 || chairsSafe > 30) {
      toast({
        title: "Chairs must be between 0 and 30",
        variant: "destructive",
      });
      return;
    }
    // A standing table (0 chairs) can only be sold whole — there are no
    // seats to sell individually.
    const sellingMode =
      chairsSafe === 0 ? "table" : currentRoundTable.sellingMode;
    // Optional helper to read a money field as a number or undefined when blank.
    const numOrUndef = (v: string) => {
      const t = (v ?? "").trim();
      if (t === "") return undefined;
      const n = parseFloat(t);
      return Number.isFinite(n) ? n : undefined;
    };

    // A "not for sale" reference table skips the price requirement.
    if (currentRoundTable.forSale) {
      const price =
        sellingMode === "chair"
          ? parseFloat(currentRoundTable.chairPrice) || 0
          : parseFloat(currentRoundTable.tablePrice) || 0;
      if (price <= 0) {
        toast({
          title: "Price must be greater than 0",
          variant: "destructive",
        });
        return;
      }
    }
    const templateData = {
      name: currentRoundTable.name,
      numberOfChairs: chairsSafe,
      sellingMode,
      tablePrice: parseFloat(currentRoundTable.tablePrice) || 0,
      chairPrice: parseFloat(currentRoundTable.chairPrice) || 0,
      bookingPrice: parseFloat(currentRoundTable.bookingPrice) || 0,
      depositPrice: parseFloat(currentRoundTable.depositPrice) || 0,
      memberTablePrice: numOrUndef(currentRoundTable.memberTablePrice),
      memberChairPrice: numOrUndef(currentRoundTable.memberChairPrice),
      memberBookingPrice: numOrUndef(currentRoundTable.memberBookingPrice),
      memberDepositPrice: numOrUndef(currentRoundTable.memberDepositPrice),
      category: currentRoundTable.category,
      color: currentRoundTable.color,
      tableDiameter: parseInt(currentRoundTable.tableDiameter) || 120,
      forSale: currentRoundTable.forSale,
    };

    if (editingRoundTableId) {
      setRoundTableTemplates((prev) =>
        prev.map((t) =>
          t.id === editingRoundTableId ? { ...t, ...templateData } : t,
        ),
      );
      toast({ title: "Round table template updated" });
    } else {
      const newTemplate: RoundTableTemplate = {
        id: Math.random().toString(36).slice(2, 15),
        ...templateData,
      };
      setRoundTableTemplates([...roundTableTemplates, newTemplate]);
      toast({ title: "Round table template added" });
    }
    resetRoundTableForm();
  };

  // Load an existing round-table template back into the form for editing.
  const editRoundTableTemplate = (id: string) => {
    const t = roundTableTemplates.find((x) => x.id === id);
    if (!t) return;
    const toStr = (v: number | undefined | null) =>
      v != null ? String(v) : "";
    setCurrentRoundTable({
      name: t.name ?? "",
      numberOfChairs: t.numberOfChairs != null ? String(t.numberOfChairs) : "8",
      sellingMode: t.sellingMode || "chair",
      tablePrice: t.tablePrice != null ? String(t.tablePrice) : "",
      chairPrice: t.chairPrice != null ? String(t.chairPrice) : "",
      bookingPrice: toStr(t.bookingPrice),
      depositPrice: toStr(t.depositPrice),
      memberTablePrice: toStr(t.memberTablePrice),
      memberChairPrice: toStr(t.memberChairPrice),
      memberBookingPrice: toStr(t.memberBookingPrice),
      memberDepositPrice: toStr(t.memberDepositPrice),
      category: t.category || "Standard",
      color: t.color || "#8B5CF6",
      tableDiameter: t.tableDiameter != null ? String(t.tableDiameter) : "120",
      forSale: t.forSale !== false,
    });
    setEditingRoundTableId(id);
  };

  // Clear the visitor-type form and drop out of edit mode.
  const resetVisitorForm = () => {
    setCurrentVisitor({
      name: "",
      price: "0",
      maxCount: "",
      description: "",
      featureAccess: { ...DEFAULT_VISITOR_FEATURES },
    });
    setEditingVisitorId(null);
  };

  // Add a brand-new visitor type, or — when editingVisitorId is set —
  // update that existing type in place (keeping its id and isActive flag).
  const addVisitorType = () => {
    if (!currentVisitor.name.trim()) {
      toast({ title: "Visitor type name is required", variant: "destructive" });
      return;
    }
    // Belt-and-suspenders: even if isIndividualAccount toggles after
    // a stale price was typed, force 0 here too. Server enforces the
    // same rule in events.controller.
    const price = isIndividualAccount
      ? 0
      : parseFloat(currentVisitor.price) || 0;
    const maxCount = currentVisitor.maxCount
      ? parseInt(currentVisitor.maxCount)
      : undefined;

    if (editingVisitorId) {
      setVisitorTypes((prev) =>
        prev.map((v) =>
          v.id === editingVisitorId
            ? {
                ...v,
                name: currentVisitor.name.trim(),
                price,
                maxCount,
                description: currentVisitor.description,
                featureAccess: { ...currentVisitor.featureAccess },
              }
            : v,
        ),
      );
    } else {
      const newVisitor: VisitorType = {
        id: Math.random().toString(36).slice(2, 10),
        name: currentVisitor.name.trim(),
        price,
        maxCount,
        description: currentVisitor.description,
        featureAccess: { ...currentVisitor.featureAccess },
        isActive: true,
      };
      setVisitorTypes((prev) => [...prev, newVisitor]);
    }
    resetVisitorForm();
  };

  // Load an existing visitor type back into the form for editing.
  const editVisitorType = (id: string) => {
    const v = visitorTypes.find((vt) => vt.id === id);
    if (!v) return;
    setCurrentVisitor({
      name: v.name,
      price: String(v.price ?? 0),
      maxCount: v.maxCount != null ? String(v.maxCount) : "",
      description: v.description ?? "",
      // Merge over defaults so any custom features the type carries are
      // preserved while every default key still exists.
      featureAccess: { ...DEFAULT_VISITOR_FEATURES, ...v.featureAccess },
    });
    setEditingVisitorId(id);
  };

  const removeVisitorType = (id: string) => {
    setVisitorTypes((prev) => prev.filter((v) => v.id !== id));
    // If the type being edited was deleted, exit edit mode cleanly.
    if (editingVisitorId === id) resetVisitorForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const token = sessionStorage.getItem("token");
    if (!token) {
      toast({
        duration: 5000,
        title: "Please login to continue",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const organizer = getOrganizerFromToken(token);
    if (!organizer?.sub) {
      toast({
        duration: 5000,
        title: "Invalid token",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const data = new FormData();

      // Add basic form data
      Object.entries(formData).forEach(([key, value]) => {
        if (
          key === "features" ||
          key === "tags" ||
          key === "socialMedia" ||
          key === "categories" ||
          key === "ageRestrictions" ||
          // Object-valued — must be JSON-encoded, NOT left to FormData's string
          // coercion (which turns it into the literal "[object Object]" that the
          // backend can't parse, wiping the per-section visibility on save).
          key === "sectionVisibility"
        ) {
          data.append(key, JSON.stringify(value));
        } else {
          data.append(key, value ?? "");
        }
      });

      const formattedAddOns = addOnItems.map((item) => {
        return {
          ...item,
          hasNewImage: !!item.rawFile, // Tell the backend this item expects a new image file
          rawFile: undefined, // Remove the File object before stringifying
          preview: undefined, // Remove the local blob URL before stringifying
        };
      });

      // Add exhibition data. Placed spaces inherit `minimumPaymentEnabled`
      // from their source template (matched by id) when they don't carry it
      // — so editing a template's toggle propagates to spaces placed earlier,
      // and the booking/payment flow reads a consistent flag everywhere.
      const tplById = new Map(
        (tableTemplates || []).map((t: any) => [t.id, t]),
      );
      const venueTablesForSave = Object.fromEntries(
        Object.entries(venueTables).map(([layoutId, tables]) => [
          layoutId,
          (tables as any[]).map((t) => ({
            ...t,
            minimumPaymentEnabled:
              t.minimumPaymentEnabled ??
              tplById.get(t.id)?.minimumPaymentEnabled ??
              true,
          })),
        ]),
      );
      data.append("tableTemplates", JSON.stringify(tableTemplates));
      data.append("venueTables", JSON.stringify(venueTablesForSave));
      data.append("addOnItems", JSON.stringify(formattedAddOns));
      data.append("venueConfig", JSON.stringify(venueConfigurations));
      data.append("venueLayoutImage", JSON.stringify(venueLayoutImages));
      data.append(
        "termsAndConditionsforStalls",
        JSON.stringify(
          stallTerms.map(({ termsAndConditionsforStalls, isMandatory }) => ({
            termsAndConditionsforStalls,
            isMandatory,
          })),
        ),
      );

      addOnItems.forEach((item) => {
        if (item.rawFile) {
          data.append("addOnImages", item.rawFile);
        }
      });

      // Add banner
      if (bannerFile) {
        data.append("banner", bannerFile);
      }

      // Create a manifest for the gallery to handle new, existing, and updated descriptions
      const galleryManifest = galleryImages.map((image) => {
        if (image.file) {
          // New image
          return {
            filename: image.file.name,
            description: image.description,
            type: "new",
          };
        } else {
          // Existing image
          return {
            url: image.preview,
            description: image.description,
            type: "existing",
          };
        }
      });
      data.append("galleryManifest", JSON.stringify(galleryManifest));

      // Add only new gallery image files for upload
      galleryImages.forEach((image) => {
        if (image.file) {
          data.append("gallery", image.file);
        }
      });

      // Sponsor logos — a manifest keeps existing logos (by URL) and slots new
      // uploads in order; only new files are sent, so re-saving is cheap.
      const sponsorManifest = sponsorLogos.map((s) =>
        s.file ? { type: "new" } : { type: "existing", url: s.preview },
      );
      data.append("sponsorManifest", JSON.stringify(sponsorManifest));
      data.append(
        "maxSpacesPerVendor",
        String(Math.max(1, parseInt(maxSpacesPerVendor, 10) || 1)),
      );
      sponsorLogos.forEach((s) => {
        if (s.file) data.append("sponsorLogos", s.file);
      });

      // Instagram reel URLs — drop blank rows before persisting so a
      // half-typed entry doesn't end up in the carousel.
      data.append(
        "reelLinks",
        JSON.stringify(
          (reelLinks || []).map((r) => String(r || "").trim()).filter(Boolean),
        ),
      );

      // Announcement / Ad Bar — always send the whole object so the
      // backend can persist toggles + colors atomically. The trim on
      // message ensures whitespace-only inputs don't render an empty
      // bar on the eventfront.
      data.append(
        "adBar",
        JSON.stringify({
          visible: !!adBar.visible,
          message: (adBar.message || "").trim(),
          bgColor: adBar.bgColor || "#000000",
          textColor: adBar.textColor || "#ffffff",
        }),
      );

      // Eventfront chatbot ({ enabled, name }) — always send the whole object
      // so the toggle + name persist atomically. Name falls back to the
      // default so the widget never renders nameless.
      data.append(
        "chatbot",
        JSON.stringify({
          enabled: !!chatbot.enabled,
          name: (chatbot.name || "").trim() || "Event Assistant",
          accentColor: chatbot.accentColor || "#2563eb",
        }),
      );

      // Custom Basic-Info sections — drop entries with both an
      // empty heading and an empty body so half-typed rows don't
      // get persisted.
      data.append(
        "customSections",
        JSON.stringify(
          (customSections || [])
            .map((s) => ({
              id: s.id,
              heading: (s.heading || "").trim(),
              content: (s.content || "").trim(),
            }))
            .filter((s) => s.heading || s.content),
        ),
      );

      // NOTE: sectionVisibility is appended (JSON-encoded) by the generic
      // formData loop above. Do NOT append it again here — a second field with
      // the same name makes the backend receive an array it can't parse, which
      // silently wiped the per-section visibility on every save.

      // When an admin creates a demo/showcase event, save it under the demo
      // organizer (override) instead of the admin's own token subject.
      data.append("organizerId", organizerIdOverride || organizer.sub);

      // Build speakers array ONLY from session slots (single source of truth)
      const builtSpeakers: any[] = [];
      speakerSlotTemplates.forEach((space) => {
        (space.sessions || []).forEach((sess: any) => {
          if (sess.speakerName) {
            // Append speaker photo file if exists
            if (sess.photoFile) {
              data.append("speakerImages", sess.photoFile);
            }
            builtSpeakers.push({
              id: `session-${space.id}-${sess.id}`,
              name: sess.speakerName,
              title: sess.agenda || "",
              organization: sess.companyName || "",
              bio: sess.description || "",
              hasNewImage: !!sess.photoFile,
              image: sess.photo || "",
              email: sess.email || "",
              socialLinks: {
                linkedin: sess.socialLinks?.linkedin || "",
                twitter: sess.socialLinks?.twitter || "",
                website: sess.socialLinks?.website || "",
                instagram: sess.socialLinks?.instagram || "",
                youtube: sess.socialLinks?.youtube || "",
                facebook: sess.socialLinks?.facebook || "",
              },
              slots: [
                {
                  topic: sess.agenda || space.name,
                  startTime: sess.startTime || "",
                  endTime: sess.endTime || "",
                  description: sess.description || "",
                },
              ],
              isKeynote: space.isMainStage || false,
              order: builtSpeakers.length,
            });
          }
        });
      });
      data.append("speakers", JSON.stringify(builtSpeakers));

      // Add speaker slot templates and zones
      data.append("speakerSlotTemplates", JSON.stringify(speakerSlotTemplates));
      const allSpeakerZones = Object.entries(venueSpeakerZones).flatMap(
        ([configId, zones]) =>
          zones.map((z: any) => ({ ...z, venueConfigId: configId })),
      );
      data.append("venueSpeakerZones", JSON.stringify(allSpeakerZones));

      // Add round table data
      data.append("roundTableTemplates", JSON.stringify(roundTableTemplates));
      const allRoundTables = Object.entries(venueRoundTables).flatMap(
        ([configId, tables]) =>
          tables.map((rt) => ({ ...rt, venueConfigId: configId })),
      );
      data.append("venueRoundTables", JSON.stringify(allRoundTables));

      // Placed entrance / exit doors — flattened to one list with each
      // door tagged by its venueConfigId so the backend can group them
      // back per venue on read (same shape we use for speaker zones and
      // round tables).
      const allDoors = Object.entries(venueDoors).flatMap(([configId, doors]) =>
        (doors || []).map((d: any) => ({ ...d, venueConfigId: configId })),
      );
      data.append("venueDoors", JSON.stringify(allDoors));

      // CAD annotations — flattened + tagged by venueConfigId, same as the
      // collections above.
      const allAnnotations = Object.entries(venueAnnotations).flatMap(
        ([configId, items]) =>
          (items || []).map((a: any) => ({ ...a, venueConfigId: configId })),
      );
      data.append("venueAnnotations", JSON.stringify(allAnnotations));

      // Add visitor types
      data.append("visitorTypes", JSON.stringify(visitorTypes));

      // Volunteers — emails trimmed; rows with no email are dropped so they
      // don't pollute the allow-list with empty strings.
      const cleanedVolunteers = volunteers
        .map((v) => ({
          name: (v.name || "").trim(),
          email: (v.email || "").trim().toLowerCase(),
          phoneNumber: (v.phoneNumber || "").trim(),
        }))
        .filter((v) => v.email);
      data.append("volunteers", JSON.stringify(cleanedVolunteers));

      await onSave(data);
      toast({
        duration: 5000,
        title: editMode ? "Event updated!" : "Event created!",
        description: "Your event has been saved.",
      });
      // In edit mode, keep the form open after a successful save so
      // the organizer can keep tweaking and re-save without losing
      // context. They can dismiss it from the Cancel / X button in
      // the sticky header. Create mode still auto-closes so the
      // user lands back on the events list with their new event.
      if (!editMode) {
        onClose();
      }
    } catch (err: any) {
      toast({
        duration: 5000,
        title: "Error",
        description: err?.message ?? "Failed to save event",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 ">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
          <h1 className="text-base sm:text-xl font-bold ml-1 sm:ml-2 truncate min-w-0">
            {editMode
              ? "Edit Event"
              : duplicateMode
                ? "Duplicate Event"
                : "Create New Event"}
          </h1>
          <div className="flex gap-2 shrink-0">
            <Button
              type="button"
              variant="buttonOutline"
              onClick={onClose}
              className="px-3 sm:px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="min-w-0 sm:min-w-32 px-3 sm:px-4"
            >
              {loading
                ? editMode
                  ? "Updating..."
                  : "Creating..."
                : editMode
                  ? "Update Event"
                  : "Create Event"}
            </Button>
          </div>
        </div>
      </div>

      {/* Sticky Tabs — only show sections enabled in Basic Info > Event Sections */}
      {(() => {
        const showStalls = !!formData.features.hasStalls;
        const showRoundTables = !!formData.features.hasRoundTables;
        const showSpeakers = !!formData.features.hasSpeakers;
        // Layout tab is also useful when any door type is defined (per venue),
        // since the user needs the canvas to place those door markers.
        const anyDoorsEnabled = venueConfigurations.some(
          (v) =>
            v.hasEntrance || v.hasExit || (v.customDoorTypes || []).length > 0,
        );
        const showLayout =
          showStalls || showRoundTables || showSpeakers || anyDoorsEnabled;
        // Always-on tabs: basic, media, venue, visitors, volunteers (5)
        const visibleCount =
          5 +
          (showStalls ? 1 : 0) +
          (showSpeakers ? 1 : 0) +
          (showRoundTables ? 1 : 0) +
          (showLayout ? 1 : 0);
        const colsClass =
          (
            {
              5: "grid-cols-5",
              6: "grid-cols-6",
              7: "grid-cols-7",
              8: "grid-cols-8",
              9: "grid-cols-9",
            } as Record<number, string>
          )[visibleCount] || "grid-cols-9";
        return (
          <div className="sticky top-[73px] z-40 bg-white border-b">
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              {/* Mobile: a horizontally-scrollable tab row (each tab keeps its
                  natural width — swipe to reach them) so labels aren't squashed
                  or wrapped. Desktop (md+): the original even grid, unchanged. */}
              <TabsList
                className={`flex w-full justify-start overflow-x-auto md:grid ${colsClass} h-12 [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>button]:px-3 md:[&>button]:px-3`}
              >
                <TabsTrigger value="basic" className="text-sm">
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="media" className="text-sm">
                  Media
                </TabsTrigger>
                <TabsTrigger value="visitors" className="text-sm">
                  Visitors
                </TabsTrigger>
                <TabsTrigger value="volunteers" className="text-sm">
                  Volunteers
                </TabsTrigger>
                <TabsTrigger value="venue" className="text-sm">
                  Venue Setup
                </TabsTrigger>
                {showStalls && (
                  <TabsTrigger value="tables" className="text-sm">
                    Space / AddOns
                  </TabsTrigger>
                )}

                {showSpeakers && (
                  <TabsTrigger value="speakers" className="text-sm">
                    Speakers
                  </TabsTrigger>
                )}
                {showRoundTables && (
                  <TabsTrigger value="roundtables" className="text-sm">
                    Round Tables
                  </TabsTrigger>
                )}
                {showLayout && (
                  <TabsTrigger value="layout" className="text-sm">
                    Space Layout
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          </div>
        );
      })()}

      <div className="p-6 max-w-7xl mx-auto">
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          {/* BASIC INFO TAB */}
          <TabsContent value="basic" className="space-y-6">
            <ModuleGate moduleKey="events" sectionKey="basic">
              {/* The "Import event details from URL" widget was removed
                from the Basic Info tab. The `applyImportedFields`
                handler and `EventUrlImporter` import are kept in
                this file so the feature can be re-mounted later
                without re-implementing the field-merge logic. */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar size={20} />
                    Event Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Event Title *</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) =>
                          handleInputChange("title", e.target.value)
                        }
                        placeholder="e.g., Tech Innovation Expo 2025"
                        required
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Label>Category *</Label>
                        {/* Event type chosen in the "Create Event" pre-step.
                            Read-only here — to switch Commercial/Personal the
                            organizer restarts from the chooser. */}
                        {formData.eventType && (
                          <Badge variant="secondary" className="font-normal">
                            {eventTypeLabel(formData.eventType)}
                          </Badge>
                        )}
                      </div>
                      {/* Single-select category — the previous popover
                        let organizers pick multiple, but the product
                        decision is one event = one category. Writes
                        both `category` (string, primary) and
                        `categories` (one-element array for
                        backward-compat with reads that already
                        switched to the array). "Add new" stays
                        inline so organizers can still extend the
                        shared /categories pool from here. */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-between font-normal"
                          >
                            <span className="truncate text-left">
                              {formData.category || "Select category"}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0"
                          align="start"
                        >
                          {/* List scrolling — sized to fit exactly
                            8 category rows per viewport (≈ 32px per
                            row × 8 + 8px py-1 wrapper). Wheel scroll
                            stays inside the list so it doesn't leak
                            to the page underneath, and the scrollbar
                            is always visible so the user doesn't
                            have to hunt for it. */}
                          <div
                            className="overflow-y-auto py-1 overscroll-contain"
                            style={{
                              maxHeight: "264px",
                              scrollbarWidth: "thin",
                              scrollbarColor: "#94a3b8 transparent",
                            }}
                            onWheel={(e) => {
                              // Eat the wheel event so it scrolls the
                              // list rather than bubbling to whatever
                              // is behind the popover.
                              e.stopPropagation();
                            }}
                          >
                            {/* When an event type was picked in the pre-step,
                                the list is locked to that type's fixed
                                sub-types; otherwise it uses the shared pool. */}
                            {(formData.eventType
                              ? subtypesFor(formData.eventType)
                              : categoryOptions
                            ).map((cat) => {
                              const active = formData.category === cat;
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => {
                                    setFormData((old) => ({
                                      ...old,
                                      category: cat,
                                      categories: [cat],
                                    }));
                                  }}
                                  className={`w-full text-left flex items-center justify-between px-3 py-1.5 hover:bg-primary/10 hover:text-primary text-sm ${
                                    active
                                      ? "bg-primary/10 text-primary font-medium"
                                      : ""
                                  }`}
                                >
                                  <span>{cat}</span>
                                  {active && (
                                    <span aria-hidden className="text-primary">
                                      ✓
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          {/* Add custom category — persisted to /categories so
                            every organizer/exhibitor sees it next time. Hidden
                            when an event type is set: those sub-types are a
                            fixed list, not the free-form shared pool. */}
                          {!formData.eventType && (
                          <div className="border-t p-2 flex gap-2 bg-muted/30">
                            <Input
                              value={newCategoryInput}
                              onChange={(e) =>
                                setNewCategoryInput(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddCustomCategory();
                                }
                              }}
                              placeholder="Add new category"
                              className="h-8 text-sm"
                              disabled={addingCategory}
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAddCustomCategory}
                              disabled={
                                addingCategory || !newCategoryInput.trim()
                              }
                              className="h-8 px-3 shrink-0"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <Label>Description *</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        handleInputChange("description", e.target.value)
                      }
                      placeholder="Describe your event, what visitors can expect..."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label>Start Date *</Label>
                      <Input
                        type="date"
                        value={formData.startDate}
                        min={startDateMin}
                        onChange={(e) =>
                          handleInputChange("startDate", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Start Time *</Label>
                      <Input
                        type="time"
                        value={formData.time}
                        onChange={(e) =>
                          handleInputChange("time", e.target.value)
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={formData.endDate}
                        min={endDateMin}
                        onChange={(e) =>
                          handleInputChange("endDate", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) =>
                          handleInputChange("endTime", e.target.value)
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative" ref={venueAutocompleteRef}>
                      <Label>Venue Name *</Label>
                      <Input
                        value={formData.location}
                        onChange={(e) => {
                          handleInputChange("location", e.target.value);
                          setVenueDropdownOpen(true);
                        }}
                        onFocus={() => {
                          if (venueSuggestions.length > 0)
                            setVenueDropdownOpen(true);
                        }}
                        placeholder="Start typing a venue or landmark…"
                        required
                        autoComplete="off"
                      />
                      {venueDropdownOpen &&
                        (venueLoading || venueSuggestions.length > 0) && (
                          <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-auto rounded-md border bg-white shadow-lg">
                            {venueLoading && venueSuggestions.length === 0 && (
                              <div className="px-3 py-2 text-xs text-slate-500">
                                Searching…
                              </div>
                            )}
                            {venueSuggestions.map((s) => (
                              <button
                                type="button"
                                key={s.placeId}
                                onClick={() => pickVenueSuggestion(s)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-b-0"
                              >
                                <div className="font-medium text-slate-900 truncate">
                                  {s.name}
                                </div>
                                {s.formattedAddress && (
                                  <div className="text-xs text-slate-500 truncate">
                                    {s.formattedAddress}
                                  </div>
                                )}
                              </button>
                            ))}
                            <div className="px-3 py-1.5 text-[10px] text-slate-400 text-right bg-slate-50/60">
                              Suggestions by Geoapify · address auto-fills below
                            </div>
                          </div>
                        )}
                    </div>
                    <div>
                      <Label>Visibility</Label>
                      <Select
                        value={formData.visibility}
                        onValueChange={(v) =>
                          handleInputChange("visibility", v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Full Address *</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) =>
                        handleInputChange("address", e.target.value)
                      }
                      placeholder="Complete venue address with landmark"
                      rows={2}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="flex items-center gap-1.5">
                        <Facebook className="h-4 w-4 text-blue-600" />
                        Facebook Link
                      </Label>
                      <Input
                        type="url"
                        value={formData.socialMedia?.facebook ?? ""}
                        onChange={(e) =>
                          setFormData((old) => ({
                            ...old,
                            socialMedia: {
                              ...old.socialMedia,
                              facebook: e.target.value,
                            },
                          }))
                        }
                        placeholder="https://facebook.com/your-event"
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5">
                        <Instagram className="h-4 w-4 text-pink-600" />
                        Instagram Link
                      </Label>
                      <Input
                        type="url"
                        value={formData.socialMedia?.instagram ?? ""}
                        onChange={(e) =>
                          setFormData((old) => ({
                            ...old,
                            socialMedia: {
                              ...old.socialMedia,
                              instagram: e.target.value,
                            },
                          }))
                        }
                        placeholder="https://instagram.com/your-event"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tags, Features & Event Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Event Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Tags Section */}
                  <div>
                    <Label>Event Tags</Label>
                    <div className="flex gap-2 mb-2 mt-1">
                      <Input
                        value={currentTag}
                        onChange={(e) => setCurrentTag(e.target.value)}
                        placeholder="Add relevant tags"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                      />
                      <Button type="button" onClick={addTag} size="sm">
                        <Plus size={16} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                          <X
                            size={12}
                            className="ml-1 cursor-pointer"
                            onClick={() => removeTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Event Settings Section — Age + Dress share one card on
                    the event page, with a single show/hide toggle. */}
                  <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                    <span className="text-sm font-medium">
                      Age Restriction &amp; Dress Code
                    </span>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      {isSectionVisible("ageDress")
                        ? "Shown on event page"
                        : "Hidden"}
                      <Switch
                        checked={isSectionVisible("ageDress")}
                        onCheckedChange={(v) =>
                          setSectionVisible("ageDress", v)
                        }
                      />
                    </label>
                  </div>
                  <div className="max-w-sm space-y-2">
                    <div>
                      <Label>Dress Code</Label>
                      <Select
                        value={formData.dresscode}
                        onValueChange={(v) => handleInputChange("dresscode", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dressCodeOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Specific theme (optional)</Label>
                      <Input
                        value={formData.dressCodeTheme}
                        onChange={(e) =>
                          handleInputChange("dressCodeTheme", e.target.value)
                        }
                        placeholder="e.g. Great Gatsby, All White, Bollywood Retro"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Add a custom theme guests should dress to — shown on the
                        event page alongside the dress code.
                      </p>
                    </div>
                  </div>

                  {/* Custom age restrictions — a different age limit per
                      purpose (e.g. Vendors, Round Tables). Optional; the single
                      Age Restriction above stays as the general/default. */}
                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <Label className="text-sm">
                          Custom age restrictions
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Add a different age limit per purpose — e.g.
                          &quot;Vendors&quot;, &quot;Round Tables&quot;.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleInputChange("ageRestrictions", [
                            ...((formData.ageRestrictions as any[]) || []),
                            { heading: "", age: "All Ages" },
                          ])
                        }
                      >
                        <Plus className="mr-1 h-4 w-4" /> Add
                      </Button>
                    </div>
                    {((formData.ageRestrictions as any[]) || []).length ===
                    0 ? (
                      <p className="text-xs text-muted-foreground">
                        None added. The general Age Restriction above applies to
                        everyone.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {((formData.ageRestrictions as any[]) || []).map(
                          (row: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                placeholder="Heading (e.g. Vendors)"
                                value={row.heading || ""}
                                onChange={(e) => {
                                  const next = [
                                    ...((formData.ageRestrictions as any[]) ||
                                      []),
                                  ];
                                  next[i] = {
                                    ...next[i],
                                    heading: e.target.value,
                                  };
                                  handleInputChange("ageRestrictions", next);
                                }}
                                className="flex-1"
                              />
                              <Select
                                value={row.age || "All Ages"}
                                onValueChange={(v) => {
                                  const next = [
                                    ...((formData.ageRestrictions as any[]) ||
                                      []),
                                  ];
                                  next[i] = { ...next[i], age: v };
                                  handleInputChange("ageRestrictions", next);
                                }}
                              >
                                <SelectTrigger className="w-32 shrink-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ageRestrictionOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <button
                                type="button"
                                title="Remove"
                                onClick={() =>
                                  handleInputChange(
                                    "ageRestrictions",
                                    ((formData.ageRestrictions as any[]) ||
                                      []).filter(
                                      (_: any, idx: number) => idx !== i,
                                    ),
                                  )
                                }
                                className="shrink-0 text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  {/* Policies */}
                  <div className="space-y-4">
                    {/* Special Instructions */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="block">
                          Special Instructions / Event Itinerary
                        </Label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          {isSectionVisible("specialInstructions")
                            ? "Shown"
                            : "Hidden"}
                          <Switch
                            checked={isSectionVisible("specialInstructions")}
                            onCheckedChange={(v) =>
                              setSectionVisible("specialInstructions", v)
                            }
                          />
                        </label>
                      </div>
                      <div className="bg-white dark:bg-slate-950 rounded-md">
                        <Suspense
                          fallback={
                            <div className="h-[150px] border rounded-md animate-pulse bg-muted" />
                          }
                        >
                          <ReactQuill
                            theme="snow"
                            value={formData.specialInstructions}
                            modules={modules}
                            onChange={(content) =>
                              handleInputChange("specialInstructions", content)
                            }
                            placeholder="e.g. 1. Goods once sold are not returnable."
                            className="[&_.ql-editor]:min-h-[150px] [&_.ql-container]:rounded-b-md [&_.ql-toolbar]:rounded-t-md text-black dark:text-white"
                          />
                        </Suspense>
                      </div>
                    </div>

                    {/* Refund Policy */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="block">Refund Policy</Label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          {isSectionVisible("refundPolicy")
                            ? "Shown"
                            : "Hidden"}
                          <Switch
                            checked={isSectionVisible("refundPolicy")}
                            onCheckedChange={(v) =>
                              setSectionVisible("refundPolicy", v)
                            }
                          />
                        </label>
                      </div>
                      <div className="bg-white dark:bg-slate-950 rounded-md">
                        <Suspense
                          fallback={
                            <div className="h-[150px] border rounded-md animate-pulse bg-muted" />
                          }
                        >
                          <ReactQuill
                            theme="snow"
                            value={formData.refundPolicy}
                            modules={modules}
                            onChange={(content) =>
                              handleInputChange("refundPolicy", content)
                            }
                            placeholder="Define your refund policies"
                            className="[&_.ql-editor]:min-h-[150px] [&_.ql-container]:rounded-b-md [&_.ql-toolbar]:rounded-t-md text-black dark:text-white"
                          />
                        </Suspense>
                      </div>
                    </div>

                    {/* Terms and Conditions */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <Label className="block">Terms and Conditions</Label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          {isSectionVisible("termsAndConditions")
                            ? "Shown"
                            : "Hidden"}
                          <Switch
                            checked={isSectionVisible("termsAndConditions")}
                            onCheckedChange={(v) =>
                              setSectionVisible("termsAndConditions", v)
                            }
                          />
                        </label>
                      </div>
                      <div className="bg-white dark:bg-slate-950 rounded-md">
                        <Suspense
                          fallback={
                            <div className="h-[150px] border rounded-md animate-pulse bg-muted" />
                          }
                        >
                          <ReactQuill
                            theme="snow"
                            value={formData.termsAndConditions}
                            modules={modules}
                            onChange={(content) =>
                              handleInputChange("termsAndConditions", content)
                            }
                            placeholder="Event terms and conditions"
                            className="[&_.ql-editor]:min-h-[150px] [&_.ql-container]:rounded-b-md [&_.ql-toolbar]:rounded-t-md text-black dark:text-white"
                          />
                        </Suspense>
                      </div>
                    </div>

                    {/* Custom Sections — heading + Quill rich-text
                      body. Same look as the fixed sections above
                      (Special Instructions, Refund Policy, Terms),
                      but the organizer can add as many as they
                      want. Renders on the eventfront's Additional
                      Information block alongside the fixed entries. */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base font-semibold">
                          Custom Sections
                        </Label>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() =>
                            setCustomSections((prev) => [
                              ...prev,
                              {
                                id:
                                  "cs-" +
                                  Math.random().toString(36).slice(2, 10),
                                heading: "",
                                content: "",
                              },
                            ])
                          }
                        >
                          <Plus size={14} className="mr-1" /> Add new section
                        </Button>
                      </div>
                      {customSections.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No custom sections yet. Click "Add new section" to add
                          one (e.g. Parking notes, Sponsor message, Press kit).
                          Each section gets a heading + a rich-text body that
                          shows on the public event page.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {customSections.map((sec, idx) => (
                            <div
                              key={sec.id}
                              className="border rounded-lg p-3 bg-muted/30 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <Input
                                  value={sec.heading}
                                  placeholder={`Section ${idx + 1} heading (e.g. Parking Notes)`}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setCustomSections((prev) =>
                                      prev.map((s) =>
                                        s.id === sec.id
                                          ? { ...s, heading: v }
                                          : s,
                                      ),
                                    );
                                  }}
                                  className="flex-1 font-medium"
                                />
                                <label
                                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0"
                                  title="Show this section on the event page"
                                >
                                  {isSectionVisible(sec.id)
                                    ? "Shown"
                                    : "Hidden"}
                                  <Switch
                                    checked={isSectionVisible(sec.id)}
                                    onCheckedChange={(v) =>
                                      setSectionVisible(sec.id, v)
                                    }
                                  />
                                </label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="text-red-500 hover:bg-red-50 shrink-0"
                                  onClick={() =>
                                    setCustomSections((prev) =>
                                      prev.filter((s) => s.id !== sec.id),
                                    )
                                  }
                                  title="Remove this section"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                              <div className="bg-white dark:bg-slate-950 rounded-md">
                                <Suspense
                                  fallback={
                                    <div className="h-[150px] border rounded-md animate-pulse bg-muted" />
                                  }
                                >
                                  <ReactQuill
                                    theme="snow"
                                    value={sec.content}
                                    modules={modules}
                                    onChange={(content) => {
                                      setCustomSections((prev) =>
                                        prev.map((s) =>
                                          s.id === sec.id
                                            ? { ...s, content }
                                            : s,
                                        ),
                                      );
                                    }}
                                    placeholder="Write the section content here…"
                                    className="[&_.ql-editor]:min-h-[150px] [&_.ql-container]:rounded-b-md [&_.ql-toolbar]:rounded-t-md text-black dark:text-white"
                                  />
                                </Suspense>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Terms & Conditions for Stalls */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-base font-semibold">
                          Terms & Conditions for Stall Exhibitors
                        </Label>
                        <Button type="button" size="sm" onClick={addStallTerm}>
                          <Plus size={14} className="mr-1" /> Add Condition
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        Each condition will appear as a checkbox that exhibitors
                        must agree to when booking a stall.
                      </p>

                      {stallTerms.length === 0 && (
                        <div className="text-sm text-gray-400 border border-dashed rounded-lg p-4 text-center">
                          No stall conditions added yet. Click "+ Add Condition"
                          to add one.
                        </div>
                      )}

                      <div className="space-y-3">
                        {stallTerms.map((term, index) => (
                          <div
                            key={term.id}
                            className="border rounded-lg p-4 bg-slate-50 space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-600">
                                Condition #{index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 h-7 px-2"
                                onClick={() => removeStallTerm(term.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>

                            <Textarea
                              placeholder="e.g. Goods once sold are non-refundable."
                              value={term.termsAndConditionsforStalls}
                              onChange={(e) =>
                                updateStallTerm(
                                  term.id,
                                  "termsAndConditionsforStalls",
                                  e.target.value,
                                )
                              }
                              className="min-h-[80px] bg-white"
                            />

                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`mandatory-${term.id}`}
                                checked={term.isMandatory}
                                onCheckedChange={(checked) =>
                                  updateStallTerm(
                                    term.id,
                                    "isMandatory",
                                    !!checked,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`mandatory-${term.id}`}
                                className="text-sm cursor-pointer"
                              >
                                Mandatory — exhibitor <strong>must</strong>{" "}
                                accept this condition to proceed
                              </Label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ModuleGate>

            {/* ── Eventfront AI assistant ── */}
            <div className="rounded-lg border bg-slate-50 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-sm font-medium">
                    Event assistant chatbot
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {chatbot.enabled
                      ? "A floating AI chat appears on your public event page — it answers visitor, vendor, speaker and round-table questions using this event's details."
                      : "Turn on a floating AI chat on your public event page that answers questions about this event."}
                  </p>
                </div>
                <Switch
                  id="event-chatbot-enabled"
                  checked={chatbot.enabled}
                  onCheckedChange={(checked) =>
                    setChatbot((p) => ({ ...p, enabled: !!checked }))
                  }
                />
              </div>

              {chatbot.enabled && (
                <div className="space-y-1.5">
                  <Label htmlFor="event-chatbot-name" className="text-sm">
                    Chatbot name
                  </Label>
                  <Input
                    id="event-chatbot-name"
                    value={chatbot.name}
                    maxLength={40}
                    placeholder="Event Assistant"
                    onChange={(e) =>
                      setChatbot((p) => ({ ...p, name: e.target.value }))
                    }
                    className="bg-white"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Shown as the chat's title and in its greeting (e.g. "Ravi's
                    Wedding Helper"). Defaults to "Event Assistant".
                  </p>

                  <div className="pt-1 space-y-1.5">
                    <Label htmlFor="event-chatbot-color" className="text-sm">
                      Theme colour
                    </Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="event-chatbot-color"
                        type="color"
                        value={chatbot.accentColor}
                        onChange={(e) =>
                          setChatbot((p) => ({
                            ...p,
                            accentColor: e.target.value,
                          }))
                        }
                        className="h-9 w-14 cursor-pointer rounded border bg-white p-0.5"
                      />
                      <Input
                        value={chatbot.accentColor}
                        onChange={(e) =>
                          setChatbot((p) => ({
                            ...p,
                            accentColor: e.target.value,
                          }))
                        }
                        placeholder="#2563eb"
                        className="w-32 bg-white font-mono text-sm"
                      />
                      {/* Live preview chip */}
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: chatbot.accentColor }}
                      >
                        Preview
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Colours the chat header, launcher button and visitor
                      messages on your public event page.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* VOLUNTEERS TAB — allow-listed Google accounts that can sign in to
              the scanner page for this event. Operators (OTP) and the
              organizer keep working unchanged. */}
          <TabsContent value="volunteers" className="space-y-6">
            <ModuleGate moduleKey="events" sectionKey="volunteers">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" /> Volunteers
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Add team members who should be able to scan tickets. They
                    sign in on the scanner page with Google using the email you
                    enter here.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {volunteers.length === 0 && (
                    <p className="text-sm text-gray-500 italic">
                      No volunteers added yet. Click "Add Volunteer" below.
                    </p>
                  )}
                  {volunteers.map((v, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="md:col-span-3">
                        <Label className="text-xs">Name</Label>
                        <Input
                          value={v.name}
                          onChange={(e) =>
                            updateVolunteer(idx, "name", e.target.value)
                          }
                          placeholder="Jane Doe"
                        />
                      </div>
                      <div className="md:col-span-5">
                        <Label className="text-xs">
                          Email (Google sign-in address)
                        </Label>
                        <Input
                          type="email"
                          value={v.email}
                          onChange={(e) =>
                            updateVolunteer(idx, "email", e.target.value)
                          }
                          placeholder="jane@example.com"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <Label className="text-xs">Phone</Label>
                        <Input
                          value={v.phoneNumber}
                          onChange={(e) =>
                            updateVolunteer(idx, "phoneNumber", e.target.value)
                          }
                          placeholder="+1 555 123 4567"
                        />
                      </div>
                      <div className="md:col-span-1 flex md:justify-end">
                        <Button
                          type="button"
                          variant="buttonOutline"
                          size="icon"
                          onClick={() => removeVolunteer(idx)}
                          title="Remove volunteer"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="buttonOutline"
                    onClick={addVolunteer}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Volunteer
                  </Button>
                </CardContent>
              </Card>
            </ModuleGate>
          </TabsContent>

          {/* MEDIA TAB */}
          <TabsContent value="media">
            <ModuleGate moduleKey="events" sectionKey="media">
              <Card>
                <CardHeader>
                  <CardTitle>Event Media</CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Ad Bar — sticky marquee strip that shows at the
                    very top of the eventfront (above the banner).
                    Modelled on kioscart-v1's storefront adBar so the
                    look-and-feel matches. Sits first in the Media tab
                    so the form mirrors the rendered order on the
                    eventfront: bar → banner → gallery → reels. */}
                  <div className="space-y-3 rounded-lg border border-gray-200 p-4 bg-gray-50/40">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Label className="text-base font-semibold">
                          Ad Bar
                        </Label>
                        <p className="text-sm text-gray-600">
                          A continuously-scrolling announcement strip that sits
                          at the very top of the event page. Use it for promo
                          codes, early-bird notices, or last- minute updates.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 shrink-0">
                        <Switch
                          id="ad-bar-visible"
                          checked={adBar.visible}
                          onCheckedChange={(checked) =>
                            setAdBar((p) => ({ ...p, visible: !!checked }))
                          }
                        />
                        <Label
                          htmlFor="ad-bar-visible"
                          className="text-sm font-medium"
                        >
                          Show
                        </Label>
                      </div>
                    </div>

                    {adBar.visible && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                            Message
                          </Label>
                          <Input
                            value={adBar.message}
                            onChange={(e) =>
                              setAdBar((p) => ({
                                ...p,
                                message: e.target.value,
                              }))
                            }
                            placeholder="Early-bird tickets end Friday — use code EARLY20 for 20% off"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                              Background
                            </Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={adBar.bgColor || "#000000"}
                                onChange={(e) =>
                                  setAdBar((p) => ({
                                    ...p,
                                    bgColor: e.target.value,
                                  }))
                                }
                                className="h-9 w-12 rounded border border-gray-300 cursor-pointer"
                              />
                              <Input
                                value={adBar.bgColor}
                                onChange={(e) =>
                                  setAdBar((p) => ({
                                    ...p,
                                    bgColor: e.target.value,
                                  }))
                                }
                                placeholder="#000000"
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                              Text
                            </Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={adBar.textColor || "#ffffff"}
                                onChange={(e) =>
                                  setAdBar((p) => ({
                                    ...p,
                                    textColor: e.target.value,
                                  }))
                                }
                                className="h-9 w-12 rounded border border-gray-300 cursor-pointer"
                              />
                              <Input
                                value={adBar.textColor}
                                onChange={(e) =>
                                  setAdBar((p) => ({
                                    ...p,
                                    textColor: e.target.value,
                                  }))
                                }
                                placeholder="#ffffff"
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Live preview — renders the same marquee
                          AnnouncementBar the eventfront uses so the
                          organizer can dial in colors without saving
                          and reloading. */}
                        {adBar.message.trim() && (
                          <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                              Preview
                            </Label>
                            <div className="rounded-md overflow-hidden border border-gray-200">
                              <AnnouncementBar
                                message={adBar.message.trim()}
                                backgroundColor={adBar.bgColor || "#000000"}
                                textColor={adBar.textColor || "#ffffff"}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <EventBanner
                    bannerFile={bannerFile}
                    setBannerFile={setBannerFile}
                    bannerPreview={bannerPreview}
                    setBannerPreview={setBannerPreview}
                  />
                  <EventGallery
                    galleryImages={galleryImages}
                    setGalleryImages={setGalleryImages}
                  />

                  {/* Sponsorships — logos shown below the event banner on the
                    eventfront as a left-to-right moving carousel. No limit. */}
                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <Label className="text-base font-semibold">
                          Sponsorships ({sponsorLogos.length})
                        </Label>
                        <p className="text-sm text-gray-600">
                          Upload sponsor logos — they appear below the event
                          banner as a moving carousel on the eventfront. Add as
                          many as you like.
                        </p>
                      </div>
                      <label
                        htmlFor="upload-sponsors"
                        className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        <Plus size={16} /> Add Logos
                      </label>
                      <input
                        id="upload-sponsors"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleSponsorUpload}
                      />
                    </div>

                    {sponsorLogos.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                        {sponsorLogos.map((s) => (
                          <div
                            key={s.id}
                            className="group relative flex h-20 items-center justify-center rounded-lg border bg-white p-2"
                          >
                            <img
                              src={
                                s.preview.startsWith("blob:") ||
                                /^https?:\/\//.test(s.preview)
                                  ? s.preview
                                  : `${__API_URL__}${s.preview}`
                              }
                              alt="Sponsor logo"
                              loading="lazy"
                              className="max-h-full max-w-full object-contain"
                            />
                            <button
                              type="button"
                              onClick={() => removeSponsor(s.id)}
                              className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              aria-label="Remove sponsor"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                        No sponsor logos yet. Click "Add Logos" to upload.
                      </div>
                    )}

                    {sponsorLogos.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Preview — moves left-to-right on the eventfront
                        </p>
                        <div className="overflow-hidden rounded-lg border">
                          <SponsorMarquee
                            logos={sponsorLogos.map((s) =>
                              s.preview.startsWith("blob:") ||
                              /^https?:\/\//.test(s.preview)
                                ? s.preview
                                : `${__API_URL__}${s.preview}`,
                            )}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Instagram Reels — up to 10 URLs. Persisted as a
                    string[] on the event; the eventfront turns each
                    URL into an embeddable /reel/<id>/embed iframe so
                    visitors can play reels inline without leaving the
                    page. Empty rows are dropped on submit. */}
                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <Label className="text-base font-semibold">
                          Instagram Reels ({reelLinks.length}/10)
                        </Label>
                        <p className="text-sm text-gray-600">
                          Paste up to 10 Instagram reel URLs (e.g.
                          <span className="font-mono text-[11px] mx-1">
                            https://www.instagram.com/reel/&lt;id&gt;/
                          </span>
                          ). The reel and the Instagram account must be
                          <strong> public</strong> — Instagram won't embed
                          private or restricted reels and will render a
                          placeholder card instead.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={reelLinks.length >= 10}
                        onClick={() => setReelLinks([...reelLinks, ""])}
                      >
                        <Plus size={14} className="mr-1" /> Add reel
                      </Button>
                    </div>
                    {reelLinks.length === 0 && (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <Instagram className="h-10 w-10 text-pink-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">
                          No reels yet — click "Add reel" to drop in a link.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      {reelLinks.map((url, idx) => {
                        const trimmed = (url || "").trim();
                        const isInstagram =
                          !trimmed ||
                          /^https?:\/\/(www\.)?instagram\.com\//i.test(trimmed);
                        return (
                          <div key={idx} className="flex items-start gap-2">
                            <div className="flex-1">
                              <Input
                                value={url}
                                onChange={(e) => {
                                  const next = [...reelLinks];
                                  next[idx] = e.target.value;
                                  setReelLinks(next);
                                }}
                                placeholder="https://www.instagram.com/reel/Cxyz123/"
                                className={isInstagram ? "" : "border-red-400"}
                              />
                              {!isInstagram && (
                                <p className="text-xs text-red-500 mt-1">
                                  Doesn't look like an Instagram reel URL.
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() =>
                                setReelLinks(
                                  reelLinks.filter((_, i) => i !== idx),
                                )
                              }
                              title="Remove this reel"
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </ModuleGate>
          </TabsContent>

          <TabsContent value="visitors" className="space-y-6">
            <ModuleGate moduleKey="events" sectionKey="visitors">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users size={20} />
                    Visitor Types
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-sm text-gray-500">
                    Define different visitor categories (e.g. Normal, Delegate,
                    VIP). Leave <strong>Max Count</strong> empty for unlimited
                    entries.
                  </p>
                  <div className="border rounded-lg p-4 bg-slate-50 space-y-4">
                    <Label className="text-sm font-semibold text-slate-700">
                      Add New Visitor Type
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label>Type Name *</Label>
                        <Input
                          value={currentVisitor.name}
                          onChange={(e) =>
                            setCurrentVisitor((p) => ({
                              ...p,
                              name: e.target.value,
                            }))
                          }
                          placeholder="e.g. VIP, Delegate, General"
                        />
                      </div>
                      <div>
                        <Label>Entry Price *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={
                            isIndividualAccount ? "0" : currentVisitor.price
                          }
                          onChange={(e) => {
                            if (isIndividualAccount) return;
                            setCurrentVisitor((p) => ({
                              ...p,
                              price: e.target.value,
                            }));
                          }}
                          disabled={isIndividualAccount}
                          placeholder="0 = Free"
                        />
                        {isIndividualAccount && (
                          <p className="text-[11px] text-amber-600 mt-1">
                            Individual accounts can only publish free events (no
                            payment processor configured). Upgrade to an
                            Organizer account to charge for tickets.
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>
                          Max Count{" "}
                          <span className="text-gray-400 text-xs">
                            (blank = unlimited)
                          </span>
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={currentVisitor.maxCount}
                          onChange={(e) =>
                            setCurrentVisitor((p) => ({
                              ...p,
                              maxCount: e.target.value,
                            }))
                          }
                          placeholder="e.g. 100"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={currentVisitor.description}
                        onChange={(e) =>
                          setCurrentVisitor((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Brief description of this visitor type"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        Feature Access
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Object.keys(currentVisitor.featureAccess).map(
                          (feature) => (
                            <div
                              key={feature}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                checked={
                                  !!currentVisitor.featureAccess[
                                    feature as keyof VisitorFeatureAccess
                                  ]
                                }
                                onCheckedChange={(checked) =>
                                  setCurrentVisitor((p) => ({
                                    ...p,
                                    featureAccess: {
                                      ...p.featureAccess,
                                      [feature]: !!checked,
                                    },
                                  }))
                                }
                              />
                              <Label className="capitalize text-sm">
                                {feature}
                              </Label>
                              {!DEFAULT_FEATURE_NAMES.includes(feature) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 text-red-400 hover:text-red-600"
                                  onClick={() => {
                                    setCurrentVisitor((p) => {
                                      const fa = { ...p.featureAccess };
                                      delete (fa as any)[feature];
                                      return { ...p, featureAccess: fa };
                                    });
                                  }}
                                >
                                  <X size={10} />
                                </Button>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Input
                          placeholder="Add custom feature (e.g. Lounge, Charging Station)"
                          className="flex-1 h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const val = (e.target as HTMLInputElement).value
                                .trim()
                                .toLowerCase();
                              if (
                                val &&
                                !currentVisitor.featureAccess.hasOwnProperty(
                                  val,
                                )
                              ) {
                                setCurrentVisitor((p) => ({
                                  ...p,
                                  featureAccess: {
                                    ...p.featureAccess,
                                    [val]: true,
                                  },
                                }));
                                (e.target as HTMLInputElement).value = "";
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            const input = document.getElementById(
                              "custom-feature-input",
                            ) as HTMLInputElement;
                            if (!input) return;
                            const val = input.value.trim().toLowerCase();
                            if (
                              val &&
                              !currentVisitor.featureAccess.hasOwnProperty(val)
                            ) {
                              setCurrentVisitor((p) => ({
                                ...p,
                                featureAccess: {
                                  ...p.featureAccess,
                                  [val]: true,
                                },
                              }));
                              input.value = "";
                            }
                          }}
                        >
                          <Plus size={12} className="mr-1" /> Add
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Press Enter or click Add to create a custom feature
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={addVisitorType}
                        className="w-full md:w-auto"
                      >
                        {editingVisitorId ? (
                          <>
                            <Pencil size={16} className="mr-2" /> Update Visitor
                            Type
                          </>
                        ) : (
                          <>
                            <Plus size={16} className="mr-2" /> Add Visitor Type
                          </>
                        )}
                      </Button>
                      {editingVisitorId && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetVisitorForm}
                          className="w-full md:w-auto"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                  {visitorTypes.length === 0 && (
                    <div className="text-sm text-gray-400 border border-dashed rounded-lg p-6 text-center">
                      No visitor types added yet. Add at least one above.
                    </div>
                  )}
                  <div className="space-y-3">
                    {visitorTypes.map((visitor, index) => (
                      <div
                        key={visitor.id}
                        className={`border rounded-lg p-4 bg-white space-y-3 ${
                          editingVisitorId === visitor.id
                            ? "ring-2 ring-primary border-primary"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 text-primary rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold">
                                {visitor.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {visitor.price === 0
                                  ? "Free"
                                  : formatPrice(visitor.price)}{" "}
                                ·{" "}
                                {visitor.maxCount
                                  ? `Max ${visitor.maxCount}`
                                  : "Unlimited"}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/80"
                              onClick={() => editVisitorType(visitor.id)}
                            >
                              <Pencil size={14} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => removeVisitorType(visitor.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                        {visitor.description && (
                          <p className="text-sm text-gray-600 bg-gray-50 rounded px-3 py-2">
                            {visitor.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {(
                            Object.entries(visitor.featureAccess) as [
                              keyof VisitorFeatureAccess,
                              boolean,
                            ][]
                          )
                            .filter(([, val]) => val)
                            .map(([feat]) => (
                              <Badge
                                key={feat}
                                variant="secondary"
                                className="capitalize text-xs"
                              >
                                {feat}
                              </Badge>
                            ))}
                          {Object.values(visitor.featureAccess).every(
                            (v) => !v,
                          ) && (
                            <span className="text-xs text-gray-400">
                              No special feature access
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </ModuleGate>
          </TabsContent>

          <TabsContent value="speakers" className="space-y-6">
            <ModuleGate moduleKey="events" sectionKey="speakers">
              {/* SECTION 1: Speaker Space (Physical Zone) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic size={20} />
                    Speaker Space
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Define the physical speaker zone — dimensions, stage type,
                    and pricing. This zone will appear on your venue layout.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border rounded-xl p-5 bg-slate-50 space-y-4">
                    <Label className="text-sm font-semibold text-slate-700">
                      Add Speaker Space
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Space Name *</Label>
                        <Input
                          value={currentSpeakerSlot.name}
                          onChange={(e) =>
                            setCurrentSpeakerSlot((p) => ({
                              ...p,
                              name: e.target.value,
                            }))
                          }
                          placeholder="e.g. Main Stage, Workshop Room, Panel Area"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={currentSpeakerSlot.description}
                          onChange={(e) =>
                            setCurrentSpeakerSlot((p) => ({
                              ...p,
                              description: e.target.value,
                            }))
                          }
                          placeholder="Brief description of this space"
                        />
                      </div>
                    </div>

                    {/* Main Stage Toggle */}
                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                      <div>
                        <Label className="text-sm font-medium">
                          Is Main Stage
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Uses the venue's main stage — dimensions are auto-set
                        </p>
                      </div>
                      <Checkbox
                        checked={currentSpeakerSlot.isMainStage}
                        onCheckedChange={(checked) =>
                          setCurrentSpeakerSlot((p) => ({
                            ...p,
                            isMainStage: !!checked,
                          }))
                        }
                      />
                    </div>

                    {/* Dimensions (only if NOT main stage) */}
                    {!currentSpeakerSlot.isMainStage && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Width (px)</Label>
                          <Input
                            type="number"
                            min="50"
                            value={currentSpeakerSlot.width}
                            onChange={(e) =>
                              setCurrentSpeakerSlot((p) => ({
                                ...p,
                                width: e.target.value,
                              }))
                            }
                            placeholder="200"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Height (px)</Label>
                          <Input
                            type="number"
                            min="50"
                            value={currentSpeakerSlot.height}
                            onChange={(e) =>
                              setCurrentSpeakerSlot((p) => ({
                                ...p,
                                height: e.target.value,
                              }))
                            }
                            placeholder="100"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs">Slot Price (0 = Free)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={currentSpeakerSlot.slotPrice}
                          onChange={(e) =>
                            setCurrentSpeakerSlot((p) => ({
                              ...p,
                              slotPrice: e.target.value,
                            }))
                          }
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max Speakers</Label>
                        <Input
                          type="number"
                          min="1"
                          value={currentSpeakerSlot.maxSpeakers}
                          onChange={(e) =>
                            setCurrentSpeakerSlot((p) => ({
                              ...p,
                              maxSpeakers: e.target.value,
                            }))
                          }
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max Visitors Allowed</Label>
                        <Input
                          type="number"
                          min="0"
                          value={currentSpeakerSlot.maxVisitors || ""}
                          onChange={(e) =>
                            setCurrentSpeakerSlot((p) => ({
                              ...p,
                              maxVisitors: e.target.value,
                            }))
                          }
                          placeholder="0 = Unlimited"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border">
                      <div>
                        <Label className="text-sm font-medium">
                          Open for External Applications
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Allow outside speakers to apply for sessions in this
                          space
                        </p>
                      </div>
                      <Checkbox
                        checked={currentSpeakerSlot.openForApplications}
                        onCheckedChange={(checked) =>
                          setCurrentSpeakerSlot((p) => ({
                            ...p,
                            openForApplications: !!checked,
                          }))
                        }
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={addSpeakerSlot}
                        className="w-full md:w-auto"
                      >
                        {editingSpeakerId ? (
                          <>
                            <Pencil size={16} className="mr-2" /> Update Speaker
                            Space
                          </>
                        ) : (
                          <>
                            <Plus size={16} className="mr-2" /> Add Speaker
                            Space
                          </>
                        )}
                      </Button>
                      {editingSpeakerId && (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full md:w-auto"
                          onClick={resetSpeakerForm}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Speaker Spaces List */}
                  {speakerSlotTemplates.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed rounded-xl">
                      <Mic className="mx-auto h-10 w-10 text-muted-foreground/30" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        No speaker spaces created yet
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        Add a space above, then create session slots within it
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SECTION 2: Session Slots within each Speaker Space */}
              {speakerSlotTemplates.map((space, spaceIdx) => (
                <Card
                  key={space.id}
                  className={`border-2 border-purple-200 ${
                    editingSpeakerId === space.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <CardHeader className="bg-purple-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 text-purple-700 rounded-lg w-10 h-10 flex items-center justify-center text-sm font-bold">
                          {spaceIdx + 1}
                        </div>
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            {space.name}
                            {space.isMainStage && (
                              <Badge className="bg-purple-100 text-purple-700 text-[10px]">
                                MAIN STAGE
                              </Badge>
                            )}
                            {space.openForApplications && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-green-600 border-green-300"
                              >
                                Open
                              </Badge>
                            )}
                          </CardTitle>
                          <p className="text-xs text-gray-500">
                            {space.isMainStage
                              ? "Main Stage"
                              : `${space.width}×${space.height}px`}
                            {" · "}
                            {space.slotPrice > 0
                              ? formatPrice(space.slotPrice)
                              : "Free"}
                            {" · "}Max {space.maxSpeakers} speaker
                            {space.maxSpeakers > 1 ? "s" : ""}
                            {" · "}
                            {space.maxVisitors > 0
                              ? `${space.maxVisitors} visitors`
                              : "Unlimited visitors"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-primary hover:text-primary/80"
                          onClick={() => editSpeakerSlot(space.id)}
                        >
                          <Pencil size={14} className="mr-1" /> Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => removeSpeakerSlot(space.id)}
                        >
                          <Trash2 size={14} className="mr-1" /> Remove Space
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {space.description && (
                      <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                        {space.description}
                      </p>
                    )}

                    {/* Session Slots */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">
                          Session Slots
                        </Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updated = [...speakerSlotTemplates];
                            const sessions = updated[spaceIdx].sessions || [];
                            sessions.push({
                              id: Math.random().toString(36).slice(2, 10),
                              speakerName: "",
                              companyName: "",
                              agenda: "",
                              description: "",
                              startTime: formData.time || "",
                              endTime: formData.endTime || "",
                              whatsAppNumber: "",
                              email: "",
                              socialLinks: {
                                linkedin: "",
                                instagram: "",
                                youtube: "",
                                facebook: "",
                                twitter: "",
                                website: "",
                              },
                            });
                            updated[spaceIdx] = {
                              ...updated[spaceIdx],
                              sessions,
                            };
                            setSpeakerSlotTemplates(updated);
                          }}
                        >
                          <Plus size={14} className="mr-1" /> Add Session
                        </Button>
                      </div>

                      {(!space.sessions || space.sessions.length === 0) && (
                        <div className="text-center py-6 border border-dashed rounded-lg text-sm text-muted-foreground">
                          No sessions yet. Click "Add Session" to schedule
                          speakers for this space.
                        </div>
                      )}

                      {space.sessions?.map((session: any, sessIdx: number) => {
                        const updateSession = (field: string, value: any) => {
                          const updated = [...speakerSlotTemplates];
                          const sessions = [
                            ...(updated[spaceIdx].sessions || []),
                          ];
                          sessions[sessIdx] = {
                            ...sessions[sessIdx],
                            [field]: value,
                          };
                          updated[spaceIdx] = {
                            ...updated[spaceIdx],
                            sessions,
                          };
                          setSpeakerSlotTemplates(updated);
                        };
                        const updateSocial = (field: string, value: string) => {
                          const updated = [...speakerSlotTemplates];
                          const sessions = [
                            ...(updated[spaceIdx].sessions || []),
                          ];
                          sessions[sessIdx] = {
                            ...sessions[sessIdx],
                            socialLinks: {
                              ...sessions[sessIdx].socialLinks,
                              [field]: value,
                            },
                          };
                          updated[spaceIdx] = {
                            ...updated[spaceIdx],
                            sessions,
                          };
                          setSpeakerSlotTemplates(updated);
                        };
                        const removeSession = () => {
                          const updated = [...speakerSlotTemplates];
                          const sessions = [
                            ...(updated[spaceIdx].sessions || []),
                          ];
                          sessions.splice(sessIdx, 1);
                          updated[spaceIdx] = {
                            ...updated[spaceIdx],
                            sessions,
                          };
                          setSpeakerSlotTemplates(updated);
                        };

                        return (
                          <div
                            key={session.id}
                            className="border rounded-xl p-4 bg-white space-y-4"
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className="text-xs">
                                Session {sessIdx + 1}
                              </Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 h-7"
                                onClick={removeSession}
                              >
                                <Trash2 size={12} className="mr-1" /> Remove
                              </Button>
                            </div>

                            {/* Speaker Photo + Details */}
                            <div className="grid grid-cols-1 md:grid-cols-[80px_1fr] gap-4">
                              {/* Photo Upload */}
                              <div className="flex flex-col items-center gap-1">
                                <div
                                  className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary transition-colors bg-gray-50"
                                  onClick={() =>
                                    document
                                      .getElementById(
                                        `session-img-${spaceIdx}-${sessIdx}`,
                                      )
                                      ?.click()
                                  }
                                >
                                  {session.photoPreview || session.photo ? (
                                    <img
                                      src={
                                        session.photoPreview ||
                                        (session.photo?.startsWith("/")
                                          ? `${__API_URL__?.replace("/api", "") || ""}${session.photo}`
                                          : session.photo)
                                      }
                                      alt={session.speakerName}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Upload className="h-5 w-5 text-muted-foreground" />
                                  )}
                                </div>
                                <input
                                  id={`session-img-${spaceIdx}-${sessIdx}`}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      updateSession("photoFile", file);
                                      updateSession(
                                        "photoPreview",
                                        URL.createObjectURL(file),
                                      );
                                    }
                                  }}
                                />
                                <span className="text-[9px] text-muted-foreground">
                                  Photo
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-xs">
                                    Speaker Name *
                                  </Label>
                                  <Input
                                    value={session.speakerName}
                                    onChange={(e) =>
                                      updateSession(
                                        "speakerName",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Full name of the speaker"
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">
                                    Company / Organization
                                  </Label>
                                  <Input
                                    value={session.companyName}
                                    onChange={(e) =>
                                      updateSession(
                                        "companyName",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="e.g. Google, MIT (optional)"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Agenda */}
                            <div>
                              <Label className="text-xs">
                                Agenda / Topic *
                              </Label>
                              <Input
                                value={session.agenda}
                                onChange={(e) =>
                                  updateSession("agenda", e.target.value)
                                }
                                placeholder="What will they speak about?"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">
                                Session Description
                              </Label>
                              <Textarea
                                rows={2}
                                value={session.description || ""}
                                onChange={(e) =>
                                  updateSession("description", e.target.value)
                                }
                                placeholder="Detailed session description..."
                              />
                            </div>

                            {/* Timing (validated against event start/end) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Start Time *</Label>
                                <Input
                                  type="time"
                                  value={session.startTime}
                                  min={formData.time || undefined}
                                  max={formData.endTime || undefined}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (formData.time && val < formData.time) {
                                      toast({
                                        title: "Invalid Time",
                                        description: `Start time cannot be before event start (${formData.time})`,
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    if (
                                      formData.endTime &&
                                      val > formData.endTime
                                    ) {
                                      toast({
                                        title: "Invalid Time",
                                        description: `Start time cannot be after event end (${formData.endTime})`,
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    updateSession("startTime", val);
                                  }}
                                />
                                {formData.time && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Event starts: {formData.time}
                                  </p>
                                )}
                              </div>
                              <div>
                                <Label className="text-xs">End Time *</Label>
                                <Input
                                  type="time"
                                  value={session.endTime}
                                  min={
                                    session.startTime ||
                                    formData.time ||
                                    undefined
                                  }
                                  max={formData.endTime || undefined}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (
                                      session.startTime &&
                                      val < session.startTime
                                    ) {
                                      toast({
                                        title: "Invalid Time",
                                        description:
                                          "End time must be after start time",
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    if (
                                      formData.endTime &&
                                      val > formData.endTime
                                    ) {
                                      toast({
                                        title: "Invalid Time",
                                        description: `End time cannot exceed event end (${formData.endTime})`,
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    updateSession("endTime", val);
                                  }}
                                />
                                {formData.endTime && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Event ends: {formData.endTime}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Contact */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">
                                  WhatsApp Number
                                </Label>
                                <Input
                                  value={session.whatsAppNumber || ""}
                                  onChange={(e) =>
                                    updateSession(
                                      "whatsAppNumber",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="+91 98765 43210"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Email</Label>
                                <Input
                                  type="email"
                                  value={session.email || ""}
                                  onChange={(e) =>
                                    updateSession("email", e.target.value)
                                  }
                                  placeholder="speaker@example.com"
                                />
                              </div>
                            </div>

                            {/* Social Links */}
                            <div>
                              <Label className="text-xs font-medium mb-2 block">
                                Social Media Links
                              </Label>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                <Input
                                  placeholder="LinkedIn URL"
                                  value={session.socialLinks?.linkedin || ""}
                                  onChange={(e) =>
                                    updateSocial("linkedin", e.target.value)
                                  }
                                />
                                <Input
                                  placeholder="Instagram URL"
                                  value={session.socialLinks?.instagram || ""}
                                  onChange={(e) =>
                                    updateSocial("instagram", e.target.value)
                                  }
                                />
                                <Input
                                  placeholder="YouTube URL"
                                  value={session.socialLinks?.youtube || ""}
                                  onChange={(e) =>
                                    updateSocial("youtube", e.target.value)
                                  }
                                />
                                <Input
                                  placeholder="Facebook URL"
                                  value={session.socialLinks?.facebook || ""}
                                  onChange={(e) =>
                                    updateSocial("facebook", e.target.value)
                                  }
                                />
                                <Input
                                  placeholder="Twitter / X URL"
                                  value={session.socialLinks?.twitter || ""}
                                  onChange={(e) =>
                                    updateSocial("twitter", e.target.value)
                                  }
                                />
                                <Input
                                  placeholder="Website URL"
                                  value={session.socialLinks?.website || ""}
                                  onChange={(e) =>
                                    updateSocial("website", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </ModuleGate>
          </TabsContent>

          {/* VENUE SETUP TAB */}
          <TabsContent value="venue" className="space-y-6">
            <ModuleGate moduleKey="events" sectionKey="venue">
              {/* Event Sections — controls which tabs appear in this form */}

              <BlurOverlay visible={!blurActive}>
                {/* Import a whole saved venue layout as a new venue — top of
                  Venue Setup so it's the first thing an organizer sees. */}
                <VenueTemplatePicker onImport={importVenueTemplate} />

                <VenueConfiguration
                  venueConfigurations={venueConfigurations}
                  setVenueConfigurations={setVenueConfigurations}
                  selectedVenueConfigId={selectedVenueConfigId}
                  setSelectedVenueConfigId={setSelectedVenueConfigId}
                />

                <Card className="mt-5">
                  <CardHeader>
                    <CardTitle>Event Sections</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pick the modules this event uses. Tabs you turn off will
                      be hidden from this form.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <label className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <Switch
                          checked={!!formData.features.hasStalls}
                          onCheckedChange={(checked) =>
                            handleFeatureChange("hasStalls", checked)
                          }
                        />
                        <div>
                          <p className="font-medium text-sm">Spaces / AddOns</p>
                          <p className="text-xs text-muted-foreground">
                            Booths, stalls, exhibitor spaces
                          </p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <Switch
                          checked={!!formData.features.hasRoundTables}
                          onCheckedChange={(checked) =>
                            handleFeatureChange("hasRoundTables", checked)
                          }
                        />
                        <div>
                          <p className="font-medium text-sm">Round Tables</p>
                          <p className="text-xs text-muted-foreground">
                            Gala / banquet seating
                          </p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 border rounded-lg p-3 cursor-pointer hover:bg-muted/30">
                        <Switch
                          checked={!!formData.features.hasSpeakers}
                          onCheckedChange={(checked) =>
                            handleFeatureChange("hasSpeakers", checked)
                          }
                        />
                        <div>
                          <p className="font-medium text-sm">Speaker Spaces</p>
                          <p className="text-xs text-muted-foreground">
                            Sessions, keynotes, panels
                          </p>
                        </div>
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </BlurOverlay>
            </ModuleGate>
          </TabsContent>

          {/* TABLES TAB */}
          <TabsContent value="tables">
            <ModuleGate moduleKey="events" sectionKey="tables">
              <BlurOverlay visible={!blurActive}>
                <TableManagement
                  tableTemplates={tableTemplates}
                  setTableTemplates={setTableTemplates}
                  addOnItems={addOnItems}
                  setAddOnItems={setAddOnItems}
                  currentTable={currentTable}
                  setCurrentTable={setCurrentTable}
                  currentAddOn={currentAddOn}
                  setCurrentAddOn={setCurrentAddOn}
                  venueConfigurations={venueConfigurations}
                  selectedVenueConfigId={selectedVenueConfigId}
                  maxSpacesPerVendor={maxSpacesPerVendor}
                  setMaxSpacesPerVendor={setMaxSpacesPerVendor}
                />
              </BlurOverlay>
            </ModuleGate>
          </TabsContent>

          {/* ROUND TABLES TAB */}
          <TabsContent value="roundtables">
            <ModuleGate moduleKey="events" sectionKey="roundtables">
              <BlurOverlay visible={!blurActive}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Circle size={20} />
                      Round Table Templates
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Create round tables for seating (charity dinners, galas,
                      etc.). Visitors can purchase seats directly.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Add Round Table Form */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border rounded-lg bg-slate-50">
                      <div>
                        <Label>Table Name *</Label>
                        <Input
                          placeholder="e.g. Platinum Table"
                          value={currentRoundTable.name}
                          onChange={(e) =>
                            setCurrentRoundTable({
                              ...currentRoundTable,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Number of Chairs</Label>
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={currentRoundTable.numberOfChairs}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = parseInt(v);
                            setCurrentRoundTable({
                              ...currentRoundTable,
                              numberOfChairs: v,
                              // A standing table (0 chairs) has no seats to
                              // sell individually — force whole-table mode.
                              sellingMode:
                                Number.isFinite(n) && n === 0
                                  ? "table"
                                  : currentRoundTable.sellingMode,
                            });
                          }}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Set to <strong>0</strong> for a standing table (no
                          seats).
                        </p>
                      </div>
                      <div>
                        <Label>Category</Label>
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={currentRoundTable.category}
                          onChange={(e) =>
                            setCurrentRoundTable({
                              ...currentRoundTable,
                              category: e.target.value,
                            })
                          }
                        >
                          <option value="Platinum">Platinum</option>
                          <option value="Gold">Gold</option>
                          <option value="Silver">Silver</option>
                          <option value="Standard">Standard</option>
                          <option value="VIP">VIP</option>
                        </select>
                      </div>

                      {/* For Sale / Not for Sale toggle (mirrors Spaces). */}
                      <div>
                        <Label>Table Type</Label>
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-all ${
                              currentRoundTable.forSale
                                ? "border-green-500 bg-green-50 text-green-700"
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                            onClick={() =>
                              setCurrentRoundTable({
                                ...currentRoundTable,
                                forSale: true,
                              })
                            }
                          >
                            For Sale
                          </button>
                          <button
                            type="button"
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold border-2 transition-all ${
                              !currentRoundTable.forSale
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                            }`}
                            onClick={() =>
                              setCurrentRoundTable({
                                ...currentRoundTable,
                                forSale: false,
                              })
                            }
                          >
                            Not for Sale
                          </button>
                        </div>
                      </div>

                      {!currentRoundTable.forSale && (
                        <div className="md:col-span-2 lg:col-span-3 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                          This table is <strong>not for sale</strong> — it
                          appears on the venue layout as a reference (e.g. a
                          standing cocktail table or decoration) but cannot be
                          booked.
                        </div>
                      )}

                      {currentRoundTable.forSale &&
                        parseInt(currentRoundTable.numberOfChairs) !== 0 && (
                          <div>
                            <Label>Selling Mode *</Label>
                            <div className="flex gap-2 mt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  currentRoundTable.sellingMode === "chair"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  setCurrentRoundTable({
                                    ...currentRoundTable,
                                    sellingMode: "chair",
                                  })
                                }
                              >
                                Per Chair
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={
                                  currentRoundTable.sellingMode === "table"
                                    ? "default"
                                    : "outline"
                                }
                                onClick={() =>
                                  setCurrentRoundTable({
                                    ...currentRoundTable,
                                    sellingMode: "table",
                                  })
                                }
                              >
                                Whole Table
                              </Button>
                            </div>
                          </div>
                        )}
                      {currentRoundTable.forSale &&
                        (currentRoundTable.sellingMode === "chair" ? (
                          <div>
                            <Label>Price Per Chair ({getSymbol()}) *</Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={currentRoundTable.chairPrice}
                              onChange={(e) =>
                                setCurrentRoundTable({
                                  ...currentRoundTable,
                                  chairPrice: e.target.value,
                                })
                              }
                            />
                          </div>
                        ) : (
                          <div>
                            <Label>Table Price ({getSymbol()}) *</Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={currentRoundTable.tablePrice}
                              onChange={(e) =>
                                setCurrentRoundTable({
                                  ...currentRoundTable,
                                  tablePrice: e.target.value,
                                })
                              }
                            />
                          </div>
                        ))}

                      {/* Booking + Deposit (optional, mirrors Spaces). */}
                      {currentRoundTable.forSale && (
                        <>
                          <div>
                            <Label>Booking Price ({getSymbol()})</Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={currentRoundTable.bookingPrice}
                              onChange={(e) =>
                                setCurrentRoundTable({
                                  ...currentRoundTable,
                                  bookingPrice: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div>
                            <Label>Deposit Price ({getSymbol()})</Label>
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={currentRoundTable.depositPrice}
                              onChange={(e) =>
                                setCurrentRoundTable({
                                  ...currentRoundTable,
                                  depositPrice: e.target.value,
                                })
                              }
                            />
                          </div>
                        </>
                      )}

                      {/* Member-tier pricing (only when membership is on). */}
                      {currentRoundTable.forSale && isMembershipEnabled && (
                        <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            Member price (optional)
                          </div>
                          <p className="text-[11px] text-emerald-700/80">
                            Buyers with an active membership at this event are
                            charged these prices. Leave blank to charge the
                            regular price.
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            {currentRoundTable.sellingMode === "chair" ? (
                              <div>
                                <Label className="text-xs">
                                  Member Chair Price ({getSymbol()})
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={currentRoundTable.memberChairPrice}
                                  onChange={(e) =>
                                    setCurrentRoundTable({
                                      ...currentRoundTable,
                                      memberChairPrice: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            ) : (
                              <div>
                                <Label className="text-xs">
                                  Member Table Price ({getSymbol()})
                                </Label>
                                <Input
                                  type="number"
                                  min={0}
                                  value={currentRoundTable.memberTablePrice}
                                  onChange={(e) =>
                                    setCurrentRoundTable({
                                      ...currentRoundTable,
                                      memberTablePrice: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            )}
                            <div>
                              <Label className="text-xs">
                                Member Booking ({getSymbol()})
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                value={currentRoundTable.memberBookingPrice}
                                onChange={(e) =>
                                  setCurrentRoundTable({
                                    ...currentRoundTable,
                                    memberBookingPrice: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label className="text-xs">
                                Member Deposit ({getSymbol()})
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                value={currentRoundTable.memberDepositPrice}
                                onChange={(e) =>
                                  setCurrentRoundTable({
                                    ...currentRoundTable,
                                    memberDepositPrice: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <div>
                        <Label>Color</Label>
                        <div className="flex gap-2 mt-1">
                          {[
                            "#8B5CF6",
                            "#EF4444",
                            "#F59E0B",
                            "#10B981",
                            "#3B82F6",
                            "#EC4899",
                          ].map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={`w-8 h-8 rounded-full border-2 transition-all ${currentRoundTable.color === c ? "border-gray-800 scale-110" : "border-transparent"}`}
                              style={{ backgroundColor: c }}
                              onClick={() =>
                                setCurrentRoundTable({
                                  ...currentRoundTable,
                                  color: c,
                                })
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          type="button"
                          onClick={addRoundTableTemplate}
                          className="flex-1"
                        >
                          {editingRoundTableId ? (
                            <>
                              <Pencil size={16} className="mr-2" /> Update
                              Template
                            </>
                          ) : (
                            <>
                              <Plus size={16} className="mr-2" /> Add Template
                            </>
                          )}
                        </Button>
                        {editingRoundTableId && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={resetRoundTableForm}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Existing Templates */}
                    {roundTableTemplates.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {roundTableTemplates.map((template) => (
                          <div
                            key={template.id}
                            className={`p-4 border-2 rounded-xl bg-white ${
                              editingRoundTableId === template.id
                                ? "ring-2 ring-primary"
                                : ""
                            }`}
                            style={{ borderColor: template.color + "66" }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {/* Mini round table preview */}
                                <div
                                  className="relative"
                                  style={{ width: 48, height: 48 }}
                                >
                                  <div
                                    className="absolute rounded-full"
                                    style={{
                                      width: 28,
                                      height: 28,
                                      left: 10,
                                      top: 10,
                                      backgroundColor: template.color + "33",
                                      border: `2px solid ${template.color}`,
                                    }}
                                  />
                                  {Array.from({
                                    length: Math.min(
                                      template.numberOfChairs,
                                      12,
                                    ),
                                  }).map((_, i) => {
                                    const angle =
                                      (2 * Math.PI * i) /
                                        template.numberOfChairs -
                                      Math.PI / 2;
                                    const cx = 24 + 20 * Math.cos(angle);
                                    const cy = 24 + 20 * Math.sin(angle);
                                    return (
                                      <div
                                        key={i}
                                        className="absolute rounded-full"
                                        style={{
                                          width: 6,
                                          height: 6,
                                          left: cx - 3,
                                          top: cy - 3,
                                          backgroundColor: template.color,
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm">
                                    {template.name}
                                  </h4>
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: template.color }}
                                  >
                                    {template.category}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-primary"
                                  onClick={() =>
                                    editRoundTableTemplate(template.id)
                                  }
                                >
                                  <Pencil size={14} />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-red-500"
                                  onClick={() => {
                                    setRoundTableTemplates(
                                      roundTableTemplates.filter(
                                        (t) => t.id !== template.id,
                                      ),
                                    );
                                    if (editingRoundTableId === template.id)
                                      resetRoundTableForm();
                                  }}
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <div className="flex justify-between">
                                <span>Chairs:</span>
                                <span className="font-semibold">
                                  {template.numberOfChairs === 0
                                    ? "Standing"
                                    : template.numberOfChairs}
                                </span>
                              </div>
                              {template.forSale === false ? (
                                <div className="flex justify-between">
                                  <span>Type:</span>
                                  <span className="font-semibold text-orange-600">
                                    Not for sale
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <div className="flex justify-between">
                                    <span>Mode:</span>
                                    <span className="font-semibold">
                                      {template.sellingMode === "table"
                                        ? "Whole Table"
                                        : "Per Chair"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    {" "}
                                    <span>Price:</span>
                                    <span className="font-semibold">
                                      {template.sellingMode === "table"
                                        ? formatPrice(template.tablePrice)
                                        : `${formatPrice(template.chairPrice)} / chair`}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {roundTableTemplates.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Circle size={48} className="mx-auto mb-3 opacity-20" />
                        <p>No round table templates yet. Create one above.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </BlurOverlay>
            </ModuleGate>
          </TabsContent>

          {/* LAYOUT DESIGN TAB */}
          <TabsContent value="layout">
            <ModuleGate moduleKey="events" sectionKey="layout">
              <BlurOverlay visible={!blurActive}>
                <VenueDesigner
                  tableTemplates={tableTemplates}
                  venueTables={venueTables}
                  setVenueTables={setVenueTables}
                  venueConfigurations={venueConfigurations}
                  setVenueConfigurations={setVenueConfigurations}
                  selectedVenueConfigId={selectedVenueConfigId}
                  setSelectedVenueConfigId={setSelectedVenueConfigId}
                  venueAnnotations={venueAnnotations}
                  setVenueAnnotations={setVenueAnnotations}
                  venueRef={venueRef}
                  venueLayoutImages={venueLayoutImages}
                  setVenueLayoutImages={setVenueLayoutImages}
                  speakerSlotTemplates={speakerSlotTemplates}
                  venueSpeakerZones={venueSpeakerZones}
                  setVenueSpeakerZones={setVenueSpeakerZones}
                  roundTableTemplates={roundTableTemplates}
                  venueRoundTables={venueRoundTables}
                  setVenueRoundTables={setVenueRoundTables}
                  venueDoors={venueDoors}
                  setVenueDoors={setVenueDoors}
                  stallBookings={stallBookings}
                  addOnItems={addOnItems}
                />
              </BlurOverlay>
            </ModuleGate>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
