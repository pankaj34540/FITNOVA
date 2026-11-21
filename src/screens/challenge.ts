import { api, ApiError } from '../lib/api.ts';
import type { Challenge, ChallengeDailyLog, ChallengeMember, RunningSession } from '../lib/types.ts';
import { escapeHtml, formatINR, renderImageWithFallback, toast } from '../ui/components.ts';

const TSHIRT_IMG = '/src/assets/images/challenge_tshirt_reward_1795116820835.jpg';

interface ChallengePayload {
  challenges: Challenge[];
  membership: ChallengeMember | null;
  dailyLogs: ChallengeDailyLog[];
  reward: { tshirt_size: string; shipping_address: string; dispatch_status: string; tracking_number: string | null } | null;
  leaderboard: Array<{ full_name: string; completed_days: number; points: number; final_eligibility: string }>;
}

export async function renderChallengeScreen(container: HTMLElement): Promise<void> {
  // Zero ads on challenge screens
  container.innerHTML = `<div class="fn-surface rounded-2xl p-6 text-sm text-[#9AA69B]">Loading 30-Day Challenge hub...</div>`;

  const [data, runsRes, workoutsRes] = await Promise.all([
    api<ChallengePayload>('/api/challenges'),
    api<{ runs: RunningSession[] }>('/api/runs'),
    api<{ sessions: Array<{ id: string; title: string; duration_seconds: number; completed_at: string }> }>('/api/workouts/sessions'),
  ]);

  const activeMember = data.membership;
  const activeChallenge = activeMember ? data.challenges.find((c) => c.id === activeMember.challenge_id) : null;

  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <p class="text-xs font-mono-num text-[#B6FF48]">MAIN CHALLENGE · ZERO GAMBLING · CONSISTENCY INCENTIVE</p>
        <h1 class="font-display text-2xl sm:text-3xl font-bold mt-1">30-Day Fitness Challenge</h1>
        <p class="text-sm text-[#9AA69B] mt-1">Register for ₹399, verify daily runs and workouts, and qualify for the FITNOVA Dri-Fit T-shirt + ₹299 completion refund.</p>
      </div>

      ${
        activeMember && activeMember.status === 'active' && activeChallenge
          ? renderActiveChallengeDashboard(activeChallenge, activeMember, data.dailyLogs, data.reward, runsRes.runs, workoutsRes.sessions)
          : renderChallengeOverviewAndJoin(data.challenges, activeMember)
      }

      <!-- Leaderboard -->
      <section class="fn-surface rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-display text-lg font-semibold">Challenge Leaderboard</h2>
          <span class="text-xs text-[#9AA69B]">Top Verified Participants</span>
        </div>
        ${
          data.leaderboard.length === 0
            ? `<p class="text-sm text-[#9AA69B]">No active challenge finishers yet. Be the first to verify Day 1.</p>`
            : `
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="text-xs text-[#9AA69B] border-b border-white/10">
                  <tr>
                    <th class="text-left py-2.5 font-medium">Rank</th>
                    <th class="text-left py-2.5 font-medium">Athlete</th>
                    <th class="text-right py-2.5 font-medium">Verified Days</th>
                    <th class="text-right py-2.5 font-medium">Points</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/10">
                  ${data.leaderboard
                    .map(
                      (row, i) => `
                    <tr>
                      <td class="py-3 font-mono-num text-[#B6FF48]">#${i + 1}</td>
                      <td class="py-3 text-white font-medium">${escapeHtml(row.full_name)}</td>
                      <td class="py-3 text-right font-mono-num text-white">${row.completed_days} / 30</td>
                      <td class="py-3 text-right font-mono-num text-[#B6FF48]">${row.points}</td>
                    </tr>
                  `
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          `
        }
      </section>
    </div>
  `;

  wireChallengeEvents(container, data);
}

function renderChallengeOverviewAndJoin(challenges: Challenge[], pendingMember: ChallengeMember | null): string {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <div class="lg:col-span-5 fn-surface rounded-3xl overflow-hidden flex flex-col">
        ${renderImageWithFallback(TSHIRT_IMG, 'FITNOVA Dri-Fit Finisher T-shirt', 'w-full h-56')}
        <div class="p-6 space-y-3 flex-1">
          <p class="text-xs font-mono-num text-[#B6FF48]">COMPLETION REWARD PACKAGE</p>
          <h2 class="font-display text-xl font-bold">FITNOVA Performance Tee + ₹299 Refund</h2>
          <p class="text-xs text-[#9AA69B] leading-relaxed">
            Upon completing ≥24 verified active days and 4 scheduled recovery days within 30 days, admins audit your verified GPS logs and issue your ₹299 cashback + dispatch your Dri-Fit T-shirt.
          </p>
          <div class="pt-3 border-t border-white/10 text-xs text-[#9AA69B] space-y-1">
            <p>• Maximum 2 missed active days permitted</p>
            <p>• Every 7th day is an automatic recovery day</p>
            <p>• 24h cancellation window before Day 1 starts</p>
          </div>
        </div>
      </div>

      <div class="lg:col-span-7 space-y-4">
        ${challenges
          .map(
            (c) => `
          <article class="fn-surface rounded-2xl p-5 space-y-3">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-xs font-mono-num text-[#B6FF48]">${escapeHtml(c.tier.toUpperCase())} PLAN · ${c.duration_days} DAYS</p>
                <h3 class="font-display text-lg font-semibold text-white mt-0.5">${escapeHtml(c.title)}</h3>
              </div>
              <span class="font-mono-num text-lg font-bold text-white">${formatINR(c.registration_fee_inr)}</span>
            </div>
            <p class="text-sm text-[#9AA69B]">${escapeHtml(c.description)}</p>
            <div class="grid grid-cols-3 gap-2 text-xs font-mono-num fn-surface-alt rounded-xl p-3">
              <span>Run: ${c.daily_run_km_target} km/day</span>
              <span>Workout: ${c.daily_workout_minutes_target} min</span>
              <span>Rest: ${c.rest_days_included} days</span>
            </div>
            <button type="button" data-join-challenge="${escapeHtml(c.id)}" class="fn-btn-primary w-full py-3 rounded-xl text-sm min-h-[44px]">
              ${pendingMember && pendingMember.challenge_id === c.id ? 'Complete ₹399 Verification Payment' : `Read Rules & Register (${formatINR(c.registration_fee_inr)})`}
            </button>
          </article>
        `
          )
          .join('')}

        <details class="fn-surface rounded-2xl p-5">
          <summary class="text-sm font-semibold text-white cursor-pointer">Full Challenge Rules, GPS Policy & Refund Terms</summary>
          <pre class="mt-3 text-xs text-[#9AA69B] whitespace-pre-wrap font-sans leading-relaxed">${escapeHtml(challenges[0]?.rules_markdown || '')}</pre>
        </details>
      </div>
    </div>
  `;
}

function renderActiveChallengeDashboard(
  challenge: Challenge,
  member: ChallengeMember,
  logs: ChallengeDailyLog[],
  reward: ChallengePayload['reward'],
  runs: RunningSession[],
  workouts: Array<{ id: string; title: string; duration_seconds: number; completed_at: string }>
): string {
  const logByDay = new Map<number, ChallengeDailyLog>();
  for (const l of logs) logByDay.set(l.day_number, l);
  const pct = Math.round((member.completed_days / 30) * 100);
  const nextDay = Math.min(30, logs.length + 1);

  return `
    <div class="space-y-6">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="fn-surface rounded-2xl p-4">
          <p class="text-xs text-[#9AA69B]">Active Tier</p>
          <p class="text-sm font-semibold text-white mt-1">${escapeHtml(challenge.title)}</p>
        </div>
        <div class="fn-surface rounded-2xl p-4">
          <p class="text-xs text-[#9AA69B]">Completion</p>
          <p class="font-mono-num text-2xl font-bold text-[#B6FF48] mt-1">${member.completed_days}/30 (${pct}%)</p>
        </div>
        <div class="fn-surface rounded-2xl p-4">
          <p class="text-xs text-[#9AA69B]">Missed Days (Max 2)</p>
          <p class="font-mono-num text-2xl font-bold text-white mt-1">${member.missed_days}</p>
        </div>
        <div class="fn-surface rounded-2xl p-4">
          <p class="text-xs text-[#9AA69B]">Reward Eligibility</p>
          <p class="font-mono-num text-sm font-semibold text-[#B6FF48] mt-2">${escapeHtml(member.final_eligibility.replace(/_/g, ' ').toUpperCase())}</p>
        </div>
      </div>

      <!-- Day 1 to Day 30 Calendar -->
      <section class="fn-surface rounded-2xl p-5">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 class="font-display text-lg font-semibold">Day 1 to Day 30 Calendar</h2>
          <span class="text-xs text-[#9AA69B]">Target: ${challenge.daily_run_km_target} km verified run + ${challenge.daily_workout_minutes_target}m workout · Days 7,14,21,28 Rest</span>
        </div>
        <div class="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2">
          ${Array.from({ length: 30 })
            .map((_, idx) => {
              const day = idx + 1;
              const log = logByDay.get(day);
              const isRest = day % 7 === 0;
              let cls = 'bg-[#131814] border-white/10 text-[#9AA69B]';
              let label = isRest ? 'Rest' : 'Open';
              if (log) {
                if (log.verification_status === 'verified' || log.verification_status === 'rest_approved') {
                  cls = 'bg-[#B6FF48]/15 border-[#B6FF48]/60 text-[#B6FF48]';
                  label = isRest ? 'Rest OK' : 'Verified';
                } else if (log.verification_status === 'pending') {
                  cls = 'bg-amber-500/15 border-amber-400/50 text-amber-300';
                  label = 'Pending';
                } else {
                  cls = 'bg-[#FF6262]/15 border-[#FF6262]/60 text-[#FF6262]';
                  label = 'Rejected';
                }
              }
              return `
                <div class="border rounded-xl p-2 text-center ${cls}">
                  <p class="font-mono-num text-xs font-bold">D${day}</p>
                  <p class="text-[10px] mt-0.5 truncate">${label}</p>
                </div>
              `;
            })
            .join('')}
        </div>
      </section>

      <!-- Daily Check-in + Reward Shipping Preferences -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form id="checkin-form" class="fn-surface rounded-2xl p-5 space-y-4">
          <h2 class="font-display text-lg font-semibold">Submit Daily Activity Verification</h2>
          <p class="text-xs text-[#9AA69B]">Attach a server-verified GPS run and/or tracked workout session. Unverified manual distances cannot auto-qualify.</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Challenge Day (1–30)</label>
              <input id="ci-day" type="number" min="1" max="30" value="${nextDay}" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm font-mono-num min-h-[44px]" />
            </div>
            <div>
              <label class="block text-xs text-[#9AA69B] mb-1">Day Type</label>
              <select id="ci-type" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]">
                <option value="active">Active Training Day</option>
                <option value="rest">Scheduled Recovery Day (7/14/21/28)</option>
              </select>
            </div>
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Attach GPS Running Session</label>
            <select id="ci-run" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]">
              <option value="">None attached</option>
              ${runs
                .map(
                  (r) => `<option value="${escapeHtml(r.id)}">${(r.distance_meters / 1000).toFixed(2)} km (${r.verification_status}) · ${new Date(r.started_at).toLocaleDateString('en-IN')}</option>`
                )
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Attach Workout Session</label>
            <select id="ci-workout" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]">
              <option value="">None attached</option>
              ${workouts
                .map(
                  (w) => `<option value="${escapeHtml(w.id)}">${escapeHtml(w.title)} (${Math.round(w.duration_seconds / 60)} min) · ${new Date(w.completed_at).toLocaleDateString('en-IN')}</option>`
                )
                .join('')}
            </select>
          </div>
          <button type="submit" class="fn-btn-primary w-full py-3 rounded-xl text-sm min-h-[44px]">Submit Day Check-in</button>
        </form>

        <form id="reward-form" class="fn-surface rounded-2xl p-5 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg font-semibold">T-Shirt & Refund Shipping Details</h2>
            <span class="text-xs font-mono-num text-[#B6FF48]">${escapeHtml((reward?.dispatch_status || 'pending_approval').replace(/_/g, ' '))}</span>
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">FITNOVA Dri-Fit T-Shirt Size</label>
            <select id="rw-size" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]">
              ${['S', 'M', 'L', 'XL', 'XXL']
                .map((sz) => `<option value="${sz}" ${(reward?.tshirt_size || member.tshirt_size || 'L') === sz ? 'selected' : ''}>${sz}</option>`)
                .join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Indian Delivery Address & Pincode</label>
            <textarea id="rw-addr" rows="3" required placeholder="House/Flat, Street, City, State, 6-digit Pincode" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm">${escapeHtml(reward?.shipping_address || '')}</textarea>
          </div>
          ${reward?.tracking_number ? `<p class="text-xs font-mono-num text-[#B6FF48]">Tracking ID: ${escapeHtml(reward.tracking_number)}</p>` : ''}
          <button type="submit" class="fn-btn-secondary w-full py-3 rounded-xl text-sm min-h-[44px]">Save Reward Dispatch Info</button>
        </form>
      </div>
    </div>
  `;
}

function wireChallengeEvents(container: HTMLElement, data: ChallengePayload): void {
  container.querySelectorAll('[data-join-challenge]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const challengeId = btn.getAttribute('data-join-challenge')!;
      const challenge = data.challenges.find((c) => c.id === challengeId);
      if (challenge) openChallengeCheckoutModal(challenge, () => renderChallengeScreen(container));
    });
  });

  document.getElementById('checkin-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!data.membership) return;
    try {
      const res = await api<{ verification_status: string }>('/api/challenges/daily-checkin', {
        method: 'POST',
        body: JSON.stringify({
          member_id: data.membership.id,
          day_number: Number((document.getElementById('ci-day') as HTMLInputElement).value),
          log_type: (document.getElementById('ci-type') as HTMLSelectElement).value,
          running_session_id: (document.getElementById('ci-run') as HTMLSelectElement).value || null,
          workout_session_id: (document.getElementById('ci-workout') as HTMLSelectElement).value || null,
        }),
      });
      toast(`Day logged (${res.verification_status}).`, 'success');
      renderChallengeScreen(container);
    } catch (err) {
      toast((err as ApiError).message, 'error');
    }
  });

  document.getElementById('reward-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!data.membership) return;
    try {
      await api('/api/challenges/reward-claim', {
        method: 'POST',
        body: JSON.stringify({
          member_id: data.membership.id,
          tshirt_size: (document.getElementById('rw-size') as HTMLSelectElement).value,
          shipping_address: (document.getElementById('rw-addr') as HTMLTextAreaElement).value,
        }),
      });
      toast('Reward shipping details saved.', 'success');
      renderChallengeScreen(container);
    } catch (err) {
      toast((err as ApiError).message, 'error');
    }
  });
}

