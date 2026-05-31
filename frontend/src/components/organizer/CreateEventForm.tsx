import { useState, useEffect, useRef, Fragment, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCountry } from "@/hooks/useCountry";
import { useSubscription } from "@/hooks/useSubscription";
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
  Type,
  Image,
  Mic,
  Circle,
  Sparkles,
  Maximize2,
  Minimize2,
  GripVertical,
  Pencil,
  ChevronDown,
  Facebook,
  Instagram,
  CopyPlus as CopyPlusIcon,
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
import {
  EventUrlImporter,
  type ImportedEventFields,
} from "./EventUrlImporter";
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
  // Whether the security deposit is part of Option 1 (minimum payment). When
  // false (default), Option 1 is the booking amount only and the deposit is
  // collected with the remaining balance — matching the long-standing booking
  // behavior. Turn on to make Option 1 = Booking + Deposit.
  depositInOption1?: boolean;
  color?: string;
  forSale?: boolean;
  isBooked?: boolean;
  bookedBy?: string;
  customDimensions?: boolean;
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
}

interface RoundTableTemplate {
  id: string;
  name: string;
  numberOfChairs: number;
  sellingMode: "table" | "chair";
  tablePrice: number;
  chairPrice: number;
  category: string;
  color: string;
  tableDiameter: number;
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
  totalRows: number; // NEW: Total number of rows
}

// Placed entrance/exit markers on the venue canvas — multiple per venue allowed.
interface PositionedDoor {
  id: string;
  x: number;
  y: number;
  type: "entrance" | "exit";
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

interface GalleryImage {
  id: string;
  file: File;
  preview: string;
  description: string;
}

// Event Banner Component
const EventBanner = ({
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
          // Optional: Pass aspect={16/9} if you want a specific ratio
        />
      )}
    </div>
  );
};

