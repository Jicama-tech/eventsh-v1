<p align="center">
  <img src="frontend/EventshLogo.png" alt="EventSH Logo" width="200" />
</p>

<h1 align="center">EventSH</h1>

<p align="center">
  <strong>A comprehensive, full-stack event management platform built for organizers, vendors, speakers, and attendees.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/backend-NestJS-red" alt="NestJS" />
  <img src="https://img.shields.io/badge/frontend-React%20+%20Vite-61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/database-MongoDB-47A248" alt="MongoDB" />
  <img src="https://img.shields.io/badge/language-TypeScript-3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## Overview

EventSH is an end-to-end event management platform that enables organizers to create events, manage vendors/exhibitors, sell tickets, handle speaker applications, and customize their event storefronts — all from a single dashboard.

### Key Highlights

- **Multi-tenant architecture** — Supports multiple organizers with custom storefronts
- **Role-based access** — Admin, Organizer, User, Vendor, and Speaker roles
- **WhatsApp-first communication** — OTP verification, ticket delivery, and booking confirmations via WhatsApp
- **Multi-currency support** — INR (India) and SGD (Singapore) across all messages, PDFs, and UI
- **QR-based entry management** — Secure QR codes for tickets and stall check-in/check-out
- **Real-time venue layout** — Interactive drag-and-drop venue configuration with table/stall management

---

## Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **NestJS** | Server framework |
| **MongoDB + Mongoose** | Database & ODM |
| **JWT + Passport** | Authentication (Local, Google OAuth, Instagram OAuth) |
| **Baileys** | WhatsApp messaging integration |
| **Puppeteer** | PDF ticket generation |
| **Razorpay** | Payment processing |
| **Nodemailer** | Email fallback delivery |
| **Helmet + Compression** | Security headers & response compression |

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **Vite** | Build tool & dev server |
| **TypeScript** | Type safety |
| **Tailwind CSS** | Utility-first styling |
| **Radix UI + shadcn/ui** | Accessible component library |
| **React Router v6** | Client-side routing |
| **TanStack React Query** | Server state management & caching |
| **Framer Motion** | Animations |
| **Capacitor** | Mobile app support (iOS/Android) |

---

## Project Structure

```
eventsh/
├── backend/                    # NestJS API server
│   ├── src/
│   │   ├── main.ts             # Entry point (Helmet, CORS, Compression)
│   │   ├── app.module.ts       # Root module (MongoDB connection pooling)
│   │   └── modules/
│   │       ├── admin/          # Admin management & dashboard
│   │       ├── auth/           # JWT, Google & Instagram OAuth strategies
│   │       ├── events/         # Event CRUD with venue config
│   │       ├── organizers/     # Organizer profiles & stores
│   │       ├── organizer-stores/ # Storefront customization
│   │       ├── tickets/        # Ticket creation, QR, WhatsApp delivery
│   │       ├── stalls/         # Vendor/stall management & payments
│   │       ├── speaker-requests/ # Speaker application workflow
│   │       ├── users/          # User management with OAuth
│   │       ├── otp/            # WhatsApp & Email OTP service
│   │       ├── payments/       # Razorpay integration
│   │       ├── coupon/         # Discount coupon system
│   │       ├── plans/          # Subscription plans
│   │       ├── operators/      # Operator accounts
│   │       ├── enquiry/        # Contact enquiries
│   │       └── roles/          # Role management & mail service
│   └── package.json
│
├── frontend/                   # React + Vite SPA
│   ├── src/
│   │   ├── App.tsx             # Routing & auth (lazy-loaded routes)
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx
│   │   │   ├── Events.tsx
│   │   │   ├── organizer/      # OrganizerDashboard (code-split tabs)
│   │   │   ├── admin/          # Admin dashboard, users, settings
│   │   │   └── user/           # User dashboard
│   │   ├── components/
│   │   │   ├── organizer/      # Dashboard, events, attendees, settings
│   │   │   ├── user/           # Storefront, event detail, payments
│   │   │   ├── auth/           # Login, register, OAuth
│   │   │   └── ui/             # 80+ shadcn/ui components
│   │   └── hooks/              # Auth, currency, country, toast hooks
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## Features

### For Organizers
- Create and manage events with rich details (venue, schedule, speakers, features)
- Interactive venue layout editor with drag-and-drop table placement
- Multiple visitor types with individual pricing and capacity
- Vendor/exhibitor stall management with approval workflow
- Speaker application review and session assignment
- Custom eventfront/storefront with theme, colors, and branding
- QR code scanning for attendee check-in/check-out
- Dashboard with real-time analytics (tickets sold, revenue, stalls booked)
- Coupon code generation for exhibitor complimentary entry

### For Vendors/Exhibitors
- WhatsApp OTP-based registration (no account needed)
- Stall application with business details, product images, and documents
- Space/table selection from interactive venue layout
- Payment confirmation with auto-generated PDF ticket via WhatsApp
- Returning vendor auto-fill from dedicated vendors collection
- Full booking history with timeline and status tracking

### For Attendees
- Browse events with search and filters
- Select ticket type from multiple visitor categories
- Purchase tickets with QR code generation
- Receive PDF tickets via WhatsApp
- Follow events and organizers

### For Speakers
- Apply to speak at events via WhatsApp verification
- Select available time slots
- Track application status (Pending, Approved, Rejected)
- Receive confirmation via WhatsApp

### For Admins
- Approve/reject organizer registrations
- Manage subscription plans and pricing
- View platform-wide analytics
- User management across all roles

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **MongoDB** >= 6.x (local or Atlas)
- **npm** >= 9.x

### 1. Clone the repository

```bash
git clone https://github.com/Jicama-tech/eventsh-v1.git
cd eventsh-v1
```

### 2. Backend Setup

```bash
cd backend
npm install --legacy-peer-deps
```

Create a `.env` file in `backend/`:

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/eventsh_dev

# JWT
JWT_ACCESS_SECRET=your_jwt_secret
JWT_ACCESS_EXPIRY=900s
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRY=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# SMTP (for email fallback)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Razorpay (optional)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

Start the backend:

```bash
npm run start:dev
```

Backend runs at `http://localhost:3000`

