import { api, ApiError } from '../lib/api.ts';
import { getOfflineRuns, isValidNextPoint, saveOfflineRun, syncOfflineRuns } from '../lib/offlineRuns.ts';
import type { GpsPoint, RunningSession } from '../lib/types.ts';
import { escapeHtml, formatDuration, formatPace, toast } from '../ui/components.ts';
import { icon } from '../ui/icons.ts';

let watchId: number | null = null;
let timerId: number | null = null;

export async function renderRunningScreen(container: HTMLElement): Promise<void> {
  if (watchId !== null && 'geolocation' in navigator) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }

  container.innerHTML = `<div class="fn-surface rounded-2xl p-6 text-sm text-[#9AA69B]">Loading GPS running dashboard...</div>`;

  let runs: RunningSession[] = [];
  let stats: Record<string, number> = { total_runs: 0, verified_meters: 0, longest_run_meters: 0, total_seconds: 0 };
  try {
    const res = await api<{ runs: RunningSession[]; stats: Record<string, number> }>('/api/runs');
    runs = res.runs;
    stats = res.stats;
  } catch {
    toast('Loaded offline running queue.', 'info');
  }

  const offlineQueue = getOfflineRuns();

  // Compute weekly & monthly distance from real verified runs
  const now = Date.now();
  const weekMs = 7 * 86400 * 1000;
  const monthMs = 30 * 86400 * 1000;
  let weeklyKm = 0;
  let monthlyKm = 0;
  for (const r of runs) {
    if (r.verification_status !== 'verified') continue;
    const age = now - new Date(r.started_at).getTime();
    if (age <= weekMs) weeklyKm += r.distance_meters / 1000;
    if (age <= monthMs) monthlyKm += r.distance_meters / 1000;
  }

  // Live GPS state
  let trackingState: 'idle' | 'running' | 'paused' = 'idle';
  let elapsedSec = 0;
  let distanceMeters = 0;
  let rejectedCount = 0;
  let points: GpsPoint[] = [];
  let lastValidPoint: GpsPoint | null = null;
  let startedAtIso = '';
  let gpsStatusText = 'Geolocation ready. Grant "While using app" / foreground location permission to track outdoor runs.';

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="font-display text-2xl font-bold">GPS Running Tracker</h1>
          <p class="text-sm text-[#9AA69B]">Foreground GPS telemetry with accuracy filtering, speed-spike protection, and offline sync.</p>
        </div>
        ${
          offlineQueue.length > 0
            ? `<button type="button" id="sync-offline-btn" class="fn-btn-primary px-4 py-2.5 rounded-xl text-xs min-h-[44px]">Sync ${offlineQueue.length} Offline Run(s)</button>`
            : ''
        }
      </div>

      <!-- Live Tracker Panel (Zero Ads) -->
      <section class="fn-surface rounded-3xl p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-xs font-mono-num text-[#B6FF48]">FOREGROUND GPS SESSION</p>
            <p id="gps-status-msg" class="text-xs text-[#9AA69B] mt-1">${escapeHtml(gpsStatusText)}</p>
          </div>
          <span id="gps-accuracy-readout" class="text-xs font-mono-num text-[#9AA69B]">Accuracy: --</span>
        </div>

        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="fn-surface-alt rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Verified Distance</p>
            <p id="live-dist" class="font-mono-num text-2xl font-bold text-white mt-1">0.00 km</p>
          </div>
          <div class="fn-surface-alt rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Duration</p>
            <p id="live-time" class="font-mono-num text-2xl font-bold text-white mt-1">00:00</p>
          </div>
          <div class="fn-surface-alt rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Average Pace</p>
            <p id="live-pace" class="font-mono-num text-2xl font-bold text-[#B6FF48] mt-1">--:--</p>
          </div>
          <div class="fn-surface-alt rounded-2xl p-4">
            <p class="text-xs text-[#9AA69B]">Speed / Filtered</p>
            <p id="live-speed" class="font-mono-num text-lg font-bold text-white mt-1">0.0 km/h · 0 rej</p>
          </div>
        </div>

        <!-- Live SVG Route Map Canvas -->
        <div class="bg-[#101411] border border-white/10 rounded-2xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-[#9AA69B]">Live Route Map</span>
            <span id="live-pts-count" class="text-xs font-mono-num text-[#9AA69B]">0 valid GPS points</span>
          </div>
          <svg id="live-route-svg" viewBox="0 0 400 140" class="w-full h-36 rounded-xl bg-[#131814]">
            <text x="200" y="74" text-anchor="middle" fill="#6B766C" font-size="11" font-family="JetBrains Mono">Press Start GPS Run outdoors to record coordinates</text>
          </svg>
        </div>

        <div class="flex flex-wrap gap-3">
          <button type="button" id="run-start-btn" class="fn-btn-primary w-full sm:w-auto justify-center px-6 py-3.5 rounded-xl text-sm min-h-[48px] flex items-center gap-2">
            ${icon('play', 'w-4 h-4')}
            <span>Start GPS Run</span>
          </button>
          <button type="button" id="run-pause-btn" disabled class="fn-btn-secondary flex-1 sm:flex-initial px-5 py-3.5 rounded-xl text-sm min-h-[48px] disabled:opacity-40">Pause</button>
          <button type="button" id="run-stop-btn" disabled class="fn-btn-secondary flex-1 sm:flex-initial px-5 py-3.5 rounded-xl text-sm min-h-[48px] disabled:opacity-40">Stop & Verify Run</button>
        </div>
      </section>

      <!-- Weekly, Monthly & PR Statistics -->
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="fn-surface rounded-2xl p-4">
          <p class="text-xs text-[#9AA69B]">Weekly Verified</p>
          <p class="font-mono-num text-2xl font-bold text-white mt-1">${weeklyKm.toFixed(2)} km</p>
        </div>
        <div class="fn-surface rounded-2xl p-4">
          <p class="text-xs text-[#9AA69B]">Monthly Verified</p>
          <p class="font-mono-num text-2xl font-bold text-white mt-1">${monthlyKm.toFixed(2)} km</p>
        </div>
        <div class="fn-surface rounded-2xl p-4">
          <p class="text-xs text-[#9AA69B]">Longest Verified Run</p>
          <p class="font-mono-num text-2xl font-bold text-[#B6FF48] mt-1">${(stats.longest_run_meters / 1000).toFixed(2)} km</p>
        </div>
        <div class="fn-surface rounded-2xl p-4">
          <p class="text-xs text-[#9AA69B]">Total Logged Runs</p>
          <p class="font-mono-num text-2xl font-bold text-white mt-1">${stats.total_runs}</p>
        </div>
      </section>

      <!-- Running History -->
      <section>
        <h2 class="font-display text-lg font-semibold mb-3">Running History & Verification Status</h2>
        <div class="fn-surface rounded-2xl divide-y divide-white/10">
          ${
            runs.length === 0
              ? `<div class="p-6 text-sm text-[#9AA69B]">No running sessions logged yet. Start an outdoor GPS run above to record verified distance.</div>`
              : runs
                  .map(
                    (r) => `
                  <div class="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p class="text-xs font-mono-num ${
                        r.verification_status === 'verified' ? 'text-[#B6FF48]' : r.verification_status === 'flagged' ? 'text-amber-400' : 'text-[#FF6262]'
                      }">${escapeHtml(r.verification_status.toUpperCase())} · ${new Date(r.started_at).toLocaleString('en-IN')}</p>
                      <p class="text-sm font-semibold text-white mt-0.5">${(r.distance_meters / 1000).toFixed(2)} km · ${formatDuration(r.duration_seconds)} · ${formatPace(r.avg_pace_sec_per_km)}</p>
                      <p class="text-xs text-[#9AA69B] mt-0.5">${escapeHtml(r.verification_notes || '')}</p>
                    </div>
                    <div class="text-left sm:text-right font-mono-num text-xs text-[#9AA69B]">
                      <p>${r.avg_speed_kmh} km/h · ${r.calories_burned} kcal</p>
                      <p>${r.rejected_points_count} pts filtered</p>
                    </div>
                  </div>
                `
                  )
                  .join('')
          }
        </div>
      </section>
    </div>
  `;

  function updateReadouts() {
    const distKm = distanceMeters / 1000;
    const speedKmh = elapsedSec > 0 ? (distKm / elapsedSec) * 3600 : 0;
    const paceSec = distKm > 0.01 ? elapsedSec / distKm : 0;
    const distEl = document.getElementById('live-dist');
    const timeEl = document.getElementById('live-time');
    const paceEl = document.getElementById('live-pace');
    const speedEl = document.getElementById('live-speed');
    const ptsEl = document.getElementById('live-pts-count');
    if (distEl) distEl.textContent = `${distKm.toFixed(2)} km`;
    if (timeEl) timeEl.textContent = formatDuration(elapsedSec);
    if (paceEl) paceEl.textContent = formatPace(paceSec);
    if (speedEl) speedEl.textContent = `${speedKmh.toFixed(1)} km/h · ${rejectedCount} rej`;
    if (ptsEl) ptsEl.textContent = `${points.length} valid GPS points`;
    renderRouteSvg(points);
  }

  function startWatch() {
    if (!('geolocation' in navigator)) {
      gpsStatusText = 'Geolocation is unsupported in this browser.';
      document.getElementById('gps-status-msg')!.textContent = gpsStatusText;
      return;
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const pt: GpsPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 25,
          timestamp: pos.timestamp || Date.now(),
        };
        const accEl = document.getElementById('gps-accuracy-readout');
        if (accEl) accEl.textContent = `Accuracy: ±${Math.round(pt.accuracy)}m`;

        if (trackingState !== 'running') return;
        const check = isValidNextPoint(lastValidPoint, pt);
        if (!check.ok) {
          rejectedCount++;
          document.getElementById('gps-status-msg')!.textContent = check.reason || 'Point filtered';
        } else {
          distanceMeters += check.deltaMeters;
          points.push(pt);
          lastValidPoint = pt;
          document.getElementById('gps-status-msg')!.textContent = 'GPS lock active. Recording verified coordinates.';
        }
        updateReadouts();
      },
      (err) => {
        const msg =
          err.code === 1
            ? 'Location permission denied. Enable GPS permission in browser/Android settings.'
            : 'Waiting for clear outdoor GPS satellite signal...';
        document.getElementById('gps-status-msg')!.textContent = msg;
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  }

  const startBtn = document.getElementById('run-start-btn') as HTMLButtonElement;
  const pauseBtn = document.getElementById('run-pause-btn') as HTMLButtonElement;
  const stopBtn = document.getElementById('run-stop-btn') as HTMLButtonElement;

  startBtn.addEventListener('click', () => {
    if (trackingState === 'idle') {
      elapsedSec = 0;
      distanceMeters = 0;
      rejectedCount = 0;
      points = [];
      lastValidPoint = null;
      startedAtIso = new Date().toISOString();
      trackingState = 'running';
      startBtn.disabled = true;
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      startWatch();
      timerId = window.setInterval(() => {
        if (trackingState === 'running') {
          elapsedSec++;
          updateReadouts();
        }
      }, 1000);
    }
  });

  pauseBtn.addEventListener('click', () => {
    if (trackingState === 'running') {
      trackingState = 'paused';
      pauseBtn.textContent = 'Resume';
    } else if (trackingState === 'paused') {
      trackingState = 'running';
      pauseBtn.textContent = 'Pause';
    }
  });

  stopBtn.addEventListener('click', async () => {
    if (watchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    trackingState = 'idle';
    stopBtn.disabled = true;
    pauseBtn.disabled = true;
    stopBtn.textContent = 'Verifying...';

    try {
      const res = await api<{ run: RunningSession }>('/api/runs', {
        method: 'POST',
        body: JSON.stringify({
          route_points: points,
          duration_seconds: Math.max(1, elapsedSec),
          started_at: startedAtIso,
          synced_from_offline: false,
        }),
      });
      toast(`Run saved (${res.run.verification_status}): ${(res.run.distance_meters / 1000).toFixed(2)} km`, res.run.verification_status === 'verified' ? 'success' : 'info');
      renderRunningScreen(container);
    } catch (err) {
      if (!navigator.onLine || (err as ApiError).status >= 500) {
        saveOfflineRun({
          id: crypto.randomUUID(),
          route_points: points,
          duration_seconds: Math.max(1, elapsedSec),
          started_at: startedAtIso,
          distance_preview_m: distanceMeters,
        });
        toast('Offline: Run saved locally and queued for Supabase/server sync.', 'info');
        renderRunningScreen(container);
      } else {
        toast((err as ApiError).message, 'error');
        renderRunningScreen(container);
      }
    }
  });

  document.getElementById('sync-offline-btn')?.addEventListener('click', async () => {
    const synced = await syncOfflineRuns();
    toast(`Synced ${synced} offline running session(s).`, 'success');
    renderRunningScreen(container);
  });
}

function renderRouteSvg(points: GpsPoint[]): void {
  const svg = document.getElementById('live-route-svg');
  if (!svg || points.length < 2) return;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.0002, maxLat - minLat);
  const lngSpan = Math.max(0.0002, maxLng - minLng);

  const coords = points
    .map((p) => {
      const x = 24 + ((p.lng - minLng) / lngSpan) * 352;
      const y = 120 - ((p.lat - minLat) / latSpan) * 100;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  svg.innerHTML = `<polyline fill="none" stroke="#B6FF48" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${coords}" />`;
}
