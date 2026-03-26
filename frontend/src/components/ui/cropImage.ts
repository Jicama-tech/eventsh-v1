export const getCroppedImg = (imageSrc: string, crop: any): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new Image();

    // ⭐ CRITICAL FIX
    image.crossOrigin = "anonymous";

    image.src = imageSrc;

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      canvas.width = crop.width;
      canvas.height = crop.height;

      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height,
      );

      // ✅ Auto-detect image type
      const mimeType = getImageMimeType(imageSrc);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas is empty"));
            return;
          }
          resolve(blob);
        },
        mimeType,
        0.9, // quality (only applies to jpeg/webp)
      );
    };

    image.onerror = () => {
      reject(new Error("Failed to load image"));
    };
  });
};

const getImageMimeType = (src: string): string => {
  if (src.endsWith(".png")) return "image/png";
  if (src.endsWith(".webp")) return "image/webp";
  if (src.endsWith(".jpg") || src.endsWith(".jpeg")) return "image/jpeg";

  // default fallback
  return "image/jpeg";
};
