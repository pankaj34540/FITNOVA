import { api, ApiError } from '../lib/api.ts';
import type { UserProfile, FitnessGoals } from '../lib/types.ts';
import { getState, setAuthView, notify, bootstrapSession } from '../state/store.ts';
import { escapeHtml, toast } from '../ui/components.ts';
import { googleGIcon } from '../ui/icons.ts';

const HERO_IMG = '/src/assets/images/hero_athlete_training_1795116821241.jpg';
let googleListenerRegistered = false;

function ensureGoogleMessageListener(): void {
  if (googleListenerRegistered) return;
  googleListenerRegistered = true;
  window.addEventListener('message', async (event: MessageEvent) => {
    const origin = event.origin || '';
    const isTrustedOrigin =
      origin === window.location.origin ||
      origin.endsWith('.run.app') ||
      origin.includes('localhost');
    if (!isTrustedOrigin) return;

    if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'google') {
      document.getElementById('google-setup-modal')?.remove();
      await bootstrapSession();
      toast(
        event.data?.isNewUser
          ? 'Account created with Google! Complete your fitness profile.'
          : 'Signed in with Google.',
        'success'
      );
    } else if (event.data?.type === 'OAUTH_AUTH_ERROR' && event.data?.provider === 'google') {
      toast(String(event.data?.error || 'Google authentication cancelled.'), 'error');
    }
  });
}

