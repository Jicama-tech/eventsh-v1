import { useState } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { getCroppedImg } from "./cropImage";
import { useToast } from "@/hooks/use-toast";

interface ImageCropModalProps {
  open: boolean;
  image: string;
  onClose: () => void;
  onCropComplete: (file: File) => void;
}

const ASPECT_RATIOS = [
  { label: "1:1", value: 1 / 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "Free", value: undefined },
];

/** Resolve the image's natural dimensions so we have a safe fallback crop
 *  area when react-easy-crop's onCropComplete hasn't fired yet (e.g. user
 *  clicked Save before the image finished loading or before dragging). */
function loadImageBounds(
  src: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export default function ImageCropModal({
  open,
  image,
  onClose,
  onCropComplete,
}: ImageCropModalProps) {
  const { toast } = useToast();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const handleCropComplete = (_: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Fall back to the full natural image bounds when the user hasn't
      // dragged the crop area yet (in that case react-easy-crop hasn't
      // fired onCropComplete and croppedAreaPixels is still null). This
      // matches the user expectation of "save the whole image as-is" when
      // they click Crop & Save immediately.
      let area = croppedAreaPixels;
      if (!area) {
        const dims = await loadImageBounds(image);
        area = { x: 0, y: 0, width: dims.width, height: dims.height };
      }

      const blob = await getCroppedImg(image, area);
      const file = new File([blob], `cropped-${Date.now()}.jpg`, {
        type: blob.type || "image/jpeg",
      });

      onCropComplete(file);
    } catch (err: any) {
      toast({
        title: "Couldn't crop the image",
        description:
          err?.message ||
          "Try selecting the file again, or use a JPG/PNG image.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>Crop Image</DialogHeader>

        {/* Cropper */}
        <div className="relative w-full h-[200px] bg-black rounded-md overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect} // set to undefined for free resize
            minZoom={1}
            maxZoom={3}
            zoomSpeed={0.1}
            cropShape="rect"
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={handleCropComplete}
            restrictPosition={false} // allows moving freely
          />
        </div>

        {/* Zoom Slider */}
        <div className="flex justify-between items-center mt-4">
          <div className="mt-4">
            <label className="text-sm font-medium">Zoom</label>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-96"
            />
          </div>

          {/* Aspect Ratio */}
          <div className="flex gap-2 justify-center mt-4">
            {ASPECT_RATIOS.map((item) => (
              <Button
                key={item.label}
                size="sm"
                variant={aspect === item.value ? "default" : "outline"}
                onClick={() => setAspect(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              "Crop & Save"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
