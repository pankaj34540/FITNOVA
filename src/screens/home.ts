import { api } from '../lib/api.ts';
import type { AffiliateProduct, WorkoutPlan } from '../lib/types.ts';
import { getState, navigate } from '../state/store.ts';
import { escapeHtml, formatDuration, formatINR, renderAdBanner, renderImageWithFallback, toast } from '../ui/components.ts';
import { icon } from '../ui/icons.ts';

interface DashboardData {
  today: {
    workoutSeconds: number;
    workoutCount: number;
    runDistanceKm: number;
    runSeconds: number;
    activityCalories: number;
    waterMl: number;
    caloriesIntake: number;
  };
  activeChallenge: {
    challenge_title: string;
    completed_days: number;
    daily_run_km_target: number;
    daily_workout_minutes_target: number;
    refund_reward_inr: number;
  } | null;
  recommendedPlans: WorkoutPlan[];
  recommendedAffiliate: AffiliateProduct[];
}

export async function renderHomeScreen(container: HTMLElement): Promise<void> {
  const s = getState();
  const user = s.user!;
  const goals = s.goals;

  container.innerHTML = `
    <div class="space-y-6 animate-pulse">
      <div class="h-36 fn-surface rounded-2xl"></div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="h-28 fn-surface rounded-2xl"></div>
        <div class="h-28 fn-surface rounded-2xl"></div>
        <div class="h-28 fn-surface rounded-2xl"></div>
        <div class="h-28 fn-surface rounded-2xl"></div>
      </div>
    </div>
  `;

  let data: DashboardData;
  try {
    data = await api<DashboardData>('/api/dashboard');
  } catch {
    container.innerHTML = `<div class="fn-surface rounded-2xl p-6 text-sm text-[#FF6262]">Unable to load dashboard metrics. Please refresh.</div>`;
    return;
  }

  const firstName = escapeHtml((user.full_name || 'Athlete').split(' ')[0]);
  const calTarget = goals?.daily_calorie_target || 2100;
  const waterTarget = goals?.daily_water_ml || 3000;
  const calPct = Math.min(100, Math.round((data.today.caloriesIntake / calTarget) * 100));
  const waterPct = Math.min(100, Math.round((data.today.waterMl / waterTarget) * 100));
  const todayPlan = data.recommendedPlans[0];

  container.innerHTML = `
    <div class="space-y-8">
      <!-- Hero Welcome & Today's Primary Workout -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div class="lg:col-span-7 fn-surface rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <p class="text-xs font-mono-num text-[#B6FF48]">WELCOME BACK · ${(user.fitness_goal || 'general_fitness').replace(/_/g, ' ').toUpperCase()}</p>
            <h1 class="font-display text-2xl sm:text-3xl font-bold text-white mt-2">Ready to train, ${firstName}?</h1>
            <p class="text-sm text-[#9AA69B] mt-2 max-w-xl">
              ${todayPlan ? `Recommended today: <strong class="text-white">${escapeHtml(todayPlan.title)}</strong> (${todayPlan.estimated_minutes} min · ${todayPlan.difficulty}).` : 'Pick a workout plan or start a GPS outdoor run.'}
            </p>
          </div>
          <div class="mt-6 flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <button type="button" data-action="go-workout" class="fn-btn-primary w-full sm:w-auto justify-center px-5 py-3 rounded-xl text-sm min-h-[44px] flex items-center gap-2">
              ${icon('play', 'w-4 h-4')}
              <span>Start Today's Workout</span>
            </button>
            <button type="button" data-action="go-run" class="fn-btn-secondary w-full sm:w-auto justify-center px-5 py-3 rounded-xl text-sm min-h-[44px] flex items-center gap-2">
              ${icon('footprints', 'w-4 h-4')}
              <span>Track GPS Run</span>
            </button>
          </div>
        </div>

        <div class="lg:col-span-5 fn-surface-alt rounded-3xl p-6 flex flex-col justify-between">
          ${
            data.activeChallenge
              ? `
              <div>
                <p class="text-xs font-mono-num text-[#B6FF48]">30-DAY CHALLENGE ACTIVE</p>
                <h2 class="font-display text-xl font-semibold text-white mt-1">${escapeHtml(data.activeChallenge.challenge_title)}</h2>
                <p class="text-xs text-[#9AA69B] mt-2">Daily Target: ${data.activeChallenge.daily_run_km_target} km run · ${data.activeChallenge.daily_workout_minutes_target} min workout</p>
                <div class="mt-4">
                  <div class="flex justify-between text-xs font-mono-num mb-1.5">
                    <span class="text-[#9AA69B]">Verified Progress</span>
                    <span class="text-white">${data.activeChallenge.completed_days} / 30 days</span>
                  </div>
                  <div class="h-2 rounded-full bg-[#101411] overflow-hidden">
                    <div class="h-full bg-[#B6FF48]" style="width:${Math.round((data.activeChallenge.completed_days / 30) * 100)}%"></div>
                  </div>
                </div>
              </div>
              <button type="button" data-action="go-challenge" class="fn-btn-secondary mt-5 w-full py-2.5 rounded-xl text-xs min-h-[44px]">Open Challenge Calendar</button>
            `
              : `
              <div>
                <p class="text-xs font-mono-num text-[#B6FF48]">MAIN CHALLENGE · ₹399 ENTRY</p>
                <h2 class="font-display text-xl font-semibold text-white mt-1">30-Day Fitness Challenge</h2>
                <p class="text-sm text-[#9AA69B] mt-2">Complete 30 days with GPS-verified runs & workouts to earn a FITNOVA T-shirt and ₹299 conditional refund.</p>
              </div>
              <button type="button" data-action="go-challenge" class="fn-btn-primary mt-5 w-full py-3 rounded-xl text-sm min-h-[44px]">View Challenge Rules & Join</button>
            `
          }
        </div>
      </section>

      <!-- Today's Real Activity Metrics -->
      <section aria-label="Daily activity">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display text-lg font-semibold">Today's Activity</h2>
          <button type="button" data-action="go-progress" class="text-xs text-[#B6FF48] hover:underline min-h-[40px]">Progress Charts →</button>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="fn-surface rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Running Distance</p>
            <p class="font-mono-num text-2xl font-bold text-white mt-2">${data.today.runDistanceKm.toFixed(2)} <span class="text-sm font-normal text-[#9AA69B]">km</span></p>
          </div>
          <div class="fn-surface rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Workout Duration</p>
            <p class="font-mono-num text-2xl font-bold text-white mt-2">${formatDuration(data.today.workoutSeconds)}</p>
          </div>
          <div class="fn-surface rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Activity Calories</p>
            <p class="font-mono-num text-2xl font-bold text-[#B6FF48] mt-2">${data.today.activityCalories} <span class="text-sm font-normal text-[#9AA69B]">kcal</span></p>
          </div>
          <div class="fn-surface rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Workouts Logged</p>
            <p class="font-mono-num text-2xl font-bold text-white mt-2">${data.today.workoutCount}</p>
          </div>
        </div>
      </section>

      <!-- Daily Goals & Quick Access Modules -->
      <section class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div class="lg:col-span-5 fn-surface rounded-2xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-base font-semibold">Daily Fitness & Nutrition Goals</h2>
            <button type="button" data-action="go-nutrition" class="text-xs text-[#B6FF48] hover:underline">Log Meal</button>
          </div>
          <div>
            <div class="flex justify-between text-xs mb-1.5">
              <span class="text-[#9AA69B]">Calorie Intake</span>
              <span class="font-mono-num text-white">${data.today.caloriesIntake} / ${calTarget} kcal</span>
            </div>
            <div class="h-2 rounded-full bg-[#101411] overflow-hidden">
              <div class="h-full bg-[#B6FF48]" style="width:${calPct}%"></div>
            </div>
          </div>
          <div>
            <div class="flex justify-between text-xs mb-1.5">
              <span class="text-[#9AA69B]">Hydration</span>
              <span class="font-mono-num text-white">${data.today.waterMl} / ${waterTarget} ml</span>
            </div>
            <div class="h-2 rounded-full bg-[#101411] overflow-hidden">
              <div class="h-full bg-white" style="width:${waterPct}%"></div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button type="button" data-action="go-challenge" class="fn-surface rounded-2xl p-4 text-left hover:border-[#B6FF48]/40 transition-colors min-h-[100px] flex flex-col justify-between">
            <span class="text-[#B6FF48]">${icon('trophy', 'w-5 h-5')}</span>
            <div>
              <p class="text-sm font-semibold text-white">30-Day Challenge</p>
              <p class="text-xs text-[#9AA69B]">Calendar & Rewards</p>
            </div>
          </button>
          <button type="button" data-action="go-nutrition" class="fn-surface rounded-2xl p-4 text-left hover:border-[#B6FF48]/40 transition-colors min-h-[100px] flex flex-col justify-between">
            <span class="text-[#B6FF48]">${icon('utensils', 'w-5 h-5')}</span>
            <div>
              <p class="text-sm font-semibold text-white">Nutrition</p>
              <p class="text-xs text-[#9AA69B]">Indian Food DB</p>
            </div>
          </button>
          <button type="button" data-action="go-calculators" class="fn-surface rounded-2xl p-4 text-left hover:border-[#B6FF48]/40 transition-colors min-h-[100px] flex flex-col justify-between">
            <span class="text-[#B6FF48]">${icon('calculator', 'w-5 h-5')}</span>
            <div>
              <p class="text-sm font-semibold text-white">Calculators</p>
              <p class="text-xs text-[#9AA69B]">BMI, BMR, TDEE, 1RM</p>
            </div>
          </button>
          <button type="button" data-action="go-progress" class="fn-surface rounded-2xl p-4 text-left hover:border-[#B6FF48]/40 transition-colors min-h-[100px] flex flex-col justify-between">
            <span class="text-[#B6FF48]">${icon('flame', 'w-5 h-5')}</span>
            <div>
              <p class="text-sm font-semibold text-white">Progress</p>
              <p class="text-xs text-[#9AA69B]">Weight & Photos</p>
            </div>
          </button>
        </div>
      </section>

      <!-- Recommended Workouts -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display text-lg font-semibold">Recommended Programs</h2>
          <button type="button" data-action="go-workout" class="text-xs text-[#B6FF48] hover:underline min-h-[40px]">Browse All →</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          ${data.recommendedPlans
            .map(
              (p) => `
              <article class="fn-surface rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <p class="text-xs text-[#9AA69B]">${escapeHtml(p.difficulty)} · ${p.duration_days}-day · ${p.estimated_minutes} min</p>
                  <h3 class="font-display text-base font-semibold text-white mt-1.5">${escapeHtml(p.title)}</h3>
                  <p class="text-xs text-[#9AA69B] mt-2 line-clamp-2">${escapeHtml(p.description)}</p>
                </div>
                <button type="button" data-action="go-workout" class="fn-btn-secondary mt-4 w-full py-2.5 rounded-xl text-xs min-h-[44px]">Open Plan</button>
              </article>
            `
            )
            .join('')}
        </div>
      </section>

      <!-- Minimal Home Banner Ad -->
      ${renderAdBanner('home', s.adsConfig, user)}

      <!-- Recommended Affiliate Gear -->
      <section>
        <div class="flex items-center justify-between mb-3">
          <div>
            <h2 class="font-display text-lg font-semibold">Recommended Training Gear</h2>
            <p class="text-xs text-[#9AA69B]">Affiliate disclosure: external merchant purchases earn FITNOVA a small commission at no extra cost to you.</p>
          </div>
          <button type="button" data-action="go-affiliate" class="text-xs text-[#B6FF48] hover:underline shrink-0 min-h-[40px]">All Gear →</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          ${data.recommendedAffiliate
            .map(
              (item) => `
              <article class="fn-surface rounded-2xl overflow-hidden flex flex-col">
                ${renderImageWithFallback(item.image_url, item.title, 'w-full h-36')}
                <div class="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <p class="text-xs text-[#9AA69B]">${escapeHtml(item.category)} · ${escapeHtml(item.merchant_name)}</p>
                    <h3 class="text-sm font-semibold text-white mt-1 line-clamp-2">${escapeHtml(item.title)}</h3>
                    <p class="font-mono-num text-sm font-bold text-[#B6FF48] mt-2">${formatINR(item.displayed_price_inr)}</p>
                  </div>
                  <button type="button" data-aff-buy="${escapeHtml(item.id)}" class="fn-btn-secondary mt-3 w-full py-2 rounded-xl text-xs min-h-[40px]">Buy at ${escapeHtml(item.merchant_name)}</button>
                </div>
              </article>
            `
            )
            .join('')}
        </div>
      </section>
    </div>
  `;

  container.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.getAttribute('data-action');
      if (act === 'go-workout') navigate('workout');
      else if (act === 'go-run') navigate('running');
      else if (act === 'go-challenge') navigate('home', 'challenge');
      else if (act === 'go-nutrition') navigate('home', 'nutrition');
      else if (act === 'go-calculators') navigate('home', 'calculators');
      else if (act === 'go-progress') navigate('home', 'progress');
      else if (act === 'go-affiliate') navigate('store', 'affiliate');
    });
  });

  container.querySelectorAll('[data-nav-store]').forEach((btn) => {
    btn.addEventListener('click', () => navigate('store', 'affiliate'));
  });

  container.querySelectorAll('[data-aff-buy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-aff-buy')!;
      try {
        const res = await api<{ affiliate_url: string }>('/api/affiliate/click', {
          method: 'POST',
          body: JSON.stringify({ product_id: id, referrer_screen: 'home_dashboard' }),
        });
        toast(`Click logged. Merchant link: ${res.affiliate_url}`, 'success');
      } catch {
        toast('Unable to log affiliate redirect.', 'error');
      }
    });
  });
}
