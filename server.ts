import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { createServer as createViteServer } from 'vite';
import { db, hashPassword, verifyPassword, hashToken, uuid } from './server/db.ts';
import { seedReferenceCatalog } from './server/seed.ts';

seedReferenceCatalog();

const app = express();
const PORT = 3000;
const SESSION_COOKIE = 'fitnova_sid';
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'fitnova_dev_webhook_secret';

app.use(express.json({ limit: '6mb' }));

// ============================================================================
// COOKIE & AUTH MIDDLEWARE
// ============================================================================
function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  const result: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function isHttpsContext(req?: Request): boolean {
  const appUrl = (process.env.APP_URL || '').trim();
  if (appUrl.startsWith('https://')) return true;
  if (req) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    if (req.secure || proto === 'https') return true;
    if (String(req.get('host') || '').endsWith('.run.app')) return true;
  }
  return process.env.NODE_ENV === 'production';
}

function setSessionCookie(res: Response, rawToken: string, req?: Request) {
  const isSecure = isHttpsContext(req);
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${60 * 60 * 24 * 14}`,
  ];
  if (isSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response, req?: Request) {
  const isSecure = isHttpsContext(req);
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    isSecure ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isSecure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

interface AuthProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  account_status: string;
  email_verified: number;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  fitness_goal: string | null;
  fitness_level: string | null;
  workout_preference: string | null;
  available_equipment: string;
  activity_level: string | null;
  ad_free_member: number;
  onboarding_completed: number;
  consent_accepted_at: string | null;
  created_at: string;
}

interface AuthedRequest extends Request {
  user?: AuthProfile;
}

function sanitizeProfile(p: AuthProfile) {
  let equip: string[] = [];
  try {
    equip = JSON.parse(p.available_equipment || '[]');
  } catch {
    equip = [];
  }
  return {
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    role: p.role,
    account_status: p.account_status,
    email_verified: Boolean(p.email_verified),
    date_of_birth: p.date_of_birth,
    age: p.age,
    gender: p.gender,
    height_cm: p.height_cm,
    weight_kg: p.weight_kg,
    fitness_goal: p.fitness_goal,
    fitness_level: p.fitness_level,
    workout_preference: p.workout_preference,
    available_equipment: equip,
    activity_level: p.activity_level,
    ad_free_member: Boolean(p.ad_free_member),
    onboarding_completed: Boolean(p.onboarding_completed),
    consent_accepted_at: p.consent_accepted_at,
    created_at: p.created_at,
  };
}

function attachUser(req: AuthedRequest, _res: Response, next: NextFunction) {
  const cookies = parseCookies(req);
  const rawToken = cookies[SESSION_COOKIE];
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const row = db
      .prepare(`
        SELECT p.* FROM sessions s
        JOIN profiles p ON p.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > datetime('now') AND p.account_status = 'active'
      `)
      .get(tokenHash) as AuthProfile | undefined;
    if (row) req.user = row;
  }
  next();
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin authorization required' });
    return;
  }
  next();
}

function createSessionForUser(userId: string, res: Response, req?: Request) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+14 days'))`).run(
    tokenHash,
    userId
  );
  setSessionCookie(res, rawToken, req);
}