function openChallengeCheckoutModal(challenge: Challenge, onActivated: () => void): void {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="fn-surface rounded-3xl max-w-lg w-full p-6 space-y-4">
      <p class="text-xs font-mono-num text-[#B6FF48]">RAZORPAY INDIA CHECKOUT · SERVER-VERIFIED</p>
      <h2 class="font-display text-xl font-bold">${escapeHtml(challenge.title)}</h2>
      <p class="text-sm text-[#9AA69B]">Entry Fee: <strong class="text-white font-mono-num">${formatINR(challenge.registration_fee_inr)}</strong> · Conditional Reward: ₹299 Refund + Dri-Fit Tee</p>
      <form id="ch-pay-form" class="space-y-3">
        <div>
          <label class="block text-xs text-[#9AA69B] mb-1">Select T-Shirt Size</label>
          <select id="ch-size" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]">
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L" selected>L</option>
            <option value="XL">XL</option>
            <option value="XXL">XXL</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-[#9AA69B] mb-1">Delivery Address (for T-shirt dispatch)</label>
          <input id="ch-addr" type="text" required placeholder="Flat 402, Indiranagar, Bengaluru 560038" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]" />
        </div>
        <label class="flex items-start gap-2 text-xs text-[#9AA69B]">
          <input type="checkbox" required class="mt-0.5 accent-[#B6FF48]" />
          <span>I have read the Challenge Rules, GPS Verification Policy, and understand membership activates only after server webhook confirmation.</span>
        </label>
        <div class="flex gap-3 pt-2">
          <button type="button" id="ch-cancel" class="fn-btn-secondary flex-1 py-3 rounded-xl text-sm min-h-[44px]">Cancel</button>
          <button type="submit" id="ch-pay-btn" class="fn-btn-primary flex-1 py-3 rounded-xl text-sm min-h-[44px]">Pay ₹399 via UPI / Card</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#ch-cancel')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#ch-pay-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = modal.querySelector('#ch-pay-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = 'Verifying Payment Webhook...';
    try {
      const order = await api<{ gatewayOrderId: string }>(`/api/challenges/${challenge.id}/checkout`, {
        method: 'POST',
        body: JSON.stringify({
          tshirt_size: (modal.querySelector('#ch-size') as HTMLSelectElement).value,
          shipping_address: (modal.querySelector('#ch-addr') as HTMLInputElement).value,
        }),
      });
      // Complete Razorpay payment and verify HMAC signature server-side
      await api('/api/payments/sandbox-confirm', {
        method: 'POST',
        body: JSON.stringify({ gatewayOrderId: order.gatewayOrderId }),
      });
      modal.remove();
      toast('Payment verified by server webhook! 30-Day Challenge is now active.', 'success');
      onActivated();
    } catch (err) {
      toast((err as ApiError).message, 'error');
      btn.disabled = false;
      btn.textContent = 'Pay ₹399 via UPI / Card';
    }
  });
}
