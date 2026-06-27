import * as puppeteer from "puppeteer";

/**
 * Renders an organizer-guide document (controlled markdown) to a branded A4 PDF.
 *
 * We deliberately implement a tiny markdown subset inline instead of pulling in
 * a parser dependency — the guide content is authored by us in
 * organizer-guide.content.ts and only uses: #/##/### headings, **bold**,
 * `inline code`, "- " bullets, "1." numbered lists, "---" rules, "> " quotes
 * and blank-line-separated paragraphs.
 */

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// Inline spans: **bold** and `code`. Run AFTER block-level escaping so the
// generated tags survive.
const formatInline = (s: string): string =>
  escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

/**
 * Minimal, indentation-aware markdown → HTML for our controlled guide content.
 * Supports nested lists (a bullet sub-list inside a numbered step) by tracking
 * each open list's indent on a stack, so ordered numbering never restarts and
 * nested items render inside their parent <li>.
 */
function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  // Stack of currently-open lists. Each frame leaves its last <li> open until
  // a sibling item closes it or the list itself is popped.
  const stack: Array<{ type: "ul" | "ol"; indent: number }> = [];

  const closeAllLists = () => {
    while (stack.length) {
      const f = stack.pop()!;
      out.push(`</li></${f.type}>`);
    }
  };

  const handleItem = (indent: number, type: "ul" | "ol", content: string) => {
    // Close any lists nested deeper than (or same depth, different type as)
    // this item before placing it.
    while (
      stack.length &&
      (stack[stack.length - 1].indent > indent ||
        (stack[stack.length - 1].indent === indent &&
          stack[stack.length - 1].type !== type))
    ) {
      const f = stack.pop()!;
      out.push(`</li></${f.type}>`);
    }

    const top = stack[stack.length - 1];
    if (top && top.indent === indent && top.type === type) {
      // Sibling: close the previous item, open a new one.
      out.push(`</li><li>${content}`);
    } else {
      // New (possibly nested) list. If a parent <li> is open, this nests
      // inside it — we intentionally do NOT close the parent <li>.
      out.push(`<${type}><li>${content}`);
      stack.push({ type, indent });
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      closeAllLists();
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeAllLists();
      out.push("<hr/>");
      continue;
    }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      closeAllLists();
      const level = h[1].length;
      out.push(`<h${level}>${formatInline(h[2])}</h${level}>`);
      continue;
    }

    const bullet = /^(\s*)-\s+(.*)$/.exec(line);
    if (bullet) {
      handleItem(bullet[1].length, "ul", formatInline(bullet[2]));
      continue;
    }

    const numbered = /^(\s*)\d+\.\s+(.*)$/.exec(line);
    if (numbered) {
      handleItem(numbered[1].length, "ol", formatInline(numbered[2]));
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      closeAllLists();
      out.push(`<blockquote>${formatInline(quote[1])}</blockquote>`);
      continue;
    }

    closeAllLists();
    out.push(`<p>${formatInline(line)}</p>`);
  }
  closeAllLists();
  return out.join("\n");
}

function wrapHtml(title: string, bodyHtml: string): string {
  const year = "2026";
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2937; margin: 0; padding: 0; font-size: 12px; line-height: 1.6;
  }
  .header {
    background: #4f46e5; color: #fff; padding: 22px 40px;
  }
  .header .brand { font-size: 13px; font-weight: 700; letter-spacing: 2px; opacity: .9; }
  .header .title { font-size: 24px; font-weight: 800; margin-top: 4px; }
  .content { padding: 28px 40px 48px; }
  h1 { font-size: 20px; color: #111827; margin: 0 0 12px; }
  h2 { font-size: 15px; color: #4f46e5; margin: 22px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  h3 { font-size: 13px; color: #374151; margin: 16px 0 6px; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0 6px 18px; padding: 0; }
  li { margin: 3px 0; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 22px 0; }
  code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-family: "Courier New", monospace; font-size: .9em; }
  strong { color: #111827; }
  blockquote {
    margin: 10px 0; padding: 8px 14px; background: #eef2ff;
    border-left: 3px solid #4f46e5; color: #3730a3; border-radius: 0 6px 6px 0;
  }
  .footer { color: #9ca3af; font-size: 10px; text-align: center; padding: 0 40px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">EVENTSH</div>
    <div class="title">${escapeHtml(title)}</div>
  </div>
  <div class="content">
    ${bodyHtml}
  </div>
  <div class="footer">Eventsh Organizer Guide · © ${year} · Generated automatically</div>
</body>
</html>`;
}

/** Convert guide markdown to a branded A4 PDF buffer. */
export async function renderGuidePdf(
  title: string,
  markdown: string,
): Promise<Buffer> {
  const html = wrapHtml(title, markdownToHtml(markdown));

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", bottom: "12mm", left: "0mm", right: "0mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