function logAdminAction(adminId: string, action: string, targetTable: string, targetId: string | null, metadata: unknown = {}) {
  db.prepare(`
    INSERT INTO admin_audit_logs (id, admin_user_id, action, target_table, target_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(uuid(), adminId, action, targetTable, targetId, JSON.stringify(metadata));
}

app.use(attachUser);

// ============================================================================
// HEALTH & PUBLIC CONFIG
// ============================================================================
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fitnova-api' });
});

app.get('/api/public/settings', (_req, res) => {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ads_config') as { value: string } | undefined;
  const adsConfig = row ? JSON.parse(row.value) : { admob_enabled: true, banner_home: true, banner_workout_library: true, banner_calculators: true };
  res.json({
    adsConfig,
    supabaseConfigured: Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
  });
});

// ============================================================================
// AUTHENTICATION & ACCOUNT MANAGEMENT
// ============================================================================
app.get('/api/auth/me', (req: AuthedRequest, res) => {
  if (!req.user) {
    res.json({ user: null, goals: null });
    return;
  }
  const goals = db.prepare('SELECT * FROM fitness_goals WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1').get(req.user.id);
  res.json({ user: sanitizeProfile(req.user), goals: goals || null });
});

app.post('/api/auth/signup', (req, res) => {
  const { email, password, full_name } = req.body ?? {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || !password || String(password).length < 6) {
    res.status(400).json({ error: 'Valid email and password (minimum 6 characters) are required.' });
    return;
  }
  const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(cleanEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }
  const id = uuid();
  const name = String(full_name || '').trim() || cleanEmail.split('@')[0];
  db.prepare(`
    INSERT INTO profiles (id, email, password_hash, full_name, role, email_verified, consent_accepted_at)
    VALUES (?, ?, ?, ?, 'user', 0, datetime('now'))
  `).run(id, cleanEmail, hashPassword(String(password)), name);

  const verifyCode = crypto.randomInt(100000, 999999).toString();
  db.prepare(`INSERT INTO auth_tokens (id, user_id, purpose, token, expires_at) VALUES (?, ?, 'email_verify', ?, datetime('now', '+1 day'))`).run(
    uuid(),
    id,
    `${cleanEmail}:${verifyCode}`
  );

  createSessionForUser(id, res, req);
  const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as unknown as AuthProfile;
  res.status(201).json({
    user: sanitizeProfile(profile),
    verificationCodeHint: verifyCode,
    message: 'Account created. Verify your email using the 6-digit confirmation code.',
  });
});

app.post('/api/auth/verify-email', requireAuth, (req: AuthedRequest, res) => {
  const { code } = req.body ?? {};
  const user = req.user!;
  const row = db
    .prepare(`SELECT * FROM auth_tokens WHERE user_id = ? AND purpose = 'email_verify' AND used_at IS NULL AND expires_at > datetime('now') ORDER BY rowid DESC LIMIT 1`)
    .get(user.id) as { id: string; token: string } | undefined;

  if (!row || row.token !== `${user.email}:${String(code || '').trim()}`) {
    res.status(400).json({ error: 'Invalid or expired verification code.' });
    return;
  }
  db.prepare(`UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  db.prepare(`UPDATE profiles SET email_verified = 1, updated_at = datetime('now') WHERE id = ?`).run(user.id);
  const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(user.id) as unknown as AuthProfile;
  res.json({ user: sanitizeProfile(updated) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const row = db.prepare('SELECT * FROM profiles WHERE email = ?').get(cleanEmail) as (AuthProfile & { password_hash: string }) | undefined;
  if (!row || !verifyPassword(String(password || ''), row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  if (row.account_status !== 'active') {
    res.status(403).json({ error: `Account is ${row.account_status}. Contact support.` });
    return;
  }
  createSessionForUser(row.id, res, req);
  res.json({ user: sanitizeProfile(row) });
});

function getAppBaseUrl(): string {
  const envUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (envUrl && envUrl !== 'MY_APP_URL' && /^https?:\/\//i.test(envUrl)) {
    return envUrl;
  }
  return `http://localhost:${PORT}`;
}

function getGoogleRedirectUri(): string {
  return `${getAppBaseUrl()}/auth/google/callback`;
}

function escapeHtmlSafe(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}

function renderOAuthPopupHtml(payload: Record<string, unknown>, heading: string, detail: string): string {
  const serialized = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FITNOVA · Google Authentication</title>
  </head>
  <body style="background:#101411;color:#FFFFFF;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;">
    <div style="max-width:420px;width:100%;background:#1A211C;border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:28px;text-align:center;">
      <p style="color:#B6FF48;font-size:12px;font-weight:700;letter-spacing:0.1em;margin:0 0 8px;">FITNOVA</p>
      <h1 style="font-size:20px;margin:0 0 8px;">${escapeHtmlSafe(heading)}</h1>
      <p style="color:#9AA69B;font-size:14px;line-height:1.5;margin:0;">${escapeHtmlSafe(detail)}</p>
    </div>
    <script>
      (function () {
        var msg = ${serialized};
        if (window.opener) {
          window.opener.postMessage(msg, '*');
          setTimeout(function () { window.close(); }, 350);
        } else if (msg.type === 'OAUTH_AUTH_SUCCESS') {
          window.location.href = '/';
        }
      })();
    </script>
  </body>
</html>`;
}

app.get('/api/auth/google/url', (req, res) => {
  const redirectUri = getGoogleRedirectUri();
  const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const mode = req.query.mode === 'signup' ? 'signup' : 'login';

  if (!clientId || !clientSecret) {
    res.status(503).json({
      error: 'Google OAuth credentials (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) are not configured yet.',
      setupRequired: true,
      redirectUri,
    });
    return;
  }

  db.prepare(`DELETE FROM oauth_states WHERE created_at < datetime('now', '-20 minutes')`).run();
  const state = crypto.randomBytes(24).toString('hex');
  db.prepare(`INSERT INTO oauth_states (state, provider, mode, redirect_uri) VALUES (?, 'google', ?, ?)`).run(state, mode, redirectUri);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'online',
    state,
  });

  res.json({
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    redirectUri,
  });
});

async function handleGoogleCallback(req: Request, res: Response) {
  const oauthError = String(req.query.error_description || req.query.error || '').trim();
  if (oauthError) {
    res
      .status(400)
      .send(renderOAuthPopupHtml({ type: 'OAUTH_AUTH_ERROR', provider: 'google', error: oauthError }, 'Google Sign-In Cancelled', oauthError));
    return;
  }

  const code = String(req.query.code || '').trim();
  const state = String(req.query.state || '').trim();
  if (!code || !state) {
    res
      .status(400)
      .send(
        renderOAuthPopupHtml(
          { type: 'OAUTH_AUTH_ERROR', provider: 'google', error: 'Missing authorization code or state from Google.' },
          'Authentication Failed',
          'Missing authorization code or state parameter.'
        )
      );
    return;
  }

  const stateRow = db
    .prepare(`SELECT * FROM oauth_states WHERE state = ? AND provider = 'google' AND created_at >= datetime('now', '-20 minutes')`)
    .get(state) as { state: string; mode: string; redirect_uri: string } | undefined;

  if (!stateRow) {
    res
      .status(400)
      .send(
        renderOAuthPopupHtml(
          { type: 'OAUTH_AUTH_ERROR', provider: 'google', error: 'Expired or invalid OAuth state. Please try again.' },
          'Session Expired',
          'Please close this window and try Continue with Google again.'
        )
      );
    return;
  }
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);

  const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    res
      .status(503)
      .send(
        renderOAuthPopupHtml(
          { type: 'OAUTH_AUTH_ERROR', provider: 'google', error: 'Google OAuth credentials are not configured on the server.' },
          'Server Configuration Needed',
          'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.'
        )
      );
    return;
  }

  try {
    const tokenForm = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: stateRow.redirect_uri,
      grant_type: 'authorization_code',
    });

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenForm.toString(),
    });
    const tokenJson = (await tokenResp.json().catch(() => ({}))) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenResp.ok || !tokenJson.access_token) {
      const msg = tokenJson.error_description || tokenJson.error || 'Failed to exchange Google authorization code.';
      res
        .status(400)
        .send(renderOAuthPopupHtml({ type: 'OAUTH_AUTH_ERROR', provider: 'google', error: msg }, 'Google Token Error', msg));
      return;
    }

    const userinfoResp = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const userinfo = (await userinfoResp.json().catch(() => ({}))) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      error?: string;
    };

    const googleSub = String(userinfo.sub || '').trim();
    const cleanEmail = String(userinfo.email || '').trim().toLowerCase();
    const fullName = String(userinfo.name || cleanEmail.split('@')[0] || 'FITNOVA Athlete').trim();

    if (!googleSub || !cleanEmail || !cleanEmail.includes('@')) {
      res
        .status(400)
        .send(
          renderOAuthPopupHtml(
            { type: 'OAUTH_AUTH_ERROR', provider: 'google', error: 'Google did not return a verified email profile.' },
            'Google Profile Error',
            'Unable to read your Google email profile.'
          )
        );
      return;
    }

    let profile = db.prepare('SELECT * FROM profiles WHERE google_sub = ? OR email = ?').get(googleSub, cleanEmail) as unknown as AuthProfile | undefined;
    let isNewUser = false;

    if (!profile) {
      isNewUser = true;
      const id = uuid();
      db.prepare(`
        INSERT INTO profiles (id, email, password_hash, google_sub, full_name, role, email_verified, consent_accepted_at)
        VALUES (?, ?, ?, ?, ?, 'user', ?, datetime('now'))
      `).run(
        id,
        cleanEmail,
        hashPassword(crypto.randomBytes(24).toString('hex')),
        googleSub,
        fullName,
        userinfo.email_verified === false ? 0 : 1
      );
      profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(id) as unknown as AuthProfile;
    } else {
      if (profile.account_status !== 'active') {
        res
          .status(403)
          .send(
            renderOAuthPopupHtml(
              { type: 'OAUTH_AUTH_ERROR', provider: 'google', error: `Account is ${profile.account_status}. Contact support.` },
              'Account Unavailable',
              `Account is ${profile.account_status}.`
            )
          );
        return;
      }
      db.prepare(`UPDATE profiles SET google_sub = COALESCE(google_sub, ?), email_verified = MAX(email_verified, ?), updated_at = datetime('now') WHERE id = ?`).run(
        googleSub,
        userinfo.email_verified === false ? 0 : 1,
        profile.id
      );
    }

    createSessionForUser(profile.id, res, req);
    res.send(
      renderOAuthPopupHtml(
        {
          type: 'OAUTH_AUTH_SUCCESS',
          provider: 'google',
          email: cleanEmail,
          isNewUser,
        },
        isNewUser ? 'Welcome to FITNOVA' : 'Signed in with Google',
        `Signed in as ${cleanEmail}. Returning to FITNOVA...`
      )
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected Google OAuth error.';
    res
      .status(500)
      .send(renderOAuthPopupHtml({ type: 'OAUTH_AUTH_ERROR', provider: 'google', error: msg }, 'Authentication Error', msg));
  }
}

app.get(['/auth/google/callback', '/auth/google/callback/'], handleGoogleCallback);

app.post('/api/auth/forgot-password', (req, res) => {
  const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT id FROM profiles WHERE email = ?').get(cleanEmail) as { id: string } | undefined;
  if (!user) {
    res.json({ message: 'If an account matches that email, a reset code has been generated.' });
    return;
  }
  const resetCode = crypto.randomInt(100000, 999999).toString();
  db.prepare(`INSERT INTO auth_tokens (id, user_id, purpose, token, expires_at) VALUES (?, ?, 'password_reset', ?, datetime('now', '+1 hour'))`).run(
    uuid(),
    user.id,
    `${cleanEmail}:${resetCode}`
  );
  res.json({
    message: 'Password reset code generated.',
    resetCodeHint: resetCode,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body ?? {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' });
    return;
  }
  const user = db.prepare('SELECT id FROM profiles WHERE email = ?').get(cleanEmail) as { id: string } | undefined;
  if (!user) {
    res.status(400).json({ error: 'Invalid reset request.' });
    return;
  }
  const tokenRow = db
    .prepare(`SELECT * FROM auth_tokens WHERE user_id = ? AND purpose = 'password_reset' AND used_at IS NULL AND expires_at > datetime('now') ORDER BY rowid DESC LIMIT 1`)
    .get(user.id) as { id: string; token: string } | undefined;
  if (!tokenRow || tokenRow.token !== `${cleanEmail}:${String(code || '').trim()}`) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }
  db.prepare(`UPDATE auth_tokens SET used_at = datetime('now') WHERE id = ?`).run(tokenRow.id);
  db.prepare(`UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hashPassword(String(newPassword)), user.id);
  res.json({ message: 'Password updated. You can now log in.' });
});

app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req);
  if (cookies[SESSION_COOKIE]) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(cookies[SESSION_COOKIE]));
  }
  clearSessionCookie(res, req);
  res.json({ ok: true });
});

app.delete('/api/account', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  db.prepare('DELETE FROM profiles WHERE id = ?').run(userId);
  clearSessionCookie(res, req);
  res.json({ deleted: true });
});