export function renderAuthScreen(root: HTMLElement): void {
  ensureGoogleMessageListener();
  const s = getState();
  const view = s.user && !s.user.onboarding_completed ? 'onboarding' : s.authView;

  if (view === 'onboarding' && s.user) {
    renderOnboarding(root, s.user);
    return;
  }

  if (view === 'login') {
    root.innerHTML = renderAuthFrame(
      'Sign in to FITNOVA',
      'Access your workouts, verified GPS runs, and 30-day challenge progress.',
      `
      <form id="login-form" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-[#9AA69B] mb-1.5" for="login-email">Email address</label>
          <input id="login-email" type="email" required placeholder="arjun@example.com" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[#9AA69B] mb-1.5" for="login-password">Password</label>
          <input id="login-password" type="password" required placeholder="Enter password" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
        </div>
        <button type="submit" id="login-submit" class="fn-btn-primary w-full rounded-xl py-3 text-sm min-h-[48px]">Sign In</button>
      </form>
      <div class="my-5 flex items-center gap-3">
        <div class="h-px flex-1 bg-white/10"></div>
        <span class="text-xs text-[#9AA69B]">or</span>
        <div class="h-px flex-1 bg-white/10"></div>
      </div>
      <button type="button" id="google-signin-btn" class="fn-btn-secondary w-full rounded-xl py-3 px-4 text-sm min-h-[48px] flex items-center justify-center gap-2.5">
        ${googleGIcon('w-4 h-4')}
        <span>Continue with Google</span>
      </button>
      <div class="mt-6 flex items-center justify-between text-xs text-[#9AA69B]">
        <button type="button" id="go-forgot" class="hover:text-white underline-offset-4 hover:underline min-h-[40px]">Forgot password?</button>
        <button type="button" id="go-signup" class="text-[#B6FF48] font-medium hover:underline min-h-[40px]">Create account</button>
      </div>
      `
    );

    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('login-email') as HTMLInputElement).value;
      const password = (document.getElementById('login-password') as HTMLInputElement).value;
      const btn = document.getElementById('login-submit') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Signing in...';
      try {
        await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
        await bootstrapSession();
        toast('Welcome back to FITNOVA.', 'success');
      } catch (err) {
        toast((err as ApiError).message, 'error');
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });

    wireGoogleSignIn('google-signin-btn', 'login');
    document.getElementById('go-forgot')?.addEventListener('click', () => setAuthView('forgot'));
    document.getElementById('go-signup')?.addEventListener('click', () => setAuthView('signup'));
    document.getElementById('auth-back-welcome')?.addEventListener('click', () => setAuthView('welcome'));
    return;
  }

  if (view === 'signup') {
    root.innerHTML = renderAuthFrame(
      'Create your FITNOVA account',
      'Start tracking workouts, verified outdoor runs, and daily Indian nutrition.',
      `
      <form id="signup-form" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-[#9AA69B] mb-1.5" for="su-name">Full name</label>
          <input id="su-name" type="text" required placeholder="Priya Sharma" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[#9AA69B] mb-1.5" for="su-email">Email address</label>
          <input id="su-email" type="email" required placeholder="priya@example.com" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
        </div>
        <div>
          <label class="block text-xs font-medium text-[#9AA69B] mb-1.5" for="su-pass">Password (min 6 characters)</label>
          <input id="su-pass" type="password" required minlength="6" placeholder="Create strong password" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
        </div>
        <label class="flex items-start gap-2.5 text-xs text-[#9AA69B] cursor-pointer">
          <input id="su-consent" type="checkbox" required class="mt-0.5 accent-[#B6FF48]" />
          <span>I accept the FITNOVA Terms, Privacy Policy, and understand fitness/nutrition metrics are informational estimates, not medical advice.</span>
        </label>
        <button type="submit" id="signup-submit" class="fn-btn-primary w-full rounded-xl py-3 text-sm min-h-[48px]">Create Account</button>
      </form>
      <div class="my-5 flex items-center gap-3">
        <div class="h-px flex-1 bg-white/10"></div>
        <span class="text-xs text-[#9AA69B]">or</span>
        <div class="h-px flex-1 bg-white/10"></div>
      </div>
      <button type="button" id="google-signin-btn" class="fn-btn-secondary w-full rounded-xl py-3 px-4 text-sm min-h-[48px] flex items-center justify-center gap-2.5">
        ${googleGIcon('w-4 h-4')}
        <span>Continue with Google</span>
      </button>
      <div id="verify-box" class="hidden mt-5 pt-5 border-t border-white/10 space-y-3">
        <p class="text-xs text-[#B6FF48]" id="verify-hint"></p>
        <div class="flex gap-2">
          <input id="verify-code" type="text" placeholder="6-digit code" class="fn-input flex-1 rounded-xl px-3 py-2.5 text-sm font-mono-num min-h-[44px]" />
          <button type="button" id="verify-btn" class="fn-btn-primary px-4 rounded-xl text-sm min-h-[44px]">Verify</button>
        </div>
      </div>
      <div class="mt-5 flex items-center justify-center text-xs text-[#9AA69B]">
        <button type="button" id="go-login" class="text-[#B6FF48] font-medium hover:underline min-h-[40px]">Already registered? Sign in</button>
      </div>
      `
    );

    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const full_name = (document.getElementById('su-name') as HTMLInputElement).value;
      const email = (document.getElementById('su-email') as HTMLInputElement).value;
      const password = (document.getElementById('su-pass') as HTMLInputElement).value;
      const btn = document.getElementById('signup-submit') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = 'Creating account...';
      try {
        const res = await api<{ user: UserProfile; verificationCodeHint: string }>('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({ full_name, email, password }),
        });
        toast(`Verification code issued: ${res.verificationCodeHint}`, 'success');
        const box = document.getElementById('verify-box')!;
        box.classList.remove('hidden');
        document.getElementById('verify-hint')!.textContent = `Enter verification code (${res.verificationCodeHint}) to confirm your email and continue to onboarding.`;
        btn.textContent = 'Account Created';

        document.getElementById('verify-btn')?.addEventListener('click', async () => {
          const code = (document.getElementById('verify-code') as HTMLInputElement).value;
          try {
            await api('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ code }) });
            await bootstrapSession();
            toast('Email verified! Complete your fitness profile.', 'success');
          } catch (err) {
            toast((err as ApiError).message, 'error');
          }
        });
      } catch (err) {
        toast((err as ApiError).message, 'error');
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });

    wireGoogleSignIn('google-signin-btn', 'signup');
    document.getElementById('go-login')?.addEventListener('click', () => setAuthView('login'));
    document.getElementById('auth-back-welcome')?.addEventListener('click', () => setAuthView('welcome'));
    return;
  }

  if (view === 'forgot') {
    root.innerHTML = renderAuthFrame(
      'Reset password',
      'Request a 6-digit recovery code to set a new FITNOVA password.',
      `
      <form id="forgot-form" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-[#9AA69B] mb-1.5" for="fp-email">Account email</label>
          <input id="fp-email" type="email" required placeholder="arjun@example.com" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
        </div>
        <button type="submit" class="fn-btn-primary w-full rounded-xl py-3 text-sm min-h-[48px]">Send Recovery Code</button>
      </form>
      <form id="reset-form" class="hidden space-y-4 mt-5 pt-5 border-t border-white/10">
        <p class="text-xs text-[#B6FF48]" id="fp-hint"></p>
        <input id="fp-code" type="text" required placeholder="6-digit recovery code" class="fn-input w-full rounded-xl px-4 py-3 text-sm font-mono-num min-h-[44px]" />
        <input id="fp-newpass" type="password" required minlength="6" placeholder="New password (min 6 chars)" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
        <button type="submit" class="fn-btn-primary w-full rounded-xl py-3 text-sm min-h-[48px]">Update Password</button>
      </form>
      <div class="mt-5 text-center">
        <button type="button" id="go-login" class="text-xs text-[#9AA69B] hover:text-white underline min-h-[40px]">Back to Sign In</button>
      </div>
      `
    );

    let resetEmail = '';
    document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      resetEmail = (document.getElementById('fp-email') as HTMLInputElement).value;
      try {
        const res = await api<{ message: string; resetCodeHint?: string }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: resetEmail }),
        });
        document.getElementById('reset-form')?.classList.remove('hidden');
        document.getElementById('fp-hint')!.textContent = res.resetCodeHint
          ? `Recovery code: ${res.resetCodeHint}`
          : res.message;
      } catch (err) {
        toast((err as ApiError).message, 'error');
      }
    });

    document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = (document.getElementById('fp-code') as HTMLInputElement).value;
      const newPassword = (document.getElementById('fp-newpass') as HTMLInputElement).value;
      try {
        await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ email: resetEmail, code, newPassword }) });
        toast('Password updated. Sign in with your new password.', 'success');
        setAuthView('login');
      } catch (err) {
        toast((err as ApiError).message, 'error');
      }
    });

    document.getElementById('go-login')?.addEventListener('click', () => setAuthView('login'));
    document.getElementById('auth-back-welcome')?.addEventListener('click', () => setAuthView('welcome'));
    return;
  }

  // Welcome / First Page (High-impact athletic editorial layout)
  const APP_ICON_URL = '/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png';
  const BARBELL_IMG = '/src/assets/images/workout_strength_barbell_1795116820325.jpg';
  const TSHIRT_IMG = '/src/assets/images/challenge_tshirt_reward_1795116820835.jpg';
  const SHOES_IMG = '/src/assets/images/gear_running_shoes_1795116820962.jpg';

  root.innerHTML = `
    <div class="min-h-dvh bg-[#101411] text-white flex flex-col">
      <!-- 3-Zone Top Bar Contract -->
      <header class="sticky top-0 z-30 bg-[#101411]/90 backdrop-blur-md border-b border-white/10">
        <div class="w-full max-w-7xl mx-auto px-4 sm:px-8 h-14 sm:h-16 flex items-center justify-between gap-4 md:gap-8">
          <a href="#top" class="flex items-center gap-2.5 font-display text-2xl font-bold tracking-wide text-white whitespace-nowrap shrink-0">
            <img src="${APP_ICON_URL}" alt="FITNOVA App Icon" class="w-8 h-8 rounded-lg object-cover bg-black border border-white/15 shrink-0" />
            <span>FITNOVA</span>
          </a>

          <nav class="hidden md:flex items-center gap-7 text-sm font-medium text-[#9AA69B]" aria-label="Landing sections">
            <a href="#programs" class="hover:text-white transition-colors whitespace-nowrap shrink-0">Training System</a>
            <a href="#challenge" class="hover:text-white transition-colors whitespace-nowrap shrink-0">30-Day Challenge</a>
            <a href="#nutrition" class="hover:text-white transition-colors whitespace-nowrap shrink-0">Quick Calculator</a>
            <a href="#admin" id="welcome-admin-link" class="hover:text-white transition-colors whitespace-nowrap shrink-0">Admin Console</a>
          </nav>

          <div class="shrink-0">
            <button type="button" id="welcome-login-btn" class="fn-btn-primary px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[44px]">Sign In</button>
          </div>
        </div>
      </header>

      <main id="top" class="flex-1 w-full">
        <!-- Hero Split + Anchored 4-Column Metric Strip -->
        <section class="max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-8 sm:pt-8 sm:pb-10 lg:pt-12 lg:pb-14">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
            <div class="lg:col-span-6 flex flex-col justify-between py-1 sm:py-2">
              <div>
                <p class="text-[11px] sm:text-xs font-mono-num text-[#B6FF48] tracking-wider">TRAIN SMART · TRACK SMART · STAY STRONG</p>
                <h1 class="font-display font-bold uppercase text-white mt-2.5 leading-[0.96] tracking-tight" style="font-size: clamp(2.5rem, 5.2vw, 4.75rem);">
                  Built for disciplined Indian athletes.
                </h1>
                <p class="mt-4 sm:mt-5 text-sm sm:text-base text-[#9AA69B] leading-relaxed max-w-xl">
                  One connected dark-mode training platform combining 12-category strength programs, GPS-verified outdoor runs, an Indian macro database, and the ₹399 30-Day Challenge with conditional cashback and finisher gear.
                </p>

                <div class="mt-6 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                  <button type="button" id="welcome-start-btn" class="fn-btn-primary w-full sm:w-auto px-7 py-3.5 rounded-xl text-sm min-h-[48px] whitespace-nowrap">Create Free Account</button>
                  <button type="button" id="welcome-google-btn" class="fn-btn-secondary w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm min-h-[48px] whitespace-nowrap flex items-center justify-center gap-2.5">
                    ${googleGIcon('w-4 h-4')}
                    <span>Continue with Google</span>
                  </button>
                </div>

                <!-- Mobile Quick Section Links -->
                <div class="mt-5 flex md:hidden items-center gap-4 overflow-x-auto no-scrollbar text-xs font-medium text-[#9AA69B] pb-1">
                  <a href="#programs" class="whitespace-nowrap shrink-0 hover:text-white">Training System</a>
                  <span aria-hidden="true">·</span>
                  <a href="#challenge" class="whitespace-nowrap shrink-0 hover:text-white">30-Day Challenge</a>
                  <span aria-hidden="true">·</span>
                  <a href="#nutrition" class="whitespace-nowrap shrink-0 hover:text-white">Calculator</a>
                </div>
              </div>

              <div class="mt-6 sm:mt-10 pt-5 border-t border-white/10">
                <p class="text-xs text-[#9AA69B] leading-relaxed">
                  India-first architecture · Razorpay UPI verification · Android Health Connect & Foreground GPS ready
                </p>
              </div>
            </div>

            <div class="lg:col-span-6 relative rounded-3xl overflow-hidden border border-white/10 h-[300px] sm:h-[380px] lg:h-auto lg:min-h-[500px]">
              <img src="${HERO_IMG}" alt="FITNOVA athlete sprinting at dusk" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
              <div class="absolute inset-0 bg-gradient-to-t from-[#101411] via-[#101411]/40 to-transparent"></div>
              <div class="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 items-end">
                <div>
                  <p class="text-[11px] sm:text-xs font-mono-num text-[#B6FF48]">FLAGSHIP TRACK · 30 DAYS</p>
                  <p class="font-display text-xl sm:text-3xl font-bold text-white leading-tight mt-0.5">
                    Verified GPS & Daily Workout Accountability
                  </p>
                </div>
                <div class="hidden sm:block bg-[#1A211C]/90 backdrop-blur-md border border-white/15 rounded-2xl p-3.5 text-xs">
                  <div class="flex justify-between font-mono-num text-[#9AA69B]">
                    <span>Entry / Refund</span>
                    <span class="text-[#B6FF48]">₹399 / ₹299</span>
                  </div>
                  <div class="flex justify-between font-mono-num text-white mt-1.5">
                    <span>Recovery Days</span>
                    <span>4 Built-in</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Full-Width 4-Column KPI Benchmark Strip -->
          <div class="mt-6 sm:mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div class="fn-surface rounded-2xl p-4 sm:p-5">
              <p class="font-mono-num text-2xl sm:text-3xl font-bold text-white">12</p>
              <p class="text-[11px] sm:text-xs text-[#9AA69B] mt-1">Training Categories · Chest to Yoga</p>
            </div>
            <div class="fn-surface rounded-2xl p-4 sm:p-5">
              <p class="font-mono-num text-2xl sm:text-3xl font-bold text-[#B6FF48]">7–90d</p>
              <p class="text-[11px] sm:text-xs text-[#9AA69B] mt-1">Structured Beginner to Pro Plans</p>
            </div>
            <div class="fn-surface rounded-2xl p-4 sm:p-5">
              <p class="font-mono-num text-2xl sm:text-3xl font-bold text-white">&lt;50m</p>
              <p class="text-[11px] sm:text-xs text-[#9AA69B] mt-1">GPS Accuracy Filter · Jump Guard</p>
            </div>
            <div class="fn-surface rounded-2xl p-4 sm:p-5">
              <p class="font-mono-num text-2xl sm:text-3xl font-bold text-[#B6FF48]">₹299</p>
              <p class="text-[11px] sm:text-xs text-[#9AA69B] mt-1">Conditional Refund + Dri-Fit Tee</p>
            </div>
          </div>
        </section>

        <!-- Section 2: Asymmetric Bento System Showcase -->
        <section id="programs" class="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-12 border-t border-white/10">
          <div class="flex flex-wrap items-end justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <p class="text-xs font-mono-num text-[#B6FF48]">CORE ARCHITECTURE</p>
              <h2 class="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-1">Four integrated training pillars</h2>
            </div>
            <p class="text-sm text-[#9AA69B] max-w-md">Every module writes to a unified athlete record so workouts, runs, meals, and challenge logs stay synchronized.</p>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
            <!-- Pillar 01: Wide Card -->
            <article class="lg:col-span-7 fn-surface rounded-3xl overflow-hidden grid grid-cols-1 sm:grid-cols-12 items-stretch">
              <div class="sm:col-span-5 h-48 sm:h-auto sm:min-h-[220px]">
                <img src="${BARBELL_IMG}" alt="FITNOVA strength studio equipment" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
              </div>
              <div class="sm:col-span-7 p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <p class="text-xs font-mono-num text-[#B6FF48]">01. WORKOUT ENGINE</p>
                  <h3 class="text-lg sm:text-xl font-bold text-white mt-2">Guided 7, 30, 60 & 90-Day Programs</h3>
                  <p class="text-sm text-[#9AA69B] mt-2 leading-relaxed">
                    Searchable library across 12 muscle & conditioning groups with set tracking, live rest countdown timers, and zero ads during active sessions.
                  </p>
                </div>
                <div class="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono-num text-[#9AA69B]">
                  <span>Beginner · Intermediate · Advanced</span>
                  <button type="button" data-open-signup class="text-[#B6FF48] hover:underline shrink-0 ml-2">Explore →</button>
                </div>
              </div>
            </article>

            <!-- Pillar 02: GPS Running -->
            <article class="lg:col-span-5 fn-surface-alt rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <p class="text-xs font-mono-num text-[#B6FF48]">02. ANTI-CHEAT GPS RUNNING</p>
                <h3 class="text-lg sm:text-xl font-bold text-white mt-2">Foreground Trajectory Validation</h3>
                <p class="text-sm text-[#9AA69B] mt-2 leading-relaxed">
                  Real-time Haversine distance, pace, and speed telemetry. Coordinates with accuracy worse than 50m or impossible sprint spikes (&gt;32 km/h) are filtered automatically.
                </p>
              </div>
              <div class="mt-5 bg-[#101411] border border-white/10 rounded-2xl p-4">
                <div class="flex justify-between text-xs font-mono-num text-[#9AA69B] mb-2">
                  <span>Offline Queue + Cloud Sync</span>
                  <span class="text-[#B6FF48]">Verified</span>
                </div>
                <svg viewBox="0 0 300 44" class="w-full h-10" aria-hidden="true">
                  <polyline fill="none" stroke="#B6FF48" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="8,34 45,28 82,31 120,18 164,22 208,10 250,15 292,7" />
                </svg>
              </div>
            </article>

            <!-- Pillar 03: Live Interactive Calculator Preview -->
            <article id="nutrition" class="lg:col-span-5 fn-surface rounded-3xl p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <p class="text-xs font-mono-num text-[#B6FF48]">03. INDIAN NUTRITION & 9 CALCULATORS</p>
                <h3 class="text-lg sm:text-xl font-bold text-white mt-2">Instant BMI & Calorie Estimator</h3>
                <p class="text-xs text-[#9AA69B] mt-1">Preview your baseline targets right here using Asian-Indian BMI cut-offs and Mifflin-St Jeor TDEE.</p>
                <div class="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] text-[#9AA69B] mb-1" for="lp-w">Weight (kg)</label>
                    <input id="lp-w" type="number" min="35" max="200" value="72" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-[#9AA69B] mb-1" for="lp-h">Height (cm)</label>
                    <input id="lp-h" type="number" min="120" max="220" value="174" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
                  </div>
                </div>
              </div>
              <div class="mt-4 fn-surface-alt rounded-2xl p-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p class="text-[11px] text-[#9AA69B]">BMI</p>
                  <p id="lp-bmi" class="font-mono-num text-lg font-bold text-white mt-0.5">23.8</p>
                </div>
                <div>
                  <p class="text-[11px] text-[#9AA69B]">Daily TDEE</p>
                  <p id="lp-tdee" class="font-mono-num text-lg font-bold text-[#B6FF48] mt-0.5">2540</p>
                </div>
                <div>
                  <p class="text-[11px] text-[#9AA69B]">Protein</p>
                  <p id="lp-prot" class="font-mono-num text-lg font-bold text-white mt-0.5">115g</p>
                </div>
              </div>
            </article>

            <!-- Pillar 04: FITNOVA Gear & Affiliate Store -->
            <article class="lg:col-span-7 fn-surface rounded-3xl overflow-hidden grid grid-cols-1 sm:grid-cols-12 items-stretch">
              <div class="sm:col-span-7 p-5 sm:p-6 flex flex-col justify-between order-2 sm:order-1">
                <div>
                  <p class="text-xs font-mono-num text-[#B6FF48]">04. FITNOVA STORE & AFFILIATE GEAR</p>
                  <h3 class="text-lg sm:text-xl font-bold text-white mt-2">Official Training Gear & Vetted Merchant Picks</h3>
                  <p class="text-sm text-[#9AA69B] mt-2 leading-relaxed">
                    Shop FITNOVA own-inventory equipment with UPI/Card or Cash on Delivery, plus curated running shoes, smartwatches, and dumbbells from trusted Indian merchants.
                  </p>
                </div>
                <div class="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono-num text-[#9AA69B]">
                  <span>INR Checkout · Coupons · Order Tracking</span>
                  <button type="button" data-open-signup class="text-[#B6FF48] hover:underline shrink-0 ml-2">Browse Store →</button>
                </div>
              </div>
              <div class="sm:col-span-5 h-48 sm:h-auto sm:min-h-[220px] order-1 sm:order-2">
                <img src="${SHOES_IMG}" alt="Performance marathon running shoes" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
              </div>
            </article>
          </div>
        </section>

        <!-- Section 3: 30-Day Fitness Challenge Spotlight -->
        <section id="challenge" class="max-w-7xl mx-auto px-4 sm:px-8 py-10 sm:py-12 border-t border-white/10">
          <div class="fn-surface rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div class="lg:col-span-5 h-56 sm:h-72 lg:h-auto lg:min-h-[320px]">
              <img src="${TSHIRT_IMG}" alt="FITNOVA 30-Day Challenge Finisher T-shirt" referrerpolicy="no-referrer" class="w-full h-full object-cover" />
            </div>
            <div class="lg:col-span-7 p-5 sm:p-10 flex flex-col justify-between space-y-6">
              <div>
                <p class="text-xs font-mono-num text-[#B6FF48]">MAIN USP · SKILL & CONSISTENCY INCENTIVE</p>
                <h2 class="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight mt-2">
                  The 30-Day FITNOVA Challenge
                </h2>
                <p class="text-sm text-[#9AA69B] mt-3 leading-relaxed">
                  Join Beginner (2.0 km/day), Intermediate (3.5 km/day), or Advanced (5.0 km/day) tracks for ₹399. Every 7th day is a built-in recovery day. Complete 24+ verified active days and 4 rest days to receive a FITNOVA Dri-Fit T-shirt and ₹299 conditional refund after server & admin audit.
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div class="fn-surface-alt rounded-2xl p-4">
                  <p class="font-mono-num text-[#B6FF48] font-bold">STEP 01</p>
                  <p class="text-white font-semibold mt-1">Razorpay Verification</p>
                  <p class="text-[#9AA69B] mt-1">Membership activates only on trusted server HMAC webhook.</p>
                </div>
                <div class="fn-surface-alt rounded-2xl p-4">
                  <p class="font-mono-num text-[#B6FF48] font-bold">STEP 02</p>
                  <p class="text-white font-semibold mt-1">Daily GPS & Workout</p>
                  <p class="text-[#9AA69B] mt-1">Submit real GPS tracks and timer-logged workouts.</p>
                </div>
                <div class="fn-surface-alt rounded-2xl p-4">
                  <p class="font-mono-num text-[#B6FF48] font-bold">STEP 03</p>
                  <p class="text-white font-semibold mt-1">₹299 Refund + Tee</p>
                  <p class="text-[#9AA69B] mt-1">Zero gambling mechanics—100% transparent criteria.</p>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                <button type="button" data-open-signup class="fn-btn-primary w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm min-h-[48px]">Register & Join Challenge</button>
                <button type="button" id="welcome-existing-login" class="fn-btn-secondary w-full sm:w-auto px-5 py-3.5 rounded-xl text-sm min-h-[48px]">Existing Member Login</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <!-- Quiet Footer -->
      <footer class="border-t border-white/10 bg-[#101411]">
        <div class="max-w-7xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#9AA69B]">
          <div>
            <div class="flex items-center gap-2.5">
              <img src="${APP_ICON_URL}" alt="FITNOVA" class="w-7 h-7 rounded-lg object-cover bg-black border border-white/15 shrink-0" />
              <p class="font-display text-base font-bold text-white tracking-wide">FITNOVA</p>
            </div>
            <p class="mt-1.5">Train Smart. Track Smart. Stay Strong. · Built for India & Global Play Store Compliance</p>
          </div>
          <div class="flex flex-wrap items-center gap-5">
            <a href="#programs" class="hover:text-white min-h-[36px] flex items-center">Training</a>
            <a href="#challenge" class="hover:text-white min-h-[36px] flex items-center">30-Day Challenge</a>
            <button type="button" id="footer-admin-btn" class="hover:text-white min-h-[36px]">Admin Console</button>
            <span>support@fitnova.in</span>
          </div>
        </div>
      </footer>
    </div>
  `;

  // Interactive landing calculator preview
  const updateLandingCalc = () => {
    const wt = Math.max(30, Number((document.getElementById('lp-w') as HTMLInputElement)?.value) || 72);
    const ht = Math.max(110, Number((document.getElementById('lp-h') as HTMLInputElement)?.value) || 174);
    const bmi = wt / ((ht / 100) * (ht / 100));
    const bmr = 10 * wt + 6.25 * ht - 5 * 26 + 5;
    const tdee = Math.round(bmr * 1.55);
    const prot = Math.round(wt * 1.6);
    const bmiEl = document.getElementById('lp-bmi');
    const tdeeEl = document.getElementById('lp-tdee');
    const protEl = document.getElementById('lp-prot');
    if (bmiEl) bmiEl.textContent = bmi.toFixed(1);
    if (tdeeEl) tdeeEl.textContent = String(tdee);
    if (protEl) protEl.textContent = `${prot}g`;
  };
  document.getElementById('lp-w')?.addEventListener('input', updateLandingCalc);
  document.getElementById('lp-h')?.addEventListener('input', updateLandingCalc);

  document.getElementById('welcome-login-btn')?.addEventListener('click', () => setAuthView('login'));
  document.getElementById('welcome-existing-login')?.addEventListener('click', () => setAuthView('login'));
  document.getElementById('welcome-start-btn')?.addEventListener('click', () => setAuthView('signup'));
  root.querySelectorAll('[data-open-signup]').forEach((btn) => {
    btn.addEventListener('click', () => setAuthView('signup'));
  });
  const openAdmin = (e: Event) => {
    e.preventDefault();
    window.location.hash = '#admin';
    getState().subRoute = 'admin';
    notify();
  };
  document.getElementById('welcome-admin-link')?.addEventListener('click', openAdmin);
  document.getElementById('footer-admin-btn')?.addEventListener('click', openAdmin);
  wireGoogleSignIn('welcome-google-btn', 'login');
}

