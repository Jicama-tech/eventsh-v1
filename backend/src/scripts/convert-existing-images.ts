import * as fs from "fs";
import * as path from "path";
import * as sharp from "sharp";

// --- CONFIGURATION ---
const UPLOADS_DIR = path.join(__dirname, "../uploads");

async function convertRecursive(dir: string) {
  if (!fs.existsSync(dir)) {
    return;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await convertRecursive(fullPath);
    } else if (entry.name.match(/\.(jpg|jpeg|png)$/i)) {
      const newPath = fullPath.replace(/\.(jpg|jpeg|png)$/i, ".webp");

      // Check if .webp already exists to avoid redundant processing
      if (fs.existsSync(newPath)) {
        // Optional: Uncomment below if you want to delete originals even if WebP exists
        // fs.unlinkSync(fullPath);
        continue;
      }

      try {

        await sharp(fullPath)
          .resize(1200, null, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(newPath);


        // DELETE the original file
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error(`❌ Failed to process ${entry.name}: ${err.message}`);
      }
    }
  }
}

// EXECUTION
convertRecursive(UPLOADS_DIR)
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Critical error during conversion:", err);
    process.exit(1);
  });
