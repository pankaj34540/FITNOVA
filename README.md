# FITNOVA — Train Smart. Track Smart. Stay Strong.

An India-first, dark-mode fitness, GPS running, nutrition, paid 30-day challenge, affiliate marketplace, and e-commerce platform built with **Vanilla TypeScript (ES Modules)**, **Tailwind CSS v4**, **Express**, and **SQLite**, with production **Supabase (PostgreSQL + RLS + Edge Functions)** schemas and **Capacitor Android** packaging ready.

---

## 1. Design Direction & Brand System

- **Palette**:
  - Background: `#101411`
  - Primary Cards: `#1A211C`
  - Secondary Cards / Inputs: `#202A22`
  - Primary Accent (Neon Green): `#B6FF48`
  - Primary Text: `#FFFFFF`
  - Secondary Text: `#9AA69B`
  - Error: `#FF6262`
- **Typography**: `Barlow Condensed` (display), `Plus Jakarta Sans` (body), `JetBrains Mono` (metrics/telemetry).
- **Navigation**:
  - Mobile-first fixed 5-tab bottom bar: **Home**, **Workout**, **Running**, **Store**, **Profile**
  - Desktop/Tablet 3-zone top navigation bar with direct **30-Day Challenge** CTA
  - Dedicated Admin Console accessible via `#admin`
- **App Icon & PWA Manifest**:
  - Official Icon: `public/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png` (`1274x1234` PNG)
  - Web Manifest: `public/manifest.json` (linked in `index.html` with favicon & `apple-touch-icon`)

---

## 2. Architecture & Tech Stack

> **Important Constraint**: The frontend is intentionally written in **pure Vanilla TypeScript + HTML5 + Tailwind CSS v4** (no React/Vue/Angular/jQuery components in `src/screens/`). Keep all new UI screens modular in `src/screens/*.ts`.

- **Frontend**: HTML5, Tailwind CSS v4 (`@tailwindcss/vite`), Vanilla TypeScript ES Modules (`src/main.ts` is the active entry point referenced by `index.html`).
- **Backend Server (`server.ts`)**: Express (`PORT=3000`) serving both REST API routes (`/api/*`, `/auth/google/callback`) and Vite dev middlewares (`npm run dev`) or production static `dist/` (`NODE_ENV=production npm start`).
- **Local / Embedded Database (`server/db.ts`)**: Node built-in SQLite (`node:sqlite`, persisted at `./data/fitnova.db`) with 33 tables, PBKDF2 password hashing, HTTP-only session cookies (`SameSite=None; Secure` on HTTPS/iframe contexts), and automated seed catalog (`server/seed.ts`).
- **Production Cloud Backend (`supabase/`)**:
  - `supabase/migrations/001_fitnova_schema.sql`: 29 normalized PostgreSQL tables, indexes, atomic stock RPC (`decrement_product_stock`), and Row Level Security (RLS) policies.
  - `supabase/functions/verify-gps-run/`: Server-side GPS run validation Edge Function.
  - `supabase/functions/verify-payment-webhook/`: Razorpay payment webhook verification Edge Function.
- **Android Packaging (`capacitor.config.ts`)**: Configured with `appId: 'in.fitnova.app'`, `webDir: 'dist'`, Geolocation (`enableHighAccuracy: true`), and AdMob plugin hooks.

---

## 3. Quick Start (Local Development)

### Prerequisites
- Node.js `v22+` (uses native `node:sqlite`)
- npm or bun

### Setup & Run
```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your secrets (see Section 4)

# 3. Start full-stack server (Express API + SQLite + Vite on port 3000)
npm run dev
```

Open `http://localhost:3000`.

### Available Scripts
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `tsx server.ts` | Starts Express + Vite dev server on `http://localhost:3000` |
| `npm run start` | `tsx server.ts` | Runs server directly (serves `dist/` when `NODE_ENV=production`) |
| `npm run build` | `vite build` | Builds production frontend bundle into `dist/` |
| `npm run lint` | `tsc --noEmit` | Runs TypeScript type checking across frontend & server |
| `npm run clean` | `rm -rf dist server.js` | Cleans build artifacts |

---

## 4. Environment Variables (`.env`)

Copy `.env.example` to `.env` and populate values as needed:

