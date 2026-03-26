import { Module } from "@nestjs/common";
import { MailerModule } from "@nestjs-modules/mailer";
import { MailService } from "./mail.service";

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
      defaults: {
        from: `"EventSH" <${process.env.SMTP_USER}>`,
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
