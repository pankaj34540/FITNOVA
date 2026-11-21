import { api, ApiError } from '../lib/api.ts';
import { bootstrapSession, getState, navigate } from '../state/store.ts';
import { escapeHtml, formatINR, toast } from '../ui/components.ts';

type AdminTab = 'overview' | 'users' | 'exercises' | 'verifications' | 'rewards' | 'affiliate' | 'store' | 'settings' | 'audit';

export async function renderAdminScreen(root: HTMLElement): Promise<void> {
  const s = getState();
  const user = s.user;

  if (!user || user.role !== 'admin') {
    root.innerHTML = `
      <div class="min-h-dvh bg-[#101411] flex flex-col justify-center items-center px-4">
        <div class="fn-surface rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-5">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-2 text-xs font-mono-num text-[#B6FF48]">
              <img src="/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png" alt="FITNOVA" class="w-6 h-6 rounded-md object-cover bg-black border border-white/15 shrink-0" />
              <span>FITNOVA ADMIN CONSOLE</span>
            </span>
            <button type="button" id="adm-exit-app" class="text-xs text-[#9AA69B] hover:text-white min-h-[36px]">Return to App</button>
          </div>
          <h1 class="font-display text-2xl font-bold">Server-Verified Admin Login</h1>
          <p class="text-xs text-[#9AA69B]">Access requires an account with server-enforced <code class="text-white">role = 'admin'</code> in the database.</p>
          <form id="admin-login-form" class="space-y-3">
            <input id="adm-email" type="email" required value="admin@fitnova.in" placeholder="Admin email" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
            <input id="adm-pass" type="password" required placeholder="Admin password" class="fn-input w-full rounded-xl px-4 py-3 text-sm min-h-[44px]" />
            <button type="submit" class="fn-btn-primary w-full py-3 rounded-xl text-sm min-h-[48px]">Sign In to Admin Panel</button>
          </form>
        </div>
      </div>
    `;
    document.getElementById('adm-exit-app')?.addEventListener('click', () => {
      window.location.hash = '';
      navigate('home');
    });
    document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: (document.getElementById('adm-email') as HTMLInputElement).value,
            password: (document.getElementById('adm-pass') as HTMLInputElement).value,
          }),
        });
        await bootstrapSession();
        if (getState().user?.role !== 'admin') {
          toast('This account does not have server admin privileges.', 'error');
          return;
        }
        renderAdminScreen(root);
      } catch (err) {
        toast((err as ApiError).message, 'error');
      }
    });
    return;
  }

  const adminUser = user;
  let tab: AdminTab = 'overview';

  async function draw() {
    root.innerHTML = `
      <div class="min-h-dvh bg-[#101411] flex flex-col lg:flex-row">
        <aside class="w-full lg:w-64 bg-[#1A211C] border-b lg:border-b-0 lg:border-r border-white/10 p-5 flex flex-col justify-between shrink-0">
          <div>
            <div class="flex items-center justify-between mb-6">
              <span class="flex items-center gap-2.5 font-display text-lg font-bold text-white whitespace-nowrap">
                <img src="/assets/aistudio/Muscular_Barbell_Emblem_with_Orbiting_Flare_22c19e00.png" alt="FITNOVA" class="w-7 h-7 rounded-lg object-cover bg-black border border-white/15 shrink-0" />
                <span>FITNOVA Admin</span>
              </span>
              <button type="button" id="adm-back-user" class="text-xs text-[#B6FF48] hover:underline">App View</button>
            </div>
            <nav class="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
              ${(
                [
                  ['overview', 'Dashboard Overview'],
                  ['users', 'Users'],
                  ['exercises', 'Exercises'],
                  ['verifications', 'Challenge Verification'],
                  ['rewards', 'Refunds & T-Shirts'],
                  ['affiliate', 'Affiliate Products'],
                  ['store', 'E-Commerce & Orders'],
                  ['settings', 'AdMob & Settings'],
                  ['audit', 'Admin Audit Logs'],
                ] as Array<[AdminTab, string]>
              )
                .map(
                  ([key, label]) => `
                  <button type="button" data-atab="${key}" class="px-3 py-2.5 rounded-xl text-xs font-medium text-left whitespace-nowrap min-h-[40px] ${
                    tab === key ? 'bg-[#B6FF48] text-[#101411] font-semibold' : 'text-[#9AA69B] hover:text-white hover:bg-[#202A22]'
                  }">${label}</button>
                `
                )
                .join('')}
            </nav>
          </div>
          <p class="hidden lg:block text-xs text-[#9AA69B] pt-4 border-t border-white/10 truncate">${escapeHtml(adminUser.email)}</p>
        </aside>

        <main id="adm-main" class="flex-1 p-5 lg:p-8 max-w-6xl w-full"></main>
      </div>
    `;

    document.getElementById('adm-back-user')?.addEventListener('click', () => {
      window.location.hash = '';
      navigate('home');
    });

    root.querySelectorAll('[data-atab]').forEach((b) => {
      b.addEventListener('click', () => {
        tab = b.getAttribute('data-atab') as AdminTab;
        draw();
      });
    });

    const main = document.getElementById('adm-main')!;
    main.innerHTML = `<div class="fn-surface rounded-2xl p-6 text-sm text-[#9AA69B]">Loading module...</div>`;

    if (tab === 'overview') {
      const { metrics } = await api<{ metrics: Record<string, number> }>('/api/admin/overview');
      main.innerHTML = `
        <div class="space-y-6">
          <h1 class="font-display text-2xl font-bold">Operations Dashboard</h1>
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="fn-surface rounded-2xl p-4"><p class="text-xs text-[#9AA69B]">Total Users</p><p class="font-mono-num text-2xl font-bold mt-1">${metrics.totalUsers}</p></div>
            <div class="fn-surface rounded-2xl p-4"><p class="text-xs text-[#9AA69B]">Active Users</p><p class="font-mono-num text-2xl font-bold text-[#B6FF48] mt-1">${metrics.activeUsers}</p></div>
            <div class="fn-surface rounded-2xl p-4"><p class="text-xs text-[#9AA69B]">Workout Sessions</p><p class="font-mono-num text-2xl font-bold mt-1">${metrics.workoutSessions}</p></div>
            <div class="fn-surface rounded-2xl p-4"><p class="text-xs text-[#9AA69B]">GPS Running Sessions</p><p class="font-mono-num text-2xl font-bold mt-1">${metrics.runningSessions}</p></div>
            <div class="fn-surface rounded-2xl p-4"><p class="text-xs text-[#9AA69B]">Challenge Registrations</p><p class="font-mono-num text-2xl font-bold mt-1">${metrics.challengeRegistrations}</p></div>
            <div class="fn-surface rounded-2xl p-4"><p class="text-xs text-[#9AA69B]">Challenge Revenue</p><p class="font-mono-num text-2xl font-bold text-[#B6FF48] mt-1">${formatINR(metrics.challengeRevenueInr)}</p></div>
            <div class="fn-surface rounded-2xl p-4"><p class="text-xs text-[#9AA69B]">Store Revenue</p><p class="font-mono-num text-2xl font-bold text-[#B6FF48] mt-1">${formatINR(metrics.storeRevenueInr)}</p></div>
            <div class="fn-surface rounded-2xl p-4"><p class="text-xs text-[#9AA69B]">Affiliate Clicks</p><p class="font-mono-num text-2xl font-bold mt-1">${metrics.affiliateClicks}</p></div>
          </div>
        </div>
      `;
    } else if (tab === 'users') {
      const { users } = await api<{ users: Array<{ id: string; email: string; full_name: string; role: string; account_status: string; fitness_goal: string }> }>('/api/admin/users');
      main.innerHTML = `
        <div class="space-y-4">
          <h1 class="font-display text-2xl font-bold">User Management</h1>
          <div class="fn-surface rounded-2xl overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="text-xs text-[#9AA69B] border-b border-white/10">
                <tr><th class="text-left p-4">Name</th><th class="text-left p-4">Email</th><th class="text-left p-4">Role</th><th class="text-left p-4">Status</th><th class="text-right p-4">Action</th></tr>
              </thead>
              <tbody class="divide-y divide-white/10">
                ${users
                  .map(
                    (u) => `
                  <tr>
                    <td class="p-4 text-white font-medium">${escapeHtml(u.full_name)}</td>
                    <td class="p-4 text-[#9AA69B] font-mono-num text-xs">${escapeHtml(u.email)}</td>
                    <td class="p-4 text-xs font-mono-num">${escapeHtml(u.role)}</td>
                    <td class="p-4 text-xs ${u.account_status === 'active' ? 'text-[#B6FF48]' : 'text-[#FF6262]'}">${escapeHtml(u.account_status)}</td>
                    <td class="p-4 text-right">
                      ${
                        u.role !== 'admin'
                          ? `<button type="button" data-toggle-user="${escapeHtml(u.id)}" data-next="${u.account_status === 'active' ? 'suspended' : 'active'}" class="fn-btn-secondary px-3 py-1.5 rounded-lg text-xs">${u.account_status === 'active' ? 'Suspend' : 'Reactivate'}</button>`
                          : '—'
                      }
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      main.querySelectorAll('[data-toggle-user]').forEach((b) => {
        b.addEventListener('click', async () => {
          await api(`/api/admin/users/${b.getAttribute('data-toggle-user')}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ account_status: b.getAttribute('data-next') }),
          });
          toast('User status updated.', 'success');
          draw();
        });
      });
    } else if (tab === 'exercises') {
      const { exercises } = await api<{ exercises: Array<{ id: string; name: string; category: string; difficulty: string; equipment: string }> }>('/api/exercises');
      main.innerHTML = `
        <div class="space-y-6">
          <h1 class="font-display text-2xl font-bold">Exercise Library Management</h1>
          <form id="adm-add-ex" class="fn-surface rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input id="ae-name" type="text" required placeholder="Exercise Name" class="fn-input rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            <select id="ae-cat" class="fn-input rounded-xl px-3 py-2 text-sm min-h-[44px]">
              ${['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Full Body', 'Cardio', 'HIIT', 'Yoga', 'Stretching'].map((c) => `<option>${c}</option>`).join('')}
            </select>
            <select id="ae-diff" class="fn-input rounded-xl px-3 py-2 text-sm min-h-[44px]">
              <option value="beginner">beginner</option><option value="intermediate">intermediate</option><option value="advanced">advanced</option>
            </select>
            <input id="ae-equip" type="text" required placeholder="Equipment (e.g. Dumbbells)" class="fn-input rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            <input id="ae-inst" type="text" required placeholder="Form instructions" class="fn-input sm:col-span-2 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            <button type="submit" class="fn-btn-primary sm:col-span-3 py-2.5 rounded-xl text-sm min-h-[44px]">Add Exercise</button>
          </form>
          <div class="fn-surface rounded-2xl divide-y divide-white/10">
            ${exercises
              .map(
                (ex) => `
                <div class="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-semibold text-white">${escapeHtml(ex.name)}</p>
                    <p class="text-xs text-[#9AA69B]">${escapeHtml(ex.category)} · ${escapeHtml(ex.difficulty)} · ${escapeHtml(ex.equipment)}</p>
                  </div>
                  <button type="button" data-del-ex="${escapeHtml(ex.id)}" class="text-xs text-[#FF6262] hover:underline">Delete</button>
                </div>`
              )
              .join('')}
          </div>
        </div>
      `;
      document.getElementById('adm-add-ex')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await api('/api/admin/exercises', {
          method: 'POST',
          body: JSON.stringify({
            name: (document.getElementById('ae-name') as HTMLInputElement).value,
            category: (document.getElementById('ae-cat') as HTMLSelectElement).value,
            difficulty: (document.getElementById('ae-diff') as HTMLSelectElement).value,
            equipment: (document.getElementById('ae-equip') as HTMLInputElement).value,
            instructions: (document.getElementById('ae-inst') as HTMLInputElement).value,
          }),
        });
        toast('Exercise created.', 'success');
        draw();
      });
      main.querySelectorAll('[data-del-ex]').forEach((b) => {
        b.addEventListener('click', async () => {
          await api(`/api/admin/exercises/${b.getAttribute('data-del-ex')}`, { method: 'DELETE' });
          draw();
        });
      });
    } else if (tab === 'verifications') {
      const { logs } = await api<{ logs: Array<{ id: string; full_name: string; challenge_title: string; day_number: number; run_distance_km: number; workout_minutes: number; verification_status: string }> }>('/api/admin/verifications');
      main.innerHTML = `
        <div class="space-y-4">
          <h1 class="font-display text-2xl font-bold">Challenge Daily Activity Verification</h1>
          <div class="fn-surface rounded-2xl divide-y divide-white/10">
            ${
              logs.length === 0
                ? `<div class="p-6 text-sm text-[#9AA69B]">No daily challenge logs submitted yet.</div>`
                : logs
                    .map(
                      (l) => `
                  <div class="p-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p class="text-sm font-semibold text-white">${escapeHtml(l.full_name)} · Day ${l.day_number}</p>
                      <p class="text-xs text-[#9AA69B]">${escapeHtml(l.challenge_title)} · Run: ${l.run_distance_km} km · Workout: ${l.workout_minutes} min</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-mono-num text-[#B6FF48] mr-2">${escapeHtml(l.verification_status)}</span>
                      <button type="button" data-ver="${escapeHtml(l.id)}" data-st="verified" class="fn-btn-primary px-3 py-1.5 rounded-lg text-xs">Approve</button>
                      <button type="button" data-ver="${escapeHtml(l.id)}" data-st="rejected" class="fn-btn-secondary px-3 py-1.5 rounded-lg text-xs text-[#FF6262]">Reject</button>
                    </div>
                  </div>`
                    )
                    .join('')
            }
          </div>
        </div>
      `;
      main.querySelectorAll('[data-ver]').forEach((b) => {
        b.addEventListener('click', async () => {
          await api(`/api/admin/verifications/${b.getAttribute('data-ver')}`, {
            method: 'POST',
            body: JSON.stringify({ status: b.getAttribute('data-st') }),
          });
          toast('Verification status updated.', 'success');
          draw();
        });
      });
    } else if (tab === 'rewards') {
      const { rewards, refunds } = await api<{
        rewards: Array<{ member_id: string; full_name: string; tshirt_size: string; shipping_address: string; dispatch_status: string; tracking_number: string | null }>;
        refunds: Array<{ id: string; full_name: string; amount_inr: number; reason: string; status: string; gateway_refund_id: string | null }>;
      }>('/api/admin/rewards');
      main.innerHTML = `
        <div class="space-y-6">
          <h1 class="font-display text-2xl font-bold">Refunds & T-Shirt Dispatch</h1>
          <section class="fn-surface rounded-2xl p-5 space-y-3">
            <h2 class="font-display text-base font-semibold">Refund Requests</h2>
            ${
              refunds.length === 0
                ? `<p class="text-xs text-[#9AA69B]">No refund requests.</p>`
                : refunds
                    .map(
                      (r) => `
                  <div class="py-3 border-t border-white/10 flex items-center justify-between gap-4">
                    <div>
                      <p class="text-sm font-semibold text-white">${escapeHtml(r.full_name)} · ${formatINR(r.amount_inr)}</p>
                      <p class="text-xs text-[#9AA69B]">${escapeHtml(r.reason)} · Status: ${escapeHtml(r.status)}</p>
                    </div>
                    ${
                      r.status === 'pending'
                        ? `<div class="flex gap-2">
                            <button type="button" data-rf="${escapeHtml(r.id)}" data-st="processed" class="fn-btn-primary px-3 py-1.5 rounded-lg text-xs">Process Refund</button>
                            <button type="button" data-rf="${escapeHtml(r.id)}" data-st="rejected" class="fn-btn-secondary px-3 py-1.5 rounded-lg text-xs text-[#FF6262]">Reject</button>
                           </div>`
                        : `<span class="text-xs font-mono-num text-[#B6FF48]">${escapeHtml(r.gateway_refund_id || r.status)}</span>`
                    }
                  </div>`
                    )
                    .join('')
            }
          </section>
          <section class="fn-surface rounded-2xl p-5 space-y-3">
            <h2 class="font-display text-base font-semibold">T-Shirt Dispatch Queue</h2>
            ${
              rewards.length === 0
                ? `<p class="text-xs text-[#9AA69B]">No T-shirt reward claims yet.</p>`
                : rewards
                    .map(
                      (rw) => `
                  <div class="py-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-white">${escapeHtml(rw.full_name)} · Size ${escapeHtml(rw.tshirt_size)}</p>
                      <p class="text-xs text-[#9AA69B]">${escapeHtml(rw.shipping_address)} · ${escapeHtml(rw.dispatch_status)}</p>
                    </div>
                    <button type="button" data-disp="${escapeHtml(rw.member_id)}" class="fn-btn-secondary px-3 py-1.5 rounded-lg text-xs">Mark Dispatched</button>
                  </div>`
                    )
                    .join('')
            }
          </section>
        </div>
      `;
      main.querySelectorAll('[data-rf]').forEach((b) => {
        b.addEventListener('click', async () => {
          await api(`/api/admin/refunds/${b.getAttribute('data-rf')}/process`, {
            method: 'POST',
            body: JSON.stringify({ status: b.getAttribute('data-st') }),
          });
          toast('Refund updated.', 'success');
          draw();
        });
      });
      main.querySelectorAll('[data-disp]').forEach((b) => {
        b.addEventListener('click', async () => {
          await api(`/api/admin/rewards/${b.getAttribute('data-disp')}/dispatch`, {
            method: 'POST',
            body: JSON.stringify({ dispatch_status: 'dispatched', tracking_number: `DLV${Date.now().toString().slice(-6)}`, courier_name: 'Delhivery' }),
          });
          toast('T-shirt marked dispatched.', 'success');
          draw();
        });
      });
    } else if (tab === 'affiliate') {
      const { products } = await api<{ products: Array<{ id: string; title: string; category: string; merchant_name: string; displayed_price_inr: number; click_count: number }> }>('/api/admin/affiliate');
      main.innerHTML = `
        <div class="space-y-6">
          <h1 class="font-display text-2xl font-bold">Affiliate Products & Click Reports</h1>
          <form id="adm-add-aff" class="fn-surface rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input id="aa-title" type="text" required placeholder="Product Title" class="fn-input rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            <input id="aa-merch" type="text" required placeholder="Merchant (e.g. Amazon India)" class="fn-input rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            <input id="aa-price" type="number" required placeholder="Price INR" class="fn-input rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            <input id="aa-url" type="url" required placeholder="Affiliate URL" class="fn-input sm:col-span-2 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
            <button type="submit" class="fn-btn-primary rounded-xl text-sm min-h-[44px]">Add Affiliate Item</button>
          </form>
          <div class="fn-surface rounded-2xl divide-y divide-white/10">
            ${products
              .map(
                (p) => `
              <div class="p-4 flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-white">${escapeHtml(p.title)}</p>
                  <p class="text-xs text-[#9AA69B]">${escapeHtml(p.category)} · ${escapeHtml(p.merchant_name)} · ${formatINR(p.displayed_price_inr)}</p>
                </div>
                <div class="flex items-center gap-4">
                  <span class="font-mono-num text-xs text-[#B6FF48]">${p.click_count} clicks</span>
                  <button type="button" data-del-aff="${escapeHtml(p.id)}" class="text-xs text-[#FF6262] hover:underline">Remove</button>
                </div>
              </div>`
              )
              .join('')}
          </div>
        </div>
      `;
      document.getElementById('adm-add-aff')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await api('/api/admin/affiliate', {
          method: 'POST',
          body: JSON.stringify({
            title: (document.getElementById('aa-title') as HTMLInputElement).value,
            merchant_name: (document.getElementById('aa-merch') as HTMLInputElement).value,
            displayed_price_inr: Number((document.getElementById('aa-price') as HTMLInputElement).value),
            affiliate_url: (document.getElementById('aa-url') as HTMLInputElement).value,
          }),
        });
        toast('Affiliate product added.', 'success');
        draw();
      });
      main.querySelectorAll('[data-del-aff]').forEach((b) => {
        b.addEventListener('click', async () => {
          await api(`/api/admin/affiliate/${b.getAttribute('data-del-aff')}`, { method: 'DELETE' });
          draw();
        });
      });
    } else if (tab === 'store') {
      const { products, orders } = await api<{
        products: Array<{ id: string; name: string; sku: string; price_inr: number; stock_quantity: number }>;
        orders: Array<{ id: string; full_name: string; total_inr: number; order_status: string; payment_status: string }>;
      }>('/api/admin/store');
      main.innerHTML = `
        <div class="space-y-6">
          <h1 class="font-display text-2xl font-bold">Own Store Inventory & Orders</h1>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section class="fn-surface rounded-2xl p-5 space-y-3">
              <h2 class="font-display text-base font-semibold">Inventory Management</h2>
              ${products
                .map(
                  (p) => `
                <div class="py-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <p class="text-sm font-medium text-white">${escapeHtml(p.name)}</p>
                    <p class="text-xs font-mono-num text-[#9AA69B]">${escapeHtml(p.sku)} · ${formatINR(p.price_inr)}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <input type="number" id="stk-${escapeHtml(p.id)}" value="${p.stock_quantity}" class="fn-input w-20 rounded-lg px-2 py-1 text-xs font-mono-num min-h-[36px]" />
                    <button type="button" data-save-stk="${escapeHtml(p.id)}" class="fn-btn-secondary px-2.5 py-1.5 rounded-lg text-xs">Save</button>
                  </div>
                </div>`
                )
                .join('')}
            </section>
            <section class="fn-surface rounded-2xl p-5 space-y-3">
              <h2 class="font-display text-base font-semibold">Orders Fulfilment</h2>
              ${
                orders.length === 0
                  ? `<p class="text-xs text-[#9AA69B]">No store orders placed yet.</p>`
                  : orders
                      .map(
                        (o) => `
                  <div class="py-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                    <div>
                      <p class="text-sm font-medium text-white">${escapeHtml(o.full_name)} · ${formatINR(o.total_inr)}</p>
                      <p class="text-xs font-mono-num text-[#9AA69B]">${escapeHtml(o.order_status)} · ${escapeHtml(o.payment_status)}</p>
                    </div>
                    <button type="button" data-ship-ord="${escapeHtml(o.id)}" class="fn-btn-primary px-3 py-1.5 rounded-lg text-xs">Mark Shipped</button>
                  </div>`
                      )
                      .join('')
              }
            </section>
          </div>
        </div>
      `;
      main.querySelectorAll('[data-save-stk]').forEach((b) => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-save-stk')!;
          const qty = Number((document.getElementById(`stk-${id}`) as HTMLInputElement).value);
          await api(`/api/admin/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock_quantity: qty }) });
          toast('Stock updated.', 'success');
        });
      });
      main.querySelectorAll('[data-ship-ord]').forEach((b) => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-ship-ord')!;
          await api(`/api/admin/orders/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ order_status: 'shipped', tracking_number: `FNORD${Date.now().toString().slice(-6)}` }),
          });
          toast('Order marked shipped.', 'success');
          draw();
        });
      });
    } else if (tab === 'settings') {
      const { adsConfig } = await api<{ adsConfig: Record<string, unknown> }>('/api/public/settings');
      main.innerHTML = `
        <div class="space-y-6 max-w-xl">
          <h1 class="font-display text-2xl font-bold">Advertisement & App Settings</h1>
          <form id="adm-settings-form" class="fn-surface rounded-2xl p-5 space-y-4">
            <label class="flex items-center justify-between text-sm">
              <span>Enable Google AdMob Banners</span>
              <input id="set-admob" type="checkbox" ${adsConfig.admob_enabled ? 'checked' : ''} class="accent-[#B6FF48]" />
            </label>
            <label class="flex items-center justify-between text-sm">
              <span>Home Dashboard Banner</span>
              <input id="set-home" type="checkbox" ${adsConfig.banner_home ? 'checked' : ''} class="accent-[#B6FF48]" />
            </label>
            <label class="flex items-center justify-between text-sm">
              <span>Workout Library Banner</span>
              <input id="set-work" type="checkbox" ${adsConfig.banner_workout_library ? 'checked' : ''} class="accent-[#B6FF48]" />
            </label>
            <label class="flex items-center justify-between text-sm">
              <span>Calculators Screen Banner</span>
              <input id="set-calc" type="checkbox" ${adsConfig.banner_calculators ? 'checked' : ''} class="accent-[#B6FF48]" />
            </label>
            <button type="submit" class="fn-btn-primary w-full py-2.5 rounded-xl text-sm min-h-[44px]">Save Settings</button>
          </form>
        </div>
      `;
      document.getElementById('adm-settings-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await api('/api/admin/settings', {
          method: 'PUT',
          body: JSON.stringify({
            ...adsConfig,
            admob_enabled: (document.getElementById('set-admob') as HTMLInputElement).checked,
            banner_home: (document.getElementById('set-home') as HTMLInputElement).checked,
            banner_workout_library: (document.getElementById('set-work') as HTMLInputElement).checked,
            banner_calculators: (document.getElementById('set-calc') as HTMLInputElement).checked,
          }),
        });
        toast('AdMob settings updated.', 'success');
      });
    } else if (tab === 'audit') {
      const { logs } = await api<{ logs: Array<{ action: string; target_table: string; admin_email: string; created_at: string }> }>('/api/admin/audit-logs');
      main.innerHTML = `
        <div class="space-y-4">
          <h1 class="font-display text-2xl font-bold">Admin Audit Logs</h1>
          <div class="fn-surface rounded-2xl divide-y divide-white/10">
            ${
              logs.length === 0
                ? `<div class="p-5 text-sm text-[#9AA69B]">No admin audit events recorded yet.</div>`
                : logs
                    .map(
                      (l) => `
                  <div class="p-4 flex items-center justify-between text-xs">
                    <div>
                      <p class="font-mono-num text-[#B6FF48]">${escapeHtml(l.action)}</p>
                      <p class="text-[#9AA69B]">${escapeHtml(l.admin_email)} · ${escapeHtml(l.target_table)}</p>
                    </div>
                    <span class="font-mono-num text-[#9AA69B]">${new Date(l.created_at).toLocaleString('en-IN')}</span>
                  </div>`
                    )
                    .join('')
            }
          </div>
        </div>
      `;
    }
  }

  draw();
}
