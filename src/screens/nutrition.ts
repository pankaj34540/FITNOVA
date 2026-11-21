import { api, ApiError } from '../lib/api.ts';
import {
  INDIAN_FOOD_DATABASE,
  calc1RM,
  calcBMI,
  calcBMR,
  calcBodyFatNavy,
  calcIdealWeight,
  calcTDEE,
} from '../lib/indianFoods.ts';
import { getState, navigate } from '../state/store.ts';
import { escapeHtml, renderAdBanner, toast } from '../ui/components.ts';

interface MealLog {
  id: string;
  meal_slot: string;
  food_name: string;
  diet_type: 'veg' | 'non_veg';
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export async function renderNutritionScreen(container: HTMLElement): Promise<void> {
  const s = getState();
  const goals = s.goals;
  let dietFilter: 'all' | 'veg' | 'non_veg' = 'all';
  let foodSearch = '';
  let selectedSlot: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch';

  const data = await api<{ date: string; meals: MealLog[]; waterMl: number }>('/api/nutrition');

  function draw() {
    const totals = data.meals.reduce(
      (acc, m) => ({
        cal: acc.cal + m.calories,
        p: acc.p + m.protein_g,
        c: acc.c + m.carbs_g,
        f: acc.f + m.fat_g,
      }),
      { cal: 0, p: 0, c: 0, f: 0 }
    );
    const calTarget = goals?.daily_calorie_target || 2100;
    const proteinTarget = goals?.daily_protein_g || 110;
    const waterTarget = goals?.daily_water_ml || 3000;

    const foods = INDIAN_FOOD_DATABASE.filter((f) => {
      if (dietFilter !== 'all' && f.dietType !== dietFilter) return false;
      if (foodSearch && !f.name.toLowerCase().includes(foodSearch.toLowerCase())) return false;
      return true;
    });

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="font-display text-2xl font-bold">Indian Nutrition & Meal Planner</h1>
            <p class="text-sm text-[#9AA69B]">Track home-cooked Indian meals, protein, macros, and daily hydration.</p>
          </div>
          <button type="button" id="go-calcs-from-nut" class="fn-btn-secondary px-4 py-2.5 rounded-xl text-xs min-h-[44px]">Open 9 Fitness Calculators →</button>
        </div>

        <p class="text-xs text-[#9AA69B] fn-surface rounded-xl px-4 py-3">
          Nutrition Disclaimer: Calorie and macronutrient figures are informational estimates based on standard Indian portion sizes and are not medical or clinical dietary advice.
        </p>

        <!-- Daily Macro & Water Summary -->
        <section class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="fn-surface rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Calories</p>
            <p class="font-mono-num text-xl font-bold text-[#B6FF48] mt-1">${totals.cal} <span class="text-xs text-[#9AA69B]">/ ${calTarget}</span></p>
          </div>
          <div class="fn-surface rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Protein</p>
            <p class="font-mono-num text-xl font-bold text-white mt-1">${totals.p.toFixed(1)}g <span class="text-xs text-[#9AA69B]">/ ${proteinTarget}g</span></p>
          </div>
          <div class="fn-surface rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Carbs</p>
            <p class="font-mono-num text-xl font-bold text-white mt-1">${totals.c.toFixed(1)}g</p>
          </div>
          <div class="fn-surface rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Fats</p>
            <p class="font-mono-num text-xl font-bold text-white mt-1">${totals.f.toFixed(1)}g</p>
          </div>
          <div class="fn-surface rounded-2xl p-4 col-span-2 lg:col-span-1 flex flex-col justify-between">
            <div>
              <p class="text-xs text-[#9AA69B]">Water Intake</p>
              <p class="font-mono-num text-xl font-bold text-white mt-1">${data.waterMl} / ${waterTarget} ml</p>
            </div>
            <button type="button" id="add-water-btn" class="fn-btn-primary mt-2 py-1.5 rounded-lg text-xs min-h-[36px]">+250 ml Glass</button>
          </div>
        </section>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <!-- Indian Food Database -->
          <section class="lg:col-span-7 fn-surface rounded-2xl p-5 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="font-display text-lg font-semibold">Indian Food Database</h2>
              <div class="flex items-center gap-1 p-1 bg-[#131814] rounded-xl">
                <button type="button" data-diet="all" class="px-3 py-1.5 text-xs rounded-lg ${dietFilter === 'all' ? 'bg-[#B6FF48] text-[#101411] font-semibold' : 'text-[#9AA69B]'}">All</button>
                <button type="button" data-diet="veg" class="px-3 py-1.5 text-xs rounded-lg ${dietFilter === 'veg' ? 'bg-[#B6FF48] text-[#101411] font-semibold' : 'text-[#9AA69B]'}">Veg</button>
                <button type="button" data-diet="non_veg" class="px-3 py-1.5 text-xs rounded-lg ${dietFilter === 'non_veg' ? 'bg-[#B6FF48] text-[#101411] font-semibold' : 'text-[#9AA69B]'}">Non-Veg</button>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input id="food-search" type="search" value="${escapeHtml(foodSearch)}" placeholder="Search dal, poha, paneer, chicken..." class="fn-input rounded-xl px-3.5 py-2.5 text-sm min-h-[44px]" />
              <select id="meal-slot-select" class="fn-input rounded-xl px-3.5 py-2.5 text-sm min-h-[44px]">
                <option value="breakfast" ${selectedSlot === 'breakfast' ? 'selected' : ''}>Log to Breakfast</option>
                <option value="lunch" ${selectedSlot === 'lunch' ? 'selected' : ''}>Log to Lunch</option>
                <option value="dinner" ${selectedSlot === 'dinner' ? 'selected' : ''}>Log to Dinner</option>
                <option value="snack" ${selectedSlot === 'snack' ? 'selected' : ''}>Log to Snack</option>
              </select>
            </div>

            <div class="divide-y divide-white/10 max-h-[420px] overflow-y-auto pr-1">
              ${foods
                .map(
                  (f, idx) => `
                  <div class="py-3 flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-white truncate">${escapeHtml(f.name)}</p>
                      <p class="text-xs text-[#9AA69B]">${f.dietType === 'veg' ? 'Veg' : 'Non-Veg'} · ${escapeHtml(f.servingLabel)} · P ${f.protein}g / C ${f.carbs}g / F ${f.fat}g</p>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                      <span class="font-mono-num text-xs text-[#B6FF48]">${f.calories} kcal</span>
                      <button type="button" data-add-food="${idx}" class="fn-btn-secondary px-3 py-2 rounded-lg text-xs min-h-[40px]">Add</button>
                    </div>
                  </div>
                `
                )
                .join('')}
            </div>
          </section>

          <!-- Today's Logged Meals -->
          <section class="lg:col-span-5 fn-surface rounded-2xl p-5 space-y-4">
            <h2 class="font-display text-lg font-semibold">Today's Meal Log (${escapeHtml(data.date)})</h2>
            ${
              data.meals.length === 0
                ? `<p class="text-sm text-[#9AA69B]">No meals logged today. Add items from the Indian food database.</p>`
                : `
                <div class="divide-y divide-white/10">
                  ${data.meals
                    .map(
                      (m) => `
                    <div class="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p class="text-xs font-mono-num text-[#B6FF48]">${escapeHtml(m.meal_slot.toUpperCase())}</p>
                        <p class="text-sm font-medium text-white">${escapeHtml(m.food_name)}</p>
                        <p class="text-xs font-mono-num text-[#9AA69B]">${m.calories} kcal · P ${m.protein_g}g</p>
                      </div>
                      <button type="button" data-del-meal="${escapeHtml(m.id)}" class="text-xs text-[#FF6262] hover:underline min-h-[40px] px-2">Remove</button>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              `
            }
          </section>
        </div>
      </div>
    `;

    document.getElementById('go-calcs-from-nut')?.addEventListener('click', () => navigate('home', 'calculators'));

    document.getElementById('add-water-btn')?.addEventListener('click', async () => {
      const res = await api<{ waterMl: number }>('/api/nutrition/water', { method: 'POST', body: JSON.stringify({ amount_ml: 250 }) });
      data.waterMl = res.waterMl;
      toast('+250 ml water logged.', 'success');
      draw();
    });

    container.querySelectorAll('[data-diet]').forEach((b) => {
      b.addEventListener('click', () => {
        dietFilter = b.getAttribute('data-diet') as typeof dietFilter;
        draw();
      });
    });

    document.getElementById('meal-slot-select')?.addEventListener('change', (e) => {
      selectedSlot = (e.target as HTMLSelectElement).value as typeof selectedSlot;
    });

    document.getElementById('food-search')?.addEventListener('input', (e) => {
      foodSearch = (e.target as HTMLInputElement).value;
      draw();
      const inp = document.getElementById('food-search') as HTMLInputElement | null;
      if (inp) {
        inp.focus();
        inp.setSelectionRange(foodSearch.length, foodSearch.length);
      }
    });

    container.querySelectorAll('[data-add-food]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const food = foods[Number(btn.getAttribute('data-add-food'))];
        if (!food) return;
        try {
          const res = await api<{ meal: MealLog }>('/api/nutrition/meals', {
            method: 'POST',
            body: JSON.stringify({
              meal_slot: selectedSlot,
              food_name: food.name,
              diet_type: food.dietType,
              servings: 1,
              calories: food.calories,
              protein_g: food.protein,
              carbs_g: food.carbs,
              fat_g: food.fat,
            }),
          });
          data.meals.unshift(res.meal);
          toast(`Added ${food.name} to ${selectedSlot}.`, 'success');
          draw();
        } catch (err) {
          toast((err as ApiError).message, 'error');
        }
      });
    });

    container.querySelectorAll('[data-del-meal]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-del-meal')!;
        await api(`/api/nutrition/meals/${id}`, { method: 'DELETE' });
        data.meals = data.meals.filter((m) => m.id !== id);
        draw();
      });
    });
  }

  draw();
}

