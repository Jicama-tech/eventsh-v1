import * as sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

/**
 * Compress an on-disk image saved by multer (diskStorage) IN PLACE:
 * downscale to a sane maximum dimension and re-encode as WebP. Mutates
 * `file.filename` / `file.path` so the caller's `/uploads/.../${file.filename}`
 * URLs point at the smaller compressed file.
 *
 * Best-effort: if sharp can't read the file (e.g. an unsupported type), the
 * original is left untouched so the upload still works.
 */
export async function compressDiskImage(
  file: Express.Multer.File,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<void> {
  if (!file || !file.path) return;
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 78;
  try {
    const dir = path.dirname(file.path);
    const base = path.basename(file.filename, path.extname(file.filename));
    const newName = `${base}.webp`;
    const newPath = path.join(dir, newName);

    const buf = await sharp(file.path)
      .rotate() // honour EXIF orientation
      .resize({
        width: maxDim,
        height: maxDim,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, smartSubsample: true })
      .toBuffer();

    await fs.promises.writeFile(newPath, buf);
    if (path.resolve(newPath) !== path.resolve(file.path)) {
      await fs.promises.unlink(file.path).catch(() => {});
    }
    file.filename = newName;
    file.path = newPath;
  } catch {
    // leave the original file on any failure
  }
}

/**
 * The hero banner is shown full-width (up to ~1920 CSS px, 2x on retina), so
 * it keeps far more detail than gallery or add-on images: the old 1600px /
 * q78 settings upscaled on wide screens and looked soft.
 */
const BANNER_COMPRESSION = { maxDim: 3200, quality: 92 };

/**
 * Compress every image uploaded through the event create/update form
 * (banner, gallery, add-on images, speaker images). Order within each array
 * is preserved, so index-based mapping (add-ons / speakers) still lines up.
 */
export async function compressEventUploadFiles(files: {
  banner?: Express.Multer.File[];
  gallery?: Express.Multer.File[];
  addOnImages?: Express.Multer.File[];
  speakerImages?: Express.Multer.File[];
}): Promise<void> {
  if (!files) return;
  await Promise.all(
    (files.banner || []).map((f) => compressDiskImage(f, BANNER_COMPRESSION)),
  );
  const all = [
    ...(files.gallery || []),
    ...(files.addOnImages || []),
    ...(files.speakerImages || []),
  ];
  await Promise.all(all.map((f) => compressDiskImage(f)));
}