### 3. Frontend Setup

```bash
cd frontend
npm install --legacy-peer-deps
```

Create a `.env.development` file in `frontend/`:

```env
VITE_API_URL=http://localhost:3000
```

Start the frontend:

```bash
npm run dev
```

Frontend runs at `http://localhost:8080`

---

## Deployment

### Production Build

```bash
# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build    # Output in dist/
```

### Environment Variables (Production)

**Frontend** `.env.production`:
```env
VITE_API_URL=https://yourdomain.com/api
```

For detailed deployment instructions (VPS, Docker, Nginx), see [`frontend/DEPLOYMENT_GUIDE.md`](frontend/DEPLOYMENT_GUIDE.md).

---

## API Overview

| Module | Endpoints | Auth |
|---|---|---|
| **Auth** | `POST /auth/login`, Google/Instagram OAuth | Public |
| **Events** | `GET /events/get-events`, `POST /events/create-event` | JWT (write) |
| **Tickets** | `POST /tickets/create-ticket`, `GET /tickets/:id` | Public/JWT |
| **Stalls** | `POST /stalls/register-for-stall`, `PATCH /stalls/:id/select-tables-and-addons` | Public |
| **Vendors** | `GET /stalls/vendor/profile/:phone`, `GET /stalls/vendor/detail/:id` | Public |
| **Speakers** | `POST /speaker-requests`, `PATCH /speaker-requests/:id/status` | JWT |
| **Organizers** | `POST /organizers/register`, `GET /organizers/:email` | Public/JWT |
| **OTP** | `POST /otp/send-whatsapp-otp`, `POST /otp/verify-whatsapp-otp` | Public |
| **Admin** | `POST /admin/create-admin`, `GET /admin/dashboard-stats` | JWT |

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **Current Version:** `v1.0.0`
- Tags: `git tag` to list all versions
- Each release is tagged: `v{major}.{minor}.{patch}`

| Version | Description |
|---|---|
| `v1.0.0` | Initial release — full platform with events, tickets, stalls, speakers |

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **Monorepo** | Frontend & backend are tightly coupled; single repo simplifies deployment and versioning |
| **Dedicated `vendors` collection** | Vendor data persists across events for returning vendor auto-fill |
| **WhatsApp-first** | Target markets (India, Singapore) prefer WhatsApp over email |
| **Lazy-loaded dashboard tabs** | OrganizerDashboard reduced from 850KB to 217KB initial load |
| **Per-visitor-type ticketing** | Events can have VIP, General, Student etc. with independent pricing and capacity |
| **`originalTotalTickets` field** | Tracks original capacity separately from decremented `totalTickets` |

---

## Performance Optimizations

- **Backend:** Helmet security headers, gzip compression, MongoDB connection pooling (10 max), `.lean()` queries, paginated endpoints, 7-day static asset caching
- **Frontend:** Code-split routes via `React.lazy()`, lazy-loaded dashboard tabs (16 components), dynamic imports for heavy libs (html2canvas, jsPDF, ReactQuill), React Query with 5-min stale time, optimized Vite chunk splitting

---

## Contributing

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit changes: `git commit -m "feat: add my feature"`
3. Push: `git push origin feature/my-feature`
4. Open a Pull Request

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with care by <a href="https://jicama.tech">Jicama.Tech</a>
</p>
