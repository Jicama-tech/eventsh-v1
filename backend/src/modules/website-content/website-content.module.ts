import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JwtModule } from "@nestjs/jwt";
import { WebsiteContentController } from "./website-content.controller";
import { WebsiteContentService } from "./website-content.service";
import {
  WebsiteContent,
  WebsiteContentSchema,
} from "./schemas/website-content.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebsiteContent.name, schema: WebsiteContentSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || "secretKey",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [WebsiteContentController],
  providers: [WebsiteContentService],
})
export class WebsiteContentModule {}
