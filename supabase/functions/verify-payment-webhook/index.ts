// FITNOVA Supabase Edge Function: Server-Side Payment Webhook Verification (Razorpay India)
// Deploy: supabase functions deploy verify-payment-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

async function verifyHmacSha256(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expectedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return expectedHex === signature;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const signatureValid = await verifyHmacSha256(rawBody, signature, webhookSecret);

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const payload = JSON.parse(rawBody);
  const eventId = req.headers.get('x-razorpay-event-id') ?? payload?.payload?.payment?.entity?.id ?? crypto.randomUUID();

  // Log webhook event idempotently
  await supabase.from('payment_webhook_events').upsert({
    gateway: 'razorpay',
    event_id: eventId,
    event_type: payload?.event ?? 'unknown',
    signature_valid: signatureValid,
    payload,
  }, { onConflict: 'event_id' });

  if (!signatureValid) {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 401 });
  }

  if (payload?.event === 'payment.captured') {
    const paymentEntity = payload.payload.payment.entity;
    const gatewayOrderId = paymentEntity.order_id;
    const gatewayPaymentId = paymentEntity.id;

    const { data: tx } = await supabase
      .from('payment_transactions')
      .update({
        status: 'captured',
        gateway_payment_id: gatewayPaymentId,
        verified_server_side: true,
        updated_at: new Date().toISOString(),
      })
      .eq('gateway_order_id', gatewayOrderId)
      .select()
      .single();

    if (tx?.purpose === 'challenge_registration') {
      await supabase
        .from('challenge_members')
        .update({ status: 'active', payment_transaction_id: tx.id })
        .eq('id', tx.reference_id);
    } else if (tx?.purpose === 'store_order') {
      await supabase
        .from('orders')
        .update({ payment_status: 'paid', order_status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', tx.reference_id);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
