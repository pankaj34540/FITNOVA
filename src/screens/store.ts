import { api, ApiError } from '../lib/api.ts';
import type { AffiliateProduct, StoreProduct } from '../lib/types.ts';
import { getState, refreshCartCount, notify } from '../state/store.ts';
import { escapeHtml, formatINR, renderImageWithFallback, toast } from '../ui/components.ts';
import { icon } from '../ui/icons.ts';

const AFF_CATEGORIES = [
  'All',
  'Running shoes',
  'Dumbbells',
  'Resistance bands',
  'Yoga mats',
  'Gym gloves',
  'Sportswear',
  'Smartwatches',
  'Gym bags',
  'Fitness accessories',
  'Water bottles',
];

const STORE_CATEGORIES = [
  'All',
  'Gym equipment',
  'Home workout equipment',
  'Fitness clothing',
  'Running accessories',
  'Gym bags',
  'Water bottles',
  'Exercise accessories',
];

export async function renderStoreScreen(container: HTMLElement, defaultMode: 'own' | 'affiliate' = 'own'): Promise<void> {
  let mode: 'own' | 'affiliate' | 'cart' | 'orders' = defaultMode;
  let storeCat = 'All';
  let storeQuery = '';
  let affCat = 'All';

  container.innerHTML = `<div class="fn-surface rounded-2xl p-6 text-sm text-[#9AA69B]">Loading FITNOVA Store & Affiliate Marketplace...</div>`;

  const [storeRes, affRes, cartRes] = await Promise.all([
    api<{ products: StoreProduct[] }>('/api/store/products'),
    api<{ products: AffiliateProduct[] }>('/api/affiliate/products'),
    api<{
      cart: Array<{ id: string; product_id: string; quantity: number; name: string; price_inr: number; stock_quantity: number; image_url: string; cod_supported: number }>;
      wishlistIds: string[];
      addresses: Array<{ id: string; recipient_name: string; phone: string; line1: string; city: string; state: string; pincode: string }>;
      orders: Array<{
        id: string;
        payment_method: string;
        payment_status: string;
        order_status: string;
        total_inr: number;
        tracking_number: string | null;
        created_at: string;
        items: Array<{ product_name: string; quantity: number; unit_price_inr: number }>;
      }>;
    }>('/api/store/cart'),
  ]);

  let appliedCoupon: { code: string; discount_inr: number } | null = null;

  async function reloadCartData() {
    const fresh = await api<typeof cartRes>('/api/store/cart');
    cartRes.cart = fresh.cart;
    cartRes.wishlistIds = fresh.wishlistIds;
    cartRes.addresses = fresh.addresses;
    cartRes.orders = fresh.orders;
    await refreshCartCount();
    notify();
  }

  function draw() {
    const cartCount = cartRes.cart.reduce((a, b) => a + b.quantity, 0);
    const subtotal = cartRes.cart.reduce((a, b) => a + b.price_inr * b.quantity, 0);

    const filteredOwn = storeRes.products.filter((p) => {
      if (storeCat !== 'All' && p.category_name !== storeCat) return false;
      if (storeQuery && !p.name.toLowerCase().includes(storeQuery.toLowerCase())) return false;
      return true;
    });

    const filteredAff = affRes.products.filter((a) => affCat === 'All' || a.category === affCat);

    container.innerHTML = `
      <div class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="font-display text-2xl font-bold">FITNOVA Marketplace</h1>
            <p class="text-sm text-[#9AA69B]">Shop official FITNOVA equipment & apparel or explore vetted affiliate gear.</p>
          </div>
          <div class="w-full sm:w-auto grid grid-cols-4 sm:flex items-center gap-1 p-1 bg-[#1A211C] border border-white/10 rounded-xl">
            <button type="button" data-smode="own" class="px-1.5 sm:px-3.5 py-2 text-[11px] sm:text-xs font-medium rounded-lg min-h-[40px] whitespace-nowrap truncate ${mode === 'own' ? 'bg-[#B6FF48] text-[#101411]' : 'text-[#9AA69B] hover:text-white'}">Store</button>
            <button type="button" data-smode="affiliate" class="px-1.5 sm:px-3.5 py-2 text-[11px] sm:text-xs font-medium rounded-lg min-h-[40px] whitespace-nowrap truncate ${mode === 'affiliate' ? 'bg-[#B6FF48] text-[#101411]' : 'text-[#9AA69B] hover:text-white'}">Affiliate</button>
            <button type="button" data-smode="cart" class="px-1.5 sm:px-3.5 py-2 text-[11px] sm:text-xs font-medium rounded-lg min-h-[40px] whitespace-nowrap truncate ${mode === 'cart' ? 'bg-[#B6FF48] text-[#101411]' : 'text-[#9AA69B] hover:text-white'}">Cart (${cartCount})</button>
            <button type="button" data-smode="orders" class="px-1.5 sm:px-3.5 py-2 text-[11px] sm:text-xs font-medium rounded-lg min-h-[40px] whitespace-nowrap truncate ${mode === 'orders' ? 'bg-[#B6FF48] text-[#101411]' : 'text-[#9AA69B] hover:text-white'}">Orders (${cartRes.orders.length})</button>
          </div>
        </div>

        ${
          mode === 'own'
            ? `
          <div class="space-y-4">
            <div class="flex flex-col sm:flex-row gap-3">
              <input id="store-search" type="search" value="${escapeHtml(storeQuery)}" placeholder="Search FITNOVA gear..." class="fn-input flex-1 rounded-xl px-4 py-2.5 text-sm min-h-[44px]" />
              <select id="store-cat" class="fn-input rounded-xl px-4 py-2.5 text-sm min-h-[44px]">
                ${STORE_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${storeCat === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
              </select>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              ${filteredOwn
                .map((p) => {
                  const wish = cartRes.wishlistIds.includes(p.id);
                  return `
                  <article class="fn-surface rounded-2xl overflow-hidden flex flex-col justify-between">
                    <div>
                      ${renderImageWithFallback(p.image_url, p.name, 'w-full h-40')}
                      <div class="p-4">
                        <div class="flex items-center justify-between gap-2">
                          <p class="text-xs text-[#9AA69B] truncate">${escapeHtml(p.category_name)}</p>
                          <button type="button" data-wish="${escapeHtml(p.id)}" class="text-xs ${wish ? 'text-[#B6FF48]' : 'text-[#9AA69B]'} min-h-[32px] px-1">${wish ? 'Saved' : 'Wishlist'}</button>
                        </div>
                        <h2 class="font-display text-base font-semibold text-white mt-1">${escapeHtml(p.name)}</h2>
                        <p class="text-xs text-[#9AA69B] mt-1 line-clamp-2">${escapeHtml(p.description)}</p>
                        <div class="mt-2.5 flex items-baseline gap-2">
                          <span class="font-mono-num text-base font-bold text-[#B6FF48]">${formatINR(p.price_inr)}</span>
                          ${p.compare_at_price_inr ? `<span class="font-mono-num text-xs text-[#9AA69B] line-through">${formatINR(p.compare_at_price_inr)}</span>` : ''}
                        </div>
                        <p class="text-[11px] font-mono-num text-[#9AA69B] mt-1">${p.stock_quantity > 0 ? `${p.stock_quantity} in stock · ${p.cod_supported ? 'COD available' : 'Prepaid only'}` : 'Out of stock'}</p>
                      </div>
                    </div>
                    <div class="px-4 pb-4">
                      <button type="button" data-add-cart="${escapeHtml(p.id)}" ${p.stock_quantity <= 0 ? 'disabled' : ''} class="fn-btn-primary w-full py-2.5 rounded-xl text-xs min-h-[44px]">
                        ${p.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                      </button>
                    </div>
                  </article>
                `;
                })
                .join('')}
            </div>
          </div>
        `
            : mode === 'affiliate'
              ? `
          <div class="space-y-4">
            <div class="fn-surface rounded-xl p-4 text-xs text-[#9AA69B]">
              <strong class="text-white">Affiliate Disclosure:</strong> Products below are sold and fulfilled by external partner merchants (Amazon India, Flipkart, Myntra). FITNOVA is not the seller of record for external merchant orders.
            </div>
            <div class="flex sm:flex-wrap gap-2 overflow-x-auto no-scrollbar pb-1">
              ${AFF_CATEGORIES.map(
                (cat) => `
                  <button type="button" data-affcat="${escapeHtml(cat)}" class="px-3.5 py-2 rounded-xl text-xs min-h-[40px] whitespace-nowrap shrink-0 border ${
                    affCat === cat ? 'bg-[#B6FF48] text-[#101411] border-[#B6FF48] font-semibold' : 'bg-[#1A211C] text-[#9AA69B] border-white/10'
                  }">${escapeHtml(cat)}</button>
                `
              ).join('')}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              ${filteredAff
                .map(
                  (a) => `
                  <article class="fn-surface rounded-2xl overflow-hidden flex flex-col justify-between">
                    <div>
                      ${renderImageWithFallback(a.image_url, a.title, 'w-full h-40')}
                      <div class="p-4">
                        <p class="text-xs text-[#9AA69B]">${escapeHtml(a.category)} · ${escapeHtml(a.merchant_name)}</p>
                        <h2 class="font-display text-base font-semibold text-white mt-1">${escapeHtml(a.title)}</h2>
                        <p class="text-xs text-[#9AA69B] mt-1 line-clamp-2">${escapeHtml(a.description)}</p>
                        <p class="font-mono-num text-base font-bold text-[#B6FF48] mt-2">${formatINR(a.displayed_price_inr)}</p>
                      </div>
                    </div>
                    <div class="px-4 pb-4">
                      <button type="button" data-aff-buy="${escapeHtml(a.id)}" class="fn-btn-secondary w-full py-2.5 rounded-xl text-xs min-h-[44px] flex items-center justify-center gap-1.5">
                        <span>Buy Now (${escapeHtml(a.merchant_name)})</span>
                        ${icon('external', 'w-3.5 h-3.5')}
                      </button>
                    </div>
                  </article>
                `
                )
                .join('')}
            </div>
          </div>
        `
              : mode === 'cart'
                ? renderCartAndCheckout(cartRes.cart, cartRes.addresses, subtotal, appliedCoupon)
                : renderOrdersHistory(cartRes.orders)
        }
      </div>
    `;

    container.querySelectorAll('[data-smode]').forEach((b) => {
      b.addEventListener('click', () => {
        mode = b.getAttribute('data-smode') as typeof mode;
        draw();
      });
    });

    document.getElementById('store-cat')?.addEventListener('change', (e) => {
      storeCat = (e.target as HTMLSelectElement).value;
      draw();
    });

    document.getElementById('store-search')?.addEventListener('input', (e) => {
      storeQuery = (e.target as HTMLInputElement).value;
      draw();
      const inp = document.getElementById('store-search') as HTMLInputElement | null;
      if (inp) {
        inp.focus();
        inp.setSelectionRange(storeQuery.length, storeQuery.length);
      }
    });

    container.querySelectorAll('[data-affcat]').forEach((b) => {
      b.addEventListener('click', () => {
        affCat = b.getAttribute('data-affcat') || 'All';
        draw();
      });
    });

    container.querySelectorAll('[data-add-cart]').forEach((b) => {
      b.addEventListener('click', async () => {
        const product_id = b.getAttribute('data-add-cart')!;
        const existing = cartRes.cart.find((i) => i.product_id === product_id);
        try {
          await api('/api/store/cart', {
            method: 'POST',
            body: JSON.stringify({ product_id, quantity: (existing?.quantity || 0) + 1 }),
          });
          await reloadCartData();
          toast('Added to cart.', 'success');
          draw();
        } catch (err) {
          toast((err as ApiError).message, 'error');
        }
      });
    });

    container.querySelectorAll('[data-wish]').forEach((b) => {
      b.addEventListener('click', async () => {
        const product_id = b.getAttribute('data-wish')!;
        const res = await api<{ wishlisted: boolean }>('/api/store/wishlist/toggle', {
          method: 'POST',
          body: JSON.stringify({ product_id }),
        });
        await reloadCartData();
        toast(res.wishlisted ? 'Saved to wishlist.' : 'Removed from wishlist.', 'info');
        draw();
      });
    });

    container.querySelectorAll('[data-aff-buy]').forEach((b) => {
      b.addEventListener('click', async () => {
        const product_id = b.getAttribute('data-aff-buy')!;
        const res = await api<{ affiliate_url: string }>('/api/affiliate/click', {
          method: 'POST',
          body: JSON.stringify({ product_id, referrer_screen: 'affiliate_marketplace' }),
        });
        toast(`Click logged. External merchant URL: ${res.affiliate_url}`, 'success');
      });
    });

    // Cart & Checkout event handlers
    container.querySelectorAll('[data-rm-cart]').forEach((b) => {
      b.addEventListener('click', async () => {
        await api(`/api/store/cart/${b.getAttribute('data-rm-cart')}`, { method: 'DELETE' });
        await reloadCartData();
        draw();
      });
    });

    document.getElementById('apply-coupon-btn')?.addEventListener('click', async () => {
      const code = (document.getElementById('coupon-input') as HTMLInputElement).value;
      try {
        const res = await api<{ code: string; discount_inr: number }>('/api/store/validate-coupon', {
          method: 'POST',
          body: JSON.stringify({ code, subtotal_inr: subtotal }),
        });
        appliedCoupon = res;
        toast(`Coupon ${res.code} applied (-${formatINR(res.discount_inr)})`, 'success');
        draw();
      } catch (err) {
        appliedCoupon = null;
        toast((err as ApiError).message, 'error');
      }
    });

    document.getElementById('add-address-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api('/api/store/addresses', {
          method: 'POST',
          body: JSON.stringify({
            recipient_name: (document.getElementById('addr-name') as HTMLInputElement).value,
            phone: (document.getElementById('addr-phone') as HTMLInputElement).value,
            line1: (document.getElementById('addr-line1') as HTMLInputElement).value,
            city: (document.getElementById('addr-city') as HTMLInputElement).value,
            state: (document.getElementById('addr-state') as HTMLInputElement).value,
            pincode: (document.getElementById('addr-pin') as HTMLInputElement).value,
          }),
        });
        await reloadCartData();
        toast('Delivery address saved.', 'success');
        draw();
      } catch (err) {
        toast((err as ApiError).message, 'error');
      }
    });

    document.getElementById('checkout-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const address_id = (document.getElementById('co-addr') as HTMLSelectElement)?.value;
      const payment_method = (document.getElementById('co-method') as HTMLSelectElement)?.value;
      try {
        const res = await api<{ orderId: string; paymentMethod: string; gatewayOrderId: string | null }>('/api/store/checkout', {
          method: 'POST',
          body: JSON.stringify({
            address_id,
            payment_method,
            coupon_code: appliedCoupon?.code || null,
          }),
        });
        if (res.gatewayOrderId) {
          await api('/api/payments/sandbox-confirm', {
            method: 'POST',
            body: JSON.stringify({ gatewayOrderId: res.gatewayOrderId }),
          });
          toast('Payment verified by webhook & order confirmed!', 'success');
        } else {
          toast('COD Order placed & confirmed!', 'success');
        }
        appliedCoupon = null;
        await reloadCartData();
        mode = 'orders';
        draw();
      } catch (err) {
        toast((err as ApiError).message, 'error');
      }
    });

    container.querySelectorAll('[data-return-order]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-return-order')!;
        await api(`/api/store/orders/${id}/return`, { method: 'POST', body: JSON.stringify({ reason: 'Customer requested return via FITNOVA app' }) });
        await reloadCartData();
        toast('Return & refund request submitted.', 'success');
        draw();
      });
    });
  }

  draw();
}

