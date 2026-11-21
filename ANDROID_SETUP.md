# FITNOVA Setup & Android Play Store Deployment Guide

## 1. Local & Full-Stack Web Run
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and configure your secrets (`FITNOVA_SESSION_SECRET`, `FITNOVA_ADMIN_PASSWORD`, Razorpay keys, and optional Supabase keys).
3. Start the full-stack server (Express + SQLite + Vite):
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000`.

## 2. Supabase Production Setup (PostgreSQL + Auth + RLS + Edge Functions)
1. Create a free Supabase project (Mumbai `ap-south-1` region for India-first low latency).
2. Open **SQL Editor** in Supabase and run `/supabase/migrations/001_fitnova_schema.sql`. This creates all 29 normalized tables, indexes, atomic stock RPC (`decrement_product_stock`), and Row Level Security (RLS) policies.
3. In **Authentication -> Providers**, enable **Email** (with email confirmation enabled) and **Google OAuth** (add your Google Cloud OAuth Client ID and redirect URL).
4. Set secrets and deploy Edge Functions:
   ```bash
   supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   supabase functions deploy verify-payment-webhook
   supabase functions deploy verify-gps-run
   ```
5. Point Razorpay Dashboard Webhooks to your `verify-payment-webhook` function URL for `payment.captured` events.

## 3. Android Packaging with Capacitor
1. Build the production web bundle:
   ```bash
   npm run build
   ```
2. Add Capacitor Android platform and official plugins:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/geolocation @capacitor-community/admob
   npx cap add android
   npx cap sync android
   ```
3. In `android/app/src/main/AndroidManifest.xml`, add required permissions:
   - `android.permission.INTERNET`
   - `android.permission.ACCESS_COARSE_LOCATION`
   - `android.permission.ACCESS_FINE_LOCATION`
   - `android.permission.FOREGROUND_SERVICE`
   - `android.permission.FOREGROUND_SERVICE_LOCATION`
   - `android.permission.health.READ_STEPS`, `android.permission.health.READ_DISTANCE`, `android.permission.health.READ_ACTIVE_CALORIES_BURNED` (for Android Health Connect)
4. Generate native Android adaptive launcher & splash icons from the official FITNOVA app icon (`public/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png`) using `@capacitor/assets`:
   - Copy `public/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png` to `assets/icon-only.png` (and `assets/icon-foreground.png`) with `#101411` background and run `npx @capacitor/assets generate --android`.
5. Configure Google AdMob App ID in `AndroidManifest.xml` (`com.google.android.gms.ads.APPLICATION_ID`). Only render banner units on Home Dashboard, Workout Library, Fitness Articles, and Calculator screens — never during active running, workouts, checkout, or challenge verification screens.

## 4. Google Play Store Compliance Checklist (India & Global)
- **Health Apps Declaration**: Declare activity tracking and nutrition logs; state clearly that calorie/macro calculations are informational estimates, not medical advice.
- **Data Safety Form**: Declare account email, fitness metrics, and foreground GPS coordinates collected only during user-initiated running sessions; support instant in-app account deletion (`Profile -> Delete Account`).
- **30-Day Paid Challenge Legal Review**: Ensure published Terms & Conditions clearly state that rewards (₹299 completion refund + branded T-shirt) are skill-and-consistency based conditional completion incentives verified against published workout/GPS thresholds — never luck, lottery, or gambling mechanics.