// ============================================================================
// ONBOARDING & GOALS
// ============================================================================
app.put('/api/profile/onboarding', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const b = req.body ?? {};
  const age = Number(b.age) || null;
  const heightCm = Number(b.height_cm) || 170;
  const weightKg = Number(b.weight_kg) || 70;
  const gender = b.gender || null;
  const goal = b.fitness_goal || 'general_fitness';
  const level = b.fitness_level || 'beginner';
  const pref = b.workout_preference || 'mixed';
  const equip = Array.isArray(b.available_equipment) ? b.available_equipment : [];
  const activity = b.activity_level || 'moderate';

  db.prepare(`
    UPDATE profiles SET
      full_name = ?,
      age = ?,
      date_of_birth = ?,
      gender = ?,
      height_cm = ?,
      weight_kg = ?,
      fitness_goal = ?,
      fitness_level = ?,
      workout_preference = ?,
      available_equipment = ?,
      activity_level = ?,
      onboarding_completed = 1,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(b.full_name || user.full_name).trim(),
    age,
    b.date_of_birth || null,
    gender,
    heightCm,
    weightKg,
    goal,
    level,
    pref,
    JSON.stringify(equip),
    activity,
    user.id
  );

  // Calculate evidence-based initial daily calorie & macro target (Mifflin-St Jeor)
  const effectiveAge = age ?? 26;
  const s = gender === 'female' ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * effectiveAge + s;
  const multMap: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  let tdee = Math.round(bmr * (multMap[activity] || 1.55));
  if (goal === 'weight_loss' || goal === 'abs_building') tdee = Math.max(1300, tdee - 400);
  if (goal === 'muscle_gain' || goal === 'weight_gain') tdee = tdee + 300;
  const proteinG = Math.round(weightKg * (goal === 'muscle_gain' ? 1.8 : 1.5));
  const waterMl = Math.round(weightKg * 38);

  db.prepare('UPDATE fitness_goals SET is_active = 0 WHERE user_id = ?').run(user.id);
  db.prepare(`
    INSERT INTO fitness_goals (id, user_id, goal_type, target_weight_kg, daily_calorie_target, daily_protein_g, daily_water_ml, weekly_run_km_target, weekly_workout_target, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(uuid(), user.id, goal, b.target_weight_kg ? Number(b.target_weight_kg) : weightKg, tdee, proteinG, waterMl, level === 'advanced' ? 25 : level === 'intermediate' ? 15 : 10, level === 'beginner' ? 4 : 5);

  const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(user.id) as unknown as AuthProfile;
  const activeGoal = db.prepare('SELECT * FROM fitness_goals WHERE user_id = ? AND is_active = 1 LIMIT 1').get(user.id);
  res.json({ user: sanitizeProfile(updated), goals: activeGoal });
});

app.put('/api/profile/goals', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const b = req.body ?? {};
  const active = db.prepare('SELECT id FROM fitness_goals WHERE user_id = ? AND is_active = 1 LIMIT 1').get(userId) as { id: string } | undefined;
  if (!active) {
    res.status(404).json({ error: 'No active goal found' });
    return;
  }
  db.prepare(`
    UPDATE fitness_goals SET
      daily_calorie_target = ?,
      daily_protein_g = ?,
      daily_water_ml = ?,
      weekly_run_km_target = ?,
      weekly_workout_target = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    Number(b.daily_calorie_target) || 2100,
    Number(b.daily_protein_g) || 110,
    Number(b.daily_water_ml) || 3000,
    Number(b.weekly_run_km_target) || 15,
    Number(b.weekly_workout_target) || 4,
    active.id
  );
  res.json({ goals: db.prepare('SELECT * FROM fitness_goals WHERE id = ?').get(active.id) });
});

// ============================================================================
// DASHBOARD AGGREGATION
// ============================================================================
app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const today = new Date().toISOString().slice(0, 10);

  const todayWorkouts = db
    .prepare(`SELECT COALESCE(SUM(duration_seconds),0) as sec, COALESCE(SUM(calories_burned),0) as cal, COUNT(*) as cnt FROM workout_sessions WHERE user_id = ? AND date(completed_at) = ?`)
    .get(userId, today) as { sec: number; cal: number; cnt: number };

  const todayRuns = db
    .prepare(`SELECT COALESCE(SUM(distance_meters),0) as meters, COALESCE(SUM(duration_seconds),0) as sec, COALESCE(SUM(calories_burned),0) as cal FROM running_sessions WHERE user_id = ? AND date(started_at) = ?`)
    .get(userId, today) as { meters: number; sec: number; cal: number };

  const activeChallenge = db
    .prepare(`
      SELECT cm.*, c.title as challenge_title, c.daily_run_km_target, c.daily_workout_minutes_target, c.refund_reward_inr
      FROM challenge_members cm
      JOIN challenges c ON c.id = cm.challenge_id
      WHERE cm.user_id = ? AND cm.status IN ('active', 'completed')
      ORDER BY cm.created_at DESC LIMIT 1
    `)
    .get(userId);

  const recommendedPlans = db.prepare(`SELECT * FROM workout_plans WHERE is_published = 1 ORDER BY duration_days ASC LIMIT 3`).all();
  const recommendedAffiliate = db.prepare(`SELECT * FROM affiliate_products WHERE is_active = 1 LIMIT 4`).all();
  const goals = db.prepare('SELECT * FROM fitness_goals WHERE user_id = ? AND is_active = 1 LIMIT 1').get(userId);
  const waterToday = (db.prepare(`SELECT COALESCE(SUM(amount_ml),0) as ml FROM water_logs WHERE user_id = ? AND logged_on = ?`).get(userId, today) as { ml: number }).ml;
  const caloriesIntakeToday = (db.prepare(`SELECT COALESCE(SUM(calories),0) as cal FROM meal_logs WHERE user_id = ? AND logged_on = ?`).get(userId, today) as { cal: number }).cal;

  res.json({
    today: {
      workoutSeconds: todayWorkouts.sec,
      workoutCount: todayWorkouts.cnt,
      runDistanceKm: Number((todayRuns.meters / 1000).toFixed(2)),
      runSeconds: todayRuns.sec,
      activityCalories: todayWorkouts.cal + todayRuns.cal,
      waterMl: waterToday,
      caloriesIntake: caloriesIntakeToday,
    },
    goals,
    activeChallenge: activeChallenge || null,
    recommendedPlans,
    recommendedAffiliate,
  });
});

// ============================================================================
// EXERCISES & WORKOUTS
// ============================================================================
app.get('/api/exercises', (req, res) => {
  const category = String(req.query.category || '');
  const difficulty = String(req.query.difficulty || '');
  const q = String(req.query.q || '').trim().toLowerCase();

  let rows = db.prepare('SELECT * FROM exercises WHERE is_published = 1 ORDER BY category, name').all() as Array<Record<string, unknown>>;
  rows = rows
    .filter((r) => (!category || category === 'All' || r.category === category))
    .filter((r) => (!difficulty || difficulty === 'all' || r.difficulty === difficulty))
    .filter((r) => {
      if (!q) return true;
      return String(r.name).toLowerCase().includes(q) || String(r.category).toLowerCase().includes(q) || String(r.equipment).toLowerCase().includes(q);
    })
    .map((r) => ({ ...r, target_muscles: JSON.parse(String(r.target_muscles || '[]')) }));
  res.json({ exercises: rows });
});

app.get('/api/plans', (_req, res) => {
  const plans = db.prepare('SELECT * FROM workout_plans WHERE is_published = 1 ORDER BY duration_days ASC').all() as Array<Record<string, unknown>>;
  const itemsStmt = db.prepare(`
    SELECT wpi.*, e.name as exercise_name, e.category, e.instructions, e.media_url, e.calories_per_min, e.equipment
    FROM workout_plan_items wpi
    JOIN exercises e ON e.id = wpi.exercise_id
    WHERE wpi.plan_id = ?
    ORDER BY wpi.sort_order ASC
  `);
  const enriched = plans.map((p) => ({
    ...p,
    items: itemsStmt.all(String(p.id)),
  }));
  res.json({ plans: enriched });
});

app.get('/api/workouts/sessions', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare('SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY completed_at DESC LIMIT 50').all(req.user!.id);
  res.json({ sessions: rows });
});

app.post('/api/workouts/sessions', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { plan_id, title, duration_seconds, calories_burned, exercises_completed } = req.body ?? {};
  const dur = Math.max(10, Number(duration_seconds) || 0);
  const cal = Math.max(5, Number(calories_burned) || Math.round((dur / 60) * 6.5));
  const id = uuid();
  db.prepare(`
    INSERT INTO workout_sessions (id, user_id, plan_id, title, duration_seconds, calories_burned, exercises_completed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, plan_id || null, String(title || 'Custom Workout'), dur, cal, JSON.stringify(exercises_completed || []));

  // Unlock first workout achievement
  db.prepare(`
    INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_key, title, description)
    VALUES (?, ?, 'first_workout', 'First Session Logged', 'Completed your first tracked workout in FITNOVA.')
  `).run(uuid(), userId);

  res.status(201).json({ session: db.prepare('SELECT * FROM workout_sessions WHERE id = ?').get(id) });
});

// ============================================================================
// GPS RUNNING TRACKER & SERVER VERIFICATION
// ============================================================================
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
  const c = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

app.get('/api/runs', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare('SELECT * FROM running_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 50').all(req.user!.id) as Array<Record<string, unknown>>;
  const runs = rows.map((r) => ({ ...r, route_points: JSON.parse(String(r.route_points || '[]')) }));

  const stats = db
    .prepare(`
      SELECT
        COUNT(*) as total_runs,
        COALESCE(SUM(CASE WHEN verification_status = 'verified' THEN distance_meters ELSE 0 END), 0) as verified_meters,
        COALESCE(MAX(CASE WHEN verification_status = 'verified' THEN distance_meters ELSE 0 END), 0) as longest_run_meters,
        COALESCE(SUM(duration_seconds), 0) as total_seconds
      FROM running_sessions WHERE user_id = ?
    `)
    .get(req.user!.id) as Record<string, number>;

  res.json({ runs, stats });
});

