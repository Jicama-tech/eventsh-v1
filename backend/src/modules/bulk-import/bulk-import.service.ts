import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import OpenAI from "openai";
import * as XLSX from "xlsx";
import * as ExcelJS from "exceljs";

// Canonical field schemas. Anything mapped to "ignore" is dropped.
const VISITOR_FIELDS = [
  "name",
  "firstName",
  "lastName",
  "email",
  "whatsAppNumber",
  "phone",
  "ignore",
] as const;
type VisitorField = (typeof VISITOR_FIELDS)[number];

const EXHIBITOR_FIELDS = [
  // Stable record id. Present in exported sheets so a re-upload updates the
  // exact same vendor even when the email / WhatsApp was edited in the row.
  // Blank on fresh template rows — those create new vendors.
  "id",
  // Mirrors the organizer's "Add Exhibitor" form so the sheet carries the
  // same fields the form collects (name split into first/last).
  "firstName",
  "lastName",
  "name",
  "email",
  "businessEmail",
  "shopName",
  "businessCategory",
  "country",
  "whatsAppNumber",
  "phone",
  "address",
  // Manual membership flags so a bulk import can pre-populate the
  // member badge + expiry the CRM shows. Either or both can be omitted
  // — the row imports cleanly as a non-member when missing.
  "isMember",
  "membershipEndDate",
  "ignore",
] as const;
type ExhibitorField = (typeof EXHIBITOR_FIELDS)[number];

type ImportResult = {
  totalRows: number;
  created: number;
  // Existing records matched (by id, else email / WhatsApp) and refreshed
  // with the row's values. Drives the round-trip "export → edit → re-upload"
  // workflow for exhibitors.
  updated: number;
  skipped: number;
  errors: number;
  mapping: Record<string, string>;
  skippedRows: Array<{ row: number; reason: string }>;
  errorRows: Array<{ row: number; reason: string }>;
};

@Injectable()
export class BulkImportService {
  private readonly logger = new Logger(BulkImportService.name);
  private readonly ai: OpenAI;
  private readonly aiModel: string;
  private readonly aiAvailable: boolean;

  constructor(
    @InjectModel("User") private userModel: Model<any>,
    @InjectModel("Vendor") private vendorModel: Model<any>,
    @InjectModel("Stall") private stallModel: Model<any>,
  ) {
    // Mirror chatbot.service AI client setup so column-mapping uses whichever
    // provider the project is already configured for.
    const useQwen = !!process.env.QWEN_API_KEY;
    const apiKey = useQwen
      ? process.env.QWEN_API_KEY
      : process.env.GROQ_API_KEY || "";
    const baseURL = useQwen
      ? process.env.QWEN_BASE_URL ||
        "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
      : process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
    this.ai = new OpenAI({ apiKey, baseURL });
    this.aiModel = useQwen
      ? process.env.QWEN_ROUTER_MODEL || "qwen-turbo"
      : process.env.GROQ_ROUTER_MODEL || "llama-3.1-8b-instant";
    this.aiAvailable = !!apiKey;
  }

  // ============================ EXCEL PARSE ============================

