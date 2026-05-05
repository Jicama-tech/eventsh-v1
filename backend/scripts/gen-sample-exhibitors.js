// One-off generator: writes 100 realistic exhibitor rows to an .xlsx the user
// can drop straight into the bulk-import dialog.
const path = require("path");
const ExcelJS = require("exceljs");

const FIRST_IN = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan",
  "Ananya", "Aadhya", "Saanvi", "Aanya", "Diya", "Pari", "Anika", "Kiara", "Myra", "Aaradhya",
  "Rahul", "Priya", "Neha", "Karan", "Pooja", "Vikram", "Sneha", "Manish", "Riya", "Tanvi"];
const LAST_IN = ["Sharma", "Verma", "Patel", "Iyer", "Reddy", "Khan", "Kumar", "Gupta", "Mehta", "Nair",
  "Jain", "Agarwal", "Shah", "Pillai", "Banerjee", "Chatterjee", "Das", "Bose", "Singh", "Rao"];
const FIRST_SG = ["Wei", "Jun", "Hao", "Min", "Hui", "Ling", "Mei", "Xin", "Kai", "Yi", "Tan", "Lim", "Lee", "Ng", "Goh"];
const LAST_SG = ["Tan", "Lim", "Lee", "Ng", "Goh", "Wong", "Chan", "Teo", "Koh", "Ong"];

const SHOP_TEMPLATES = [
  "{first}'s Crafts", "{first} & Co", "{last} Bazaar", "{last} Emporium", "{first} Studio",
  "{first}'s Boutique", "Atelier {first}", "{last} Trading", "{first} Originals", "{last} Designs",
  "{first}'s Pantry", "House of {last}", "{first} Mart", "{last} Naturals", "Studio {first}"
];

const CATEGORIES = ["Technology", "Music", "Food", "Sports", "Arts", "Fashion", "Electronics", "Other"];

const IN_CITIES = [
  ["Mumbai", "Maharashtra", "400001"], ["Delhi", "Delhi", "110001"],
  ["Bangalore", "Karnataka", "560001"], ["Chennai", "Tamil Nadu", "600001"],
  ["Hyderabad", "Telangana", "500001"], ["Pune", "Maharashtra", "411001"],
  ["Kolkata", "West Bengal", "700001"], ["Ahmedabad", "Gujarat", "380001"],
  ["Jaipur", "Rajasthan", "302001"], ["Lucknow", "Uttar Pradesh", "226001"],
];
const SG_AREAS = [
  ["Singapore", "Central", "238801"], ["Singapore", "East", "510001"],
  ["Singapore", "West", "640001"], ["Singapore", "North", "730001"],
  ["Singapore", "Northeast", "820001"],
];

const STREETS_IN = ["MG Road", "Park Street", "Brigade Road", "Linking Road", "Anna Salai", "Marine Drive",
  "Commercial Street", "Connaught Place", "Khan Market", "Carter Road"];
const STREETS_SG = ["Orchard Road", "Bugis Street", "Chinatown Plaza", "Marina Boulevard", "Tampines Central",
  "Jurong East Ave", "Sentosa Gateway", "Clarke Quay"];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pad(n, len) {
  return String(n).padStart(len, "0");
}
function genIN(i) {
  // Indian mobile: +91, 10 digits starting 6-9.
  const first = pick("6789");
  const rest = pad(Math.floor(Math.random() * 1e9), 9);
  return `+91${first}${rest}`;
}
function genSG(i) {
  // Singapore mobile: +65, 8 digits starting 8 or 9.
  const first = pick("89");
  const rest = pad(Math.floor(Math.random() * 1e7), 7);
  return `+65${first}${rest}`;
}
function emailFor(first, last, brand) {
  const domains = ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com",
    `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`];
  return `${first}.${last}.${Math.floor(Math.random() * 99)}`.toLowerCase() + "@" + pick(domains);
}

(async () => {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Exhibitors");
  sheet.columns = [
    { header: "Name", key: "name", width: 24 },
    { header: "Shop Name", key: "shopName", width: 26 },
    { header: "Business Category", key: "businessCategory", width: 20 },
    { header: "Email", key: "email", width: 32 },
    { header: "WhatsApp Number", key: "whatsAppNumber", width: 20 },
    { header: "Phone", key: "phone", width: 20 },
    { header: "Country", key: "country", width: 10 },
    { header: "Address", key: "address", width: 38 },
    { header: "City", key: "city", width: 16 },
    { header: "State", key: "state", width: 18 },
    { header: "Pincode", key: "pincode", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" },
  };

  for (let i = 0; i < 100; i++) {
    const isIN = Math.random() < 0.7; // 70% India, 30% Singapore
    const first = pick(isIN ? FIRST_IN : FIRST_SG);
    const last = pick(isIN ? LAST_IN : LAST_SG);
    const fullName = `${first} ${last}`;
    const shopName = pick(SHOP_TEMPLATES)
      .replace("{first}", first)
      .replace("{last}", last);
    const cat = pick(CATEGORIES);
    const email = emailFor(first, last, shopName);
    const wa = isIN ? genIN(i) : genSG(i);
    const phone = isIN ? genIN(i) : genSG(i);
    const [city, state, pincode] = isIN ? pick(IN_CITIES) : pick(SG_AREAS);
    const street = isIN ? pick(STREETS_IN) : pick(STREETS_SG);
    const address = `${Math.floor(Math.random() * 250) + 1}, ${street}, ${city}`;

    sheet.addRow({
      name: fullName,
      shopName,
      businessCategory: cat,
      email,
      whatsAppNumber: wa,
      phone,
      country: isIN ? "IN" : "SG",
      address,
      city,
      state,
      pincode,
    });
  }

  const out = path.resolve(__dirname, "..", "..", "sample-exhibitors-100.xlsx");
  await wb.xlsx.writeFile(out);
  console.log("WROTE", out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