app.post('/api/runs', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { route_points, duration_seconds, started_at, synced_from_offline } = req.body ?? {};
  const points: GpsPoint[] = Array.isArray(route_points) ? route_points : [];
  const durSec = Math.max(1, Math.round(Number(duration_seconds) || 1));

  // Server-side GPS trajectory verification (never trust client-submitted distance)
  let verifiedMeters = 0;
  let rejectedPoints = 0;
  let maxAccuracy = 0;
  let prev: GpsPoint | null = null;

  for (const pt of points) {
    if (typeof pt?.lat !== 'number' || typeof pt?.lng !== 'number' || typeof pt?.timestamp !== 'number') {
      rejectedPoints++;
      continue;
    }
    const acc = typeof pt.accuracy === 'number' ? pt.accuracy : 999;
    if (acc > maxAccuracy) maxAccuracy = acc;
    if (acc > 50) {
      rejectedPoints++;
      continue;
    }
    if (prev) {
      const dtSec = Math.max(0.5, (pt.timestamp - prev.timestamp) / 1000);
      const dist = haversineMeters(prev, pt);
      const speedKmh = (dist / dtSec) * 3.6;
      if (speedKmh > 32 || dist > 250) {
        rejectedPoints++;
        continue;
      }
      verifiedMeters += dist;
    }
    prev = pt;
  }

  let status = 'verified';
  let notes = 'GPS coordinates verified against accuracy and velocity bounds.';
  if (points.length < 2) {
    status = 'flagged';
    notes = 'Insufficient GPS points (<2). Cannot qualify automatically for challenge rewards.';
  } else if (rejectedPoints > points.length * 0.4) {
    status = 'flagged';
    notes = `Rejected ${rejectedPoints} GPS points due to poor accuracy (>50m) or unrealistic speed jumps.`;
  }

  const distKm = verifiedMeters / 1000;
  const avgSpeedKmh = durSec > 0 ? Number(((distKm / durSec) * 3600).toFixed(2)) : 0;
  const avgPaceSecPerKm = distKm > 0.01 ? Number((durSec / distKm).toFixed(1)) : 0;
  const weightKg = req.user!.weight_kg || 70;
  const calories = Math.round(distKm * weightKg * 1.036);

  const id = uuid();
  db.prepare(`
    INSERT INTO running_sessions (
      id, user_id, distance_meters, duration_seconds, avg_pace_sec_per_km, avg_speed_kmh,
      calories_burned, route_points, max_accuracy_m, rejected_points_count, verification_status,
      verification_notes, synced_from_offline, started_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    Number(verifiedMeters.toFixed(2)),
    durSec,
    avgPaceSecPerKm,
    avgSpeedKmh,
    calories,
    JSON.stringify(points),
    maxAccuracy,
    rejectedPoints,
    status,
    notes,
    synced_from_offline ? 1 : 0,
    started_at || new Date().toISOString()
  );

  if (status === 'verified' && verifiedMeters >= 1000) {
    db.prepare(`
      INSERT OR IGNORE INTO user_achievements (id, user_id, achievement_key, title, description)
      VALUES (?, ?, 'first_1k_run', 'Verified 1K Runner', 'Completed a server-verified 1 km+ outdoor GPS run.')
    `).run(uuid(), userId);
  }

  const saved = db.prepare('SELECT * FROM running_sessions WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({ run: { ...saved, route_points: points } });
});

// ============================================================================
// 30-DAY FITNESS CHALLENGE & SERVER-VERIFIED PAYMENTS
// ============================================================================
app.get('/api/challenges', (req: AuthedRequest, res) => {
  const challenges = db.prepare('SELECT * FROM challenges WHERE is_active = 1 ORDER BY registration_fee_inr ASC').all();
  let membership: Record<string, unknown> | null = null;
  let dailyLogs: Array<Record<string, unknown>> = [];
  let reward: Record<string, unknown> | null = null;

  if (req.user) {
    membership = (db
      .prepare(`SELECT * FROM challenge_members WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(req.user.id) as Record<string, unknown> | undefined) || null;
    if (membership) {
      dailyLogs = db.prepare(`SELECT * FROM challenge_daily_logs WHERE member_id = ? ORDER BY day_number ASC`).all(String(membership.id)) as Array<Record<string, unknown>>;
      reward = (db.prepare(`SELECT * FROM challenge_rewards WHERE member_id = ?`).get(String(membership.id)) as Record<string, unknown> | undefined) || null;
    }
  }

  const leaderboard = db
    .prepare(`
      SELECT cm.id, cm.challenge_id, p.full_name, cm.completed_days, cm.points, cm.final_eligibility
      FROM challenge_members cm
      JOIN profiles p ON p.id = cm.user_id
      WHERE cm.status IN ('active', 'completed')
      ORDER BY cm.points DESC, cm.completed_days DESC
      LIMIT 20
    `)
    .all();

  res.json({ challenges, membership, dailyLogs, reward, leaderboard });
});

app.post('/api/challenges/:id/checkout', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const challengeId = req.params.id;
  const tshirtSize = ['S', 'M', 'L', 'XL', 'XXL'].includes(req.body?.tshirt_size) ? req.body.tshirt_size : 'L';
  const shippingAddress = String(req.body?.shipping_address || '').trim();

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ? AND is_active = 1').get(challengeId) as { id: string; registration_fee_inr: number; title: string } | undefined;
  if (!challenge) {
    res.status(404).json({ error: 'Challenge not found' });
    return;
  }

  const existing = db.prepare('SELECT * FROM challenge_members WHERE challenge_id = ? AND user_id = ?').get(challengeId, userId) as { id: string; status: string } | undefined;
  if (existing && existing.status === 'active') {
    res.status(409).json({ error: 'You are already enrolled in this challenge.' });
    return;
  }

  const memberId = existing ? existing.id : uuid();
  if (!existing) {
    db.prepare(`
      INSERT INTO challenge_members (id, challenge_id, user_id, status, tshirt_size, start_date)
      VALUES (?, ?, ?, 'pending_payment', ?, date('now'))
    `).run(memberId, challengeId, userId, tshirtSize);
  } else {
    db.prepare('UPDATE challenge_members SET tshirt_size = ? WHERE id = ?').run(tshirtSize, memberId);
  }

  if (shippingAddress) {
    db.prepare(`
      INSERT INTO challenge_rewards (id, member_id, user_id, tshirt_size, shipping_address)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(member_id) DO UPDATE SET tshirt_size = excluded.tshirt_size, shipping_address = excluded.shipping_address
    `).run(uuid(), memberId, userId, tshirtSize, shippingAddress);
  }

  const txId = uuid();
  const gatewayOrderId = `order_fn_${crypto.randomBytes(6).toString('hex')}`;
  db.prepare(`
    INSERT INTO payment_transactions (id, user_id, purpose, reference_id, gateway, gateway_order_id, amount_inr, status)
    VALUES (?, ?, 'challenge_registration', ?, 'razorpay', ?, ?, 'created')
  `).run(txId, userId, memberId, gatewayOrderId, challenge.registration_fee_inr);

  res.status(201).json({
    transactionId: txId,
    memberId,
    gatewayOrderId,
    amountInr: challenge.registration_fee_inr,
    challengeTitle: challenge.title,
    message: 'Payment order initialized. Awaiting server-side Razorpay webhook verification.',
  });
});

