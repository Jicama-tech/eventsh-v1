import { useState, useEffect, useRef } from "react";
import { useCountry } from "@/hooks/useCountry";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  X,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react";
import { jwtDecode } from "jwt-decode";
import BlurOverlay from "../ui/blurOverlay";
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

interface CreateEventFormProps {
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  editMode?: boolean;
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
  color?: string;
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
}

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
  totalRows: number; // NEW: Total number of rows
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

  // Cropping States
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

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

          <Input
            placeholder="Image description"
            value={galleryImages[currentImageIndex]?.description || ""}
            onChange={(e) => {
              const updated = [...galleryImages];
              updated[currentImageIndex].description = e.target.value;
              setGalleryImages(updated);
            }}
          />

          {/* Thumbnails list remains the same... */}
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
                value={selectedConfig.width / 10}
                onChange={(e) =>
                  updateSelectedConfig({
                    width: parseInt(e.target.value) * 10 || 800,
                  })
                }
                min="0"
                max="200"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Height (meters)</Label>
              <Input
                type="number"
                value={selectedConfig.height / 10}
                onChange={(e) =>
                  updateSelectedConfig({
                    height: parseInt(e.target.value) * 10 || 500,
                  })
                }
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
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedConfig.hasMainStage}
                  onCheckedChange={(checked) =>
                    updateSelectedConfig({ hasMainStage: !!checked })
                  }
                />
                <Label className="text-sm">Main Stage</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
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
    color: string;
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
      color: string;
    }>
  >;
  // Update the currentAddOn prop type in TableManagement:
  currentAddOn: {
    name: string;
    price: string;
    description: string;
    rawFile?: File | null;
    preview?: string;
  };
  setCurrentAddOn: React.Dispatch<
    React.SetStateAction<{
      name: string;
      price: string;
      description: string;
      rawFile?: File | null;
      preview?: string;
    }>
  >;
  venueConfigurations: VenueConfig[];
  selectedVenueConfigId: string;
}) => {
  // const { toast } = useToast();

  const { country } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImage, setCropImage] = useState<string | null>(null);

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
    if (
      !currentTable.name ||
      !currentTable.rowNumber ||
      !currentTable.tablePrice ||
      !currentTable.bookingPrice ||
      !currentTable.depositPrice
    ) {
      toast({
        duration: 5000,
        title: "Please fill in all required fields",
        description:
          "Name, Row, Table Price, Booking Price, and Deposit are required",
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

    const newTable: TableTemplate = {
      id: Math.random().toString(36).slice(2, 15),
      name: currentTable.name,
      type: currentTable.type,
      width: dimensions.width,
      height: dimensions.height,
      rowNumber: parseInt(currentTable.rowNumber),
      tablePrice: tablePrice,
      bookingPrice: bookingPrice,
      depositPrice: depositPrice,
      color: currentTable.color || "#6b7280",
      customDimensions: currentTable.type === "Straight",
      isBooked: false,
    };

    setTableTemplates([...tableTemplates, newTable]);

    // Reset form
    setCurrentTable({
      name: "",
      type: "Straight",
      width: "",
      height: "",
      rowNumber: "1",
      tablePrice: "",
      bookingPrice: "",
      depositPrice: "",
      color: "#6b7280",
    });

    toast({
      duration: 5000,
      title: "Table template created",
      description: `${newTable.name} added to templates`,
    });
  };

  const addAddOn = () => {
    if (!currentAddOn.name || !currentAddOn.price) {
      toast({
        title: "Please fill in add-on name and price",
        variant: "destructive",
      });
      return;
    }

    const newAddOn: AddOnItem = {
      id: Math.random().toString(36).slice(2, 15),
      name: currentAddOn.name,
      price: parseFloat(currentAddOn.price),
      description: currentAddOn.description,
      rawFile: currentAddOn.rawFile || undefined,
      preview: currentAddOn.preview || undefined,
    };

    setAddOnItems([...addOnItems, newAddOn]);
    setCurrentAddOn({
      name: "",
      price: "",
      description: "",
      rawFile: null,
      preview: "",
    });

    toast({ title: "Add-on created successfully!" });
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

            {/* Color Picker */}
            <div>
              <Label className="flex items-center gap-1 mb-2">Space Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {["#6b7280", "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${currentTable.color === c ? "border-gray-800 scale-110 shadow-md" : "border-gray-200 hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setCurrentTable((prev) => ({ ...prev, color: c }))}
                  />
                ))}
                <input
                  type="color"
                  value={currentTable.color}
                  onChange={(e) => setCurrentTable((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-8 h-8 rounded-full cursor-pointer border-2 border-gray-200"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Pricing Summary */}
            {currentTable.tablePrice &&
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
                        Deposit + Booking =
                        {formatPrice(
                          parseFloat(currentTable.depositPrice) +
                            parseFloat(currentTable.bookingPrice),
                        )}
                      </p>
                      <p className="text-xs text-green-600">
                        Remaining:
                        {formatPrice(
                          parseFloat(currentTable.tablePrice) -
                            parseFloat(currentTable.bookingPrice),
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
          </div>

          <Button type="button" onClick={addTable} className="w-full">
            <Plus size={16} className="mr-2" />
            Create Space Template
          </Button>

          {tableTemplates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Space Templates ({tableTemplates.length})
              </Label>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                {tableTemplates.map((table) => (
                  <div
                    key={table.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded border-l-4"
                    style={{ borderLeftColor: table.color || "#6b7280" }}
                  >
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: table.color || "#6b7280" }} />
                        {table.name}
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
                    <Button
                      type="button"
                      variant="buttonOutline"
                      size="sm"
                      onClick={() =>
                        setTableTemplates(
                          tableTemplates.filter((t) => t.id !== table.id),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
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
                    <Plus size={16} className="mr-2" /> Add
                  </Button>
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
                    className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center gap-3">
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
                    <Button
                      type="button"
                      variant="buttonOutline"
                      size="sm"
                      onClick={() =>
                        setAddOnItems(
                          addOnItems.filter((item) => item.id !== addOn.id),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </Button>
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
}: {
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
  roundTableTemplates: RoundTableTemplate[];
  venueRoundTables: Record<string, PositionedRoundTable[]>;
  setVenueRoundTables: (tables: Record<string, PositionedRoundTable[]>) => void;
}) => {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const { country } = useCountry();
  const { formatPrice, getSymbol } = useCurrency(country);

  // Get current config
  const venueConfig =
    venueConfigurations.find((vc) => vc.id === selectedVenueConfigId) ||
    venueConfigurations[0];

  const currentTables = venueTables[selectedVenueConfigId] || [];
  const currentSpeakerZones = venueSpeakerZones[selectedVenueConfigId] || [];
  const currentRoundTables = venueRoundTables[selectedVenueConfigId] || [];

  // --- Actions ---

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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedTable || !venueConfig) return;
    const rect = venueRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (selectedTable.startsWith("rt-")) {
      const rtId = selectedTable.replace("rt-", "");
      const rt = currentRoundTables.find((r) => r.positionId === rtId);
      if (!rt) return;
      const diameter = rt.tableDiameter || 120;
      const newX = Math.max(
        0,
        Math.min(
          (e.clientX - rect.left - dragOffset.x) / venueConfig.scale,
          venueConfig.width - diameter,
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          (e.clientY - rect.top - dragOffset.y) / venueConfig.scale,
          venueConfig.height - diameter,
        ),
      );
      const updatedRTs = currentRoundTables.map((r) =>
        r.positionId === rtId ? { ...r, x: newX, y: newY } : r,
      );
      setVenueRoundTables({
        ...venueRoundTables,
        [selectedVenueConfigId]: updatedRTs,
      });
    } else if (selectedTable.startsWith("sz-")) {
      const zoneId = selectedTable.replace("sz-", "");
      const zone = currentSpeakerZones.find((z) => z.positionId === zoneId);
      if (!zone) return;
      const newX = Math.max(
        0,
        Math.min(
          (e.clientX - rect.left - dragOffset.x) / venueConfig.scale,
          venueConfig.width - zone.width,
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          (e.clientY - rect.top - dragOffset.y) / venueConfig.scale,
          venueConfig.height - zone.height,
        ),
      );
      const updatedZones = currentSpeakerZones.map((z) =>
        z.positionId === zoneId ? { ...z, x: newX, y: newY } : z,
      );
      setVenueSpeakerZones({
        ...venueSpeakerZones,
        [selectedVenueConfigId]: updatedZones,
      });
    } else {
      const table = currentTables.find((t) => t.positionId === selectedTable);
      if (!table) return;
      const newX = Math.max(
        0,
        Math.min(
          (e.clientX - rect.left - dragOffset.x) / venueConfig.scale,
          venueConfig.width - table.width,
        ),
      );
      const newY = Math.max(
        0,
        Math.min(
          (e.clientY - rect.top - dragOffset.y) / venueConfig.scale,
          venueConfig.height - table.height,
        ),
      );
      handleUpdateTable(selectedTable, { x: newX, y: newY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

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

    return {
      position: "absolute" as const,
      left: table.x * venueConfig.scale,
      top: table.y * venueConfig.scale,
      width: table.width * venueConfig.scale,
      height: table.height * venueConfig.scale,
      borderRadius,
      transform: `rotate(${table.rotation}deg)`,
      backgroundColor: table.isBooked
        ? "#ef4444"
        : isSelected
          ? "#3b82f6"
          : (table.color || "#6b7280"),
      color: "white",
      border: isSelected ? "3px solid #1d4ed8" : `2px solid ${table.color ? table.color + "88" : "#374151"}`,
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

      {/* Templates Row - Full Width Horizontal */}
      <div className="border rounded-xl bg-slate-50 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Click to add to venue
        </p>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* Space Templates */}
          {tableTemplates.map((template) => (
            <div
              key={template.id}
              className="flex-shrink-0 w-36 p-3 border-2 rounded-xl cursor-pointer hover:shadow-md transition-all bg-white"
              style={{ borderColor: (template.color || "#6b7280") + "44" }}
              onClick={() => addTableToVenue(template)}
            >
              <div className="flex items-center gap-1 mb-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: template.color || "#6b7280" }} />
                <span className="font-bold text-xs truncate">
                  {template.name}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {template.width}×{template.height}
              </p>
              <p className="text-[10px] font-semibold" style={{ color: template.color || "#6b7280" }}>
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

          {tableTemplates.length === 0 &&
            speakerSlotTemplates.length === 0 &&
            roundTableTemplates.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 w-full text-center">
                No templates yet. Create Spaces in "Space / AddOns" tab, Speaker
                Slots in "Speakers" tab, or Round Tables in "Round Tables" tab
                first.
              </p>
            )}
        </div>
      </div>

      {/* Full Width Canvas */}
      <Card className="border-2">
        <CardContent className="p-3">
          <div
            className="relative border-2 border-dashed border-gray-300 rounded-xl bg-slate-50 overflow-auto flex justify-center items-start p-6"
            style={{ minHeight: "700px" }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              ref={venueRef}
              className="relative bg-white border-2 border-gray-200 shadow-2xl rounded-lg"
              style={{
                width: venueConfig.width * venueConfig.scale,
                height: venueConfig.height * venueConfig.scale,
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
              {/* Entrance */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-green-100 border-t border-x border-green-300 px-4 py-1 rounded-t text-[9px] font-bold text-green-700">
                ENTRANCE
              </div>

              {/* Placed Tables */}
              {currentTables.map((table) => (
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
                  {selectedTable === table.positionId && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-1 bg-white border p-1 rounded-md shadow-xl z-50">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => rotateTable(table.positionId)}
                      >
                        <RotateCw size={12} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-600"
                        onClick={() => removeTableFromVenue(table.positionId)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {/* Placed Speaker Zones */}
              {currentSpeakerZones.map((zone) => {
                const isSelected = selectedTable === `sz-${zone.positionId}`;
                return (
                  <div
                    key={`sz-${zone.positionId}`}
                    style={{
                      position: "absolute",
                      left: zone.x * venueConfig.scale,
                      top: zone.y * venueConfig.scale,
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
                      left: rt.x * venueConfig.scale,
                      top: rt.y * venueConfig.scale,
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
  initialData,
}: CreateEventFormProps) {
  const { toast } = useToast();
  const venueRef = useRef<HTMLDivElement>(null);

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
    color: "#6b7280",
  });

  // Replace your currentAddOn state with this:
  const [currentAddOn, setCurrentAddOn] = useState<{
    name: string;
    price: string;
    description: string;
    rawFile?: File | null;
    preview?: string;
  }>({ name: "", price: "", description: "" });

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

  // Enhanced Options
  const categoryOptions = [
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
  ];

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
    features: initialData?.features ?? {
      food: false,
      parking: false,
      wifi: false,
      photography: false,
      security: false,
      accessibility: false,
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

  // Speaker Slot Templates (like table templates but for speaker zones)
  const [speakerSlotTemplates, setSpeakerSlotTemplates] = useState<any[]>(
    initialData?.speakerSlotTemplates?.map((s: any) => ({ ...s })) ?? [],
  );
  const [currentSpeakerSlot, setCurrentSpeakerSlot] = useState({
    name: "",
    startTime: "",
    endTime: "",
    isMainStage: false,
    width: "200",
    height: "100",
    slotPrice: "0",
    maxSpeakers: "1",
    description: "",
    openForApplications: true,
  });

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

  // Load initial data for editing
  useEffect(() => {
    if (editMode && initialData) {
      // Load existing data
      if (initialData.image) {
        setBannerPreview(initialData.image);
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
  }, [editMode, initialData]);

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

  const handleInputChange = (field: string, value: any) => {
    setFormData((old) => ({ ...old, [field]: value }));
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

  const addSpeakerSlot = () => {
    if (!currentSpeakerSlot.name.trim()) {
      toast({ title: "Space name is required", variant: "destructive" });
      return;
    }
    const newSlot = {
      id: Math.random().toString(36).slice(2, 10),
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
      sessions: [],
    };
    setSpeakerSlotTemplates((prev) => [...prev, newSlot]);
    setCurrentSpeakerSlot({
      name: "",
      startTime: "",
      endTime: "",
      isMainStage: false,
      width: "200",
      height: "100",
      slotPrice: "0",
      maxSpeakers: "1",
      maxVisitors: "",
      description: "",
      openForApplications: true,
    });
  };

  const removeSpeakerSlot = (id: string) => {
    setSpeakerSlotTemplates((prev) => prev.filter((s) => s.id !== id));
  };

  const addVisitorType = () => {
    if (!currentVisitor.name.trim()) {
      toast({ title: "Visitor type name is required", variant: "destructive" });
      return;
    }
    const newVisitor: VisitorType = {
      id: Math.random().toString(36).slice(2, 10),
      name: currentVisitor.name.trim(),
      price: parseFloat(currentVisitor.price) || 0,
      maxCount: currentVisitor.maxCount
        ? parseInt(currentVisitor.maxCount)
        : undefined,
      description: currentVisitor.description,
      featureAccess: { ...currentVisitor.featureAccess },
      isActive: true,
    };
    setVisitorTypes((prev) => [...prev, newVisitor]);
    setCurrentVisitor({
      name: "",
      price: "0",
      maxCount: "",
      description: "",
      featureAccess: { ...DEFAULT_VISITOR_FEATURES },
    });
  };

  const removeVisitorType = (id: string) => {
    setVisitorTypes((prev) => prev.filter((v) => v.id !== id));
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
        if (key === "features" || key === "tags" || key === "socialMedia") {
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

      // Add visitor types
      data.append("visitorTypes", JSON.stringify(visitorTypes));

      await onSave(data);
      toast({
        duration: 5000,
        title: editMode ? "Event updated!" : "Event created!",
        description: "Your exhibition has been saved.",
      });
      onClose();
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
            {editMode ? "Edit Event" : "Create New Event"}
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

      {/* Sticky Tabs */}
      <div className="sticky top-[73px] z-40 bg-white border-b">
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          <TabsList className="grid w-full grid-cols-8 h-12">
            <TabsTrigger value="basic" className="text-sm">
              Basic Info
            </TabsTrigger>
            <TabsTrigger value="media" className="text-sm">
              Media
            </TabsTrigger>
            <TabsTrigger value="visitors" className="text-sm">
              Visitors
            </TabsTrigger>
            <TabsTrigger value="speakers" className="text-sm">
              Speakers
            </TabsTrigger>
            <TabsTrigger value="venue" className="text-sm">
              Venue Setup
            </TabsTrigger>
            <TabsTrigger value="tables" className="text-sm">
              Space / AddOns
            </TabsTrigger>
            <TabsTrigger value="roundtables" className="text-sm">
              Round Tables
            </TabsTrigger>
            <TabsTrigger value="layout" className="text-sm">
              Space Layout
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <Tabs value={currentTab} onValueChange={setCurrentTab}>
          {/* BASIC INFO TAB */}
          <TabsContent value="basic" className="space-y-6">
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
                    <Select
                      value={formData.category}
                      onValueChange={(v) => handleInputChange("category", v)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <div>
                    <Label>Venue Name *</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) =>
                        handleInputChange("location", e.target.value)
                      }
                      placeholder="e.g., Mumbai Exhibition Center"
                      required
                    />
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
          </TabsContent>

          {/* MEDIA TAB */}
          <TabsContent value="media">
            <Card>
              <CardHeader>
                <CardTitle>Event Media</CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="visitors" className="space-y-6">
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
                        value={currentVisitor.price}
                        onChange={(e) =>
                          setCurrentVisitor((p) => ({
                            ...p,
                            price: e.target.value,
                          }))
                        }
                        placeholder="0 = Free"
                      />
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
                  <Button
                    type="button"
                    onClick={addVisitorType}
                    className="w-full md:w-auto"
                  >
                    <Plus size={16} className="mr-2" /> Add Visitor Type
                  </Button>
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
                      className="border rounded-lg p-4 bg-white space-y-3"
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
          </TabsContent>

          <TabsContent value="speakers" className="space-y-6">
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

                  <Button
                    type="button"
                    onClick={addSpeakerSlot}
                    className="w-full md:w-auto"
                  >
                    <Plus size={16} className="mr-2" /> Add Speaker Space
                  </Button>
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
              <Card key={space.id} className="border-2 border-purple-200">
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
          </TabsContent>

          {/* VENUE SETUP TAB */}
          <TabsContent value="venue">
            <BlurOverlay visible={!blurActive}>
              <VenueConfiguration
                venueConfigurations={venueConfigurations}
                setVenueConfigurations={setVenueConfigurations}
                selectedVenueConfigId={selectedVenueConfigId}
                setSelectedVenueConfigId={setSelectedVenueConfigId}
              />
            </BlurOverlay>
          </TabsContent>

          {/* TABLES TAB */}
          <TabsContent value="tables">
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
          </TabsContent>

          {/* ROUND TABLES TAB */}
          <TabsContent value="roundtables">
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
                    <div className="flex items-end">
                      <Button
                        type="button"
                        onClick={() => {
                          if (!currentRoundTable.name) {
                            toast({
                              title: "Table name is required",
                              variant: "destructive",
                            });
                            return;
                          }
                          const chairs =
                            parseInt(currentRoundTable.numberOfChairs) || 8;
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
                            toast({
                              title: "Price must be greater than 0",
                              variant: "destructive",
                            });
                            return;
                          }
                          const newTemplate: RoundTableTemplate = {
                            id: Math.random().toString(36).slice(2, 15),
                            name: currentRoundTable.name,
                            numberOfChairs: chairs,
                            sellingMode: currentRoundTable.sellingMode,
                            tablePrice:
                              parseFloat(currentRoundTable.tablePrice) || 0,
                            chairPrice:
                              parseFloat(currentRoundTable.chairPrice) || 0,
                            category: currentRoundTable.category,
                            color: currentRoundTable.color,
                            tableDiameter:
                              parseInt(currentRoundTable.tableDiameter) || 120,
                          };
                          setRoundTableTemplates([
                            ...roundTableTemplates,
                            newTemplate,
                          ]);
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
                          toast({ title: "Round table template added" });
                        }}
                        className="w-full"
                      >
                        <Plus size={16} className="mr-2" /> Add Template
                      </Button>
                    </div>
                  </div>

                  {/* Existing Templates */}
                  {roundTableTemplates.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {roundTableTemplates.map((template) => (
                        <div
                          key={template.id}
                          className="p-4 border-2 rounded-xl bg-white"
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
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-red-500"
                              onClick={() =>
                                setRoundTableTemplates(
                                  roundTableTemplates.filter(
                                    (t) => t.id !== template.id,
                                  ),
                                )
                              }
                            >
                              <Trash2 size={14} />
                            </Button>
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
          </TabsContent>

          {/* LAYOUT DESIGN TAB */}
          <TabsContent value="layout">
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
              />
            </BlurOverlay>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
