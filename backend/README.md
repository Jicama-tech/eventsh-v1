# Eventsh Backend (NestJS + MongoDB)

This is a ready-to-run NestJS backend skeleton for Eventsh with:
- MongoDB (Mongoose)
- JWT authentication (access + refresh tokens)
- Google OAuth (Passport)
- Instagram OAuth skeleton (Passport OAuth2 strategy)
- Modules: users, events, organizers, shopkeepers, uploads
- Swagger (basic wiring)
- Seed script to create an admin user
- Docker-compose for local MongoDB (optional)

## Quick start (local MongoDB)
1. Copy `.env.example` to `.env` and update values.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start local MongoDB (or run `docker-compose up -d`).
4. Run in dev mode:
   ```bash
   npm run start:dev
   ```
5. API runs at `http://localhost:3000`. Swagger will be available at `/api` if enabled in `main.ts`.

## Docker (optional)
A `docker-compose.yml` is provided to start MongoDB locally:
```bash
docker-compose up -d
```

## OAuth notes
- Google OAuth: create credentials in Google Cloud Console and set the redirect URI to `http://localhost:3000/auth/google/redirect`.
- Instagram (Meta) OAuth: you'll need a Facebook Developer app. The code includes the OAuth endpoints but you must register your app and set `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET` in `.env`.

## Seed
To create an admin user and sample data (requires ts-node):
```bash
npm run seed
```

---
You can now integrate this backend with your React frontend. See `src/modules` for the implemented endpoints and DTOs.
