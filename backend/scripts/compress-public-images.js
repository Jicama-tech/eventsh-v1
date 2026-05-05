// Convert frontend/public/*.{jpg,png} to WebP. Idempotent — skips files
// whose .webp already exists and is newer than the source.
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const publicDir = path.resolve(__dirname, "..", "..", "frontend", "public");

const SOURCES = [
  // Bento backdrop — heavy JPGs, big wins from WebP @ q=72
  { name: "image1.jpg", quality: 72 },
  { name: "image2.jpg", quality: 72 },
  { name: "image3.jpg", quality: 72 },
  { name: "image4.jpg", quality: 72 },
  { name: "image5.jpg", quality: 72 },
  { name: "image6.jpg", quality: 72 },
  // Step carousel — PNG → WebP lossless-ish
  { name: "step1.png", quality: 85 },
  { name: "step2.png", quality: 85 },
  { name: "step3.png", quality: 85 },
  { name: "step4.png", quality: 85 },
];

(async () => {
  const results = [];
  for (const { name, quality } of SOURCES) {
    const src = path.join(publicDir, name);
    const out = path.join(publicDir, name.replace(/\.(jpg|jpeg|png)$/i, ".webp"));
    if (!fs.existsSync(src)) {
      console.warn("SKIP (missing):", name);
      continue;
    }
    const srcStat = fs.statSync(src);
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= srcStat.mtimeMs) {
      console.log("SKIP (up to date):", name);
      continue;
    }
    await sharp(src).webp({ quality, effort: 6 }).toFile(out);
    const outStat = fs.statSync(out);
    results.push({
      name,
      from: srcStat.size,
      to: outStat.size,
      saved: srcStat.size - outStat.size,
    });
    console.log(
      `${name} -> ${path.basename(out)}: ${(srcStat.size / 1024).toFixed(0)} KB -> ${(outStat.size / 1024).toFixed(0)} KB`,
    );
  }
  if (results.length) {
    const totalFrom = results.reduce((s, r) => s + r.from, 0);
    const totalTo = results.reduce((s, r) => s + r.to, 0);
    console.log(
      `\nTotal: ${(totalFrom / 1024 / 1024).toFixed(2)} MB -> ${(totalTo / 1024 / 1024).toFixed(2)} MB (${(100 * (1 - totalTo / totalFrom)).toFixed(1)}% smaller)`,
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
