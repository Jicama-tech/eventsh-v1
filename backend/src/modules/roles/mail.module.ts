import { Module } from "@nestjs/common";
import { MailerModule } from "@nestjs-modules/mailer";
import { MailService } from "./mail.service";
import { emailBrand } from "../../common/email/email-brand";

@Module({
  imports: [
    MailerModule.forRoot({
      transport: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS || "P@ssC)d*!23$",
        },
      },
      // Evaluated at import, before main.ts has run dotenv.config() — so this
      // is only a last resort. Callers set `from` per message (MailService's
      // platformFrom), which reads the brand when the email is actually sent.
      defaults: {
        from: `"${emailBrand().senderName}" <${process.env.SMTP_USER}>`,
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