  private parseFile(buffer: Buffer): { rows: Record<string, any>[]; headers: string[] } {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    } catch {
      throw new BadRequestException(
        "Could not read the file. Please upload a valid .xlsx, .xls, or .csv.",
      );
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException("File has no sheets");
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      defval: "",
      raw: false,
    });
    if (!rows.length) {
      throw new BadRequestException("File is empty.");
    }
    const headers = Object.keys(rows[0]);
    return { rows, headers };
  }

  // ============================ AI MAPPING =============================

  private async mapColumnsWithAI<T extends string>(
    headers: string[],
    sampleRows: Record<string, any>[],
    canonicalFields: readonly T[],
    target: "visitor" | "exhibitor",
  ): Promise<Record<string, T>> {
    // Cheap fast-path: if every header already matches a canonical field
    // (case-insensitive), skip the AI call entirely.
    const cheapMap = this.cheapMap(headers, canonicalFields);
    const allMatched = headers.every((h) => cheapMap[h] && cheapMap[h] !== "ignore");
    if (allMatched || !this.aiAvailable) return cheapMap;

    const fieldList = canonicalFields.join(", ");
    const sampleSnippet = sampleRows
      .slice(0, 3)
      .map((r, i) => `Row ${i + 1}: ${JSON.stringify(r)}`)
      .join("\n");

    const prompt = `You are mapping spreadsheet columns to canonical ${target} fields for an event-management system.

CANONICAL FIELDS (you MUST pick from this list, or use "ignore"):
${fieldList}

SOURCE COLUMN HEADERS:
${JSON.stringify(headers)}

SAMPLE ROWS (first 3):
${sampleSnippet}

For EVERY source header, return the best canonical field. Use "ignore" when nothing matches.
Examples: "WA Number" / "Mobile" / "Cell" → whatsAppNumber. "Mail" / "E-mail" → email. "Full Name" → name.

Return ONLY this JSON shape, nothing else:
{ "mapping": { "<source header>": "<canonical field>", ... } }`;

    try {
      const completion = await this.ai.chat.completions.create({
        model: this.aiModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        response_format: { type: "json_object" } as any,
      });
      const raw = completion.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);
      const aiMap: Record<string, T> = {};
      const m = parsed.mapping || {};
      for (const h of headers) {
        const proposal = m[h];
        const cheap = cheapMap[h];
        // Trust our deterministic alias/direct match first — it reliably maps
        // our own exported/template headers (e.g. "Owner Name" -> name). The
        // AI sometimes downgrades a known column to "ignore", which would drop
        // required data; only fall back to the AI for headers we can't resolve.
        if (cheap && cheap !== ("ignore" as T)) {
          aiMap[h] = cheap;
        } else if (canonicalFields.includes(proposal as T)) {
          aiMap[h] = proposal as T;
        } else {
          aiMap[h] = "ignore" as T;
        }
      }
      return aiMap;
    } catch (err) {
      this.logger.warn(
        `AI column mapping failed, falling back to fuzzy match: ${err}`,
      );
      return cheapMap;
    }
  }

  // Local fuzzy fallback: lowercase-strip-compare against canonical names plus
  // a handful of known aliases. Used when AI unavailable or as warm-start.
  private cheapMap<T extends string>(
    headers: string[],
    canonicalFields: readonly T[],
  ): Record<string, T> {
    const aliases: Record<string, string> = {
      mobile: "whatsAppNumber",
      cell: "whatsAppNumber",
      cellphone: "whatsAppNumber",
      whatsapp: "whatsAppNumber",
      whatsappnumber: "whatsAppNumber",
      whatsappno: "whatsAppNumber",
      wa: "whatsAppNumber",
      wanumber: "whatsAppNumber",
      mail: "email",
      emailid: "email",
      emailaddress: "email",
      fullname: "name",
      contactname: "name",
      ownername: "name",
      firstname: "firstName",
      lastname: "lastName",
      phone: "phone",
      phonenumber: "phone",
      tel: "phone",
      telephone: "phone",
      shop: "shopName",
      shopname: "shopName",
      store: "shopName",
      business: "businessName",
      businessname: "businessName",
      company: "businessName",
      category: "businessCategory",
      businesscategory: "businessCategory",
      brand: "brandName",
      brandname: "brandName",
      address: "address",
      city: "city",
      state: "state",
      country: "country",
      pincode: "pincode",
      zip: "pincode",
      zipcode: "pincode",
      businessemail: "businessEmail",
      primaryemail: "email",
      personalemail: "email",
      // Record-id aliases so an exported sheet round-trips for updates.
      id: "id",
      recordid: "id",
      vendorid: "id",
      exhibitorid: "id",
      // Membership column aliases — accept the common spellings so
      // organizers don't have to match our header exactly.
      ismember: "isMember",
      member: "isMember",
      memberstatus: "isMember",
      membershipend: "membershipEndDate",
      membershipenddate: "membershipEndDate",
      memberend: "membershipEndDate",
      memberenddate: "membershipEndDate",
      expiry: "membershipEndDate",
      memberexpiry: "membershipEndDate",
    };
    const norm = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const out: Record<string, T> = {};
    for (const h of headers) {
      const n = norm(h);
      const direct = canonicalFields.find((c) => norm(c) === n);
      if (direct) {
        out[h] = direct as T;
        continue;
      }
      const alias = aliases[n];
      if (alias && canonicalFields.includes(alias as T)) {
        out[h] = alias as T;
        continue;
      }
      out[h] = "ignore" as T;
    }
    return out;
  }

  // ============================ VISITORS ===============================

  async importVisitors(
    organizerId: string,
    fileBuffer: Buffer,
  ): Promise<ImportResult> {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const { rows, headers } = this.parseFile(fileBuffer);
    const mapping = await this.mapColumnsWithAI(
      headers,
      rows,
      VISITOR_FIELDS,
      "visitor",
    );

    const result: ImportResult = {
      totalRows: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      mapping,
      skippedRows: [],
      errorRows: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const mapped = this.applyMapping<VisitorField>(raw, mapping as any);
      // Derive name from firstName/lastName when name itself wasn't supplied.
      let name = String(mapped.name || "").trim();
      const firstName = String(mapped.firstName || "").trim();
      const lastName = String(mapped.lastName || "").trim();
      if (!name && (firstName || lastName)) {
        name = `${firstName} ${lastName}`.trim();
      }
      const email = String(mapped.email || "").trim().toLowerCase() || undefined;
      const wa = String(mapped.whatsAppNumber || "").trim();

      if (!name) {
        result.skipped++;
        result.skippedRows.push({ row: i + 2, reason: "Missing name" });
        continue;
      }
      if (!wa && !email) {
        result.skipped++;
        result.skippedRows.push({
          row: i + 2,
          reason: "Need WhatsApp number or email",
        });
        continue;
      }

      // Skip if a matching visitor already exists for this organizer.
      const dupQuery: any = {
        provider: "Shopkeeper",
        providerId: organizerId,
        $or: [],
      };
      if (wa) dupQuery.$or.push({ whatsAppNumber: wa });
      if (email) dupQuery.$or.push({ email });
      if (dupQuery.$or.length === 0) delete dupQuery.$or;
      const exists = await this.userModel.exists(dupQuery);
      if (exists) {
        result.skipped++;
        result.skippedRows.push({ row: i + 2, reason: "Already exists" });
        continue;
      }

      try {
        await this.userModel.create({
          name,
          firstName: firstName || name.split(" ")[0],
          lastName: lastName || name.split(" ").slice(1).join(" "),
          email,
          whatsAppNumber: wa || undefined,
          provider: "Shopkeeper",
          providerId: organizerId,
          roles: ["user"],
        });
        result.created++;
      } catch (err: any) {
        result.errors++;
        result.errorRows.push({
          row: i + 2,
          reason: err?.message || "Insert failed",
        });
      }
    }

    return result;
  }

  // ============================ EXHIBITORS =============================

  async importExhibitors(
    organizerId: string,
    fileBuffer: Buffer,
  ): Promise<ImportResult> {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const { rows, headers } = this.parseFile(fileBuffer);
    const mapping = await this.mapColumnsWithAI(
      headers,
      rows,
      EXHIBITOR_FIELDS,
      "exhibitor",
    );
    const orgObjId = new Types.ObjectId(organizerId);

    const result: ImportResult = {
      totalRows: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      mapping,
      skippedRows: [],
      errorRows: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const mapped = this.applyMapping<ExhibitorField>(raw, mapping as any);
      // Name may arrive as a single column or as first/last (Add Exhibitor
      // form shape) — accept either.
      const first = String((mapped as any).firstName || "").trim();
      const last = String((mapped as any).lastName || "").trim();
      const name =
        String(mapped.name || "").trim() ||
        `${first} ${last}`.trim();
      const email = String(mapped.email || "").trim().toLowerCase() || undefined;
      const wa = String(mapped.whatsAppNumber || "").trim();
      const idVal = String((mapped as any).id || "").trim();

      if (!name) {
        result.skipped++;
        result.skippedRows.push({ row: i + 2, reason: "Missing name" });
        continue;
      }
      if (!wa && !email) {
        result.skipped++;
        result.skippedRows.push({
          row: i + 2,
          reason: "Need WhatsApp number or email",
        });
        continue;
      }

      try {
        // Locate an existing vendor to update. Prefer the exported row id
        // (survives email / WhatsApp edits); fall back to matching on the
        // contact fields so sheets built from our template still update.
        let existing: any = null;
        if (idVal && Types.ObjectId.isValid(idVal)) {
          existing = await this.vendorModel
            .findOne({ _id: new Types.ObjectId(idVal), organizerId: orgObjId })
            .lean();
        }
        if (!existing) {
          const dupOr: any[] = [];
          if (wa) dupOr.push({ whatsappNumber: wa }, { whatsAppNumber: wa });
          if (email) dupOr.push({ email });
          if (dupOr.length) {
            existing = await this.vendorModel
              .findOne({ organizerId: orgObjId, $or: dupOr })
              .lean();
          }
        }

        // Only the columns actually present in the row are written, so a
        // partial sheet never wipes existing data on update.
        const fields = this.buildExhibitorFields(mapped);

        if (existing) {
          await this.vendorModel.updateOne(
            { _id: existing._id },
            { $set: fields },
          );
          result.updated++;
        } else {
          await this.vendorModel.create({
            organizerId: orgObjId,
            approved: true,
            isActive: true,
            isMember: false,
            ...fields,
          });
          result.created++;
        }
      } catch (err: any) {
        result.errors++;
        result.errorRows.push({
          row: i + 2,
          reason: err?.message || "Insert failed",
        });
      }
    }

    return result;
  }

  // Translate a mapped exhibitor row into the vendor fields to persist.
  // Returns ONLY the keys whose source cells had a value — callers spread
  // this onto a create payload or pass it to $set so blank cells never
  // clobber stored data on update.
  private buildExhibitorFields(
    mapped: Partial<Record<ExhibitorField, any>>,
  ): Record<string, any> {
    const set: Record<string, any> = {};
    const put = (key: string, val: any) => {
      const v = typeof val === "string" ? val.trim() : val;
      if (v !== undefined && v !== null && v !== "") set[key] = v;
    };

    // Derive the combined name from first/last when a single Name column
    // wasn't supplied — mirrors the Add Exhibitor form (first + last).
    const firstName = String(mapped.firstName || "").trim();
    const lastName = String(mapped.lastName || "").trim();
    let name = String(mapped.name || "").trim();
    if (!name && (firstName || lastName)) {
      name = `${firstName} ${lastName}`.trim();
    }

    put("name", name);
    put("email", String(mapped.email || "").trim().toLowerCase());
    put("businessEmail", String(mapped.businessEmail || "").trim().toLowerCase());
    put("shopName", mapped.shopName);
    put("businessCategory", mapped.businessCategory);
    put("country", mapped.country);
    put("phone", mapped.phone);
    put("address", mapped.address);

    const wa = String(mapped.whatsAppNumber || "").trim();
    if (wa) {
      set.whatsAppNumber = wa;
      set.whatsappNumber = wa;
    }

    // Membership flag — coerced from "Yes"/"true"/"1" etc. Only written
    // when the column actually carries a value, so omitting it leaves the
    // stored flag untouched on update.
    if (mapped.isMember != null && String(mapped.isMember).trim() !== "") {
      const r = String(mapped.isMember).trim().toLowerCase();
      set.isMember = r === "true" || r === "yes" || r === "y" || r === "1";
    }
    // Membership end date — Excel hands us a Date for date-formatted cells
    // and a string ("2026-12-31") otherwise.
    const end = this.parseDate(mapped.membershipEndDate);
    if (end) set.membershipEndDate = end;

    return set;
  }

  private parseDate(raw: any): Date | undefined {
    if (raw instanceof Date && !isNaN(raw.getTime())) return raw;
    if (typeof raw === "string" && raw.trim()) {
      const d = new Date(raw.trim());
      if (!isNaN(d.getTime())) return d;
    }
    return undefined;
  }

  private applyMapping<T extends string>(
    rawRow: Record<string, any>,
    mapping: Record<string, T>,
  ): Partial<Record<T, any>> {
    const out: Partial<Record<T, any>> = {};
    for (const [src, canonical] of Object.entries(mapping)) {
      if (canonical === ("ignore" as T)) continue;
      const v = rawRow[src];
      if (v == null || v === "") continue;
      // First non-empty wins so we don't clobber a mapped column with a later
      // duplicate header (Excel sometimes appends "_1" etc.).
      if ((out as any)[canonical] == null || (out as any)[canonical] === "") {
        (out as any)[canonical] = typeof v === "string" ? v.trim() : v;
      }
    }
    return out;
  }

  // ============================ EXPORTS ================================

  async exportVisitors(organizerId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const visitors = await this.userModel
      .find({ provider: "Shopkeeper", providerId: organizerId })
      .sort({ createdAt: -1 })
      .lean();

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Visitors");
    sheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "First Name", key: "firstName", width: 18 },
      { header: "Last Name", key: "lastName", width: 18 },
      { header: "Email", key: "email", width: 30 },
      { header: "WhatsApp Number", key: "whatsAppNumber", width: 22 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const v of visitors as any[]) {
      sheet.addRow({
        name: v.name || "",
        firstName: v.firstName || "",
        lastName: v.lastName || "",
        email: v.email || "",
        whatsAppNumber: v.whatsAppNumber || "",
        createdAt: v.createdAt
          ? new Date(v.createdAt).toISOString().slice(0, 19).replace("T", " ")
          : "",
      });
    }
    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab);
  }

  async exportExhibitors(organizerId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(organizerId)) {
      throw new BadRequestException("Invalid organizer id");
    }
    const orgObjId = new Types.ObjectId(organizerId);
    // Include BOTH sources of exhibitors:
    //   1. vendors owned by this organizer (added via CRM / bulk import)
    //   2. vendors who registered through the stall form for this organizer's
    //      events (older ones may not carry organizerId) — matched via their
    //      stall records.
    const stallVendorIds = await this.stallModel
      .find({ organizerId: orgObjId })
      .distinct("shopkeeperId");
    const exhibitors = await this.vendorModel
      .find({
        $or: [
          { organizerId: orgObjId },
          { _id: { $in: stallVendorIds } },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Exhibitors");
    // Columns mirror the organizer's "Add Exhibitor" form. ID is first so
    // editing a row and re-uploading updates that exact vendor; leave ID
    // blank to create a new exhibitor.
    sheet.columns = [
      { header: "ID", key: "id", width: 26 },
      { header: "First Name", key: "firstName", width: 18 },
      { header: "Last Name", key: "lastName", width: 18 },
      { header: "Email", key: "email", width: 28 },
      { header: "Business Email", key: "businessEmail", width: 28 },
      { header: "Shop Name", key: "shopName", width: 24 },
      { header: "Business Category", key: "businessCategory", width: 20 },
      { header: "Country", key: "country", width: 14 },
      { header: "WhatsApp Number", key: "whatsAppNumber", width: 20 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Address", key: "address", width: 30 },
      // Membership status + validity. Edit these and re-upload to change a
      // vendor's member badge / expiry in bulk.
      { header: "Is Member", key: "isMember", width: 12 },
      { header: "Membership End Date", key: "membershipEndDate", width: 20 },
      // Read-only metadata (mapped to "ignore" on re-import).
      { header: "Approved", key: "approved", width: 10 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const v of exhibitors as any[]) {
      const end = v.membershipEndDate ? new Date(v.membershipEndDate) : null;
      const fullName = String(v.name || "").trim();
      const [firstName, ...rest] = fullName.split(" ");
      sheet.addRow({
        id: String(v._id || ""),
        firstName: firstName || "",
        lastName: rest.join(" ") || "",
        email: v.email || "",
        businessEmail: v.businessEmail || "",
        shopName: v.shopName || v.businessName || "",
        businessCategory: v.businessCategory || v.businessType || "",
        country: v.country || "",
        whatsAppNumber: v.whatsAppNumber || v.whatsappNumber || "",
        phone: v.phone || v.phoneNumber || "",
        address: v.address || "",
        isMember: v.isMember ? "Yes" : "No",
        membershipEndDate:
          end && !isNaN(end.getTime())
            ? end.toISOString().slice(0, 10)
            : "",
        approved: v.approved ? "Yes" : "No",
        createdAt: v.createdAt
          ? new Date(v.createdAt).toISOString().slice(0, 19).replace("T", " ")
          : "",
      });
    }
    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab);
  }

  // ============================ TEMPLATES ==============================

  async visitorTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Visitors");
    sheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "WhatsApp Number", key: "whatsAppNumber", width: 22 },
      { header: "Phone", key: "phone", width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      name: "Jane Doe",
      email: "jane@example.com",
      whatsAppNumber: "+919876543210",
      phone: "+919876543210",
    });
    const info = wb.addWorksheet("Instructions");
    info.addRow(["Bulk Visitor Import Template"]);
    info.addRow([]);
    info.addRow([
      "• Each row creates one Visitor.",
    ]);
    info.addRow([
      "• Required: Name + (WhatsApp Number OR Email).",
    ]);
    info.addRow([
      "• Column headers can be renamed — AI will map common variants like 'WA', 'Mobile', 'E-mail'.",
    ]);
    info.addRow([
      "• Duplicates (matched by WhatsApp or email) are skipped, not overwritten.",
    ]);
    info.getRow(1).font = { bold: true, size: 14 };
    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab);
  }

  async exhibitorTemplate(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Exhibitors");
    // Same columns as the export / "Add Exhibitor" form so the template,
    // export and import all line up. ID is included (blank = new rows).
    sheet.columns = [
      { header: "ID", key: "id", width: 26 },
      { header: "First Name", key: "firstName", width: 18 },
      { header: "Last Name", key: "lastName", width: 18 },
      { header: "Email", key: "email", width: 28 },
      { header: "Business Email", key: "businessEmail", width: 28 },
      { header: "Shop Name", key: "shopName", width: 24 },
      { header: "Business Category", key: "businessCategory", width: 20 },
      { header: "Country", key: "country", width: 14 },
      { header: "WhatsApp Number", key: "whatsAppNumber", width: 20 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Address", key: "address", width: 30 },
      { header: "Is Member", key: "isMember", width: 12 },
      { header: "Membership End Date", key: "membershipEndDate", width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      firstName: "Alex",
      lastName: "Kumar",
      email: "alex@vendor.com",
      businessEmail: "info@alexcrafts.com",
      shopName: "Alex Crafts Pvt Ltd",
      businessCategory: "Handmade",
      country: "IN",
      whatsAppNumber: "+919876543210",
      phone: "+919876543210",
      address: "MG Road, Bangalore",
      isMember: "Yes",
      membershipEndDate: "2026-12-31",
    });
    const info = wb.addWorksheet("Instructions");
    info.addRow(["Bulk Exhibitor Import Template"]);
    info.addRow([]);
    info.addRow(["• Each new row creates one Exhibitor (vendor)."]);
    info.addRow([
      "• Columns mirror the 'Add Exhibitor' form: First/Last Name, Email,",
    ]);
    info.addRow([
      "  Business Email, Shop Name, Business Category, Country, WhatsApp,",
    ]);
    info.addRow(["  Phone, Address, Is Member, Membership End Date."]);
    info.addRow(["• Required: First Name + (WhatsApp Number OR Email)."]);
    info.addRow([
      "• Column headers can be renamed — AI will map common variants.",
    ]);
    info.addRow([
      "• Update existing exhibitors: export the current list, edit the cells,",
    ]);
    info.addRow([
      "  and re-upload. Rows are matched by the ID column (or by WhatsApp /",
    ]);
    info.addRow([
      "  email when ID is blank) and the matching record is updated in place.",
    ]);
    info.addRow([
      "• Only the cells you fill are written — blank cells never erase data.",
    ]);
    info.addRow([
      "• Is Member: Yes / No / true / false. Leave blank for non-members.",
    ]);
    info.addRow([
      "• Membership End Date: YYYY-MM-DD. The membership validity period.",
    ]);
    info.getRow(1).font = { bold: true, size: 14 };
    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab);
  }
}
