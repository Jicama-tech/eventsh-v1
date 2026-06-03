import { useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageCropModalProps {
  open: boolean;
  image: string;
  onClose: () => void;
  onCropComplete: (file: File) => void;
  /** Optional initial locked ratio (e.g. 16/9). Omit for free cropping. */
  defaultAspect?: number;
}

// Optional ratio locks. "Free" (undefined) lets you drag all 8 handles
// (4 corners + 4 edges) independently.
const ASPECT_RATIOS: { label: string; value: number | undefined }[] = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
];

// Build a centered starting selection. With an aspect it respects the ratio;
// without one it's a generous 90% box the user can resize from any side.
function makeCenteredCrop(
  width: number,
  height: number,
  aspect?: number,
): Crop {
  if (aspect) {
    return centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height),
      width,
      height,
    );
  }
  return { unit: "%", x: 5, y: 5, width: 90, height: 90 };
}

export default function ImageCropModal({
  open,
  image,
  onClose,
  onCropComplete,
  defaultAspect,
}: ImageCropModalProps) {
  const { toast } = useToast();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(defaultAspect);
  const [saving, setSaving] = useState(false);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(makeCenteredCrop(width, height, aspect));
  };

  const changeAspect = (a?: number) => {
    setAspect(a);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(makeCenteredCrop(width, height, a));
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const img = imgRef.current;
    if (!img) return;
    setSaving(true);
    try {
      // Resolve the selection in display pixels: prefer the dragged
      // completedCrop; else derive from the current (possibly %-based) crop;
      // else fall back to the whole image.
      let c: PixelCrop;
      if (completedCrop && completedCrop.width && completedCrop.height) {
        c = completedCrop;
      } else if (crop && crop.width && crop.height) {
        const pct = crop.unit === "%";
        c = {
          unit: "px",
          x: pct ? (crop.x / 100) * img.width : crop.x,
          y: pct ? (crop.y / 100) * img.height : crop.y,
          width: pct ? (crop.width / 100) * img.width : crop.width,
          height: pct ? (crop.height / 100) * img.height : crop.height,
        };
      } else {
        c = { unit: "px", x: 0, y: 0, width: img.width, height: img.height };
      }

      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(c.width * scaleX));
      canvas.height = Math.max(1, Math.round(c.height * scaleY));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(
        img,
        c.x * scaleX,
        c.y * scaleY,
        c.width * scaleX,
        c.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("Could not create image"))),
          "image/jpeg",
          0.92,
        ),
      );
      const file = new File([blob], `cropped-${Date.now()}.jpg`, {
        type: blob.type || "image/jpeg",
      });
      onCropComplete(file);
    } catch (err: any) {
      toast({
        title: "Couldn't crop the image",
        description: err?.message || "Please try again.",
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

        {/* Drag any of the 8 handles (corners + edges) to crop. */}
        <div className="flex justify-center bg-black/90 rounded-md overflow-hidden">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect}
            ruleOfThirds
            keepSelection
          >
            <img
              ref={imgRef}
              src={image}
              alt="Crop"
              crossOrigin="anonymous"
              onLoad={onImageLoad}
              style={{ maxHeight: "60vh", objectFit: "contain" }}
            />
          </ReactCrop>
        </div>

        {/* Optional ratio lock — Free = full 8-side cropping. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Lock ratio:</span>
          {ASPECT_RATIOS.map((item) => (
            <Button
              key={item.label}
              size="sm"
              variant={aspect === item.value ? "default" : "outline"}
              onClick={() => changeAspect(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>

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
