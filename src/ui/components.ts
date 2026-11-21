import type { AdsConfig, UserProfile } from '../lib/types.ts';

export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0 || !Number.isFinite(secPerKm)) return '--:--';
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.round(secPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')} /km`;
}

export function toast(message: string, variant: 'success' | 'error' | 'info' = 'info'): void {
  let host = document.getElementById('fitnova-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'fitnova-toast-host';
    host.className = 'fixed top-4 right-4 z-[90] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none';
    document.body.appendChild(host);
  }
  const item = document.createElement('div');
  const borderClass =
    variant === 'error'
      ? 'border-[#FF6262]/60 text-[#FF6262]'
      : variant === 'success'
        ? 'border-[#B6FF48]/50 text-[#B6FF48]'
        : 'border-white/15 text-white';

  item.className = `pointer-events-auto bg-[#1A211C] border ${borderClass} rounded-xl px-4 py-3 text-sm font-medium shadow-xl transition-opacity duration-200`;
  item.textContent = message;
  host.appendChild(item);

  setTimeout(() => {
    item.style.opacity = '0';
    setTimeout(() => item.remove(), 220);
  }, 3400);
}

/**
 * Renders a minimal, clearly-labeled AdMob banner slot strictly in permitted placements.
 * Never rendered during active running, active workout sessions, payment screens, or challenge logs.
 */
export function renderAdBanner(
  placement: 'home' | 'workout_library' | 'calculators',
  adsConfig: AdsConfig | null,
  user: UserProfile | null
): string {
  if (user?.ad_free_member) return '';
  if (!adsConfig || !adsConfig.admob_enabled) return '';
  if (placement === 'home' && !adsConfig.banner_home) return '';
  if (placement === 'workout_library' && !adsConfig.banner_workout_library) return '';
  if (placement === 'calculators' && !adsConfig.banner_calculators) return '';

  return `
    <aside class="fn-surface rounded-xl px-4 py-3 flex items-center justify-between gap-4 my-4" aria-label="Advertisement">
      <div class="min-w-0">
        <p class="text-[11px] font-mono-num text-[#9AA69B]">Sponsored · Google AdMob Banner (${escapeHtml(adsConfig.admob_unit_id)})</p>
        <p class="text-sm text-white font-medium truncate mt-0.5">Hydrate smarter on long runs — explore FITNOVA insulated steel gear & partner offers</p>
      </div>
      <button type="button" data-nav-store="affiliate" class="fn-btn-secondary text-xs px-3 py-2 rounded-lg whitespace-nowrap shrink-0 min-h-[40px]">
        Explore Gear
      </button>
    </aside>
  `;
}

export function renderImageWithFallback(src: string, alt: string, className = 'w-full h-44 object-cover'): string {
  return `
    <div class="relative overflow-hidden bg-[#202A22] ${className}">
      <img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" referrerpolicy="no-referrer" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
      <div style="display:none" class="w-full h-full items-center justify-center p-4 text-center text-xs text-[#9AA69B]">
        <span>${escapeHtml(alt)}</span>
      </div>
    </div>
  `;
}
