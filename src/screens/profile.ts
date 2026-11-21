import { api, ApiError } from '../lib/api.ts';
import { bootstrapSession, getState, navigate, setAuthView, notify } from '../state/store.ts';
import { escapeHtml, toast } from '../ui/components.ts';

interface Measurement {
  id: string;
  weight_kg: number;
  body_fat_pct: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  photo_data_url: string | null;
  photo_visibility: 'private' | 'coach_only';
  recorded_on: string;
}

export async function renderProgressScreen(container: HTMLElement): Promise<void> {
  const data = await api<{ measurements: Measurement[]; achievements: Array<{ title: string; description: string; earned_at: string }> }>('/api/measurements');
  const user = getState().user!;

  const sorted = [...data.measurements].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  let photoBase64 = '';

  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="font-display text-2xl font-bold">Progress & Body Measurements</h1>
        <p class="text-sm text-[#9AA69B]">Track daily weight, body dimensions, earned achievements, and private progress photos.</p>
      </div>

      <!-- Weight Trend SVG Chart -->
      <section class="fn-surface rounded-2xl p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-display text-base font-semibold">Weight Trend (kg)</h2>
          <span class="font-mono-num text-xs text-[#B6FF48]">Current: ${user.weight_kg || '--'} kg</span>
        </div>
        ${renderWeightChartSvg(sorted)}
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form id="meas-form" class="lg:col-span-5 fn-surface rounded-2xl p-5 space-y-3 h-fit">
          <h2 class="font-display text-base font-semibold">Log New Measurement</h2>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Weight (kg)</label>
              <input id="m-weight" type="number" step="0.1" required value="${user.weight_kg || 70}" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Body Fat % (optional)</label>
              <input id="m-bf" type="number" step="0.1" placeholder="18.5" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Waist (cm)</label>
              <input id="m-waist" type="number" step="0.5" placeholder="82" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Chest / Arm (cm)</label>
              <div class="flex gap-1.5">
                <input id="m-chest" type="number" step="0.5" placeholder="96" class="fn-input w-1/2 rounded-xl px-2 py-2 text-sm font-mono-num min-h-[44px]" />
                <input id="m-arm" type="number" step="0.5" placeholder="34" class="fn-input w-1/2 rounded-xl px-2 py-2 text-sm font-mono-num min-h-[44px]" />
              </div>
            </div>
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Before / After Photo (Stored Privately)</label>
            <input id="m-photo" type="file" accept="image/*" class="text-xs text-[#9AA69B] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#202A22] file:text-white" />
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Photo Privacy Control</label>
            <select id="m-vis" class="fn-input w-full rounded-xl px-3 py-2 text-sm min-h-[44px]">
              <option value="private">Private (Visible only to me)</option>
              <option value="coach_only">Challenge Verifier Only</option>
            </select>
          </div>
          <button type="submit" class="fn-btn-primary w-full py-3 rounded-xl text-sm min-h-[44px]">Save Entry</button>
        </form>

        <div class="lg:col-span-7 space-y-4">
          <section class="fn-surface rounded-2xl p-5">
            <h2 class="font-display text-base font-semibold mb-3">Personal Achievements</h2>
            ${
              data.achievements.length === 0
                ? `<p class="text-xs text-[#9AA69B]">Complete your first workout or verified 1K GPS run to unlock achievements.</p>`
                : `<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">${data.achievements
                    .map(
                      (a) => `
                  <div class="fn-surface-alt rounded-xl p-3">
                    <p class="text-sm font-semibold text-[#B6FF48]">${escapeHtml(a.title)}</p>
                    <p class="text-xs text-[#9AA69B] mt-0.5">${escapeHtml(a.description)}</p>
                  </div>`
                    )
                    .join('')}</div>`
            }
          </section>

          <section class="fn-surface rounded-2xl divide-y divide-white/10">
            ${
              data.measurements.length === 0
                ? `<div class="p-5 text-sm text-[#9AA69B]">No measurements logged yet.</div>`
                : data.measurements
                    .map(
                      (m) => `
                  <div class="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p class="font-mono-num text-sm font-bold text-white">${m.weight_kg} kg ${m.body_fat_pct ? `· ${m.body_fat_pct}% BF` : ''}</p>
                      <p class="text-xs text-[#9AA69B] mt-0.5">${escapeHtml(m.recorded_on)} · Privacy: ${escapeHtml(m.photo_visibility)}</p>
                    </div>
                    ${m.photo_data_url ? `<img src="${m.photo_data_url}" alt="Progress" class="w-12 h-12 rounded-lg object-cover border border-white/10" />` : ''}
                  </div>`
                    )
                    .join('')
            }
          </section>
        </div>
      </div>
    </div>
  `;

  document.getElementById('m-photo')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      photoBase64 = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('meas-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/measurements', {
        method: 'POST',
        body: JSON.stringify({
          weight_kg: Number((document.getElementById('m-weight') as HTMLInputElement).value),
          body_fat_pct: (document.getElementById('m-bf') as HTMLInputElement).value || null,
          waist_cm: (document.getElementById('m-waist') as HTMLInputElement).value || null,
          chest_cm: (document.getElementById('m-chest') as HTMLInputElement).value || null,
          arm_cm: (document.getElementById('m-arm') as HTMLInputElement).value || null,
          photo_data_url: photoBase64 || null,
          photo_visibility: (document.getElementById('m-vis') as HTMLSelectElement).value,
        }),
      });
      await bootstrapSession();
      toast('Measurement logged.', 'success');
      renderProgressScreen(container);
    } catch (err) {
      toast((err as ApiError).message, 'error');
    }
  });
}

function renderWeightChartSvg(items: Measurement[]): string {
  if (items.length < 2) {
    return `<p class="text-xs text-[#9AA69B] py-4">Log at least 2 weight entries on different dates to render your trend curve.</p>`;
  }
  const weights = items.map((i) => i.weight_kg);
  const minW = Math.min(...weights) - 1;
  const maxW = Math.max(...weights) + 1;
  const span = Math.max(1, maxW - minW);
  const pts = items
    .map((m, idx) => {
      const x = 20 + (idx / (items.length - 1)) * 360;
      const y = 95 - ((m.weight_kg - minW) / span) * 75;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return `
    <svg viewBox="0 0 400 110" class="w-full h-32 bg-[#131814] rounded-xl border border-white/10">
      <polyline fill="none" stroke="#B6FF48" stroke-width="2.5" stroke-linecap="round" points="${pts}" />
    </svg>
  `;
}

export function renderProfileScreen(container: HTMLElement): void {
  const s = getState();
  const user = s.user!;
  const goals = s.goals;

  container.innerHTML = `
    <div class="space-y-6">
      <section class="fn-surface rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p class="text-xs font-mono-num text-[#B6FF48]">${escapeHtml(user.role.toUpperCase())} ACCOUNT · ${user.email_verified ? 'EMAIL VERIFIED' : 'UNVERIFIED'}</p>
          <h1 class="font-display text-2xl font-bold text-white mt-1">${escapeHtml(user.full_name || user.email)}</h1>
          <p class="text-sm text-[#9AA69B]">${escapeHtml(user.email)} · ${user.height_cm || '--'} cm · ${user.weight_kg || '--'} kg · ${escapeHtml(user.fitness_level)}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="button" id="p-edit-ob" class="fn-btn-secondary px-4 py-2.5 rounded-xl text-xs min-h-[44px]">Edit Onboarding</button>
          <button type="button" id="p-logout" class="fn-btn-secondary px-4 py-2.5 rounded-xl text-xs min-h-[44px]">Sign Out</button>
        </div>
      </section>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Daily Goal Calibration -->
        <form id="goal-update-form" class="fn-surface rounded-2xl p-5 space-y-3">
          <h2 class="font-display text-lg font-semibold">Daily Targets</h2>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Daily Calories (kcal)</label>
              <input id="g-cal" type="number" value="${goals?.daily_calorie_target || 2100}" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Daily Protein (g)</label>
              <input id="g-prot" type="number" value="${goals?.daily_protein_g || 110}" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Daily Water (ml)</label>
              <input id="g-water" type="number" value="${goals?.daily_water_ml || 3000}" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Weekly Run Goal (km)</label>
              <input id="g-run" type="number" value="${goals?.weekly_run_km_target || 15}" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
            </div>
          </div>
          <button type="submit" class="fn-btn-primary w-full py-2.5 rounded-xl text-xs min-h-[44px]">Update Fitness Targets</button>
        </form>

        <!-- Quick Links & Admin Portal -->
        <div class="fn-surface rounded-2xl p-5 space-y-3">
          <h2 class="font-display text-lg font-semibold">Tools, Support & Governance</h2>
          <div class="grid grid-cols-2 gap-2.5">
            <button type="button" id="p-progress" class="fn-btn-secondary py-2.5 px-3 rounded-xl text-xs text-left min-h-[44px]">Progress & Photos</button>
            <button type="button" id="p-challenge" class="fn-btn-secondary py-2.5 px-3 rounded-xl text-xs text-left min-h-[44px]">30-Day Challenge</button>
            <button type="button" id="p-legal" class="fn-btn-secondary py-2.5 px-3 rounded-xl text-xs text-left min-h-[44px]">Privacy, Terms & Safety</button>
            <button type="button" id="p-admin" class="fn-btn-secondary py-2.5 px-3 rounded-xl text-xs text-left min-h-[44px] text-[#B6FF48]">Admin Console →</button>
          </div>
          <div class="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-semibold text-white">Help & Support (India)</p>
              <p class="text-xs text-[#9AA69B]">support@fitnova.in · Response within 24h</p>
            </div>
            <button type="button" id="p-delete-acct" class="text-xs text-[#FF6262] border border-[#FF6262]/40 px-3 py-2 rounded-xl min-h-[40px]">Delete Account</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('p-edit-ob')?.addEventListener('click', () => {
    user.onboarding_completed = false;
    setAuthView('onboarding');
    notify();
  });

  document.getElementById('p-logout')?.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    await bootstrapSession();
    toast('Signed out securely.', 'info');
  });

  document.getElementById('goal-update-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await api<{ goals: typeof goals }>('/api/profile/goals', {
        method: 'PUT',
        body: JSON.stringify({
          daily_calorie_target: Number((document.getElementById('g-cal') as HTMLInputElement).value),
          daily_protein_g: Number((document.getElementById('g-prot') as HTMLInputElement).value),
          daily_water_ml: Number((document.getElementById('g-water') as HTMLInputElement).value),
          weekly_run_km_target: Number((document.getElementById('g-run') as HTMLInputElement).value),
        }),
      });
      getState().goals = res.goals;
      toast('Daily goals updated.', 'success');
    } catch (err) {
      toast((err as ApiError).message, 'error');
    }
  });

  document.getElementById('p-progress')?.addEventListener('click', () => navigate('home', 'progress'));
  document.getElementById('p-challenge')?.addEventListener('click', () => navigate('home', 'challenge'));
  document.getElementById('p-legal')?.addEventListener('click', () => navigate('profile', 'legal'));
  document.getElementById('p-admin')?.addEventListener('click', () => {
    window.location.hash = '#admin';
    navigate('profile', 'admin');
  });

  document.getElementById('p-delete-acct')?.addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="fn-surface rounded-3xl max-w-md w-full p-6 space-y-4">
        <h2 class="font-display text-xl font-bold text-[#FF6262]">Confirm Account Deletion</h2>
        <p class="text-sm text-[#9AA69B]">This permanently deletes your FITNOVA profile, workout sessions, GPS runs, measurements, and active sessions in compliance with Data Safety standards.</p>
        <div class="flex gap-3">
          <button type="button" id="del-cancel" class="fn-btn-secondary flex-1 py-2.5 rounded-xl text-sm min-h-[44px]">Cancel</button>
          <button type="button" id="del-confirm" class="bg-[#FF6262] text-[#101411] font-semibold flex-1 py-2.5 rounded-xl text-sm min-h-[44px]">Delete Forever</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#del-cancel')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#del-confirm')?.addEventListener('click', async () => {
      await api('/api/account', { method: 'DELETE' });
      modal.remove();
      await bootstrapSession();
      toast('Your account and personal data have been permanently deleted.', 'info');
    });
  });
}