function renderAuthFrame(title: string, subtitle: string, bodyHtml: string): string {
  return `
    <div class="min-h-dvh bg-[#101411] flex flex-col justify-center items-center px-4 py-10">
      <div class="w-full max-w-md fn-surface rounded-3xl p-6 sm:p-8">
        <div class="flex items-center justify-between mb-6">
          <button type="button" id="auth-back-welcome" class="text-xs text-[#9AA69B] hover:text-white min-h-[40px] flex items-center gap-2">
            <span>←</span>
            <img src="/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png" alt="FITNOVA" class="w-6 h-6 rounded-md object-cover bg-black border border-white/15 shrink-0" />
            <span class="font-display text-sm font-bold tracking-wide text-white">FITNOVA</span>
          </button>
          <span class="text-xs font-mono-num text-[#B6FF48]">TRAIN SMART</span>
        </div>
        <h1 class="font-display text-2xl font-bold text-white">${escapeHtml(title)}</h1>
        <p class="text-sm text-[#9AA69B] mt-1.5 mb-6">${escapeHtml(subtitle)}</p>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function wireGoogleSignIn(buttonId: string, mode: 'login' | 'signup'): void {
  const btn = document.getElementById(buttonId) as HTMLButtonElement | null;
  if (!btn) return;
  btn.addEventListener('click', async () => {
    if (mode === 'signup') {
      const consent = document.getElementById('su-consent') as HTMLInputElement | null;
      if (consent && !consent.checked) {
        toast('Please accept the FITNOVA Terms above to continue with Google.', 'error');
        consent.focus();
        return;
      }
    }
    btn.disabled = true;
    try {
      const res = await fetch(`/api/auth/google/url?mode=${encodeURIComponent(mode)}`, { credentials: 'include' });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        redirectUri?: string;
        setupRequired?: boolean;
      };
      if (!res.ok || !data.url) {
        if (data.setupRequired && data.redirectUri) {
          showGoogleSetupModal(data.redirectUri, data.error || 'Google OAuth credentials are not configured yet.');
        } else {
          toast(data.error || 'Unable to start Google Sign-In.', 'error');
        }
        return;
      }
      const authWindow = window.open(data.url, 'fitnova_google_oauth', 'width=520,height=660');
      if (!authWindow) {
        toast('Please allow popups for this site to choose your Google account.', 'error');
      }
    } catch {
      toast('Network error while connecting to Google Sign-In.', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function showGoogleSetupModal(redirectUri: string, message: string): void {
  document.getElementById('google-setup-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'google-setup-modal';
  modal.className = 'fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="fn-surface rounded-3xl max-w-md w-full p-6 space-y-4">
      <div class="flex items-center gap-2.5">
        ${googleGIcon('w-5 h-5')}
        <h2 class="font-display text-xl font-bold text-white">Google OAuth Configuration Required</h2>
      </div>
      <p class="text-xs text-[#9AA69B] leading-relaxed">${escapeHtml(message)}</p>
      <div class="fn-surface-alt rounded-2xl p-3.5 space-y-2 text-xs">
        <p class="text-[#9AA69B]">1. Add this Authorized Redirect URI in Google Cloud Console:</p>
        <div class="flex items-center gap-2">
          <code id="g-cb-uri" class="flex-1 text-[11px] font-mono-num text-[#B6FF48] break-all bg-[#101411] px-2.5 py-2 rounded-lg border border-white/10">${escapeHtml(redirectUri)}</code>
          <button type="button" id="g-copy-uri" class="fn-btn-secondary px-3 py-2 rounded-lg text-xs min-h-[38px] shrink-0">Copy</button>
        </div>
        <p class="text-[#9AA69B] pt-1">2. Add <code class="text-white font-mono-num">GOOGLE_CLIENT_ID</code> and <code class="text-white font-mono-num">GOOGLE_CLIENT_SECRET</code> in your AI Studio Secrets panel on the left.</p>
      </div>
      <button type="button" id="g-setup-close" class="fn-btn-primary w-full rounded-xl py-3 text-sm min-h-[44px]">Close</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#g-setup-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#g-copy-uri')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      toast('Redirect URI copied.', 'success');
    } catch {
      toast('Copy failed—select and copy manually.', 'info');
    }
  });
}

function renderOnboarding(root: HTMLElement, user: UserProfile): void {
  const equipmentOptions = ['Bodyweight Only', 'Dumbbells', 'Resistance Bands', 'Pull-up Bar', 'Yoga Mat', 'Full Gym'];
  root.innerHTML = `
    <div class="min-h-dvh bg-[#101411] py-8 px-4">
      <div class="max-w-2xl mx-auto fn-surface rounded-3xl p-6 sm:p-8">
        <p class="text-xs font-mono-num text-[#B6FF48]">PERSONALIZATION SETUP</p>
        <h1 class="font-display text-2xl sm:text-3xl font-bold mt-1">Build your FITNOVA training profile</h1>
        <p class="text-sm text-[#9AA69B] mt-1">These metrics tailor your daily calorie target, workout intensity, and challenge recommendations.</p>

        <form id="onboarding-form" class="mt-6 space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-name">Full Name</label>
              <input id="ob-name" type="text" required value="${escapeHtml(user.full_name)}" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-age">Age (Years)</label>
              <input id="ob-age" type="number" min="13" max="100" required value="${user.age || 25}" class="fn-input w-full rounded-xl px-4 py-3 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-gender">Gender (Optional)</label>
              <select id="ob-gender" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]">
                <option value="prefer_not_to_say">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-height">Height (cm)</label>
              <input id="ob-height" type="number" min="100" max="240" required value="${user.height_cm || 172}" class="fn-input w-full rounded-xl px-4 py-3 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-weight">Current Weight (kg)</label>
              <input id="ob-weight" type="number" step="0.1" min="30" max="250" required value="${user.weight_kg || 70}" class="fn-input w-full rounded-xl px-4 py-3 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-target-weight">Target Weight (kg)</label>
              <input id="ob-target-weight" type="number" step="0.1" min="30" max="250" value="${user.weight_kg || 68}" class="fn-input w-full rounded-xl px-4 py-3 text-sm font-mono-num min-h-[44px]" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-goal">Primary Fitness Goal</label>
              <select id="ob-goal" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]">
                <option value="weight_loss">Weight loss</option>
                <option value="muscle_gain">Muscle gain</option>
                <option value="weight_gain">Weight gain</option>
                <option value="abs_building">Abs building</option>
                <option value="general_fitness" selected>General fitness</option>
                <option value="endurance_improvement">Endurance improvement</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-level">Fitness Level</label>
              <select id="ob-level" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-pref">Workout Preference</label>
              <select id="ob-pref" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]">
                <option value="home">Home workouts</option>
                <option value="gym">Gym workouts</option>
                <option value="outdoor">Outdoor running & bodyweight</option>
                <option value="mixed" selected>Mixed</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1.5" for="ob-activity">Daily Activity Level</label>
              <select id="ob-activity" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]">
                <option value="sedentary">Sedentary (Desk job)</option>
                <option value="light">Lightly active (1–2 days/wk)</option>
                <option value="moderate" selected>Moderately active (3–5 days/wk)</option>
                <option value="active">Very active (6–7 days/wk)</option>
              </select>
            </div>
          </div>

          <div>
            <p class="text-xs text-[#9AA69B] mb-2">Available Equipment</p>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
              ${equipmentOptions
                .map(
                  (eq) => `
                  <label class="fn-surface-alt rounded-xl px-3 py-2.5 flex items-center gap-2 text-xs cursor-pointer min-h-[44px]">
                    <input type="checkbox" name="ob-equip" value="${escapeHtml(eq)}" class="accent-[#B6FF48]" ${eq === 'Bodyweight Only' ? 'checked' : ''} />
                    <span>${escapeHtml(eq)}</span>
                  </label>
                `
                )
                .join('')}
            </div>
          </div>

          <button type="submit" id="ob-submit" class="fn-btn-primary w-full rounded-xl py-3.5 text-sm min-h-[48px]">Save Profile & Enter FITNOVA</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('onboarding-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('ob-submit') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Saving...';
    const equip = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="ob-equip"]:checked')).map((el) => el.value);
    try {
      const res = await api<{ user: UserProfile; goals: FitnessGoals }>('/api/profile/onboarding', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: (document.getElementById('ob-name') as HTMLInputElement).value,
          age: Number((document.getElementById('ob-age') as HTMLInputElement).value),
          gender: (document.getElementById('ob-gender') as HTMLSelectElement).value,
          height_cm: Number((document.getElementById('ob-height') as HTMLInputElement).value),
          weight_kg: Number((document.getElementById('ob-weight') as HTMLInputElement).value),
          target_weight_kg: Number((document.getElementById('ob-target-weight') as HTMLInputElement).value),
          fitness_goal: (document.getElementById('ob-goal') as HTMLSelectElement).value,
          fitness_level: (document.getElementById('ob-level') as HTMLSelectElement).value,
          workout_preference: (document.getElementById('ob-pref') as HTMLSelectElement).value,
          activity_level: (document.getElementById('ob-activity') as HTMLSelectElement).value,
          available_equipment: equip,
        }),
      });
      getState().user = res.user;
      getState().goals = res.goals;
      toast('Profile personalized! Daily targets calculated.', 'success');
      notify();
    } catch (err) {
      toast((err as ApiError).message, 'error');
      btn.disabled = false;
      btn.textContent = 'Save Profile & Enter FITNOVA';
    }
  });
}
