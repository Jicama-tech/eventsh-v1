import mongoose from "mongoose";

// --- CONFIGURATION ---
const MONGO_URI = "mongodb://127.0.0.1:27017/eventsh_dev";

async function runMigration() {
  try {
    await mongoose.connect(MONGO_URI);

    const tasks = [
      // Root level fields
      { collection: "products", field: "images" },
      { collection: "events", field: "image" },
      { collection: "events", field: "gallery" },
      { collection: "events", field: "addOnImage" },

      // DEEP NESTED fields (Matches your JSON structure)
      { collection: "organizer_stores", field: "settings.design.bannerImage" },
      {
        collection: "organizer_stores",
        field: "settings.design.heroBannerImage",
      },
      { collection: "organizer_stores", field: "settings.design.aboutUsImage" },
      { collection: "organizer_stores", field: "settings.general.logo" },

      { collection: "shopkeeper_stores", field: "settings.design.bannerImage" },
      {
        collection: "shopkeeper_stores",
        field: "settings.design.heroBannerImage",
      },
      { collection: "shopkeeper_stores", field: "settings.general.logo" },
      { collection: "shopkeepers", field: "paymentURL" },
      { collection: "organizers", field: "paymentURL" },
    ];

    for (const task of tasks) {
      await updateCollection(task.collection, task.field);
    }

  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

// Helper to find value at a nested path (e.g. "settings.design.bannerImage")
function getValueByPath(obj: any, path: string) {
  return path.split(".").reduce((acc, part) => acc && acc[part], obj);
}

async function updateCollection(collectionName: string, fieldName: string) {
  const db = mongoose.connection.db;
  if (!db) return;
  const collection = db.collection(collectionName);


  // Query using dot notation
  const cursor = collection.find({
    [fieldName]: { $regex: /\.(jpg|jpeg|png)$/i },
  });

  let count = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    const originalValue = getValueByPath(doc, fieldName);

    let updatedValue;

    if (Array.isArray(originalValue)) {
      updatedValue = originalValue.map((img) =>
        typeof img === "string"
          ? img.replace(/\.(jpg|jpeg|png)$/i, ".webp")
          : img,
      );
    } else if (typeof originalValue === "string") {
      updatedValue = originalValue.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    }

    if (updatedValue) {
      // Use dot notation in $set to update the specific nested field
      await collection.updateOne(
        { _id: doc._id },
        { $set: { [fieldName]: updatedValue } },
      );
      count++;
    }
  }

}

runMigration();
