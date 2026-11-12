import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes } from "crypto";
import { Model, Types } from "mongoose";
import { ComboxApiKey } from "./schemas/combox-api-key.schema";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const maskKey = (last: string | null) => (last ? `esk_••••••••${last}` : null);

@Injectable()
export class ComboxKeyService {
  constructor(
    @InjectModel(ComboxApiKey.name)
    private readonly keyModel: Model<ComboxApiKey>,
  ) {}

  async getKeyInfo(organizerId: string) {
    const key: any = await this.keyModel
      .findOne({ organizerId, revokedAt: null })
      .lean();
    return key
      ? {
          active: true,
          prefix: key.prefix,
          maskedKey: maskKey(key.lastChars),
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
        }
      : { active: false };
  }

  /** Creates a key, revoking any previous one. The plaintext is returned once. */
  async rotateKey(organizerId: string) {
    await this.keyModel.updateMany(
      { organizerId, revokedAt: null },
      { revokedAt: new Date() },
    );
    const apiKey = `esk_${randomBytes(24).toString("hex")}`;
    await this.keyModel.create({
      organizerId: new Types.ObjectId(organizerId),
      keyHash: sha256(apiKey),
      prefix: apiKey.slice(0, 8),
      lastChars: apiKey.slice(-2),
    });
    return {
      apiKey,
      prefix: apiKey.slice(0, 8),
      maskedKey: maskKey(apiKey.slice(-2)),
    };
  }

  async revokeKey(organizerId: string) {
    await this.keyModel.updateMany(
      { organizerId, revokedAt: null },
      { revokedAt: new Date() },
    );
    return { active: false };
  }

  /** The organizer a valid key belongs to, else null. */
  async resolveKey(plain: string): Promise<string | null> {
    const key = await this.keyModel.findOneAndUpdate(
      { keyHash: sha256(plain), revokedAt: null },
      { lastUsedAt: new Date() },
    );
    return key ? String(key.organizerId) : null;
  }
}
