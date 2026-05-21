// One-off: render JICAMA-TECH-INTEGRATION-WHITEPAPER.md to a styled PDF.
// Run from repo root:  node generate-pdf.js
// Requires: backend/node_modules/{puppeteer,marked} (already installed).

const fs = require("fs");
const path = require("path");

const REPO_ROOT = __dirname;
const MD_PATH = path.join(REPO_ROOT, "JICAMA-TECH-INTEGRATION-WHITEPAPER.md");
const PDF_PATH = path.join(REPO_ROOT, "JICAMA-TECH-INTEGRATION-WHITEPAPER.pdf");

const { marked } = require(path.join(
  REPO_ROOT,
  "backend",
  "node_modules",
  "marked"
));
const puppeteer = require(path.join(
  REPO_ROOT,
  "backend",
  "node_modules",
  "puppeteer"
));

const STYLE = `
  @page { size: A4; margin: 22mm 18mm 22mm 18mm; }
  body {
    font-family: "Segoe UI", "Calibri", "Helvetica Neue", Arial, sans-serif;
    color: #1f2937;
    line-height: 1.55;
    font-size: 10.5pt;
  }
  h1, h2, h3, h4 { color: #0f172a; line-height: 1.25; }
  h1 { font-size: 22pt; border-bottom: 2px solid #0f172a; padding-bottom: 6px;
       margin-top: 0; }
  h2 { font-size: 15pt; margin-top: 28px; border-bottom: 1px solid #cbd5e1;
       padding-bottom: 3px; }
  h3 { font-size: 12pt; margin-top: 22px; color: #1e40af; }
  h4 { font-size: 11pt; color: #475569; }
  p  { margin: 8px 0; }
  ul, ol { margin: 8px 0 8px 24px; }
  li { margin: 3px 0; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 26px 0; }
  code {
    font-family: "Consolas", "Cascadia Code", "Courier New", monospace;
    background: #f1f5f9; padding: 1px 5px; border-radius: 3px;
    font-size: 9.5pt; color: #b91c1c;
  }
  pre {
    background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 6px;
    font-size: 9pt; overflow-x: auto; line-height: 1.45;
    page-break-inside: avoid;
  }
  pre code { background: transparent; color: inherit; padding: 0; font-size: 9pt; }
  blockquote {
    border-left: 4px solid #3b82f6; background: #eff6ff; color: #1e3a8a;
    padding: 8px 14px; margin: 12px 0; border-radius: 0 4px 4px 0;
  }
  table {
    border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th, td { border: 1px solid #cbd5e1; padding: 6px 9px; text-align: left;
           vertical-align: top; }
  th { background: #0f172a; color: #f8fafc; }
  tr:nth-child(even) td { background: #f8fafc; }
  a { color: #1d4ed8; text-decoration: none; }
  strong { color: #0f172a; }
  .cover {
    text-align: center; padding: 80px 0 40px 0;
    border-bottom: 3px double #0f172a; margin-bottom: 36px;
  }
  .cover .eyebrow {
    text-transform: uppercase; letter-spacing: 4px; font-size: 9pt;
    color: #64748b; margin-bottom: 22px;
  }
  .cover h1 { border: none; font-size: 28pt; margin: 0 0 18px 0; }
  .cover .sub { font-size: 13pt; color: #475569; font-style: italic; }
  .cover .meta {
    margin-top: 40px; font-size: 10pt; color: #475569;
    display: inline-block; text-align: left; line-height: 1.9;
    border-left: 3px solid #3b82f6; padding-left: 16px;
  }
  h2 { page-break-after: avoid; }
  /* Diagram blocks (ASCII art) — keep them in one chunk */
  pre { white-space: pre; }
`;

const COVER = `
  <div class="cover">
    <div class="eyebrow">Technical Implementation Whitepaper</div>
    <h1>Jicama.tech &times; EventSH</h1>
    <div class="sub">Partner-Domain Storefront Embed Integration</div>
    <div class="meta">
      <strong>Document version:</strong> 1.0<br/>
      <strong>Issued:</strong> May 2026<br/>
      <strong>Origin host:</strong> eventsh.com<br/>
      <strong>Partner host:</strong> jicama.tech<br/>
      <strong>Classification:</strong> Internal &middot; Client deliverable
    </div>
  </div>
`;

(async () => {
  const md = fs.readFileSync(MD_PATH, "utf8");
  const bodyHtml = marked.parse(md);

  const html = `<!doctype html>
<html><head>
  <meta charset="utf-8" />
  <title>Jicama.tech × EventSH — Integration Whitepaper</title>
  <style>${STYLE}</style>
</head><body>
  ${COVER}
  ${bodyHtml}
</body></html>`;

  console.log("Launching headless Chrome...");
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: PDF_PATH,
      format: "A4",
      printBackground: true,
      margin: { top: "22mm", bottom: "22mm", left: "18mm", right: "18mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8pt; color:#94a3b8; width:100%; padding:0 18mm;">
        Jicama.tech &times; EventSH &middot; Integration Whitepaper
      </div>`,
      footerTemplate: `<div style="font-size:8pt; color:#94a3b8; width:100%; padding:0 18mm; text-align:right;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>`,
    });
    console.log("PDF written:", PDF_PATH);
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