```env
# Public app origin (used for OAuth redirect URI resolution)
APP_URL="http://localhost:3000"

# Session & Payment Secrets
FITNOVA_SESSION_SECRET="CHANGE_ME_32_CHAR_SECRET"
RAZORPAY_KEY_ID="rzp_test_placeholder"
RAZORPAY_KEY_SECRET="CHANGE_ME_RAZORPAY_SECRET"
RAZORPAY_WEBHOOK_SECRET="CHANGE_ME_WEBHOOK_SECRET"

# Optional Supabase Cloud Configuration
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

# Real Google OAuth 2.0 (Google Cloud Console -> Web Application Client)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Google AdMob Banner Unit ID (Android / Web)
VITE_ADMOB_BANNER_UNIT_ID=""

# Initial Admin Bootstrap Account
FITNOVA_ADMIN_EMAIL="admin@fitnova.in"
FITNOVA_ADMIN_PASSWORD="ChangeMe@Fitnova2026"
```

### Enabling Real Google Sign-In (`Continue with Google`)
1. Go to **Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application)**.
2. Add your Authorized Redirect URI(s):
   - Local: `http://localhost:3000/auth/google/callback`
   - Hosted / Preview: `https://<your-domain>/auth/google/callback`
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env` (or runtime environment variables) and restart the server.
4. When a user clicks **Continue with Google**, the app opens a popup to `accounts.google.com`, exchanges the authorization code server-side at `/auth/google/callback`, creates/logs in the profile in SQLite, sets the session cookie, and notifies the parent window via `postMessage` (`OAUTH_AUTH_SUCCESS`).

---

## 5. Project Structure

```text
├── index.html                      # Entry HTML, fonts, favicon, manifest link
├── manifest / public/
│   ├── manifest.json               # Web App / PWA manifest (#101411 theme)
│   └── assets/aistudio/            # Uploaded FITNOVA app icon PNG
├── server.ts                       # Express REST API, OAuth, payments, admin, Vite integration
├── server/
│   ├── db.ts                       # SQLite schema (33 tables) & PBKDF2/token crypto helpers
│   └── seed.ts                     # Exercises, workout plans, Indian foods, store & affiliate seed data
├── src/
│   ├── main.ts                     # Active app bootstrap, 5-tab shell, route dispatcher
│   ├── index.css                   # Tailwind v4 imports & FITNOVA custom dark-neon tokens
│   ├── lib/
│   │   ├── api.ts                  # Typed fetch wrapper + ApiError handling
│   │   ├── indianFoods.ts          # Indian nutrition food catalog (veg & non-veg)
│   │   ├── offlineRuns.ts          # IndexedDB/localStorage offline GPS run queue & sync
│   │   └── types.ts                # Shared TypeScript interfaces
│   ├── state/
│   │   └── store.ts                # Reactive client state & navigation store
│   ├── ui/
│   │   ├── components.ts           # Shared cards, badges, toasts, ad banner rules, modals
│   │   └── icons.ts                # Crisp SVG icon helper + multi-color Google G badge
│   └── screens/
│       ├── auth.ts                 # Welcome landing page, Email/Google Auth, Forgot Password, Onboarding
│       ├── home.ts                 # Personalized dashboard, daily rings, quick tools, minimal banner ad
│       ├── workout.ts              # 12-category exercise library, 7/30/60/90-day plans, workout/rest timers
│       ├── running.ts              # GPS run tracker, anti-cheat jump/accuracy checks, route & history
│       ├── challenge.ts            # ₹399 30-Day Challenge, rules, 30-day calendar, leaderboard, ₹299 reward flow
│       ├── nutrition.ts            # Meal planner, macro & water tracking, 9 fitness calculators
│       ├── store.ts                # Own FITNOVA Store (cart, wishlist, coupons, checkout, returns) + Affiliate Marketplace
│       ├── profile.ts              # Progress charts, body measurements, goals, legal terms, account deletion
│       └── admin.ts                # Full responsive Admin Dashboard (#admin)
├── supabase/
│   ├── migrations/001_fitnova_schema.sql
│   └── functions/
│       ├── verify-gps-run/
│       └── verify-payment-webhook/
├── capacitor.config.ts             # Capacitor Android configuration
└── ANDROID_SETUP.md                # Supabase + Capacitor + Play Store compliance guide
```

---

## 6. Key Implemented Features

1. **Authentication & Onboarding (`src/screens/auth.ts`, `server.ts`)**:
   - Email signup/login, email verification flow, forgot/reset password, real Google OAuth 2.0 popup sign-in, secure logout, and full in-app account deletion (`DELETE /api/account`).
   - Onboarding captures DOB/age, gender (optional), height, weight, fitness goal, fitness level, workout preference, available equipment, and activity level.
2. **Home Dashboard (`src/screens/home.ts`)**:
   - Welcome header, today's workout, daily steps/running distance, estimated calories, workout duration, 30-Day Challenge progress, daily goal ring/bars, quick calculators, recommended workouts, affiliate picks, and a clearly labeled minimal banner ad.
3. **Exercise & Workout System (`src/screens/workout.ts`)**:
   - Searchable 12-category library (Chest, Back, Shoulders, Biceps, Triceps, Legs, Abs, Full Body, Cardio, HIIT, Yoga, Stretching) with instructions, target muscles, equipment, sets/reps, rest timers, 7/30/60/90-day programs, and session history.
4. **GPS Running Tracker (`src/screens/running.ts`, `src/lib/offlineRuns.ts`)**:
   - Start/pause/resume run tracking, Haversine distance, pace/speed, route polyline preview, accuracy & unrealistic-jump filtering (`POST /api/runs` server verification), and offline run queueing with automatic sync when back online.
5. **30-Day Paid Fitness Challenge (`src/screens/challenge.ts`)**:
   - ₹399 entry fee checkout (Razorpay order + webhook verification, with dev sandbox fallback when Razorpay keys are placeholders).
   - Transparent rules, rest/recovery days, Day 1–30 calendar, daily check-in, verification status, leaderboard, ₹299 completion refund workflow, and FITNOVA finisher T-shirt dispatch tracking.
6. **Nutrition & 9 Fitness Calculators (`src/screens/nutrition.ts`)**:
   - Daily Calories, BMI, BMR, TDEE, Body Fat %, Ideal Weight, Protein, Water Intake, and 1RM calculators.
   - Indian food database (Vegetarian & Non-Vegetarian), Breakfast/Lunch/Dinner planner, macro & water tracking, with non-medical disclaimer.
7. **Progress Tracking (`src/screens/profile.ts`)**:
   - Weight & body measurement logs, weekly/monthly summaries, workout & run history, privacy-aware before/after notes, and goal completion %.
8. **Affiliate Marketplace & Own E-Commerce Store (`src/screens/store.ts`)**:
   - Separate Affiliate Marketplace with external merchant disclosure & click tracking (`/api/affiliate/click`).
   - Separate FITNOVA Store with search, category filters, wishlist, cart, shipping addresses, coupon codes, COD/online checkout, order tracking, and return/refund requests.
9. **Minimal Ad Placement Policy**:
   - Ads are shown **only** on allowed surfaces (Home Dashboard, Workout Library, Calculators) and suppressed during active runs, workouts, checkout, challenge tracking, and for `ad_free_member` accounts.
10. **Admin Panel (`#admin` / `src/screens/admin.ts`)**:
    - Protected by server-side `role = 'admin'` checks (`requireAdmin`).
    - Manage overview metrics, users, exercises, challenge daily verifications, refunds & T-shirt dispatches, affiliate products, store inventory/orders/coupons, AdMob settings, and audit logs.

---

## 7. Next Steps for Handoff / Production Launch

1. **Configure Production Secrets**: Set real `FITNOVA_SESSION_SECRET`, `FITNOVA_ADMIN_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and live `RAZORPAY_*` keys in your hosting environment.
2. **Switch to Supabase PostgreSQL (Recommended for Scale)**:
   - Run `supabase/migrations/001_fitnova_schema.sql` in your Supabase SQL Editor (`ap-south-1` Mumbai recommended).
   - Deploy `supabase/functions/verify-payment-webhook` and `supabase/functions/verify-gps-run`.
   - Migrate backend queries in `server.ts` from SQLite (`db.ts`) to `@supabase/supabase-js` service-role queries or direct Postgres client.
3. **Build & Package Android APK/AAB**: Follow `ANDROID_SETUP.md` step-by-step for Capacitor sync, foreground location permissions, Health Connect permissions, AdMob App ID, and adaptive icon generation from `public/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png`.
4. **Legal & Play Store Review**: Review the 30-Day Challenge terms, refund timelines, and health/nutrition disclaimers with legal counsel before public launch.