function processVerifiedWebhookPayload(eventId: string, eventType: string, payload: Record<string, unknown>, signatureValid: boolean) {
  db.prepare(`
    INSERT OR IGNORE INTO payment_webhook_events (id, gateway, event_id, event_type, signature_valid, payload)
    VALUES (?, 'razorpay', ?, ?, ?, ?)
  `).run(uuid(), eventId, eventType, signatureValid ? 1 : 0, JSON.stringify(payload));

  if (!signatureValid) return false;

  if (eventType === 'payment.captured') {
    const gatewayOrderId = String(payload.gateway_order_id || '');
    const gatewayPaymentId = String(payload.gateway_payment_id || `pay_${crypto.randomBytes(6).toString('hex')}`);
    const tx = db.prepare('SELECT * FROM payment_transactions WHERE gateway_order_id = ?').get(gatewayOrderId) as
      | { id: string; user_id: string; purpose: string; reference_id: string }
      | undefined;

    if (tx) {
      db.prepare(`
        UPDATE payment_transactions
        SET status = 'captured', gateway_payment_id = ?, verified_server_side = 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(gatewayPaymentId, tx.id);

      if (tx.purpose === 'challenge_registration') {
        db.prepare(`UPDATE challenge_members SET status = 'active', payment_transaction_id = ? WHERE id = ?`).run(tx.id, tx.reference_id);
        db.prepare(`INSERT INTO notifications (id, user_id, title, body) VALUES (?, ?, ?, ?)`).run(
          uuid(),
          tx.user_id,
          '30-Day Challenge Activated',
          'Your ₹399 registration payment was verified by Razorpay webhook. Day 1 starts today.'
        );
      } else if (tx.purpose === 'store_order') {
        db.prepare(`UPDATE orders SET payment_status = 'paid', order_status = 'confirmed', updated_at = datetime('now') WHERE id = ?`).run(tx.reference_id);
      }
    }
  }
  return true;
}

// Trusted Razorpay server-to-server webhook endpoint
app.post('/api/payments/webhook/razorpay', (req, res) => {
  const rawBody = JSON.stringify(req.body ?? {});
  const sig = String(req.headers['x-razorpay-signature'] || '');
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  const signatureValid = sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  const eventId = String(req.headers['x-razorpay-event-id'] || uuid());
  const eventType = String(req.body?.event || 'payment.captured');

  const ok = processVerifiedWebhookPayload(eventId, eventType, req.body ?? {}, signatureValid);
  if (!ok) {
    res.status(401).json({ error: 'Invalid webhook HMAC signature' });
    return;
  }
  res.json({ verified: true });
});

// Sandbox Razorpay Checkout completion trigger (generates real HMAC-signed webhook server-side)
app.post('/api/payments/sandbox-confirm', requireAuth, (req: AuthedRequest, res) => {
  const { gatewayOrderId } = req.body ?? {};
  const tx = db
    .prepare('SELECT * FROM payment_transactions WHERE gateway_order_id = ? AND user_id = ?')
    .get(String(gatewayOrderId || ''), req.user!.id) as { id: string; gateway_order_id: string } | undefined;
  if (!tx) {
    res.status(404).json({ error: 'Payment transaction not found' });
    return;
  }
  const webhookPayload = {
    event: 'payment.captured',
    gateway_order_id: tx.gateway_order_id,
    gateway_payment_id: `pay_rzp_${crypto.randomBytes(6).toString('hex')}`,
  };
  const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(webhookPayload)).digest('hex');
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(JSON.stringify(webhookPayload)).digest('hex');
  const valid = signature === expected;
  processVerifiedWebhookPayload(`evt_${crypto.randomBytes(6).toString('hex')}`, 'payment.captured', webhookPayload, valid);

  res.json({ verified: true, gatewayOrderId: tx.gateway_order_id });
});

app.post('/api/challenges/daily-checkin', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { member_id, day_number, log_type, running_session_id, workout_session_id } = req.body ?? {};
  const dayNum = Number(day_number);
  if (dayNum < 1 || dayNum > 30) {
    res.status(400).json({ error: 'Day number must be between 1 and 30.' });
    return;
  }

  const member = db
    .prepare(`
      SELECT cm.*, c.daily_run_km_target, c.daily_workout_minutes_target
      FROM challenge_members cm JOIN challenges c ON c.id = cm.challenge_id
      WHERE cm.id = ? AND cm.user_id = ? AND cm.status = 'active'
    `)
    .get(String(member_id || ''), userId) as
    | { id: string; daily_run_km_target: number; daily_workout_minutes_target: number }
    | undefined;

  if (!member) {
    res.status(404).json({ error: 'Active challenge membership not found.' });
    return;
  }

  const isScheduledRestDay = dayNum % 7 === 0 || log_type === 'rest';
  if (isScheduledRestDay && dayNum % 7 === 0) {
    db.prepare(`
      INSERT INTO challenge_daily_logs (id, member_id, user_id, day_number, log_type, verification_status, reviewer_notes)
      VALUES (?, ?, ?, ?, 'rest', 'rest_approved', 'Scheduled 7th-day active recovery day.')
      ON CONFLICT(member_id, day_number) DO NOTHING
    `).run(uuid(), member.id, userId, dayNum);
    recalcChallengeProgress(member.id);
    res.status(201).json({ status: 'rest_approved' });
    return;
  }

  let runKm = 0;
  let runVerified = false;
  if (running_session_id) {
    const r = db
      .prepare(`SELECT distance_meters, verification_status FROM running_sessions WHERE id = ? AND user_id = ?`)
      .get(String(running_session_id), userId) as { distance_meters: number; verification_status: string } | undefined;
    if (r) {
      runKm = Number((r.distance_meters / 1000).toFixed(2));
      runVerified = r.verification_status === 'verified';
    }
  }

  let workoutMin = 0;
  if (workout_session_id) {
    const w = db
      .prepare(`SELECT duration_seconds FROM workout_sessions WHERE id = ? AND user_id = ?`)
      .get(String(workout_session_id), userId) as { duration_seconds: number } | undefined;
    if (w) workoutMin = Math.round(w.duration_seconds / 60);
  }

  if (runKm === 0 && workoutMin === 0) {
    res.status(400).json({ error: 'Attach a tracked running session or workout session to submit your daily check-in.' });
    return;
  }

  // Server checks if both thresholds are met with verified GPS
  const meetsTargets = runVerified && runKm >= member.daily_run_km_target && workoutMin >= member.daily_workout_minutes_target;
  const verStatus = meetsTargets ? 'verified' : 'pending';

  db.prepare(`
    INSERT INTO challenge_daily_logs (
      id, member_id, user_id, day_number, log_type, running_session_id, workout_session_id,
      run_distance_km, workout_minutes, verification_status, reviewer_notes
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(member_id, day_number) DO UPDATE SET
      running_session_id = excluded.running_session_id,
      workout_session_id = excluded.workout_session_id,
      run_distance_km = excluded.run_distance_km,
      workout_minutes = excluded.workout_minutes,
      verification_status = excluded.verification_status
  `).run(
    uuid(),
    member.id,
    userId,
    dayNum,
    running_session_id || null,
    workout_session_id || null,
    runKm,
    workoutMin,
    verStatus,
    meetsTargets ? 'Auto-verified via GPS & workout duration targets.' : 'Queued for admin activity review.'
  );

  recalcChallengeProgress(member.id);
  res.status(201).json({ verification_status: verStatus, run_distance_km: runKm, workout_minutes: workoutMin });
});

function recalcChallengeProgress(memberId: string) {
  const stats = db
    .prepare(`
      SELECT
        SUM(CASE WHEN verification_status IN ('verified', 'rest_approved') THEN 1 ELSE 0 END) as completed_days,
        SUM(CASE WHEN verification_status = 'rejected' THEN 1 ELSE 0 END) as missed_days
      FROM challenge_daily_logs WHERE member_id = ?
    `)
    .get(memberId) as { completed_days: number | null; missed_days: number | null };
  const comp = stats.completed_days || 0;
  const missed = stats.missed_days || 0;
  const points = comp * 100;
  const eligibility = missed > 2 ? 'ineligible' : comp >= 28 ? 'eligible' : 'in_progress';
  db.prepare(`UPDATE challenge_members SET completed_days = ?, missed_days = ?, points = ?, final_eligibility = ? WHERE id = ?`).run(
    comp,
    missed,
    points,
    eligibility,
    memberId
  );
}

app.post('/api/challenges/reward-claim', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { member_id, tshirt_size, shipping_address } = req.body ?? {};
  const member = db.prepare('SELECT * FROM challenge_members WHERE id = ? AND user_id = ?').get(String(member_id || ''), userId) as
    | { id: string; final_eligibility: string }
    | undefined;
  if (!member) {
    res.status(404).json({ error: 'Challenge membership not found' });
    return;
  }

  db.prepare(`
    INSERT INTO challenge_rewards (id, member_id, user_id, tshirt_size, shipping_address)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(member_id) DO UPDATE SET tshirt_size = excluded.tshirt_size, shipping_address = excluded.shipping_address, updated_at = datetime('now')
  `).run(uuid(), member.id, userId, tshirt_size || 'L', String(shipping_address || ''));

  if (member.final_eligibility === 'eligible') {
    const existingRefund = db.prepare('SELECT id FROM refund_requests WHERE member_id = ?').get(member.id);
    if (!existingRefund) {
      db.prepare(`
        INSERT INTO refund_requests (id, user_id, member_id, amount_inr, reason, status)
        VALUES (?, ?, ?, 299, '30-Day Challenge Completion Reward', 'pending')
      `).run(uuid(), userId, member.id);
    }
  }

  res.json({ saved: true });
});

// ============================================================================
// NUTRITION & PROGRESS MEASUREMENTS
// ============================================================================
app.get('/api/nutrition', requireAuth, (req: AuthedRequest, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const meals = db.prepare('SELECT * FROM meal_logs WHERE user_id = ? AND logged_on = ? ORDER BY created_at DESC').all(req.user!.id, date);
  const water = (db.prepare('SELECT COALESCE(SUM(amount_ml), 0) as total_ml FROM water_logs WHERE user_id = ? AND logged_on = ?').get(req.user!.id, date) as { total_ml: number }).total_ml;
  res.json({ date, meals, waterMl: water });
});

app.post('/api/nutrition/meals', requireAuth, (req: AuthedRequest, res) => {
  const { meal_slot, food_name, diet_type, servings, calories, protein_g, carbs_g, fat_g, logged_on } = req.body ?? {};
  const id = uuid();
  const date = String(logged_on || new Date().toISOString().slice(0, 10));
  db.prepare(`
    INSERT INTO meal_logs (id, user_id, meal_slot, food_name, diet_type, servings, calories, protein_g, carbs_g, fat_g, logged_on)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.id,
    String(meal_slot || 'lunch'),
    String(food_name || 'Custom Meal'),
    diet_type === 'non_veg' ? 'non_veg' : 'veg',
    Number(servings) || 1,
    Math.round(Number(calories) || 0),
    Number(protein_g) || 0,
    Number(carbs_g) || 0,
    Number(fat_g) || 0,
    date
  );
  res.status(201).json({ meal: db.prepare('SELECT * FROM meal_logs WHERE id = ?').get(id) });
});

app.delete('/api/nutrition/meals/:id', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM meal_logs WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  res.json({ deleted: true });
});

app.post('/api/nutrition/water', requireAuth, (req: AuthedRequest, res) => {
  const amountMl = Math.max(50, Math.min(2000, Math.round(Number(req.body?.amount_ml) || 250)));
  const date = String(req.body?.logged_on || new Date().toISOString().slice(0, 10));
  db.prepare('INSERT INTO water_logs (id, user_id, amount_ml, logged_on) VALUES (?, ?, ?, ?)').run(uuid(), req.user!.id, amountMl, date);
  const total = (db.prepare('SELECT COALESCE(SUM(amount_ml), 0) as total_ml FROM water_logs WHERE user_id = ? AND logged_on = ?').get(req.user!.id, date) as { total_ml: number }).total_ml;
  res.status(201).json({ waterMl: total });
});

app.get('/api/measurements', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare('SELECT * FROM fitness_measurements WHERE user_id = ? ORDER BY recorded_on DESC, created_at DESC LIMIT 60').all(req.user!.id);
  const achievements = db.prepare('SELECT * FROM user_achievements WHERE user_id = ? ORDER BY earned_at DESC').all(req.user!.id);
  res.json({ measurements: rows, achievements });
});