export function renderCalculatorsScreen(container: HTMLElement): void {
  const s = getState();
  const user = s.user!;
  const w = user.weight_kg || 70;
  const h = user.height_cm || 172;
  const age = user.age || 26;
  const gender: 'male' | 'female' = user.gender === 'female' ? 'female' : 'male';

  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="font-display text-2xl font-bold">Fitness & Nutrition Calculators</h1>
        <p class="text-sm text-[#9AA69B]">All 9 evidence-based formulas pre-filled from your profile. Informational estimates only, not medical advice.</p>
      </div>

      ${renderAdBanner('calculators', s.adsConfig, user)}

      <div class="fn-surface rounded-2xl p-5 space-y-4">
        <h2 class="font-display text-base font-semibold">Core Anthropometric Inputs</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Weight (kg)</label>
            <input id="c-w" type="number" value="${w}" step="0.5" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Height (cm)</label>
            <input id="c-h" type="number" value="${h}" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Age</label>
            <input id="c-age" type="number" value="${age}" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Gender</label>
            <select id="c-gender" class="fn-input w-full rounded-xl px-3 py-2 text-sm min-h-[44px]">
              <option value="male" ${gender === 'male' ? 'selected' : ''}>Male</option>
              <option value="female" ${gender === 'female' ? 'selected' : ''}>Female</option>
            </select>
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Waist / Neck (cm)</label>
            <div class="flex gap-1">
              <input id="c-waist" type="number" value="84" class="fn-input w-1/2 rounded-xl px-2 py-2 text-sm font-mono-num min-h-[44px]" title="Waist cm" />
              <input id="c-neck" type="number" value="38" class="fn-input w-1/2 rounded-xl px-2 py-2 text-sm font-mono-num min-h-[44px]" title="Neck cm" />
            </div>
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Activity Factor</label>
            <select id="c-act" class="fn-input w-full rounded-xl px-3 py-2 text-sm min-h-[44px]">
              <option value="1.2">1.2 Sedentary</option>
              <option value="1.375">1.375 Light</option>
              <option value="1.55" selected>1.55 Moderate</option>
              <option value="1.725">1.725 Active</option>
              <option value="1.9">1.9 Athlete</option>
            </select>
          </div>
        </div>
      </div>

      <div id="calc-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"></div>

      <!-- 1RM Strength Calculator -->
      <div class="fn-surface rounded-2xl p-5 space-y-3">
        <h2 class="font-display text-base font-semibold">9. One-Rep Max (1RM) Strength Estimator (Epley Formula)</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Lifted Weight (kg)</label>
            <input id="c-1rm-w" type="number" value="60" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Repetitions Completed (1–15)</label>
            <input id="c-1rm-r" type="number" min="1" max="15" value="8" class="fn-input w-full rounded-xl px-3 py-2 text-sm font-mono-num min-h-[44px]" />
          </div>
          <div class="fn-surface-alt rounded-xl p-3">
            <p class="text-xs text-[#9AA69B]">Estimated 1RM</p>
            <p id="c-1rm-out" class="font-mono-num text-xl font-bold text-[#B6FF48]">76 kg</p>
          </div>
        </div>
      </div>
    </div>
  `;

  function recompute() {
    const wt = Number((document.getElementById('c-w') as HTMLInputElement).value) || 70;
    const ht = Number((document.getElementById('c-h') as HTMLInputElement).value) || 172;
    const ag = Number((document.getElementById('c-age') as HTMLInputElement).value) || 26;
    const gd = (document.getElementById('c-gender') as HTMLSelectElement).value as 'male' | 'female';
    const waist = Number((document.getElementById('c-waist') as HTMLInputElement).value) || 84;
    const neck = Number((document.getElementById('c-neck') as HTMLInputElement).value) || 38;
    const act = Number((document.getElementById('c-act') as HTMLSelectElement).value) || 1.55;

    const bmiRes = calcBMI(wt, ht);
    const bmr = calcBMR(wt, ht, ag, gd);
    const tdee = calcTDEE(bmr, act);
    const bf = calcBodyFatNavy(gd, waist, neck, ht);
    const ideal = calcIdealWeight(ht, gd);
    const proteinMin = Math.round(wt * 1.4);
    const proteinMax = Math.round(wt * 2.0);
    const waterMl = Math.round(wt * 38);

    const cards = [
      { title: '1. Daily Calorie Target', val: `${tdee - 350} – ${tdee + 250} kcal`, sub: `Loss: ${tdee - 400} kcal · Gain: ${tdee + 300} kcal` },
      { title: '2. Body Mass Index (BMI)', val: `${bmiRes.bmi} kg/m²`, sub: bmiRes.category },
      { title: '3. Basal Metabolic Rate (BMR)', val: `${bmr} kcal/day`, sub: 'Mifflin-St Jeor resting energy expenditure' },
      { title: '4. Total Daily Energy (TDEE)', val: `${tdee} kcal/day`, sub: `Activity multiplier ×${act}` },
      { title: '5. Body Fat Estimate', val: `${bf}%`, sub: 'US Navy circumference estimation' },
      { title: '6. Ideal Weight Range', val: `${ideal} kg`, sub: 'Devine height-adjusted reference' },
      { title: '7. Daily Protein Intake', val: `${proteinMin}–${proteinMax} g/day`, sub: '1.4–2.0 g/kg for active training' },
      { title: '8. Daily Water Intake', val: `${(waterMl / 1000).toFixed(1)} L/day`, sub: `${waterMl} ml baseline (+500ml per run)` },
    ];

    document.getElementById('calc-grid')!.innerHTML = cards
      .map(
        (c) => `
        <div class="fn-surface rounded-2xl p-5">
          <p class="text-xs text-[#9AA69B]">${escapeHtml(c.title)}</p>
          <p class="font-mono-num text-2xl font-bold text-[#B6FF48] mt-2">${escapeHtml(c.val)}</p>
          <p class="text-xs text-[#9AA69B] mt-1.5">${escapeHtml(c.sub)}</p>
        </div>
      `
      )
      .join('');

    const rmW = Number((document.getElementById('c-1rm-w') as HTMLInputElement).value) || 60;
    const rmR = Number((document.getElementById('c-1rm-r') as HTMLInputElement).value) || 8;
    document.getElementById('c-1rm-out')!.textContent = `${calc1RM(rmW, rmR)} kg`;
  }

  ['c-w', 'c-h', 'c-age', 'c-gender', 'c-waist', 'c-neck', 'c-act', 'c-1rm-w', 'c-1rm-r'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', recompute);
    document.getElementById(id)?.addEventListener('change', recompute);
  });

  recompute();
}
