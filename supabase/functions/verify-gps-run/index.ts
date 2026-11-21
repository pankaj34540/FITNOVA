// FITNOVA Supabase Edge Function: GPS Running Session Anti-Cheat & Distance Verification
// Deploy: supabase functions deploy verify-gps-run

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

function haversineMeters(a: GpsPoint, b: GpsPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const c =
    s1 * s1 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { sessionId } = await req.json();
  const { data: session, error } = await supabase
    .from('running_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
  }

  const points: GpsPoint[] = Array.isArray(session.route_points) ? session.route_points : [];
  let verifiedMeters = 0;
  let rejected = 0;
  let prev: GpsPoint | null = null;

  for (const pt of points) {
    if (pt.accuracy > 50) {
      rejected++;
      continue;
    }
    if (prev) {
      const dtSec = Math.max(0.5, (pt.timestamp - prev.timestamp) / 1000);
      const dist = haversineMeters(prev, pt);
      const speedKmh = (dist / dtSec) * 3.6;
      // Reject teleportation spikes > 32 km/h (world sprint pace buffer)
      if (speedKmh > 32 || dist > 250) {
        rejected++;
        continue;
      }
      verifiedMeters += dist;
    }
    prev = pt;
  }

  const status = points.length >= 2 && rejected < points.length * 0.4 ? 'verified' : 'flagged';
  await supabase
    .from('running_sessions')
    .update({
      distance_meters: Number(verifiedMeters.toFixed(2)),
      rejected_points_count: rejected,
      verification_status: status,
      verification_notes: status === 'verified' ? 'Server GPS trajectory validated' : 'Requires manual review due to GPS spikes or short track',
    })
    .eq('id', sessionId);

  return new Response(JSON.stringify({ sessionId, status, verifiedMeters, rejected }), { status: 200 });
});
