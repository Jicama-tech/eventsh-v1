/**
 * Download a remote image re-encoded to a chosen format.
 *
 * Sponsors upload a logo in whatever they have — PNG, JPG, WEBP, sometimes
 * SVG — but organizers need a specific format for print or for a partner
 * deck. This draws the image to a canvas and re-encodes it, so one upload
 * serves both.
 *
 * JPEG has no alpha, so a transparent PNG is flattened onto white first;
 * without that, transparent pixels come out black.
 */
export type ImageFormat = "png" | "jpeg";

const EXT: Record<ImageFormat, string> = { png: "png", jpeg: "jpg" };

function triggerDownload(href: string, filename: string, revoke = false) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) URL.revokeObjectURL(href);
}

/** Strip anything a filesystem would object to. */
function safeName(name: string): string {
  return (name || "logo").replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60);
}

export async function downloadImageAs(
  url: string,
  baseName: string,
  format: ImageFormat,
): Promise<void> {
  const filename = `${safeName(baseName)}.${EXT[format]}`;

  const img = new Image();
  // Needed for a canvas read-back on a cross-origin asset (the API is served
  // from a different origin than the dashboard in dev).
  img.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not load the image"));
    img.src = url;
  });

  const canvas = document.createElement("canvas");
  // naturalWidth is 0 for an SVG with no intrinsic size — fall back to a
  // sensible raster size so the export isn't empty.
  canvas.width = img.naturalWidth || 512;
  canvas.height = img.naturalHeight || 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  if (format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, `image/${format}`, format === "jpeg" ? 0.92 : undefined),
  );
  if (!blob) throw new Error("Could not encode the image");

  triggerDownload(URL.createObjectURL(blob), filename, true);
}

/**
 * Re-encode when possible, otherwise fall back to saving the original file.
 * A tainted canvas (missing CORS headers on the upload host) is the usual
 * reason the conversion path fails — the organizer still gets their file.
 */
export async function downloadImageWithFallback(
  url: string,
  baseName: string,
  format: ImageFormat,
): Promise<"converted" | "original"> {
  try {
    await downloadImageAs(url, baseName, format);
    return "converted";
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const ext = (url.split(".").pop() || "img").split("?")[0].slice(0, 5);
    triggerDownload(
      URL.createObjectURL(blob),
      `${safeName(baseName)}.${ext}`,
      true,
    );
    return "original";
  }
}
