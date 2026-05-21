// One-off: scan a PDF's decompressed text streams for sensitive terms.
const fs = require("fs");
const zlib = require("zlib");

const buf = fs.readFileSync("JICAMA-TECH-INTEGRATION-WHITEPAPER.pdf");
const raw = buf.toString("latin1");

let decoded = "";
const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
let m;
while ((m = re.exec(raw)) !== null) {
  try {
    decoded += zlib.inflateSync(Buffer.from(m[1], "latin1")).toString("latin1") + "\n";
  } catch (_) {
    decoded += m[1] + "\n";
  }
}

const all = decoded + "\n" + raw;
const terms = [
  "thefoxsg",
  "xcionasia",
  "192.168",
  "pm2 restart",
  "docker-compose",
  "callback(new Error",
  "8081",
  "127.0.0.1",
];

for (const t of terms) {
  const count = all.toLowerCase().split(t.toLowerCase()).length - 1;
  console.log(t.padEnd(25), "->", count, "hit(s)");
}
