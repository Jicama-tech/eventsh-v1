import * as crypto from "crypto";

// AES-256-GCM encryption for secrets at rest (e.g. organizer SMTP passwords).
// Stored format: `enc:v1:<iv>:<authTag>:<ciphertext>` (base64 parts), so the
// value is unreadable in the database — including to anyone with DB/admin
// access. The key never leaves the server: EMAIL_CONFIG_ENC_KEY from .env
// (any string; hashed to 32 bytes). Changing the key invalidates previously
// encrypted secrets — organizers would just re-enter their SMTP password.

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  const secret =
    process.env.EMAIL_CONFIG_ENC_KEY ||
    process.env.JWT_ACCESS_SECRET ||
    "eventsh-dev-secret";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

// Idempotent: already-encrypted values pass through unchanged.
export function encryptSecret(plain: string): string {
  if (!plain || plain.startsWith(PREFIX)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    [iv, tag, ciphertext].map((b) => b.toString("base64")).join(":")
  );
}

// Legacy plaintext values (saved before encryption existed) pass through
// unchanged so older configs keep working; they get encrypted on next save.
export function decryptSecret(value?: string): string {
  if (!value || !value.startsWith(PREFIX)) return value || "";
  try {
    const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key or corrupted ciphertext — behave as "no password saved".
    return "";
  }
}
