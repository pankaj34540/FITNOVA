import { api, ApiError } from '../lib/api.ts';
import type { Exercise, WorkoutPlan } from '../lib/types.ts';
import { getState } from '../state/store.ts';
import { escapeHtml, formatDuration, renderAdBanner, renderImageWithFallback, toast } from '../ui/components.ts';
import { icon } from '../ui/icons.ts';

const CATEGORIES = ['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Full Body', 'Cardio', 'HIIT', 'Yoga', 'Stretching'];

let activeTab: 'plans' | 'library' | 'history' = 'plans';
let selectedCategory = 'All';
let selectedDifficulty = 'all';
let searchQuery = '';
let activeSessionInterval: number | null = null;

export async function renderWorkoutScreen(container: HTMLElement): Promise<void> {
  if (activeSessionInterval) {
    clearInterval(activeSessionInterval);
    activeSessionInterval = null;
  }

  const s = getState();
  container.innerHTML = `<div class="fn-surface rounded-2xl p-6 text-sm text-[#9AA69B]">Loading workouts and exercise library...</div>`;

  const [exRes, planRes, sessRes] = await Promise.all([
    api<{ exercises: Exercise[] }>('/api/exercises'),
    api<{ plans: WorkoutPlan[] }>('/api/plans'),
    api<{ sessions: Array<{ id: string; title: string; duration_seconds: number; calories_burned: number; completed_at: string }> }>('/api/workouts/sessions'),
  ]);

  function draw() {
    const filteredExercises = exRes.exercises.filter((ex) => {
      if (selectedCategory !== 'All' && ex.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'all' && ex.difficulty !== selectedDifficulty) return false;
      if (searchQuery && !ex.name.toLowerCase().includes(searchQuery.toLowerCase()) && !ex.equipment.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="font-display text-2xl font-bold">Workouts & Exercise Library</h1>
            <p class="text-sm text-[#9AA69B]">Structured 7–90 day plans, 12 muscle categories, and live rest/session timers.</p>
          </div>
          <div class="w-full sm:w-auto grid grid-cols-3 sm:flex items-center gap-1 p-1 bg-[#1A211C] border border-white/10 rounded-xl">
            <button type="button" data-wtab="plans" class="px-2 sm:px-4 py-2 text-[11px] sm:text-xs font-medium rounded-lg min-h-[40px] whitespace-nowrap ${activeTab === 'plans' ? 'bg-[#B6FF48] text-[#101411]' : 'text-[#9AA69B] hover:text-white'}">Plans</button>
            <button type="button" data-wtab="library" class="px-2 sm:px-4 py-2 text-[11px] sm:text-xs font-medium rounded-lg min-h-[40px] whitespace-nowrap ${activeTab === 'library' ? 'bg-[#B6FF48] text-[#101411]' : 'text-[#9AA69B] hover:text-white'}">Library</button>
            <button type="button" data-wtab="history" class="px-2 sm:px-4 py-2 text-[11px] sm:text-xs font-medium rounded-lg min-h-[40px] whitespace-nowrap ${activeTab === 'history' ? 'bg-[#B6FF48] text-[#101411]' : 'text-[#9AA69B] hover:text-white'}">History (${sessRes.sessions.length})</button>
          </div>
        </div>

        ${
          activeTab === 'plans'
            ? `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${planRes.plans
              .map(
                (p) => `
                <article class="fn-surface rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <p class="text-xs text-[#B6FF48] font-mono-num">${escapeHtml(p.difficulty.toUpperCase())} · ${p.duration_days}-DAY PROGRAM · ${p.estimated_minutes} MIN</p>
                    <h2 class="font-display text-xl font-semibold text-white mt-1.5">${escapeHtml(p.title)}</h2>
                    <p class="text-sm text-[#9AA69B] mt-2">${escapeHtml(p.description)}</p>
                    <ul class="mt-4 space-y-1.5 border-t border-white/10 pt-3">
                      ${p.items
                        .map(
                          (item, i) => `
                          <li class="flex items-center justify-between text-xs">
                            <span class="text-white">${i + 1}. ${escapeHtml(item.exercise_name)}</span>
                            <span class="font-mono-num text-[#9AA69B]">${item.sets} × ${escapeHtml(item.reps)}</span>
                          </li>
                        `
                        )
                        .join('')}
                    </ul>
                  </div>
                  <button type="button" data-start-plan="${escapeHtml(p.id)}" class="fn-btn-primary mt-5 w-full py-3 rounded-xl text-sm min-h-[44px] flex items-center justify-center gap-2">
                    ${icon('play', 'w-4 h-4')}
                    <span>Start Workout Session</span>
                  </button>
                </article>
              `
              )
              .join('')}
          </div>
        `
            : activeTab === 'library'
              ? `
          <div class="space-y-4">
            <div class="flex flex-col sm:flex-row gap-3">
              <div class="relative flex-1">
                <input id="ex-search" type="search" value="${escapeHtml(searchQuery)}" placeholder="Search exercise or equipment..." class="fn-input w-full rounded-xl pl-4 pr-4 py-2.5 text-sm min-h-[44px]" />
              </div>
              <select id="ex-diff" class="fn-input rounded-xl px-4 py-2.5 text-sm min-h-[44px]">
                <option value="all" ${selectedDifficulty === 'all' ? 'selected' : ''}>All Levels</option>
                <option value="beginner" ${selectedDifficulty === 'beginner' ? 'selected' : ''}>Beginner</option>
                <option value="intermediate" ${selectedDifficulty === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                <option value="advanced" ${selectedDifficulty === 'advanced' ? 'selected' : ''}>Advanced</option>
              </select>
            </div>

            <div class="flex sm:flex-wrap gap-2 overflow-x-auto no-scrollbar pb-1">
              ${CATEGORIES.map(
                (cat) => `
                  <button type="button" data-cat="${escapeHtml(cat)}" class="px-3.5 py-2 rounded-xl text-xs font-medium min-h-[40px] whitespace-nowrap shrink-0 border ${
                    selectedCategory === cat ? 'bg-[#B6FF48] text-[#101411] border-[#B6FF48]' : 'bg-[#1A211C] text-[#9AA69B] border-white/10 hover:text-white'
                  }">${escapeHtml(cat)}</button>
                `
              ).join('')}
            </div>

            ${renderAdBanner('workout_library', s.adsConfig, s.user)}

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              ${
                filteredExercises.length === 0
                  ? `<div class="col-span-full fn-surface rounded-2xl p-6 text-sm text-[#9AA69B]">No exercises match your current filters.</div>`
                  : filteredExercises
                      .map(
                        (ex) => `
                      <article class="fn-surface rounded-2xl overflow-hidden flex flex-col justify-between">
                        <div>
                          ${renderImageWithFallback(ex.media_url, ex.name, 'w-full h-36')}
                          <div class="p-4">
                            <p class="text-xs text-[#9AA69B]">${escapeHtml(ex.category)} · ${escapeHtml(ex.difficulty)} · ${escapeHtml(ex.equipment)}</p>
                            <h3 class="font-display text-base font-semibold text-white mt-1">${escapeHtml(ex.name)}</h3>
                            <p class="font-mono-num text-xs text-[#B6FF48] mt-1.5">${ex.default_sets} sets × ${escapeHtml(ex.default_reps)} · ${ex.rest_seconds}s rest</p>
                          </div>
                        </div>
                        <div class="px-4 pb-4">
                          <button type="button" data-ex-detail="${escapeHtml(ex.id)}" class="fn-btn-secondary w-full py-2.5 rounded-xl text-xs min-h-[44px]">View Instructions & Quick Log</button>
                        </div>
                      </article>
                    `
                      )
                      .join('')
              }
            </div>
          </div>
        `
              : `
          <div class="fn-surface rounded-2xl divide-y divide-white/10">
            ${
              sessRes.sessions.length === 0
                ? `<div class="p-6 text-sm text-[#9AA69B]">No workouts logged yet. Start any plan to record your first session.</div>`
                : sessRes.sessions
                    .map(
                      (sess) => `
                      <div class="p-4 flex items-center justify-between gap-4">
                        <div>
                          <p class="text-sm font-semibold text-white">${escapeHtml(sess.title)}</p>
                          <p class="text-xs text-[#9AA69B] mt-0.5">${new Date(sess.completed_at).toLocaleString('en-IN')}</p>
                        </div>
                        <div class="text-right font-mono-num">
                          <p class="text-sm text-white">${formatDuration(sess.duration_seconds)}</p>
                          <p class="text-xs text-[#B6FF48]">${sess.calories_burned} kcal</p>
                        </div>
                      </div>
                    `
                    )
                    .join('')
            }
          </div>
        `
        }
      </div>
    `;

    container.querySelectorAll('[data-wtab]').forEach((b) => {
      b.addEventListener('click', () => {
        activeTab = b.getAttribute('data-wtab') as typeof activeTab;
        draw();
      });
    });

    container.querySelectorAll('[data-cat]').forEach((b) => {
      b.addEventListener('click', () => {
        selectedCategory = b.getAttribute('data-cat') || 'All';
        draw();
      });
    });

    document.getElementById('ex-diff')?.addEventListener('change', (e) => {
      selectedDifficulty = (e.target as HTMLSelectElement).value;
      draw();
    });

    document.getElementById('ex-search')?.addEventListener('input', (e) => {
      searchQuery = (e.target as HTMLInputElement).value;
      draw();
      const input = document.getElementById('ex-search') as HTMLInputElement | null;
      if (input) {
        input.focus();
        input.setSelectionRange(searchQuery.length, searchQuery.length);
      }
    });

    container.querySelectorAll('[data-start-plan]').forEach((b) => {
      b.addEventListener('click', () => {
        const plan = planRes.plans.find((p) => p.id === b.getAttribute('data-start-plan'));
        if (plan) startLiveWorkoutSession(container, plan, () => renderWorkoutScreen(container));
      });
    });

    container.querySelectorAll('[data-ex-detail]').forEach((b) => {
      b.addEventListener('click', () => {
        const ex = exRes.exercises.find((item) => item.id === b.getAttribute('data-ex-detail'));
        if (ex) openExerciseDetailModal(ex, () => renderWorkoutScreen(container));
      });
    });
  }

  draw();
}

function openExerciseDetailModal(ex: Exercise, onLogged: () => void): void {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="fn-surface rounded-3xl max-w-lg w-full overflow-hidden max-h-[90dvh] flex flex-col">
      ${renderImageWithFallback(ex.media_url, ex.name, 'w-full h-48')}
      <div class="p-6 overflow-y-auto space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs text-[#B6FF48]">${escapeHtml(ex.category)} · ${escapeHtml(ex.difficulty)} · ${escapeHtml(ex.equipment)}</p>
            <h2 class="font-display text-xl font-bold mt-1">${escapeHtml(ex.name)}</h2>
          </div>
          <button type="button" id="ex-close" class="fn-btn-secondary p-2 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center">${icon('x', 'w-4 h-4')}</button>
        </div>
        <div class="fn-surface-alt rounded-xl p-3 text-xs flex justify-between font-mono-num">
          <span>Sets: ${ex.default_sets}</span>
          <span>Reps: ${escapeHtml(ex.default_reps)}</span>
          <span>Rest: ${ex.rest_seconds}s</span>
        </div>
        <div>
          <p class="text-xs text-[#9AA69B] mb-1">Target Muscles</p>
          <p class="text-sm text-white">${escapeHtml(ex.target_muscles.join(' · '))}</p>
        </div>
        <div>
          <p class="text-xs text-[#9AA69B] mb-1">Form Instructions</p>
          <p class="text-sm text-[#9AA69B] leading-relaxed">${escapeHtml(ex.instructions)}</p>
        </div>
        <button type="button" id="ex-quick-log" class="fn-btn-primary w-full py-3 rounded-xl text-sm min-h-[44px]">Log 15-Min Practice Session</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#ex-close')?.addEventListener('click', () => modal.remove());
  modal.querySelector('#ex-quick-log')?.addEventListener('click', async () => {
    try {
      await api('/api/workouts/sessions', {
        method: 'POST',
        body: JSON.stringify({
          title: `${ex.name} Focused Practice`,
          duration_seconds: 900,
          calories_burned: Math.round(ex.calories_per_min * 15),
          exercises_completed: [ex.name],
        }),
      });
      modal.remove();
      toast('Exercise session saved.', 'success');
      onLogged();
    } catch (err) {
      toast((err as ApiError).message, 'error');
    }
  });
}

function startLiveWorkoutSession(container: HTMLElement, plan: WorkoutPlan, onExit: () => void): void {
  // Zero ads during active workout session
  let elapsedSec = 0;
  let restRemaining = 0;
  let paused = false;
  const completedSetKeys = new Set<string>();

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <button type="button" id="ws-exit" class="fn-btn-secondary px-4 py-2 rounded-xl text-xs min-h-[44px] flex items-center gap-2">
          ${icon('arrowLeft', 'w-4 h-4')}
          <span>Exit Session</span>
        </button>
        <p class="text-xs font-mono-num text-[#B6FF48]">ACTIVE WORKOUT</p>
      </div>

      <div class="fn-surface rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div>
          <h1 class="font-display text-2xl font-bold">${escapeHtml(plan.title)}</h1>
          <p class="text-xs text-[#9AA69B] mt-1">Check off sets as you complete them. Use the rest timer between sets.</p>
        </div>
        <div class="flex items-center gap-4">
          <div class="fn-surface-alt rounded-2xl px-5 py-3 text-center">
            <p class="text-[11px] text-[#9AA69B]">Workout Timer</p>
            <p id="ws-timer" class="font-mono-num text-2xl font-bold text-white">00:00</p>
          </div>
          <div class="fn-surface-alt rounded-2xl px-5 py-3 text-center">
            <p class="text-[11px] text-[#9AA69B]">Rest Timer</p>
            <p id="ws-rest" class="font-mono-num text-2xl font-bold text-[#B6FF48]">00:00</p>
          </div>
        </div>
      </div>

      <div class="space-y-3">
        ${plan.items
          .map(
            (item, idx) => `
            <div class="fn-surface rounded-2xl p-4 space-y-3">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-xs text-[#9AA69B]">${idx + 1}. ${escapeHtml(item.category)} · ${escapeHtml(item.equipment)}</p>
                  <h2 class="font-display text-base font-semibold text-white">${escapeHtml(item.exercise_name)}</h2>
                  <p class="text-xs font-mono-num text-[#B6FF48] mt-0.5">${item.sets} sets × ${escapeHtml(item.reps)} · ${item.rest_seconds}s rest</p>
                </div>
                <button type="button" data-rest-sec="${item.rest_seconds}" class="fn-btn-secondary px-3.5 py-2 rounded-xl text-xs min-h-[40px] shrink-0">Start ${item.rest_seconds}s Rest</button>
              </div>
              <div class="flex flex-wrap gap-2">
                ${Array.from({ length: item.sets })
                  .map(
                    (_, sIdx) => `
                    <button type="button" data-set-key="${item.id}-${sIdx}" class="fn-btn-secondary px-3 py-2 rounded-lg text-xs font-mono-num min-h-[40px]">Set ${sIdx + 1}</button>
                  `
                  )
                  .join('')}
              </div>
            </div>
          `
          )
          .join('')}
      </div>

      <div class="flex flex-wrap gap-3">
        <button type="button" id="ws-pause" class="fn-btn-secondary px-5 py-3.5 rounded-xl text-sm min-h-[48px]">Pause Timer</button>
        <button type="button" id="ws-finish" class="fn-btn-primary flex-1 px-6 py-3.5 rounded-xl text-sm min-h-[48px]">Complete & Save Workout</button>
      </div>
    </div>
  `;

  activeSessionInterval = window.setInterval(() => {
    if (!paused) elapsedSec++;
    if (restRemaining > 0) restRemaining--;
    const tEl = document.getElementById('ws-timer');
    const rEl = document.getElementById('ws-rest');
    if (tEl) tEl.textContent = formatDuration(elapsedSec);
    if (rEl) rEl.textContent = formatDuration(restRemaining);
  }, 1000);

  container.querySelectorAll('[data-rest-sec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      restRemaining = Number(btn.getAttribute('data-rest-sec')) || 60;
      const rEl = document.getElementById('ws-rest');
      if (rEl) rEl.textContent = formatDuration(restRemaining);
    });
  });

  container.querySelectorAll('[data-set-key]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-set-key')!;
      if (completedSetKeys.has(key)) {
        completedSetKeys.delete(key);
        btn.className = 'fn-btn-secondary px-3 py-2 rounded-lg text-xs font-mono-num min-h-[40px]';
      } else {
        completedSetKeys.add(key);
        btn.className = 'fn-btn-primary px-3 py-2 rounded-lg text-xs font-mono-num min-h-[40px]';
      }
    });
  });

  document.getElementById('ws-pause')?.addEventListener('click', (e) => {
    paused = !paused;
    (e.target as HTMLButtonElement).textContent = paused ? 'Resume Timer' : 'Pause Timer';
  });

  document.getElementById('ws-exit')?.addEventListener('click', () => {
    if (activeSessionInterval) clearInterval(activeSessionInterval);
    activeSessionInterval = null;
    onExit();
  });

  document.getElementById('ws-finish')?.addEventListener('click', async () => {
    if (activeSessionInterval) clearInterval(activeSessionInterval);
    activeSessionInterval = null;
    const durationToSave = Math.max(60, elapsedSec);
    const estCalories = Math.round((durationToSave / 60) * 7.2);
    try {
      await api('/api/workouts/sessions', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          title: plan.title,
          duration_seconds: durationToSave,
          calories_burned: estCalories,
          exercises_completed: plan.items.map((i) => i.exercise_name),
        }),
      });
      toast('Workout completed and saved to your log.', 'success');
      onExit();
    } catch (err) {
      toast((err as ApiError).message, 'error');
    }
  });
}
