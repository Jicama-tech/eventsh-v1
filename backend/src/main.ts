import { ShutdownSignal, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module";
import * as path from "path";
import * as fs from "fs";
import * as express from "express";
import helmet from "helmet";
import * as compression from "compression";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (relaxed for cross-origin image/resource loading).
  // Referrer-Policy is loosened to `strict-origin-when-cross-origin`
  // (the modern browser default) because Helmet's `no-referrer` default
  // strips the Referer on the Instagram /embed/ iframe's outbound
  // requests — and Instagram's embed endpoint uses the Referer to
  // decide whether to serve the full reel poster or a logged-out
  // placeholder card. Other 3rd-party embeds (Google, Facebook,
  // YouTube) also expect at least the origin.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  // Strip Cross-Origin-Opener-Policy on the eventfront Google-member
  // OAuth popup path. The popup needs to keep its `window.opener`
  // handle so it can postMessage the profile back to the dialog after
  // Google → backend redirect → frontend callback. Helmet's default
  // COOP (same-origin) severs that handle on cross-origin popup
  // navigations. Scoped to this exact path so the rest of the API
  // keeps the stricter default.
  app.use(
    ["/auth/google-member", "/auth/google-member/redirect"],
    (_req: any, res: any, next: any) => {
      res.removeHeader("Cross-Origin-Opener-Policy");
      res.removeHeader("Cross-Origin-Embedder-Policy");
      // Belt + suspenders: also set explicit unsafe-none so anything
      // downstream that reads-back the header sees the relaxed value.
      res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
      next();
    },
  );

  // Gzip compression for faster responses
  app.use(compression());

  async function getAllowedDomains(): Promise<string[]> {
    // CORS_ORIGINS (comma-separated) lets a white-label deployment allow its
    // own domain without touching this file — the eventsh.com deployment
    // doesn't need to set it, since the hardcoded list below covers it.
    if (process.env.CORS_ORIGINS) {
      return process.env.CORS_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    }

    const domains = [
      "https://eventsh.com",
      "https://thefoxsg.com",
      "https://xcionasia.com",
      "https://jicama.tech",
      "https://www.jicama.tech",
      "http://localhost:8080",
      "http://192.168.137.1:8080",
      "http://localhost:8081",
    ]; // sample static list, replace with DB call
    // Local-network dev origin (a phone browsing the Vite dev server over Wi-Fi).
    // Kept out of production so a machine-specific LAN IP never ships.
    if (process.env.NODE_ENV !== "production") {
      domains.push("http://192.168.1.6:8080");
    }
    return domains;
  }

  app.enableCors({
    origin: async (origin, callback) => {
      if (!origin) {
        // allow server-to-server or curl/fetch w/o origin
        return callback(null, true);
      }

      // Local development: the Vite dev server is reached as localhost,
      // 127.0.0.1 or a LAN address (a phone on the same Wi-Fi), on any
      // port. Never in production — there the list below is the rule.
      if (
        process.env.NODE_ENV !== "production" &&
        /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(
          origin,
        )
      ) {
        return callback(null, true);
      }
      const allowedDomains = await getAllowedDomains();
      if (allowedDomains.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(`CORS policy: The origin '${origin}' is not allowed.`),
        );
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });

  // Static file serving with cache headers (images cached 7 days).
  // Resolve the uploads directory defensively so the same code works
  // whether the compiled main.js lives at dist/main.js or dist/src/main.js
  // (the latter happens when tsconfig has no `rootDir`). We prefer the
  // CWD-relative path because that's also what multer's diskStorage uses
  // ("./uploads/events"). If CWD has no uploads/ folder yet, fall back to
  // an __dirname-relative path so first-run / unusual launches still find
  // the right place.
  const uploadsAtCwd = path.join(process.cwd(), "uploads");
  const uploadsNearMain = path.join(__dirname, "..", "uploads");
  const uploadsDir = fs.existsSync(uploadsAtCwd)
    ? uploadsAtCwd
    : fs.existsSync(uploadsNearMain)
      ? uploadsNearMain
      : uploadsAtCwd; // both missing — multer will create one at CWD on first upload
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      maxAge: "7d",
      etag: true,
      lastModified: true,
      immutable: true,
    }),
  );

  // Stricter validation: strip unknown fields and reject them
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Lets providers clean up when pm2 restarts the process. Each organizer's
  // WhatsApp socket is ended and its pending pairing write finished, rather
  // than the process dying mid-write and leaving a pairing the organizer has
  // to scan again (OrganizerWhatsappService.onModuleDestroy).
  //
  // Only the real stop signals (pm2 sends SIGINT; systemd and docker send
  // SIGTERM). With no argument Nest also traps SIGSEGV, SIGBUS, SIGFPE and
  // SIGILL, and a handled fault in a native addon (sharp or canvas decoding a
  // bad image) re-faults forever instead of crashing — the API would hang
  // rather than exit and be restarted by pm2.
  app.enableShutdownHooks([ShutdownSignal.SIGTERM, ShutdownSignal.SIGINT]);

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