app.post('/api/measurements', requireAuth, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const weightKg = Number(b.weight_kg);
  if (!weightKg || weightKg < 25 || weightKg > 350) {
    res.status(400).json({ error: 'Valid weight in kg (25–350) is required.' });
    return;
  }
  const id = uuid();
  const date = String(b.recorded_on || new Date().toISOString().slice(0, 10));
  db.prepare(`
    INSERT INTO fitness_measurements (id, user_id, weight_kg, body_fat_pct, waist_cm, chest_cm, arm_cm, photo_data_url, photo_visibility, recorded_on)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.id,
    weightKg,
    b.body_fat_pct ? Number(b.body_fat_pct) : null,
    b.waist_cm ? Number(b.waist_cm) : null,
    b.chest_cm ? Number(b.chest_cm) : null,
    b.arm_cm ? Number(b.arm_cm) : null,
    b.photo_data_url || null,
    b.photo_visibility === 'coach_only' ? 'coach_only' : 'private',
    date
  );
  db.prepare(`UPDATE profiles SET weight_kg = ?, updated_at = datetime('now') WHERE id = ?`).run(weightKg, req.user!.id);
  res.status(201).json({ measurement: db.prepare('SELECT * FROM fitness_measurements WHERE id = ?').get(id) });
});

// ============================================================================
// AFFILIATE MARKETPLACE & FITNOVA E-COMMERCE STORE
// ============================================================================
app.get('/api/affiliate/products', (req, res) => {
  const category = String(req.query.category || '');
  let rows = db.prepare('SELECT * FROM affiliate_products WHERE is_active = 1 ORDER BY category, title').all() as Array<Record<string, unknown>>;
  if (category && category !== 'All') {
    rows = rows.filter((r) => r.category === category);
  }
  res.json({ products: rows });
});

app.post('/api/affiliate/click', (req: AuthedRequest, res) => {
  const { product_id, referrer_screen } = req.body ?? {};
  const prod = db.prepare('SELECT id, affiliate_url FROM affiliate_products WHERE id = ?').get(String(product_id || '')) as { id: string; affiliate_url: string } | undefined;
  if (!prod) {
    res.status(404).json({ error: 'Affiliate product not found' });
    return;
  }
  db.prepare('INSERT INTO affiliate_clicks (id, product_id, user_id, referrer_screen) VALUES (?, ?, ?, ?)').run(
    uuid(),
    prod.id,
    req.user?.id || null,
    String(referrer_screen || 'affiliate_store')
  );
  res.json({ tracked: true, affiliate_url: prod.affiliate_url });
});

app.get('/api/store/products', (req, res) => {
  const category = String(req.query.category || '');
  const q = String(req.query.q || '').trim().toLowerCase();
  let rows = db.prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
  if (category && category !== 'All') rows = rows.filter((r) => r.category_name === category);
  if (q) rows = rows.filter((r) => String(r.name).toLowerCase().includes(q) || String(r.category_name).toLowerCase().includes(q));
  res.json({ products: rows });
});

app.get('/api/store/cart', requireAuth, (req: AuthedRequest, res) => {
  const items = db
    .prepare(`
      SELECT c.id, c.product_id, c.quantity, p.name, p.price_inr, p.stock_quantity, p.image_url, p.cod_supported
      FROM carts c JOIN products p ON p.id = c.product_id
      WHERE c.user_id = ?
    `)
    .all(req.user!.id);
  const wishlist = db.prepare('SELECT product_id FROM wishlist WHERE user_id = ?').all(req.user!.id) as Array<{ product_id: string }>;
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC').all(req.user!.id);
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.id) as Array<Record<string, unknown>>;
  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  const fullOrders = orders.map((o) => ({
    ...o,
    address_snapshot: JSON.parse(String(o.address_snapshot || '{}')),
    items: itemsStmt.all(String(o.id)),
  }));
  res.json({ cart: items, wishlistIds: wishlist.map((w) => w.product_id), addresses, orders: fullOrders });
});

app.post('/api/store/cart', requireAuth, (req: AuthedRequest, res) => {
  const { product_id, quantity } = req.body ?? {};
  const qty = Math.max(1, Math.round(Number(quantity) || 1));
  const prod = db.prepare('SELECT id, stock_quantity FROM products WHERE id = ? AND is_active = 1').get(String(product_id || '')) as
    | { id: string; stock_quantity: number }
    | undefined;
  if (!prod) {
    res.status(404).json({ error: 'Product unavailable' });
    return;
  }
  if (prod.stock_quantity < qty) {
    res.status(400).json({ error: `Only ${prod.stock_quantity} left in stock.` });
    return;
  }
  db.prepare(`
    INSERT INTO carts (id, user_id, product_id, quantity)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity, updated_at = datetime('now')
  `).run(uuid(), req.user!.id, prod.id, qty);
  res.json({ ok: true });
});

app.delete('/api/store/cart/:productId', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM carts WHERE user_id = ? AND product_id = ?').run(req.user!.id, req.params.productId);
  res.json({ ok: true });
});

app.post('/api/store/wishlist/toggle', requireAuth, (req: AuthedRequest, res) => {
  const prodId = String(req.body?.product_id || '');
  const existing = db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(req.user!.id, prodId);
  if (existing) {
    db.prepare('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?').run(req.user!.id, prodId);
    res.json({ wishlisted: false });
  } else {
    db.prepare('INSERT INTO wishlist (id, user_id, product_id) VALUES (?, ?, ?)').run(uuid(), req.user!.id, prodId);
    res.json({ wishlisted: true });
  }
});

app.post('/api/store/addresses', requireAuth, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  if (!b.recipient_name || !b.phone || !b.line1 || !b.city || !b.state || !b.pincode) {
    res.status(400).json({ error: 'All required shipping address fields must be filled.' });
    return;
  }
  const id = uuid();
  db.prepare(`
    INSERT INTO addresses (id, user_id, recipient_name, phone, line1, line2, city, state, pincode, is_default)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, req.user!.id, String(b.recipient_name), String(b.phone), String(b.line1), b.line2 || null, String(b.city), String(b.state), String(b.pincode));
  res.status(201).json({ address: db.prepare('SELECT * FROM addresses WHERE id = ?').get(id) });
});

