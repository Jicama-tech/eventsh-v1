/** Upgrade the demo event's exhibitor / round-table / add-on data to realistic
 *  professional pricing so the Professional Event guide shows meaningful tables.
 *  Updates templates AND placed spaces so the live demo stays consistent. */
const m = require("mongoose");
const ID = "6a4d25a48a95ea84b6244bff";

(async () => {
  await m.connect(process.env.MONGO_URI);
  const col = m.connection.db.collection("events");
  const ev = await col.findOne({ _id: new m.Types.ObjectId(ID) });
  if (!ev) throw new Error("demo event not found");

  // Two stall templates, keyed by their existing ids so placed spaces match.
  const tpls = ev.tableTemplates || [];
  const priceByTpl = {};
  const newTpls = tpls.map((t, i) => {
    const cfg = i === 0
      ? { name: "Standard Booth", w: 3, h: 3, full: 1200, book: 360, dep: 150, mem: 1000 }
      : { name: "Premium Corner", w: 3, h: 6, full: 2400, book: 720, dep: 300, mem: 2000 };
    priceByTpl[t.id] = cfg;
    return {
      ...t,
      name: cfg.name,
      tablePrice: cfg.full,
      bookingPrice: cfg.book,
      depositPrice: cfg.dep,
      memberPrice: cfg.mem,
      memberBookingPrice: Math.round(cfg.book * 0.85),
      memberDepositPrice: cfg.dep,
      forSale: true,
    };
  });

  // Placed stalls inherit their template's pricing (by id).
  const flatten = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? v : {});
  const vt = ev.venueTables && typeof ev.venueTables === "object" ? ev.venueTables : {};
  const newVenueTables = {};
  for (const [layoutId, arr] of Object.entries(vt)) {
    newVenueTables[layoutId] = (Array.isArray(arr) ? arr : []).map((s) => {
      const cfg = priceByTpl[s.id];
      return cfg
        ? { ...s, tablePrice: cfg.full, bookingPrice: cfg.book, depositPrice: cfg.dep, memberPrice: cfg.mem }
        : s;
    });
  }

  // Round tables: a real 10-seat gala table sold by the chair.
  const newRtTpls = (ev.roundTableTemplates || []).map((t) => ({
    ...t,
    name: "Gala Round Table",
    numberOfChairs: 10,
    sellingMode: "chair",
    chairPrice: 120,
    tablePrice: 1000,
    depositPrice: 200,
    forSale: true,
  }));
  const newVenueRt = (Array.isArray(ev.venueRoundTables) ? ev.venueRoundTables : []).map((t) => ({
    ...t,
    name: "Gala Round Table",
    numberOfChairs: 10,
    sellingMode: "chair",
    chairPrice: 120,
    tablePrice: 1000,
    forSale: true,
  }));

  // A richer add-on catalogue.
  const addOns = [
    { id: "ao_power", name: "Power Supply (13A)", price: 90, description: "Dedicated power point for your booth.", color: "#f59e0b" },
    { id: "ao_table", name: "Extra Trestle Table", price: 60, description: "Additional 1.8m table.", color: "#10b981" },
    { id: "ao_banner", name: "Banner Stand", price: 45, description: "Roll-up banner display slot.", color: "#3b82f6" },
    { id: "ao_lead", name: "Lead Scanner", price: 150, description: "QR lead-capture scanner rental.", color: "#8b5cf6" },
  ];

  await col.updateOne(
    { _id: ev._id },
    { $set: {
      tableTemplates: newTpls,
      venueTables: newVenueTables,
      roundTableTemplates: newRtTpls,
      venueRoundTables: newVenueRt,
      addOnItems: addOns,
      maxSpacesPerVendor: 3,
    } },
  );
  console.log("updated: stall templates =", newTpls.map((t) => `${t.name} SG$${t.tablePrice}`).join(", "));
  console.log("round table:", newRtTpls.map((t) => `${t.name} ${t.numberOfChairs} seats @SG$${t.chairPrice}/chair`).join(", "));
  console.log("add-ons:", addOns.map((a) => `${a.name} SG$${a.price}`).join(", "));
  await m.disconnect();
})().catch((e) => { console.error("ERR:", e.message); process.exit(1); });