function renderCartAndCheckout(
  cart: Array<{ product_id: string; quantity: number; name: string; price_inr: number; cod_supported: number }>,
  addresses: Array<{ id: string; recipient_name: string; line1: string; city: string; pincode: string }>,
  subtotal: number,
  coupon: { code: string; discount_inr: number } | null
): string {
  if (cart.length === 0) {
    return `<div class="fn-surface rounded-2xl p-6 text-sm text-[#9AA69B]">Your cart is empty. Browse FITNOVA Store products to add items.</div>`;
  }
  const discount = coupon ? coupon.discount_inr : 0;
  const total = Math.max(0, subtotal - discount);
  const codAllowed = cart.every((i) => i.cod_supported === 1);

  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div class="lg:col-span-7 space-y-4">
        <div class="fn-surface rounded-2xl divide-y divide-white/10">
          ${cart
            .map(
              (item) => `
              <div class="p-4 flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-semibold text-white">${escapeHtml(item.name)}</p>
                  <p class="text-xs font-mono-num text-[#9AA69B]">Qty ${item.quantity} × ${formatINR(item.price_inr)}</p>
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-mono-num text-sm font-bold text-[#B6FF48]">${formatINR(item.price_inr * item.quantity)}</span>
                  <button type="button" data-rm-cart="${escapeHtml(item.product_id)}" class="text-xs text-[#FF6262] hover:underline min-h-[40px] px-2">Remove</button>
                </div>
              </div>
            `
            )
            .join('')}
        </div>

        <form id="add-address-form" class="fn-surface rounded-2xl p-5 space-y-3">
          <h2 class="font-display text-base font-semibold">Add Delivery Address</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input id="addr-name" type="text" required placeholder="Recipient Name" class="fn-input rounded-xl px-3 py-2.5 text-sm min-h-[44px]" />
            <input id="addr-phone" type="tel" required placeholder="10-digit Mobile" class="fn-input rounded-xl px-3 py-2.5 text-sm font-mono-num min-h-[44px]" />
            <input id="addr-line1" type="text" required placeholder="House / Street / Locality" class="fn-input sm:col-span-2 rounded-xl px-3 py-2.5 text-sm min-h-[44px]" />
            <input id="addr-city" type="text" required placeholder="City" class="fn-input rounded-xl px-3 py-2.5 text-sm min-h-[44px]" />
            <div class="flex gap-2">
              <input id="addr-state" type="text" required placeholder="State" class="fn-input w-1/2 rounded-xl px-3 py-2.5 text-sm min-h-[44px]" />
              <input id="addr-pin" type="text" required placeholder="Pincode" class="fn-input w-1/2 rounded-xl px-3 py-2.5 text-sm font-mono-num min-h-[44px]" />
            </div>
          </div>
          <button type="submit" class="fn-btn-secondary px-4 py-2.5 rounded-xl text-xs min-h-[40px]">Save Address</button>
        </form>
      </div>

      <div class="lg:col-span-5 fn-surface rounded-2xl p-5 space-y-4 h-fit">
        <h2 class="font-display text-lg font-semibold">Checkout Summary</h2>
        <div class="flex gap-2">
          <input id="coupon-input" type="text" placeholder="Coupon (FITNOVA50 / TRAIN10)" class="fn-input flex-1 rounded-xl px-3 py-2 text-sm min-h-[44px]" />
          <button type="button" id="apply-coupon-btn" class="fn-btn-secondary px-4 rounded-xl text-xs min-h-[44px]">Apply</button>
        </div>
        <div class="space-y-2 text-sm border-t border-white/10 pt-3">
          <div class="flex justify-between text-[#9AA69B]"><span>Subtotal</span><span class="font-mono-num">${formatINR(subtotal)}</span></div>
          ${coupon ? `<div class="flex justify-between text-[#B6FF48]"><span>Discount (${escapeHtml(coupon.code)})</span><span class="font-mono-num">-${formatINR(discount)}</span></div>` : ''}
          <div class="flex justify-between text-white font-bold text-base pt-2 border-t border-white/10"><span>Total</span><span class="font-mono-num">${formatINR(total)}</span></div>
        </div>
        <form id="checkout-form" class="space-y-3">
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Delivery Address</label>
            <select id="co-addr" required class="fn-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]">
              ${
                addresses.length === 0
                  ? `<option value="">Add an address on the left first</option>`
                  : addresses.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.recipient_name)} — ${escapeHtml(a.line1)}, ${escapeHtml(a.city)} ${escapeHtml(a.pincode)}</option>`).join('')
              }
            </select>
          </div>
          <div>
            <label class="block text-xs text-[#9AA69B] mb-1">Payment Method</label>
            <select id="co-method" class="fn-input w-full rounded-xl px-3 py-2.5 text-sm min-h-[44px]">
              <option value="upi_card">UPI / Card / NetBanking (Razorpay Verified)</option>
              ${codAllowed ? `<option value="cod">Cash on Delivery (COD)</option>` : ''}
            </select>
          </div>
          <button type="submit" ${addresses.length === 0 ? 'disabled' : ''} class="fn-btn-primary w-full py-3 rounded-xl text-sm min-h-[48px]">Place Order (${formatINR(total)})</button>
        </form>
      </div>
    </div>
  `;
}