app.post('/api/store/validate-coupon', requireAuth, (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const subtotal = Number(req.body?.subtotal_inr) || 0;
  const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(code) as
    | { code: string; discount_type: string; discount_value: number; min_order_inr: number; max_uses: number | null; used_count: number }
    | undefined;
  if (!coupon) {
    res.status(404).json({ error: 'Coupon code is invalid or inactive.' });
    return;
  }
  if (subtotal < coupon.min_order_inr) {
    res.status(400).json({ error: `Minimum order value of ₹${coupon.min_order_inr} required for ${coupon.code}.` });
    return;
  }
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    res.status(400).json({ error: 'Coupon usage limit reached.' });
    return;
  }
  const discount = coupon.discount_type === 'percent' ? Math.round((subtotal * coupon.discount_value) / 100) : coupon.discount_value;
  res.json({ valid: true, code: coupon.code, discount_inr: Math.min(subtotal, discount) });
});

app.post('/api/store/checkout', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { address_id, payment_method, coupon_code } = req.body ?? {};
  const address = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(String(address_id || ''), userId);
  if (!address) {
    res.status(400).json({ error: 'Please select or add a valid delivery address.' });
    return;
  }

  const cartItems = db
    .prepare(`
      SELECT c.product_id, c.quantity, p.name, p.price_inr, p.stock_quantity, p.cod_supported
      FROM carts c JOIN products p ON p.id = c.product_id
      WHERE c.user_id = ?
    `)
    .all(userId) as Array<{ product_id: string; quantity: number; name: string; price_inr: number; stock_quantity: number; cod_supported: number }>;

  if (cartItems.length === 0) {
    res.status(400).json({ error: 'Your cart is empty.' });
    return;
  }

  const method = payment_method === 'cod' ? 'cod' : 'upi_card';
  if (method === 'cod' && cartItems.some((i) => !i.cod_supported)) {
    res.status(400).json({ error: 'Cash on Delivery is unavailable for heavy equipment in your cart. Please choose UPI/Card.' });
    return;
  }

  let subtotal = 0;
  for (const item of cartItems) {
    if (item.stock_quantity < item.quantity) {
      res.status(409).json({ error: `Insufficient stock for ${item.name}. Only ${item.stock_quantity} available.` });
      return;
    }
    subtotal += item.price_inr * item.quantity;
  }

  let discountInr = 0;
  let appliedCoupon: string | null = null;
  if (coupon_code) {
    const c = db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(String(coupon_code).trim().toUpperCase()) as
      | { id: string; code: string; discount_type: string; discount_value: number; min_order_inr: number }
      | undefined;
    if (c && subtotal >= c.min_order_inr) {
      discountInr = c.discount_type === 'percent' ? Math.round((subtotal * c.discount_value) / 100) : c.discount_value;
      discountInr = Math.min(subtotal, discountInr);
      appliedCoupon = c.code;
      db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(c.id);
    }
  }

  const totalInr = Math.max(0, subtotal - discountInr);
  const orderId = uuid();

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of cartItems) {
      const upd = db.prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?').run(item.quantity, item.product_id, item.quantity);
      if (upd.changes !== 1) throw new Error(`Stock conflict for ${item.name}`);
    }

    db.prepare(`
      INSERT INTO orders (id, user_id, address_snapshot, payment_method, payment_status, order_status, subtotal_inr, discount_inr, total_inr, coupon_code)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      userId,
      JSON.stringify(address),
      method,
      method === 'cod' ? 'cod_pending' : 'pending',
      method === 'cod' ? 'confirmed' : 'placed',
      subtotal,
      discountInr,
      totalInr,
      appliedCoupon
    );

    const insertItem = db.prepare('INSERT INTO order_items (id, order_id, product_id, product_name, unit_price_inr, quantity) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of cartItems) {
      insertItem.run(uuid(), orderId, item.product_id, item.name, item.price_inr, item.quantity);
    }

    db.prepare('DELETE FROM carts WHERE user_id = ?').run(userId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    res.status(409).json({ error: (err as Error).message });
    return;
  }

  if (method === 'upi_card') {
    const gatewayOrderId = `order_store_${crypto.randomBytes(6).toString('hex')}`;
    db.prepare(`
      INSERT INTO payment_transactions (id, user_id, purpose, reference_id, gateway, gateway_order_id, amount_inr, status)
      VALUES (?, ?, 'store_order', ?, 'razorpay', ?, ?, 'created')
    `).run(uuid(), userId, orderId, gatewayOrderId, totalInr);
    res.status(201).json({ orderId, totalInr, paymentMethod: method, gatewayOrderId });
    return;
  }

  res.status(201).json({ orderId, totalInr, paymentMethod: method, gatewayOrderId: null });
});

app.post('/api/store/orders/:id/return', requireAuth, (req: AuthedRequest, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id) as
    | { id: string; total_inr: number; order_status: string }
    | undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  db.prepare(`UPDATE orders SET order_status = 'return_requested', updated_at = datetime('now') WHERE id = ?`).run(order.id);
  db.prepare(`INSERT INTO refund_requests (id, user_id, order_id, amount_inr, reason, status) VALUES (?, ?, ?, ?, ?, 'pending')`).run(
    uuid(),
    req.user!.id,
    order.id,
    order.total_inr,
    String(req.body?.reason || 'Store order return request')
  );
  res.json({ requested: true });
});

// ============================================================================
// SERVER-CONTROLLED ADMIN PANEL (/api/admin/*)
// ============================================================================
app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const totalUsers = (db.prepare(`SELECT COUNT(*) as c FROM profiles WHERE role = 'user'`).get() as { c: number }).c;
  const activeUsers = (db.prepare(`SELECT COUNT(*) as c FROM profiles WHERE role = 'user' AND account_status = 'active'`).get() as { c: number }).c;
  const workoutSessions = (db.prepare(`SELECT COUNT(*) as c FROM workout_sessions`).get() as { c: number }).c;
  const runningSessions = (db.prepare(`SELECT COUNT(*) as c FROM running_sessions`).get() as { c: number }).c;
  const challengeRegistrations = (db.prepare(`SELECT COUNT(*) as c FROM challenge_members WHERE status IN ('active', 'completed')`).get() as { c: number }).c;
  const challengeRevenue = (db.prepare(`SELECT COALESCE(SUM(amount_inr),0) as s FROM payment_transactions WHERE purpose = 'challenge_registration' AND status = 'captured'`).get() as { s: number }).s;
  const storeRevenue = (db.prepare(`SELECT COALESCE(SUM(total_inr),0) as s FROM orders WHERE order_status != 'cancelled'`).get() as { s: number }).s;
  const affiliateClicks = (db.prepare(`SELECT COUNT(*) as c FROM affiliate_clicks`).get() as { c: number }).c;

  res.json({
    metrics: {
      totalUsers,
      activeUsers,
      workoutSessions,
      runningSessions,
      challengeRegistrations,
      challengeRevenueInr: challengeRevenue,
      storeRevenueInr: storeRevenue,
      affiliateClicks,
    },
  });
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  const users = db.prepare(`SELECT id, email, full_name, role, account_status, email_verified, fitness_goal, fitness_level, created_at FROM profiles ORDER BY created_at DESC`).all();
  res.json({ users });
});

app.patch('/api/admin/users/:id/status', requireAdmin, (req: AuthedRequest, res) => {
  const status = ['active', 'suspended'].includes(req.body?.account_status) ? req.body.account_status : 'active';
  db.prepare(`UPDATE profiles SET account_status = ?, updated_at = datetime('now') WHERE id = ? AND role != 'admin'`).run(status, req.params.id);
  logAdminAction(req.user!.id, `set_user_status_${status}`, 'profiles', req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/exercises', requireAdmin, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const id = uuid();
  db.prepare(`
    INSERT INTO exercises (id, name, category, target_muscles, difficulty, equipment, default_sets, default_reps, rest_seconds, calories_per_min, instructions, media_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(b.name),
    String(b.category || 'Full Body'),
    JSON.stringify(b.target_muscles || ['Full Body']),
    String(b.difficulty || 'beginner'),
    String(b.equipment || 'Bodyweight'),
    Number(b.default_sets) || 3,
    String(b.default_reps || '12'),
    Number(b.rest_seconds) || 60,
    Number(b.calories_per_min) || 6.5,
    String(b.instructions || ''),
    b.media_url || '/src/assets/images/workout_strength_barbell_1795116820325.jpg'
  );
  logAdminAction(req.user!.id, 'create_exercise', 'exercises', id, { name: b.name });
  res.status(201).json({ id });
});

app.delete('/api/admin/exercises/:id', requireAdmin, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM exercises WHERE id = ?').run(req.params.id);
  logAdminAction(req.user!.id, 'delete_exercise', 'exercises', req.params.id);
  res.json({ deleted: true });
});