export function renderLegalScreen(container: HTMLElement): void {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="font-display text-2xl font-bold">Privacy, Legal & Play Compliance</h1>
        <button type="button" id="leg-back" class="fn-btn-secondary px-4 py-2 rounded-xl text-xs min-h-[44px]">← Back to Profile</button>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <article class="fn-surface rounded-2xl p-5 space-y-2">
          <h2 class="font-display text-base font-semibold text-[#B6FF48]">Privacy Policy & DPDP Act (India)</h2>
          <p class="text-xs text-[#9AA69B] leading-relaxed">FITNOVA collects only data necessary for workout tracking, foreground GPS run verification, nutrition logging, and order fulfilment. You can permanently delete your account and all linked records at any time from Profile.</p>
        </article>
        <article class="fn-surface rounded-2xl p-5 space-y-2">
          <h2 class="font-display text-base font-semibold text-[#B6FF48]">Health Apps Declaration</h2>
          <p class="text-xs text-[#9AA69B] leading-relaxed">BMI, BMR, TDEE, calorie burn, and nutrition estimates are for general fitness and educational wellness purposes only and do not constitute medical diagnosis, treatment, or clinical advice.</p>
        </article>
        <article class="fn-surface rounded-2xl p-5 space-y-2">
          <h2 class="font-display text-base font-semibold text-[#B6FF48]">30-Day Challenge Terms</h2>
          <p class="text-xs text-[#9AA69B] leading-relaxed">Challenge participation (₹399) uses skill- and consistency-based verification. No lottery, luck, or gambling mechanics exist. Refunds (₹299) and T-shirts are issued after server GPS verification and final admin audit.</p>
        </article>
        <article class="fn-surface rounded-2xl p-5 space-y-2">
          <h2 class="font-display text-base font-semibold text-[#B6FF48]">E-Commerce & Affiliate Disclosures</h2>
          <p class="text-xs text-[#9AA69B] leading-relaxed">Own-brand FITNOVA products include a 7-day return window for unused items. External affiliate links redirect to third-party merchants (Amazon India, Flipkart, Myntra) whose own return policies apply.</p>
        </article>
      </div>
    </div>
  `;
  document.getElementById('leg-back')?.addEventListener('click', () => navigate('profile'));
}
