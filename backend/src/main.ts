import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as dotenv from "dotenv";
import { AppModule } from "./app.module";
import * as path from "path";
import * as express from "express";
import helmet from "helmet";
import * as compression from "compression";

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers (relaxed for cross-origin image/resource loading)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Gzip compression for faster responses
  app.use(compression());

  async function getAllowedDomains(): Promise<string[]> {
    return [
      "https://eventsh.com",
      "https://thefoxsg.com",
      "https://xcionasia.com",
      "http://localhost:8080",
      "http://192.168.137.1:8080",
      "http://localhost:8081",
    ]; // sample static list, replace with DB call
  }

  app.enableCors({
    origin: async (origin, callback) => {
      if (!origin) {
        // allow server-to-server or curl/fetch w/o origin
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

  // Static file serving with cache headers (images cached 7 days)
  app.use(
    "/uploads",
    express.static(path.join(__dirname, "..", "uploads"), {
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
