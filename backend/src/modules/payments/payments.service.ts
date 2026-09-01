import { Injectable, BadRequestException } from "@nestjs/common";
import * as QRCode from "qrcode"; // Fixed import
import * as crc from "crc";
import * as sharp from "sharp";
import { PaymentQrConfig, PaymentScheme } from "./payment-Qr.interface";
import { URLSearchParams } from "url";
import fetch from "node-fetch"; // npm install node-fetch
import { Buffer } from "buffer";
import { Readable } from "stream";
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from "@zxing/library";
import { loadImage, createCanvas } from "canvas";

@Injectable()
export class PaymentsService {
  // Generate EMVCo TLV string helper
  private tlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  }

  // CRC16 CCITT-FALSE per EMVCo spec
  private calculateCRC(payload: string): string {
    const data = Buffer.from(payload, "utf-8");
    const crcValue = crc.crc16ccitt(data, 0xffff);
    return crcValue.toString(16).toUpperCase().padStart(4, "0");
  }

  private currencyMap: Record<string, string> = {
    USD: "840",
    INR: "356",
    SGD: "702",
  };

  private getCurrencyCode(currency: string): string {
    const upper = (currency || "INR").toUpperCase();
    return this.currencyMap[upper] || "356"; // Default to INR
  }

  // Build Payment QR payload (EMVCo) dynamically for PayNow or UPI
  async buildPayload(config: PaymentQrConfig, refId?: string): Promise<string> {
    if (!config.payeeId || !config.payeeName || !config.scheme) {
      throw new BadRequestException("Missing required payment config");
    }
    // A static QR deliberately carries no amount — the payer types it — so the
    // amount check only applies to dynamic ones.
    const isStatic = !!config.staticQr;
    if (
      !isStatic &&
      (isNaN(Number(config.amount)) || Number(config.amount) <= 0)
    ) {
      throw new BadRequestException("Invalid amount");
    }

    // Point of initiation: "11" static (re-usable, no amount), "12" dynamic
    // (one transaction, amount baked in).
    const payloadHeader =
      this.tlv("00", "01") + this.tlv("01", isStatic ? "11" : "12");

    let merchantAccountInfo = "";
    if (config.scheme === "PAYNOW") {
      const proxyTypeValue = config.payeeId.match(/^\d{9}[A-Z]$/) ? "2" : "0";
      const proxyValue = config.payeeId.replace(/[\s+]/g, "");
      // PayNow tag 03 is the editable-amount indicator. A static QR has no
      // amount to lock, so it is always editable.
      const editableFlag = isStatic ? "1" : config.editableAmount ? "0" : "1";
      const mai =
        this.tlv("00", "SG.PAYNOW") +
        this.tlv("01", proxyTypeValue) +
        this.tlv("02", proxyValue) +
        this.tlv("03", editableFlag);
      merchantAccountInfo = this.tlv("26", mai);
    } else if (config.scheme === "UPI") {
      const aid = "com.upi";
      const mai =
        this.tlv("00", aid) +
        this.tlv("01", config.payeeId.replace(/\s+/g, ""));
      merchantAccountInfo = this.tlv("26", mai);
    } else {
      throw new BadRequestException("Unsupported QR scheme");
    }

    const mcc = "0000";
    const currencyNumeric = this.getCurrencyCode(config.currency);
    // Tag 54 is omitted entirely on a static QR — an empty or zero amount
    // field is not the same thing, and some bank apps reject it.
    const amountField = isStatic
      ? ""
      : this.tlv("54", parseFloat(config.amount).toFixed(2));
    const countryCode = config.countryCode.toUpperCase();
    const merchantName = config.payeeName.slice(0, 25);
    const merchantCity = "UNKNOWN";

    let additionalData = "";
    if (refId) {
      additionalData = this.tlv("01", refId.slice(0, 25));
    }
    const addField = additionalData ? this.tlv("62", additionalData) : "";

    const payloadWithoutCRC =
      payloadHeader +
      merchantAccountInfo +
      this.tlv("52", mcc) +
      this.tlv("53", currencyNumeric) +
      amountField +
      this.tlv("58", countryCode) +
      this.tlv("59", merchantName) +
      this.tlv("60", merchantCity) +
      addField +
      "6304";

    const crc = this.calculateCRC(payloadWithoutCRC);
    const fullPayload = payloadWithoutCRC + crc;
    return fullPayload;
  }

  /**
   * Runs the actual QR decode (zxing, via a canvas-rendered bitmap) on an
   * already-normalized image buffer. Shared by decodeQrFromFile and
   * decodeQrFromUrl so both go through the same, more tolerant decoder
   * (zxing handles rotation/noise/logos far better than a basic reader).
   */
  private async decodeQrFromImageBuffer(buffer: Buffer): Promise<any> {
    const img = await loadImage(buffer);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, img.width, img.height);

    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    // RGBLuminanceSource only computes real luminance when it's handed an
    // Int32Array of packed 0xRRGGBB pixels (BYTES_PER_ELEMENT === 4) — a
    // raw Uint8ClampedArray of R,G,B,A bytes (what canvas returns) gets
    // used as-is with no conversion, which reads as noise and always
    // fails to decode. Pack the pixels ourselves so it takes that path.
    const { data, width, height } = imageData;
    const packed = new Int32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      packed[i] = (r << 16) | (g << 8) | b;
    }
    const luminanceSource = new RGBLuminanceSource(
      packed,
      img.width,
      img.height
    );
    const binaryBitmap = new BinaryBitmap(
      new HybridBinarizer(luminanceSource)
    );
    const reader = new MultiFormatReader();

    try {
      const result = reader.decode(binaryBitmap, hints);
      if (result.getText().startsWith("upi://")) {
        const params = new URLSearchParams(
          result.getText().split("?")[1] || ""
        );
        const paramMap: Record<string, string> = {};
        params.forEach((v, k) => (paramMap[k] = v));
        return { raw: result.getText(), params: paramMap };
      }
      return { raw: result.getText() };
    } catch (zxingErr) {
      throw new BadRequestException(
        "ZXing decode failed: " + zxingErr.message
      );
    }
  }

  async decodeQrFromFile(filePath: string): Promise<any> {
    try {
      // Normalize via sharp first: the canvas loader only reliably
      // handles PNG/JPEG/GIF, but a phone photo of a printed QR sticker
      // is often HEIC (iPhone) or WEBP — sharp decodes virtually any
      // format and re-encodes to PNG. `.rotate()` also applies the
      // image's EXIF orientation, so a sideways phone photo doesn't trip
      // up the finder-pattern search.
      const normalized = await sharp(filePath).rotate().png().toBuffer();
      return await this.decodeQrFromImageBuffer(normalized);
    } catch (e: any) {
      throw new BadRequestException("Error decoding QR: " + e.message);
    }
  }

  // Decode QR from URL
  async decodeQrFromUrl(imageUrl: string): Promise<any> {
    if (!imageUrl) throw new BadRequestException("imageUrl missing");
    try {
      // Fetch the image bytes from the URL
      const response = await fetch(imageUrl);
      if (!response.ok)
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const normalized = await sharp(buffer).rotate().png().toBuffer();
      return await this.decodeQrFromImageBuffer(normalized);
    } catch (err: any) {
      throw new BadRequestException(
        "Failed to decode QR code from URL: " + err.message
      );
    }
  }

  async generateQrCode(
    config: PaymentQrConfig,
    refId?: string
  ): Promise<{ qr: string; intent: string }> {
    try {
      const payload = await this.buildPayload(config, refId);

      // Generate QR image as base64 data url
      const qr = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        margin: 2,
        scale: 6,
      });

      // Compose payment intent URI for universal deep link fallback
      let intent = `${config.scheme.toLowerCase()}://pay?pa=${encodeURIComponent(
        config.payeeId
      )}&pn=${encodeURIComponent(config.payeeName)}`;
      if (config.amount && !config.staticQr)
        intent += `&am=${encodeURIComponent(config.amount)}`;
      if (refId) intent += `&tr=${encodeURIComponent(refId)}`;
      if (config.currency)
        intent += `&cu=${encodeURIComponent(config.currency)}`;

      return { qr, intent };
    } catch (error) {
      console.error("Error generating QR code:", error);
      throw new BadRequestException(
        "Failed to generate QR code: " + error.message
      );
    }
  }
}
