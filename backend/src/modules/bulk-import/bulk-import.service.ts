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
  "name",
  "email",
  "businessEmail",
  "whatsAppNumber",
  "phone",
  "country",
  "address",
  "shopName",
  "businessName",
  "businessCategory",
  "brandName",
  "city",
  "state",
  "pincode",
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
        if (canonicalFields.includes(proposal as T)) {
          aiMap[h] = proposal as T;
        } else {
          aiMap[h] = (cheapMap[h] || "ignore") as T;
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
      skipped: 0,
      errors: 0,
      mapping,
      skippedRows: [],
      errorRows: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const mapped = this.applyMapping<ExhibitorField>(raw, mapping as any);
      const name = String(mapped.name || "").trim();
      const email = String(mapped.email || "").trim().toLowerCase() || undefined;
      const wa = String(mapped.whatsAppNumber || "").trim();
      const shopName = String(mapped.shopName || mapped.businessName || "").trim();

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

      const dupOr: any[] = [];
      if (wa) {
        dupOr.push({ whatsappNumber: wa }, { whatsAppNumber: wa });
      }
      if (email) dupOr.push({ email });
      const exists = dupOr.length
        ? await this.vendorModel.exists({
            organizerId: orgObjId,
            $or: dupOr,
          })
        : null;
      if (exists) {
        result.skipped++;
        result.skippedRows.push({ row: i + 2, reason: "Already exists" });
        continue;
      }

      try {
        // Coerce membership fields out of the raw row values. Excel
        // gives us a date object straight for date-formatted cells but
        // strings ("2026-05-30", "yes", "TRUE") for everything else.
        const rawMember = String(mapped.isMember ?? "")
          .trim()
          .toLowerCase();
        const isMember =
          rawMember === "true" ||
          rawMember === "yes" ||
          rawMember === "y" ||
          rawMember === "1";
        let membershipEndDate: Date | undefined;
        const rawEnd = mapped.membershipEndDate;
        if (rawEnd instanceof Date && !isNaN(rawEnd.getTime())) {
          membershipEndDate = rawEnd;
        } else if (typeof rawEnd === "string" && rawEnd.trim()) {
          const d = new Date(rawEnd);
          if (!isNaN(d.getTime())) membershipEndDate = d;
        }

        await this.vendorModel.create({
          organizerId: orgObjId,
          name,
          email,
          businessEmail: mapped.businessEmail || undefined,
          phone: mapped.phone || undefined,
          country: mapped.country || undefined,
          address: mapped.address || undefined,
          shopName: shopName || undefined,
          businessName: mapped.businessName || shopName || undefined,
          businessCategory: mapped.businessCategory || undefined,
          brandName: mapped.brandName || undefined,
          city: mapped.city || undefined,
          state: mapped.state || undefined,
          pincode: mapped.pincode || undefined,
          whatsAppNumber: wa || undefined,
          whatsappNumber: wa || undefined,
          approved: true,
          isActive: true,
          isMember,
          membershipEndDate,
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
    const exhibitors = await this.vendorModel
      .find({ organizerId: orgObjId })
      .sort({ createdAt: -1 })
      .lean();

    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Exhibitors");
    sheet.columns = [
      { header: "Name", key: "name", width: 22 },
      { header: "Shop Name", key: "shopName", width: 22 },
      { header: "Business Name", key: "businessName", width: 22 },
      { header: "Business Category", key: "businessCategory", width: 22 },
      { header: "Brand Name", key: "brandName", width: 18 },
      { header: "Email", key: "email", width: 28 },
      { header: "Business Email", key: "businessEmail", width: 28 },
      { header: "WhatsApp Number", key: "whatsAppNumber", width: 22 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Country", key: "country", width: 14 },
      { header: "Address", key: "address", width: 30 },
      { header: "City", key: "city", width: 16 },
      { header: "State", key: "state", width: 16 },
      { header: "Pincode", key: "pincode", width: 12 },
      { header: "Approved", key: "approved", width: 10 },
      { header: "Created At", key: "createdAt", width: 22 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const v of exhibitors as any[]) {
      sheet.addRow({
        name: v.name || "",
        shopName: v.shopName || "",
        businessName: v.businessName || "",
        businessCategory: v.businessCategory || "",
        brandName: v.brandName || "",
        email: v.email || "",
        businessEmail: v.businessEmail || "",
        whatsAppNumber: v.whatsAppNumber || v.whatsappNumber || "",
        phone: v.phone || v.phoneNumber || "",
        country: v.country || "",
        address: v.address || "",
        city: v.city || "",
        state: v.state || "",
        pincode: v.pincode || "",
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
    sheet.columns = [
      { header: "Name", key: "name", width: 22 },
      { header: "Shop Name", key: "shopName", width: 22 },
      { header: "Business Category", key: "businessCategory", width: 22 },
      { header: "Email", key: "email", width: 28 },
      { header: "WhatsApp Number", key: "whatsAppNumber", width: 22 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Country", key: "country", width: 14 },
      { header: "Address", key: "address", width: 30 },
      { header: "Is Member", key: "isMember", width: 12 },
      { header: "Membership End Date", key: "membershipEndDate", width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.addRow({
      name: "Alex Vendor",
      shopName: "Alex's Crafts",
      businessCategory: "Handmade",
      email: "alex@vendor.com",
      whatsAppNumber: "+919876543210",
      phone: "+919876543210",
      country: "IN",
      address: "MG Road, Bangalore",
      isMember: "Yes",
      membershipEndDate: "2026-12-31",
    });
    const info = wb.addWorksheet("Instructions");
    info.addRow(["Bulk Exhibitor Import Template"]);
    info.addRow([]);
    info.addRow(["• Each row creates one Exhibitor (vendor)."]);
    info.addRow(["• Required: Name + (WhatsApp Number OR Email)."]);
    info.addRow([
      "• Column headers can be renamed — AI will map common variants.",
    ]);
    info.addRow([
      "• Duplicates (matched by WhatsApp or email under this organizer) are skipped.",
    ]);
    info.addRow([
      "• Is Member: Yes / No / true / false. Leave blank for non-members.",
    ]);
    info.addRow([
      "• Membership End Date: YYYY-MM-DD. Only used when Is Member is Yes.",
    ]);
    info.getRow(1).font = { bold: true, size: 14 };
    const ab = await wb.xlsx.writeBuffer();
    return Buffer.from(ab);
  }
}
