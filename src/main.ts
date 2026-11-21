import './index.css';
import { bootstrapSession, getState, navigate, subscribe, type PrimaryRoute } from './state/store.ts';
import { renderAuthScreen } from './screens/auth.ts';
import { renderHomeScreen } from './screens/home.ts';
import { renderWorkoutScreen } from './screens/workout.ts';
import { renderRunningScreen } from './screens/running.ts';
import { renderChallengeScreen } from './screens/challenge.ts';
import { renderNutritionScreen, renderCalculatorsScreen } from './screens/nutrition.ts';
import { renderStoreScreen } from './screens/store.ts';
import { renderLegalScreen, renderProfileScreen, renderProgressScreen } from './screens/profile.ts';
import { renderAdminScreen } from './screens/admin.ts';
import { icon } from './ui/icons.ts';

const APP_ICON_URL = '/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png';
const rootEl = document.getElementById('app')!;

function renderApp(): void {
  const s = getState();

  if (!s.initialized) {
    rootEl.innerHTML = `
      <div class="min-h-dvh bg-[#101411] flex items-center justify-center">
        <div class="text-center space-y-3">
          <img src="${APP_ICON_URL}" alt="FITNOVA App Icon" class="w-16 h-16 rounded-2xl object-cover bg-black border border-white/15 mx-auto shadow-lg" />
          <p class="font-display text-2xl font-bold tracking-tight text-white">FITNOVA</p>
          <p class="text-xs font-mono-num text-[#B6FF48]">Loading training system...</p>
        </div>
      </div>
    `;
    return;
  }

  // Separate full-screen Admin Panel
  if (s.subRoute === 'admin') {
    renderAdminScreen(rootEl);
    return;
  }

  // Auth / Welcome / Onboarding flow
  if (!s.user || !s.user.onboarding_completed) {
    renderAuthScreen(rootEl);
    return;
  }

  // Main 5-Tab App Shell (Desktop 3-zone Top Bar + Mobile Fixed 5-Item Bottom Nav)
  const navItems: Array<{ id: PrimaryRoute; label: string; iconName: string }> = [
    { id: 'home', label: 'Home', iconName: 'home' },
    { id: 'workout', label: 'Workout', iconName: 'dumbbell' },
    { id: 'running', label: 'Running', iconName: 'footprints' },
    { id: 'store', label: 'Store', iconName: 'bag' },
    { id: 'profile', label: 'Profile', iconName: 'user' },
  ];

  rootEl.innerHTML = `
    <div class="min-h-dvh bg-[#101411] text-white flex flex-col">
      <!-- Desktop & Tablet 3-Zone Top Bar (Compact 48px on mobile) -->
      <header class="sticky top-0 z-30 bg-[#101411]/90 backdrop-blur-md border-b border-white/10">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 h-12 md:h-14 flex items-center justify-between gap-4 md:gap-8">
          <button type="button" id="brand-home-btn" class="flex items-center gap-2.5 font-display text-lg md:text-xl font-bold tracking-wide text-white whitespace-nowrap shrink-0">
            <img src="${APP_ICON_URL}" alt="FITNOVA" class="w-7 h-7 md:w-8 md:h-8 rounded-lg object-cover bg-black border border-white/15 shrink-0" />
            <span>FITNOVA</span>
          </button>

          <nav class="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="Primary navigation">
            ${navItems
              .map(
                (item) => `
                <button type="button" data-nav="${item.id}" class="whitespace-nowrap shrink-0 py-1 transition-colors ${
                  s.primaryRoute === item.id && s.subRoute === 'dashboard'
                    ? 'text-[#B6FF48]'
                    : 'text-[#9AA69B] hover:text-white'
                }">${item.label}${item.id === 'store' && s.cartCount > 0 ? ` (${s.cartCount})` : ''}</button>
              `
              )
              .join('')}
          </nav>

          <div class="shrink-0 flex items-center gap-2">
            <button type="button" id="top-challenge-cta" class="fn-btn-primary px-3.5 py-1.5 md:px-4 md:py-2 rounded-xl text-xs whitespace-nowrap shrink-0 min-h-[36px] md:min-h-[40px]">
              30-Day Challenge
            </button>
          </div>
        </div>
      </header>

      <!-- Active View Container -->
      <main id="main-viewport" class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 md:py-6 pb-20 md:pb-10"></main>

      <!-- Mobile 5-Tab Bottom Navigation (<= 15% viewport height) -->
      <nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#1A211C]/95 backdrop-blur-md border-t border-white/10 pb-safe" aria-label="Mobile bottom navigation">
        <div class="grid grid-cols-5 items-center h-14">
          ${navItems
            .map((item) => {
              const active = s.primaryRoute === item.id;
              return `
                <button type="button" data-nav="${item.id}" class="flex flex-col items-center justify-center min-h-[44px] ${
                  active ? 'text-[#B6FF48]' : 'text-[#9AA69B]'
                }">
                  ${icon(item.iconName, 'w-5 h-5')}
                  <span class="text-[10px] font-medium mt-0.5 whitespace-nowrap">${item.label}${item.id === 'store' && s.cartCount > 0 ? ` (${s.cartCount})` : ''}</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </nav>
    </div>
  `;

  document.getElementById('brand-home-btn')?.addEventListener('click', () => navigate('home', 'dashboard'));
  document.getElementById('top-challenge-cta')?.addEventListener('click', () => navigate('home', 'challenge'));

  rootEl.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav') as PrimaryRoute;
      navigate(target, 'dashboard');
    });
  });

  const mainEl = document.getElementById('main-viewport')!;
  if (s.subRoute === 'challenge') {
    renderChallengeScreen(mainEl);
  } else if (s.subRoute === 'nutrition') {
    renderNutritionScreen(mainEl);
  } else if (s.subRoute === 'calculators') {
    renderCalculatorsScreen(mainEl);
  } else if (s.subRoute === 'progress') {
    renderProgressScreen(mainEl);
  } else if (s.subRoute === 'legal') {
    renderLegalScreen(mainEl);
  } else if (s.subRoute === 'affiliate') {
    renderStoreScreen(mainEl, 'affiliate');
  } else if (s.primaryRoute === 'home') {
    renderHomeScreen(mainEl);
  } else if (s.primaryRoute === 'workout') {
    renderWorkoutScreen(mainEl);
  } else if (s.primaryRoute === 'running') {
    renderRunningScreen(mainEl);
  } else if (s.primaryRoute === 'store') {
    renderStoreScreen(mainEl, 'own');
  } else if (s.primaryRoute === 'profile') {
    renderProfileScreen(mainEl);
  }
}

subscribe(renderApp);
renderApp();
bootstrapSession();