// Gallery Component with Navigation
const EventGallery = ({
  galleryImages,
  setGalleryImages,
}: {
  galleryImages: GalleryImage[];
  setGalleryImages: (images: GalleryImage[]) => void;
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
    if (galleryImages.length + files.length > 5) {
      alert("Maximum 5 images allowed");
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
        Event Gallery ({galleryImages.length}/5)
      </Label>

      {galleryImages.length < 5 && (
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
            <div className="flex flex-col gap-2">
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
              {/* Entrance + Exit shape pickers. Explicit grid so the
                  checkbox column, label column, and shape picker column
                  all line up regardless of which side(s) are enabled.
                  Picker buttons share an h-8 / w-20 footprint and show
                  an actual circle / square swatch alongside the label
                  so the choice is readable at a glance instead of just
                  reading as small text. */}
              <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-3 gap-y-2">
                {(
                  [
                    {
                      key: "hasEntrance" as const,
                      shapeKey: "entranceShape" as const,
                      label: "Entrance",
                    },
                    {
                      key: "hasExit" as const,
                      shapeKey: "exitShape" as const,
                      label: "Exit",
                    },
                  ]
                ).map(({ key, shapeKey, label }) => {
                  const enabled = !!(selectedConfig as any)[key];
                  const currentShape =
                    ((selectedConfig as any)[shapeKey] as
                      | "circle"
                      | "square"
                      | undefined) || "circle";
                  return (
                    <Fragment key={key}>
                      <Checkbox
                        checked={enabled}
                        onCheckedChange={(checked) =>
                          updateSelectedConfig({ [key]: !!checked } as any)
                        }
                      />
                      <Label className="text-sm">{label}</Label>
                      <div className="justify-self-start">
                        {enabled ? (
                          <div className="inline-flex rounded-md border overflow-hidden h-8 bg-white">
                            {(["circle", "square"] as const).map((s) => {
                              const active = currentShape === s;
                              return (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() =>
                                    updateSelectedConfig({
                                      [shapeKey]: s,
                                    } as any)
                                  }
                                  className={`w-20 h-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium capitalize border-r last:border-r-0 transition-colors ${
                                    active
                                      ? "bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:bg-muted"
                                  }`}
                                  title={`Default ${label.toLowerCase()} shape: ${s}`}
                                >
                                  <span
                                    aria-hidden
                                    className={`inline-block w-3 h-3 border ${
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
                        ) : null}
                      </div>
                    </Fragment>
                  );
                })}
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
      tablePrice:
        p.tablePrice != null ? String(p.tablePrice) : prev.tablePrice,
      bookingPrice:
        p.bookingPrice != null ? String(p.bookingPrice) : prev.bookingPrice,
      depositPrice:
        p.depositPrice != null ? String(p.depositPrice) : prev.depositPrice,
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
    depositInOption1: boolean;
    color: string;
    forSale: boolean;
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
      depositInOption1: boolean;
      color: string;
      forSale: boolean;
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
  };
  setCurrentAddOn: React.Dispatch<
    React.SetStateAction<{
      name: string;
      price: string;
      description: string;
      rawFile?: File | null;
      preview?: string;
      color?: string;
    }>
  >;
  venueConfigurations: VenueConfig[];
  selectedVenueConfigId: string;
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
    const memberBookingPrice = parseOptionalNum(currentTable.memberBookingPrice);
    const memberDepositPrice = parseOptionalNum(currentTable.memberDepositPrice);

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
      depositInOption1: currentTable.depositInOption1,
      color: currentTable.color || "#6b7280",
      forSale: currentTable.forSale,
      customDimensions: currentTable.type === "Straight",
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
      depositInOption1: false,
      color: "#6b7280",
      forSale: true,
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
      depositInOption1: t.depositInOption1 === true,
      color: t.color || "#6b7280",
      forSale: t.forSale !== false,
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
                  Exhibitors with an active membership at this event see
                  these prices. Leave blank to charge the regular price.
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

            {/* Include-deposit-in-Option-1 toggle. Controls whether the
                minimum-payment option (Option 1) is Booking + Deposit (on) or
                Booking only (off, deposit collected with the balance). */}
            {currentTable.forSale && (
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
                    Payment Options for Shopkeepers:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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
                    <div className="bg-purple-50 p-2 rounded">
                      <p className="font-medium text-purple-800">
                        Option 2: Full Payment
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
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
                        <div className="bg-teal-50 p-2 rounded">
                          <p className="font-medium text-teal-800">
                            Option 2: Full Payment
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
  selectedVenueConfigId: string;
  setSelectedVenueConfigId: (id: string) => void;
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
  selectedVenueConfigId,
  setSelectedVenueConfigId,
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
  const [addingExhibitorCategory, setAddingExhibitorCategory] =
    useState(false);

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

  // Designer canvas size — decoupled from the venue's actual size so the
  // grid keeps going past the venue boundary. The venue is drawn as a
  // dashed reference outline at (0,0); items can be placed anywhere up to
  // the canvas extents. Minimum kept generous so even a tiny venue gets a
  // workable grid surface to design on.
  const CANVAS_MIN_W = 3000;
  const CANVAS_MIN_H = 2000;
  const canvasW = venueConfig
    ? Math.max(venueConfig.width + 600, CANVAS_MIN_W)
    : CANVAS_MIN_W;
  const canvasH = venueConfig
    ? Math.max(venueConfig.height + 600, CANVAS_MIN_H)
    : CANVAS_MIN_H;

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
  const addDoorToVenue = (type: "entrance" | "exit") => {
    if (!venueConfig) return;
    const existing = currentDoors.filter((d) => d.type === type).length;
    const shape: "circle" | "square" =
      (type === "entrance"
        ? venueConfig.entranceShape
        : venueConfig.exitShape) || "circle";
    const width = shape === "square" ? 80 : 50;
    const height = shape === "square" ? 40 : 50;
    const newDoor: PositionedDoor = {
      id: Math.random().toString(36).slice(2, 15),
      type,
      shape,
      width,
      height,
      rotation: 0,
      label: `${type === "entrance" ? "IN" : "OUT"}${
        existing > 0 ? " " + (existing + 1) : ""
      }`,
      x:
        type === "entrance"
          ? 50 + existing * 30
          : venueConfig.width - width - 40 - existing * 30,
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
      if (e.key.toLowerCase() === "d") {
        if (!selectedTable) return;
        // Round tables, speaker zones, doors have separate placement
        // collections; duplication for them isn't wired yet, so skip
        // silently when the selected item isn't a Space.
        if (
          selectedTable.startsWith("rt-") ||
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
  }, [selectedTable, currentTables, canvasW, canvasH]);

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
    handle:
      | "nw"
      | "n"
      | "ne"
      | "e"
      | "se"
      | "s"
      | "sw"
      | "w",
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
    let x = r.origX;
    let y = r.origY;
    let w = r.origW;
    let h = r.origH;
    const handle = r.handle;
    // East edge — extend / pull width to the right.
    if (handle === "ne" || handle === "e" || handle === "se") {
      w = Math.max(MIN, r.origW + dx);
    }
    // West edge — extend / pull width on the left; x shifts to keep
    // the right edge anchored.
    if (handle === "nw" || handle === "w" || handle === "sw") {
      w = Math.max(MIN, r.origW - dx);
      x = r.origX + (r.origW - w);
    }
    // South edge — extend / pull height downward.
    if (handle === "sw" || handle === "s" || handle === "se") {
      h = Math.max(MIN, r.origH + dy);
    }
    // North edge — extend / pull height upward; y shifts to keep the
    // bottom edge anchored.
    if (handle === "nw" || handle === "n" || handle === "ne") {
      h = Math.max(MIN, r.origH - dy);
      y = r.origY + (r.origH - h);
    }
    // Keep the resized stall inside the canvas extents.
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

  const commitResize = () => {
    const r = resizeRef.current;
    if (!r) return;
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
        scale: 2,
        useCORS: true,
      });
      const imageDataUrl = canvas.toDataURL("image/png");
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

  useEffect(() => {
    if (currentTables.length > 0 || currentRoundTables.length > 0) {
      const timeoutId = setTimeout(captureVenueAsImage, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [currentTables, currentRoundTables, venueConfig, selectedVenueConfigId]);

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
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Click to add to venue
        </p>
        <div className="flex flex-wrap gap-3 overflow-x-auto pb-2">
          {/* Space Templates */}
          {tableTemplates.map((template) => (
            <div
              key={template.id}
              className="flex-shrink-0 w-36 p-3 border-2 rounded-xl cursor-pointer hover:shadow-md transition-all bg-white"
              style={{ borderColor: (template.color || "#6b7280") + "44" }}
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
          {tableTemplates.length > 0 && speakerSlotTemplates.length > 0 && (
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
          {(tableTemplates.length > 0 || speakerSlotTemplates.length > 0) &&
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
                {template.sellingMode === "table" ? "Whole Table" : "Per Chair"}
              </p>
            </div>
          ))}

          {/* Divider before doors */}
          {(tableTemplates.length > 0 ||
            speakerSlotTemplates.length > 0 ||
            roundTableTemplates.length > 0) &&
            (venueConfig?.hasEntrance || venueConfig?.hasExit) && (
              <div className="flex-shrink-0 w-px bg-gray-300 mx-1" />
            )}

          {/* Entrance / Exit door templates — appear when enabled in Venue Setup */}
          {venueConfig?.hasEntrance && (
            <div
              key="door-entrance-template"
              className="flex-shrink-0 w-32 p-3 border-2 border-green-300 rounded-xl cursor-pointer hover:border-green-500 hover:shadow-md transition-all bg-green-50/60"
              onClick={() => addDoorToVenue("entrance")}
              title="Click to drop an entrance on the venue"
            >
              <div className="flex items-center gap-1 mb-1">
                <div className="w-3 h-3 rounded-full bg-green-600" />
                <span className="font-bold text-xs text-green-800">
                  Entrance
                </span>
              </div>
              <p className="text-[10px] text-green-700">Click to add → drag</p>
              <p className="text-[10px] text-muted-foreground">
                Multiple allowed
              </p>
            </div>
          )}
          {venueConfig?.hasExit && (
            <div
              key="door-exit-template"
              className="flex-shrink-0 w-32 p-3 border-2 border-red-300 rounded-xl cursor-pointer hover:border-red-500 hover:shadow-md transition-all bg-red-50/60"
              onClick={() => addDoorToVenue("exit")}
              title="Click to drop an exit on the venue"
            >
              <div className="flex items-center gap-1 mb-1">
                <div className="w-3 h-3 rounded-full bg-red-600" />
                <span className="font-bold text-xs text-red-800">Exit</span>
              </div>
              <p className="text-[10px] text-red-700">Click to add → drag</p>
              <p className="text-[10px] text-muted-foreground">
                Multiple allowed
              </p>
            </div>
          )}

          {tableTemplates.length === 0 &&
            speakerSlotTemplates.length === 0 &&
            roundTableTemplates.length === 0 &&
            !venueConfig?.hasEntrance &&
            !venueConfig?.hasExit && (
              <p className="text-sm text-muted-foreground py-4 w-full text-center">
                No templates yet. Create Spaces in "Space / AddOns" tab, Speaker
                Slots in "Speakers" tab, or Round Tables in "Round Tables" tab
                first. Or enable Entrance / Exit in Venue Setup.
              </p>
            )}
        </div>
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
                      Ctrl/Cmd+D duplicate. */}
                  <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 border-l pl-2 ml-1">
                    <kbd className="px-1 py-0.5 bg-white border rounded text-slate-700 font-mono">
                      Ctrl+D
                    </kbd>
                    <span>to duplicate selected</span>
                  </div>
                </div>
              )}
            </div>
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
          )}
          <div
            className="relative border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 overflow-auto flex justify-center items-start p-6"
            style={{
              minHeight: isCanvasMaximized ? "calc(100vh - 48px)" : "700px",
            }}
          >
            <div
              ref={venueRef}
              className="relative bg-white border-2 border-gray-200 shadow-2xl rounded-lg"
              style={{
                width: canvasW * venueConfig.scale,
                height: canvasH * venueConfig.scale,
                backgroundImage: venueConfig.showGrid
                  ? `linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)`
                  : "none",
                backgroundSize: `${venueConfig.gridSize * venueConfig.scale}px ${venueConfig.gridSize * venueConfig.scale}px`,
              }}
            >
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
                const liveResize =
                  resize && resize.positionId === positionId ? resize : null;
                const pos = liveResize
                  ? { x: liveResize.x, y: liveResize.y }
                  : livePos(positionId, door.x, door.y);
                const w = liveResize ? liveResize.w : door.width ?? 50;
                const h = liveResize ? liveResize.h : door.height ?? 50;
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
                    className={`absolute flex items-center justify-center text-[10px] font-bold text-white cursor-grab shadow-md select-none ${
                      isSquare ? "rounded-md" : "rounded-full"
                    } ${
                      isDragging && isSelected ? "cursor-grabbing" : ""
                    } ${
                      isEntrance
                        ? "bg-green-600 border-2 border-green-700"
                        : "bg-red-600 border-2 border-red-700"
                    } ${isSelected ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
                    style={{
                      left: pos.x * venueConfig.scale,
                      top: pos.y * venueConfig.scale,
                      width: w * venueConfig.scale,
                      height: h * venueConfig.scale,
                      transform: `rotate(${door.rotation || 0}deg)`,
                      transformOrigin: "center center",
                    }}
                    title={`${isEntrance ? "Entrance" : "Exit"} — drag to move, click to select`}
                  >
                    <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[10px] leading-none">
                      ▲
                    </span>
                    <span>{door.label || (isEntrance ? "IN" : "OUT")}</span>
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
                              cursor: cur,
                            }}
                            title="Drag to resize"
                          />
                        ))}
                      </>
                    )}
                    {isSelected && (
                      <div
                        className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white border p-1 rounded-md shadow-xl z-50"
                        style={{
                          transform: `rotate(${-(door.rotation || 0)}deg)`,
                        }}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            rotateDoor(door.id);
                          }}
                          title="Rotate 90°"
                        >
                          <RotateCw size={12} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDoorFromVenue(door.id);
                          }}
                          title="Remove this door"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
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
                  {selectedTable === table.positionId && !table.isBooked && (
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
                            cursor: cur,
                          }}
                          title="Drag to resize"
                        />
                      ))}
                    </>
                  )}
                  {selectedTable === table.positionId && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white border p-1 rounded-md shadow-xl z-50">
                      {/* Idle = primary (clearly visible on the white
                          toolbar). Hover = darker primary fill with
                          white icon so the action being targeted reads
                          loud and clear. Delete keeps its red identity
                          since red signals destructive everywhere. */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={() => rotateTable(table.positionId)}
                        title="Rotate 90°"
                      >
                        <RotateCw size={12} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:bg-primary hover:text-primary-foreground"
                        onClick={() => duplicateTable(table.positionId)}
                        title="Duplicate (Ctrl+D)"
                      >
                        <CopyPlusIcon size={12} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:bg-red-600 hover:text-white"
                        onClick={() => removeTableFromVenue(table.positionId)}
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </div>
                );
                // Wrap booked stalls in a HoverCard so the organizer gets a
                // quick popover with the vendor name and the add-ons they
                // bought (colored circle + name). Unbooked stalls render as-is
                // to avoid the popover firing while empty stalls are dragged.
                if (booking) {
                  return (
                    <HoverCard key={table.positionId} openDelay={120}>
                      <HoverCardTrigger asChild>
                        {tableNode}
                      </HoverCardTrigger>
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
                    {isSelected && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white border p-1 rounded-md shadow-xl z-50">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            const updated = currentSpeakerZones.map((z) =>
                              z.positionId === zone.positionId
                                ? {
                                    ...z,
                                    rotation: ((z.rotation || 0) + 90) % 360,
                                  }
                                : z,
                            );
                            setVenueSpeakerZones({
                              ...venueSpeakerZones,
                              [selectedVenueConfigId]: updated,
                            });
                          }}
                        >
                          <RotateCw size={12} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => removeSpeakerZone(zone.positionId)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Placed Round Tables */}
              {currentRoundTables.map((rt) => {
                const isSelected = selectedTable === `rt-${rt.positionId}`;
                const diameter = (rt.tableDiameter || 120) * venueConfig.scale;
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
                            fontSize: Math.max(5, 6 * venueConfig.scale) + "px",
                            color: "white",
                            fontWeight: "bold",
                          }}
                        >
                          {i + 1}
                        </div>
                      );
                    })}

                    {/* Controls */}
                    {isSelected && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white border p-1 rounded-md shadow-xl z-50">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => removeRoundTable(rt.positionId)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      </MaximizableSurface>
      {/* /maximize-aware design surface */}

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
                          <PopoverContent
                            className="w-56 p-0"
                            align="start"
                          >
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
                                  setNewExhibitorCategoryInput(
                                    e.target.value,
                                  )
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
                                      Array.from(
                                        new Set([...selected, name]),
                                      ),
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
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: rt.color }}
                    />
                    <span className="text-xs font-semibold truncate">
                      {rt.name}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground">
                    {rt.numberOfChairs} chairs &middot; {rt.category}
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
      const roles: string[] = Array.isArray(decoded?.roles) ? decoded.roles : [];
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
    depositInOption1: false,
    color: "#6b7280",
    forSale: true,
  });

  // Replace your currentAddOn state with this:
  const [currentAddOn, setCurrentAddOn] = useState<{
    name: string;
    price: string;
    description: string;
    rawFile?: File | null;
    preview?: string;
    color?: string;
  }>({ name: "", price: "", description: "", color: "#6b7280" });

  const { country, setCountry } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);

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
          ? data.map((c: any) => c?.name).filter((n: any) => typeof n === "string")
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
      setFormData((old) => {
        if (old.categories.includes(canonical)) return old;
        const next = [...old.categories, canonical];
        return { ...old, categories: next, category: next[0] };
      });
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
    category: initialData?.category ?? "",
    categories:
      Array.isArray(initialData?.categories) && initialData.categories.length > 0
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
    dresscode: initialData?.dresscode ?? "Business Casual",
    specialInstructions: initialData?.specialInstructions ?? "",
    refundPolicy: initialData?.refundPolicy ?? "",
    termsAndConditions: initialData?.termsAndConditions ?? "",
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
    setVolunteers((prev) => [...prev, { name: "", email: "", phoneNumber: "" }]);
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
    category: "Standard",
    color: "#8B5CF6",
    tableDiameter: "120",
  });
  // When set, the round-table form edits this existing template in place.
  const [editingRoundTableId, setEditingRoundTableId] = useState<
    string | null
  >(null);

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
                const ext =
                  (initialData.image.split(".").pop() || "jpg").split("?")[0];
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
      if (initialData.tableTemplates) {
        setTableTemplates(initialData.tableTemplates);
      }
      if (initialData.venueTables) {
        setVenueTables(initialData.venueTables);
      }
      if (initialData.addOnItems) {
        setAddOnItems(initialData.addOnItems);
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
  }, []);

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
        const fresh = fields.stalls!
          .filter((s) => s.name && !seen.has(s.name.toLowerCase()))
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
        const fresh = fields.roundTables!
          .filter((r) => r.name && !seen.has(r.name.toLowerCase()))
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
          }));
        return [...prev, ...fresh];
      });
    }
    if (fields.speakerZones && fields.speakerZones.length > 0) {
      setSpeakerSlotTemplates((prev) => {
        const seen = new Set(
          prev.map((t: any) => (t.name || "").toLowerCase()),
        );
        const fresh = fields.speakerZones!
          .filter((z) => z.name && !seen.has(z.name.toLowerCase()))
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
      (v) => v.hasEntrance || v.hasExit,
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
      category: "Standard",
      color: "#8B5CF6",
      tableDiameter: "120",
    });
    setEditingRoundTableId(null);
  };

  // Add a new round-table template, or update the one being edited in place.
  const addRoundTableTemplate = () => {
    if (!currentRoundTable.name) {
      toast({ title: "Table name is required", variant: "destructive" });
      return;
    }
    const chairs = parseInt(currentRoundTable.numberOfChairs) || 8;
    if (chairs < 2 || chairs > 20) {
      toast({
        title: "Chairs must be between 2 and 20",
        variant: "destructive",
      });
      return;
    }
    const price =
      currentRoundTable.sellingMode === "chair"
        ? parseFloat(currentRoundTable.chairPrice) || 0
        : parseFloat(currentRoundTable.tablePrice) || 0;
    if (price <= 0) {
      toast({ title: "Price must be greater than 0", variant: "destructive" });
      return;
    }
    const templateData = {
      name: currentRoundTable.name,
      numberOfChairs: chairs,
      sellingMode: currentRoundTable.sellingMode,
      tablePrice: parseFloat(currentRoundTable.tablePrice) || 0,
      chairPrice: parseFloat(currentRoundTable.chairPrice) || 0,
      category: currentRoundTable.category,
      color: currentRoundTable.color,
      tableDiameter: parseInt(currentRoundTable.tableDiameter) || 120,
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
    setCurrentRoundTable({
      name: t.name ?? "",
      numberOfChairs: t.numberOfChairs != null ? String(t.numberOfChairs) : "8",
      sellingMode: t.sellingMode || "chair",
      tablePrice: t.tablePrice != null ? String(t.tablePrice) : "",
      chairPrice: t.chairPrice != null ? String(t.chairPrice) : "",
      category: t.category || "Standard",
      color: t.color || "#8B5CF6",
      tableDiameter: t.tableDiameter != null ? String(t.tableDiameter) : "120",
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
          key === "categories"
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

      // Add exhibition data
      data.append("tableTemplates", JSON.stringify(tableTemplates));
      data.append("venueTables", JSON.stringify(venueTables));
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

      data.append("organizerId", organizer.sub);

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
      const allDoors = Object.entries(venueDoors).flatMap(
        ([configId, doors]) =>
          (doors || []).map((d: any) => ({ ...d, venueConfigId: configId })),
      );
      data.append("venueDoors", JSON.stringify(allDoors));

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
        <div className="flex items-right justify-between p-4">
          <h1 className="text-xl font-bold ml-2">
            {editMode
              ? "Edit Event"
              : duplicateMode
                ? "Duplicate Event"
                : "Create New Event"}
          </h1>
          <div className="flex gap-2">
            <Button type="button" variant="buttonOutline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="min-w-32"
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
        // Layout tab is also useful when only Entrance/Exit are enabled (per venue),
        // since the user needs the canvas to place those door markers.
        const anyDoorsEnabled = venueConfigurations.some(
          (v) => v.hasEntrance || v.hasExit,
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
              <TabsList className={`grid w-full ${colsClass} h-12`}>
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
                    <Label>Category *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between font-normal"
                        >
                          <span className="truncate text-left">
                            {formData.categories.length === 0
                              ? "Select categories"
                              : formData.categories.length === 1
                                ? formData.categories[0]
                                : `${formData.categories.length} selected`}
                          </span>
                          <ChevronDown className="h-4 w-4 opacity-50 ml-2 flex-shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                        align="start"
                      >
                        <div className="max-h-64 overflow-y-auto py-1">
                          {categoryOptions.map((cat) => {
                            const checked =
                              formData.categories.includes(cat);
                            return (
                              <label
                                key={cat}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-primary/10 hover:text-primary cursor-pointer text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  className="rounded-none"
                                  onCheckedChange={(c) => {
                                    setFormData((old) => {
                                      const set = new Set<string>(
                                        old.categories,
                                      );
                                      if (c) set.add(cat);
                                      else set.delete(cat);
                                      const next = Array.from(set);
                                      return {
                                        ...old,
                                        categories: next,
                                        // Keep legacy `category` in sync with
                                        // the first selection so existing
                                        // read-sites still display something.
                                        category: next[0] ?? "",
                                      };
                                    });
                                  }}
                                />
                                <span>{cat}</span>
                              </label>
                            );
                          })}
                        </div>
                        {/* Add custom category — persisted to /categories so
                            every organizer/exhibitor sees it next time. */}
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
                      </PopoverContent>
                    </Popover>
                    {formData.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {formData.categories.map((cat) => (
                          <Badge
                            key={cat}
                            variant="secondary"
                            className="text-xs gap-1"
                          >
                            {cat}
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((old) => {
                                  const next = old.categories.filter(
                                    (c) => c !== cat,
                                  );
                                  return {
                                    ...old,
                                    categories: next,
                                    category: next[0] ?? "",
                                  };
                                })
                              }
                              className="hover:text-destructive"
                              aria-label={`Remove ${cat}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
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
                      onValueChange={(v) => handleInputChange("visibility", v)}
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

                {/* Event Settings Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Age Restriction</Label>
                    <Select
                      value={formData.ageRestriction}
                      onValueChange={(v) =>
                        handleInputChange("ageRestriction", v)
                      }
                    >
                      <SelectTrigger>
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
                  </div>

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
                </div>

                {/* Policies */}
                <div className="space-y-4">
                  {/* Special Instructions */}
                  <div>
                    <Label className="mb-2 block">
                      Special Instructions / Event Itinerary
                    </Label>
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
                    <Label className="mb-2 block">Refund Policy</Label>
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
                    <Label className="mb-2 block">Terms and Conditions</Label>
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
                              Mandatory — exhibitor <strong>must</strong> accept
                              this condition to proceed
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
                        A continuously-scrolling announcement strip that
                        sits at the very top of the event page. Use it
                        for promo codes, early-bird notices, or last-
                        minute updates.
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
                        No reels yet — click "Add reel" to drop in a
                        link.
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
                              className={
                                isInstagram ? "" : "border-red-400"
                              }
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
                        value={isIndividualAccount ? "0" : currentVisitor.price}
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
                          Individual accounts can only publish free events
                          (no payment processor configured). Upgrade to an
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
                              !currentVisitor.featureAccess.hasOwnProperty(val)
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
                            <div className="font-semibold">{visitor.name}</div>
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
                  Define the physical speaker zone — dimensions, stage type, and
                  pricing. This zone will appear on your venue layout.
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
                    <div className="grid grid-cols-2 gap-4">
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
                          <Plus size={16} className="mr-2" /> Add Speaker Space
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
                        updated[spaceIdx] = { ...updated[spaceIdx], sessions };
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
                        updated[spaceIdx] = { ...updated[spaceIdx], sessions };
                        setSpeakerSlotTemplates(updated);
                      };
                      const removeSession = () => {
                        const updated = [...speakerSlotTemplates];
                        const sessions = [
                          ...(updated[spaceIdx].sessions || []),
                        ];
                        sessions.splice(sessIdx, 1);
                        updated[spaceIdx] = { ...updated[spaceIdx], sessions };
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
                                    updateSession("speakerName", e.target.value)
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
                                    updateSession("companyName", e.target.value)
                                  }
                                  placeholder="e.g. Google, MIT (optional)"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Agenda */}
                          <div>
                            <Label className="text-xs">Agenda / Topic *</Label>
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
                          <div className="grid grid-cols-2 gap-3">
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
                              <Label className="text-xs">WhatsApp Number</Label>
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
              <VenueConfiguration
                venueConfigurations={venueConfigurations}
                setVenueConfigurations={setVenueConfigurations}
                selectedVenueConfigId={selectedVenueConfigId}
                setSelectedVenueConfigId={setSelectedVenueConfigId}
              />

              <Card>
                <CardHeader>
                  <CardTitle>Event Sections</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pick the modules this event uses. Tabs you turn off will be
                    hidden from this form.
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
                      <Label>Number of Chairs *</Label>
                      <Input
                        type="number"
                        min={2}
                        max={20}
                        value={currentRoundTable.numberOfChairs}
                        onChange={(e) =>
                          setCurrentRoundTable({
                            ...currentRoundTable,
                            numberOfChairs: e.target.value,
                          })
                        }
                      />
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
                    {currentRoundTable.sellingMode === "chair" ? (
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
                            <Pencil size={16} className="mr-2" /> Update Template
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
                                  length: Math.min(template.numberOfChairs, 12),
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
                                {template.numberOfChairs}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Mode:</span>
                              <span className="font-semibold">
                                {template.sellingMode === "table"
                                  ? "Whole Table"
                                  : "Per Chair"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Price:</span>
                              <span className="font-semibold">
                                {template.sellingMode === "table"
                                  ? formatPrice(template.tablePrice)
                                  : `${formatPrice(template.chairPrice)} / chair`}
                              </span>
                            </div>
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
                selectedVenueConfigId={selectedVenueConfigId}
                setSelectedVenueConfigId={setSelectedVenueConfigId}
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
