import { api } from '../lib/api.ts';
import type { AdsConfig, FitnessGoals, UserProfile } from '../lib/types.ts';

export type PrimaryRoute = 'home' | 'workout' | 'running' | 'store' | 'profile';
export type SubRoute =
  | 'dashboard'
  | 'challenge'
  | 'nutrition'
  | 'calculators'
  | 'progress'
  | 'affiliate'
  | 'admin'
  | 'legal';

export interface AppState {
  initialized: boolean;
  user: UserProfile | null;
  goals: FitnessGoals | null;
  adsConfig: AdsConfig | null;
  primaryRoute: PrimaryRoute;
  subRoute: SubRoute;
  authView: 'welcome' | 'login' | 'signup' | 'forgot' | 'onboarding';
  cartCount: number;
}

const state: AppState = {
  initialized: false,
  user: null,
  goals: null,
  adsConfig: null,
  primaryRoute: 'home',
  subRoute: 'dashboard',
  authView: 'welcome',
  cartCount: 0,
};

type Listener = (s: AppState) => void;
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(): void {
  for (const fn of listeners) fn(state);
}

export function navigate(primary: PrimaryRoute, sub: SubRoute = 'dashboard'): void {
  state.primaryRoute = primary;
  state.subRoute = sub;
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  notify();
}

export function setAuthView(view: AppState['authView']): void {
  state.authView = view;
  notify();
}

export async function bootstrapSession(): Promise<void> {
  try {
    const [me, settings] = await Promise.all([
      api<{ user: UserProfile | null; goals: FitnessGoals | null }>('/api/auth/me'),
      api<{ adsConfig: AdsConfig }>('/api/public/settings'),
    ]);
    state.user = me.user;
    state.goals = me.goals;
    state.adsConfig = settings.adsConfig;

    if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
      state.subRoute = 'admin';
    }

    if (state.user) {
      await refreshCartCount();
    }
  } catch {
    state.user = null;
  } finally {
    state.initialized = true;
    notify();
  }
}

export async function refreshCartCount(): Promise<void> {
  if (!state.user) {
    state.cartCount = 0;
    return;
  }
  try {
    const res = await api<{ cart: Array<{ quantity: number }> }>('/api/store/cart');
    state.cartCount = res.cart.reduce((acc, item) => acc + item.quantity, 0);
  } catch {
    state.cartCount = 0;
  }
}