function renderOrdersHistory(
  orders: Array<{
    id: string;
    payment_method: string;
    payment_status: string;
    order_status: string;
    total_inr: number;
    tracking_number: string | null;
    created_at: string;
    items: Array<{ product_name: string; quantity: number; unit_price_inr: number }>;
  }>
): string {
  if (orders.length === 0) {
    return `<div class="fn-surface rounded-2xl p-6 text-sm text-[#9AA69B]">No FITNOVA store orders placed yet.</div>`;
  }
  return `
    <div class="space-y-4">
      ${orders
        .map(
          (o) => `
          <article class="fn-surface rounded-2xl p-5 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs font-mono-num text-[#B6FF48]">ORDER ${escapeHtml(o.id.slice(0, 8).toUpperCase())} · ${escapeHtml(o.order_status.toUpperCase())}</p>
                <p class="text-xs text-[#9AA69B] mt-0.5">${new Date(o.created_at).toLocaleString('en-IN')} · ${escapeHtml(o.payment_method.toUpperCase())} (${escapeHtml(o.payment_status)})</p>
              </div>
              <span class="font-mono-num text-base font-bold text-white">${formatINR(o.total_inr)}</span>
            </div>
            <div class="border-t border-white/10 pt-2 text-xs text-[#9AA69B] space-y-1">
              ${o.items.map((i) => `<p>${i.quantity} × ${escapeHtml(i.product_name)} (${formatINR(i.unit_price_inr)})</p>`).join('')}
            </div>
            <div class="flex items-center justify-between pt-2">
              <span class="text-xs font-mono-num text-[#9AA69B]">${o.tracking_number ? `Tracking: ${escapeHtml(o.tracking_number)}` : 'Dispatch pending'}</span>
              ${
                o.order_status !== 'return_requested' && o.order_status !== 'returned'
                  ? `<button type="button" data-return-order="${escapeHtml(o.id)}" class="fn-btn-secondary px-3 py-1.5 rounded-lg text-xs min-h-[36px]">Request Return / Refund</button>`
                  : `<span class="text-xs text-amber-300">Return requested</span>`
              }
            </div>
          </article>
        `
        )
        .join('')}
    </div>
  `;
}