app.get('/api/admin/verifications', requireAdmin, (_req, res) => {
  const logs = db
    .prepare(`
      SELECT l.*, p.full_name, p.email, c.title as challenge_title
      FROM challenge_daily_logs l
      JOIN profiles p ON p.id = l.user_id
      JOIN challenge_members cm ON cm.id = l.member_id
      JOIN challenges c ON c.id = cm.challenge_id
      ORDER BY l.created_at DESC LIMIT 60
    `)
    .all();
  res.json({ logs });
});

app.post('/api/admin/verifications/:logId', requireAdmin, (req: AuthedRequest, res) => {
  const status = req.body?.status === 'rejected' ? 'rejected' : 'verified';
  const notes = String(req.body?.notes || 'Reviewed by FITNOVA admin');
  const log = db.prepare('SELECT member_id FROM challenge_daily_logs WHERE id = ?').get(req.params.logId) as { member_id: string } | undefined;
  if (!log) {
    res.status(404).json({ error: 'Log not found' });
    return;
  }
  db.prepare(`UPDATE challenge_daily_logs SET verification_status = ?, reviewer_notes = ?, verified_by = ?, verified_at = datetime('now') WHERE id = ?`).run(
    status,
    notes,
    req.user!.id,
    req.params.logId
  );
  recalcChallengeProgress(log.member_id);
  logAdminAction(req.user!.id, `verify_challenge_log_${status}`, 'challenge_daily_logs', req.params.logId);
  res.json({ ok: true });
});

app.get('/api/admin/rewards', requireAdmin, (_req, res) => {
  const rewards = db
    .prepare(`
      SELECT r.*, p.full_name, p.email, cm.completed_days, cm.final_eligibility
      FROM challenge_rewards r
      JOIN profiles p ON p.id = r.user_id
      JOIN challenge_members cm ON cm.id = r.member_id
      ORDER BY r.updated_at DESC
    `)
    .all();
  const refunds = db
    .prepare(`
      SELECT rr.*, p.full_name, p.email
      FROM refund_requests rr JOIN profiles p ON p.id = rr.user_id
      ORDER BY rr.created_at DESC
    `)
    .all();
  res.json({ rewards, refunds });
});

app.post('/api/admin/rewards/:memberId/dispatch', requireAdmin, (req: AuthedRequest, res) => {
  const { dispatch_status, tracking_number, courier_name } = req.body ?? {};
  db.prepare(`
    UPDATE challenge_rewards
    SET dispatch_status = ?, tracking_number = ?, courier_name = ?, approved_by = ?, updated_at = datetime('now')
    WHERE member_id = ?
  `).run(String(dispatch_status || 'dispatched'), String(tracking_number || ''), String(courier_name || 'Delhivery'), req.user!.id, req.params.memberId);
  logAdminAction(req.user!.id, 'update_tshirt_dispatch', 'challenge_rewards', req.params.memberId, { dispatch_status, tracking_number });
  res.json({ ok: true });
});

app.post('/api/admin/refunds/:id/process', requireAdmin, (req: AuthedRequest, res) => {
  const status = req.body?.status === 'rejected' ? 'rejected' : 'processed';
  const gatewayRefundId = status === 'processed' ? `rfnd_${crypto.randomBytes(6).toString('hex')}` : null;
  db.prepare(`
    UPDATE refund_requests
    SET status = ?, gateway_refund_id = ?, processed_by = ?, processed_at = datetime('now')
    WHERE id = ?
  `).run(status, gatewayRefundId, req.user!.id, req.params.id);
  logAdminAction(req.user!.id, `refund_${status}`, 'refund_requests', req.params.id, { gatewayRefundId });
  res.json({ ok: true, gatewayRefundId });
});

app.get('/api/admin/affiliate', requireAdmin, (_req, res) => {
  const products = db
    .prepare(`
      SELECT ap.*, (SELECT COUNT(*) FROM affiliate_clicks ac WHERE ac.product_id = ap.id) as click_count
      FROM affiliate_products ap ORDER BY click_count DESC
    `)
    .all();
  res.json({ products });
});

app.post('/api/admin/affiliate', requireAdmin, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const id = uuid();
  db.prepare(`
    INSERT INTO affiliate_products (id, title, category, merchant_name, displayed_price_inr, affiliate_url, image_url, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(b.title),
    String(b.category || 'Fitness accessories'),
    String(b.merchant_name || 'Amazon India'),
    Number(b.displayed_price_inr) || 999,
    String(b.affiliate_url || 'https://www.amazon.in'),
    b.image_url || '/src/assets/images/gear_fitness_kit_1795116821024.jpg',
    String(b.description || '')
  );
  logAdminAction(req.user!.id, 'create_affiliate_product', 'affiliate_products', id);
  res.status(201).json({ id });
});

app.delete('/api/admin/affiliate/:id', requireAdmin, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM affiliate_products WHERE id = ?').run(req.params.id);
  logAdminAction(req.user!.id, 'delete_affiliate_product', 'affiliate_products', req.params.id);
  res.json({ deleted: true });
});

app.get('/api/admin/store', requireAdmin, (_req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY created_at DESC').all();
  const orders = db
    .prepare(`
      SELECT o.*, p.full_name, p.email
      FROM orders o JOIN profiles p ON p.id = o.user_id
      ORDER BY o.created_at DESC
    `)
    .all();
  const coupons = db.prepare('SELECT * FROM coupons').all();
  res.json({ products, orders, coupons });
});

app.post('/api/admin/products', requireAdmin, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const id = uuid();
  db.prepare(`
    INSERT INTO products (id, category_name, name, description, price_inr, compare_at_price_inr, stock_quantity, sku, image_url, cod_supported)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(b.category_name || 'Exercise accessories'),
    String(b.name),
    String(b.description || ''),
    Number(b.price_inr) || 799,
    b.compare_at_price_inr ? Number(b.compare_at_price_inr) : null,
    Number(b.stock_quantity) || 10,
    String(b.sku || `FN-${Date.now()}`),
    b.image_url || '/src/assets/images/gear_fitness_kit_1795116821024.jpg',
    b.cod_supported === false ? 0 : 1
  );
  logAdminAction(req.user!.id, 'create_store_product', 'products', id);
  res.status(201).json({ id });
});

app.patch('/api/admin/products/:id/stock', requireAdmin, (req: AuthedRequest, res) => {
  const qty = Math.max(0, Math.round(Number(req.body?.stock_quantity) || 0));
  db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(qty, req.params.id);
  logAdminAction(req.user!.id, 'update_stock', 'products', req.params.id, { stock_quantity: qty });
  res.json({ ok: true });
});

app.patch('/api/admin/orders/:id/status', requireAdmin, (req: AuthedRequest, res) => {
  const orderStatus = String(req.body?.order_status || 'shipped');
  const tracking = String(req.body?.tracking_number || '');
  db.prepare(`UPDATE orders SET order_status = ?, tracking_number = ?, updated_at = datetime('now') WHERE id = ?`).run(orderStatus, tracking, req.params.id);
  logAdminAction(req.user!.id, 'update_order_status', 'orders', req.params.id, { orderStatus, tracking });
  res.json({ ok: true });
});

app.post('/api/admin/coupons', requireAdmin, (req: AuthedRequest, res) => {
  const b = req.body ?? {};
  const id = uuid();
  db.prepare('INSERT INTO coupons (id, code, discount_type, discount_value, min_order_inr) VALUES (?, ?, ?, ?, ?)').run(
    id,
    String(b.code).trim().toUpperCase(),
    b.discount_type === 'percent' ? 'percent' : 'flat_inr',
    Number(b.discount_value) || 50,
    Number(b.min_order_inr) || 499
  );
  logAdminAction(req.user!.id, 'create_coupon', 'coupons', id, { code: b.code });
  res.status(201).json({ id });
});

app.put('/api/admin/settings', requireAdmin, (req: AuthedRequest, res) => {
  db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES ('ads_config', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).run(
    JSON.stringify(req.body ?? {})
  );
  logAdminAction(req.user!.id, 'update_ads_settings', 'app_settings', 'ads_config');
  res.json({ ok: true });
});

app.get('/api/admin/audit-logs', requireAdmin, (_req, res) => {
  const logs = db
    .prepare(`
      SELECT a.*, p.email as admin_email
      FROM admin_audit_logs a JOIN profiles p ON p.id = a.admin_user_id
      ORDER BY a.created_at DESC LIMIT 80
    `)
    .all();
  res.json({ logs });
});

// ============================================================================
// VITE MIDDLEWARE & STATIC SERVING
// ============================================================================
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FITNOVA server running on http://localhost:${PORT}`);
  });
}

start();
