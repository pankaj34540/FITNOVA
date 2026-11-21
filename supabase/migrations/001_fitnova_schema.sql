-- FITNOVA Complete PostgreSQL Schema & Row Level Security (RLS) Migration
-- Target: Supabase PostgreSQL 15+
-- Run in Supabase SQL Editor or via `supabase db push`

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. PROFILES & FITNESS GOALS
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'deleted')),
  email_verified boolean not null default false,
  date_of_birth date,
  age integer check (age is null or (age >= 13 and age <= 110)),
  gender text check (gender is null or gender in ('male', 'female', 'non_binary', 'prefer_not_to_say')),
  height_cm numeric(5,2) check (height_cm is null or (height_cm >= 80 and height_cm <= 260)),
  weight_kg numeric(5,2) check (weight_kg is null or (weight_kg >= 25 and weight_kg <= 350)),
  fitness_goal text check (fitness_goal is null or fitness_goal in ('weight_loss', 'muscle_gain', 'weight_gain', 'abs_building', 'general_fitness', 'endurance_improvement')),
  fitness_level text default 'beginner' check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  workout_preference text default 'mixed' check (workout_preference in ('home', 'gym', 'outdoor', 'mixed')),
  available_equipment text[] not null default '{}',
  activity_level text default 'moderate' check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  ad_free_member boolean not null default false,
  onboarding_completed boolean not null default false,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_status on public.profiles(account_status);

create table if not exists public.fitness_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_type text not null check (goal_type in ('weight_loss', 'muscle_gain', 'weight_gain', 'abs_building', 'general_fitness', 'endurance_improvement')),
  target_weight_kg numeric(5,2),
  daily_calorie_target integer not null default 2100 check (daily_calorie_target between 900 and 6500),
  daily_protein_g integer not null default 110 check (daily_protein_g between 30 and 400),
  daily_water_ml integer not null default 3000 check (daily_water_ml between 1000 and 8000),
  weekly_run_km_target numeric(6,2) not null default 15.0,
  weekly_workout_target integer not null default 4,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fitness_goals_user on public.fitness_goals(user_id);

-- ============================================================================
-- 2. EXERCISES, WORKOUT PLANS & SESSIONS
-- ============================================================================
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Abs', 'Full Body', 'Cardio', 'HIIT', 'Yoga', 'Stretching')),
  target_muscles text[] not null default '{}',
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  equipment text not null default 'Bodyweight',
  default_sets integer not null default 3 check (default_sets between 1 and 12),
  default_reps text not null default '12',
  rest_seconds integer not null default 60 check (rest_seconds between 10 and 300),
  calories_per_min numeric(5,2) not null default 6.5,
  instructions text not null,
  media_url text,
  video_url text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_exercises_category on public.exercises(category);
create index if not exists idx_exercises_difficulty on public.exercises(difficulty);

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  difficulty text not null check (difficulty in ('beginner', 'intermediate', 'advanced')),
  duration_days integer not null check (duration_days in (1, 7, 30, 60, 90)),
  goal_focus text not null,
  estimated_minutes integer not null default 35,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  day_number integer not null default 1 check (day_number >= 1),
  sort_order integer not null default 1,
  sets integer not null default 3,
  reps text not null default '12',
  rest_seconds integer not null default 60
);

create index if not exists idx_plan_items_plan on public.workout_plan_items(plan_id);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.workout_plans(id) on delete set null,
  title text not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  calories_burned integer not null default 0 check (calories_burned >= 0),
  exercises_completed jsonb not null default '[]',
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_workout_sessions_user on public.workout_sessions(user_id, completed_at desc);

-- ============================================================================
-- 3. GPS RUNNING SESSIONS
-- ============================================================================
create table if not exists public.running_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  distance_meters numeric(10,2) not null check (distance_meters >= 0),
  duration_seconds integer not null check (duration_seconds > 0),
  avg_pace_sec_per_km numeric(8,2) not null default 0,
  avg_speed_kmh numeric(6,2) not null default 0,
  calories_burned integer not null default 0,
  route_points jsonb not null default '[]',
  max_accuracy_m numeric(6,2),
  rejected_points_count integer not null default 0,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'flagged', 'rejected')),
  verification_notes text,
  synced_from_offline boolean not null default false,
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_running_sessions_user on public.running_sessions(user_id, started_at desc);
create index if not exists idx_running_sessions_status on public.running_sessions(verification_status);

-- ============================================================================
-- 4. FITNESS MEASUREMENTS & NUTRITION LOGS
-- ============================================================================
create table if not exists public.fitness_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric(5,2) not null check (weight_kg between 25 and 350),
  body_fat_pct numeric(4,1),
  waist_cm numeric(5,1),
  chest_cm numeric(5,1),
  arm_cm numeric(5,1),
  photo_storage_path text,
  photo_visibility text not null default 'private' check (photo_visibility in ('private', 'coach_only')),
  recorded_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_measurements_user on public.fitness_measurements(user_id, recorded_on desc);

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  meal_slot text not null check (meal_slot in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  diet_type text not null check (diet_type in ('veg', 'non_veg')),
  servings numeric(4,2) not null default 1,
  calories integer not null,
  protein_g numeric(6,1) not null,
  carbs_g numeric(6,1) not null,
  fat_g numeric(6,1) not null,
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_meal_logs_user_date on public.meal_logs(user_id, logged_on desc);

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_ml integer not null check (amount_ml between 50 and 3000),
  logged_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists idx_water_logs_user_date on public.water_logs(user_id, logged_on desc);

-- ============================================================================
-- 5. 30-DAY FITNESS CHALLENGES, LOGS, REWARDS & REFUNDS
-- ============================================================================
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  tier text not null check (tier in ('beginner', 'intermediate', 'advanced')),
  description text not null,
  registration_fee_inr integer not null default 399 check (registration_fee_inr >= 0),
  refund_reward_inr integer not null default 299 check (refund_reward_inr >= 0),
  duration_days integer not null default 30,
  daily_run_km_target numeric(4,2) not null,
  daily_workout_minutes_target integer not null,
  rest_days_included integer not null default 4,
  rules_markdown text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_members (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending_payment' check (status in ('pending_payment', 'active', 'completed', 'disqualified', 'cancelled')),
  payment_transaction_id uuid,
  tshirt_size text check (tshirt_size is null or tshirt_size in ('S', 'M', 'L', 'XL', 'XXL')),
  start_date date not null default current_date,
  completed_days integer not null default 0,
  missed_days integer not null default 0,
  points integer not null default 0,
  final_eligibility text not null default 'in_progress' check (final_eligibility in ('in_progress', 'eligible', 'ineligible', 'approved')),
  created_at timestamptz not null default now(),
  unique(challenge_id, user_id)
);

create index if not exists idx_challenge_members_user on public.challenge_members(user_id);
create index if not exists idx_challenge_members_board on public.challenge_members(challenge_id, points desc);

create table if not exists public.challenge_daily_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.challenge_members(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_number integer not null check (day_number between 1 and 30),
  log_type text not null default 'active' check (log_type in ('active', 'rest')),
  running_session_id uuid references public.running_sessions(id) on delete set null,
  workout_session_id uuid references public.workout_sessions(id) on delete set null,
  run_distance_km numeric(6,2) not null default 0,
  workout_minutes integer not null default 0,
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'rest_approved')),
  reviewer_notes text,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(member_id, day_number)
);

create index if not exists idx_challenge_logs_status on public.challenge_daily_logs(verification_status);

create table if not exists public.challenge_rewards (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.challenge_members(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tshirt_size text not null default 'L',
  shipping_address text not null default '',
  dispatch_status text not null default 'pending_approval' check (dispatch_status in ('pending_approval', 'packing', 'dispatched', 'delivered')),
  tracking_number text,
  courier_name text,
  approved_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_id uuid references public.challenge_members(id) on delete set null,
  order_id uuid,
  amount_inr integer not null check (amount_inr > 0),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'processed', 'rejected')),
  gateway_refund_id text,
  processed_by uuid references public.profiles(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 6. AFFILIATE MARKETPLACE & OWN E-COMMERCE STORE
-- ============================================================================
create table if not exists public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Running shoes', 'Dumbbells', 'Resistance bands', 'Yoga mats', 'Gym gloves', 'Sportswear', 'Smartwatches', 'Gym bags', 'Fitness accessories', 'Water bottles')),
  merchant_name text not null,
  displayed_price_inr integer not null check (displayed_price_inr > 0),
  affiliate_url text not null,
  image_url text not null,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.affiliate_products(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  referrer_screen text,
  clicked_at timestamptz not null default now()
);

create index if not exists idx_affiliate_clicks_product on public.affiliate_clicks(product_id, clicked_at desc);

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order integer not null default 0
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.product_categories(id) on delete set null,
  category_name text not null,
  name text not null,
  description text not null,
  price_inr integer not null check (price_inr > 0),
  compare_at_price_inr integer,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sku text not null unique,
  image_url text not null,
  cod_supported boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_category on public.products(category_name);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_addresses_user on public.addresses(user_id);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  updated_at timestamptz not null default now(),
  unique(user_id, product_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'flat_inr')),
  discount_value integer not null check (discount_value > 0),
  min_order_inr integer not null default 0,
  max_uses integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  expires_at timestamptz
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address_snapshot jsonb not null,
  payment_method text not null check (payment_method in ('upi_card', 'cod')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'cod_pending', 'failed', 'refunded')),
  order_status text not null default 'placed' check (order_status in ('placed', 'confirmed', 'packed', 'shipped', 'delivered', 'return_requested', 'returned', 'cancelled')),
  subtotal_inr integer not null,
  discount_inr integer not null default 0,
  total_inr integer not null,
  coupon_code text,
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders(user_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price_inr integer not null,
  quantity integer not null check (quantity > 0)
);

-- ============================================================================
-- 7. PAYMENTS, WEBHOOKS, NOTIFICATIONS, ACHIEVEMENTS & ADMIN AUDIT LOGS
-- ============================================================================
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  purpose text not null check (purpose in ('challenge_registration', 'store_order', 'ad_free_membership')),
  reference_id uuid not null,
  gateway text not null default 'razorpay',
  gateway_order_id text not null unique,
  gateway_payment_id text,
  amount_inr integer not null check (amount_inr >= 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'authorized', 'captured', 'failed', 'refunded')),
  verified_server_side boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  event_id text not null unique,
  event_type text not null,
  signature_valid boolean not null,
  payload jsonb not null,
  processed_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  title text not null,
  description text not null,
  earned_at timestamptz not null default now(),
  unique(user_id, achievement_key)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_table text not null,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 8. SERVER-SIDE HELPER FUNCTIONS & ATOMIC STOCK RPC
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and account_status = 'active'
  );
$$;

create or replace function public.decrement_product_stock(p_product_id uuid, p_qty integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_affected integer;
begin
  if p_qty <= 0 then
    return false;
  end if;

  update public.products
  set stock_quantity = stock_quantity - p_qty
  where id = p_product_id and stock_quantity >= p_qty and is_active = true;

  get diagnostics rows_affected = row_count;
  return rows_affected = 1;
end;
$$;

-- ============================================================================
-- 9. ROW LEVEL SECURITY (RLS) FOR EVERY EXPOSED TABLE
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.fitness_goals enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_items enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.running_sessions enable row level security;
alter table public.fitness_measurements enable row level security;
alter table public.meal_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenge_daily_logs enable row level security;
alter table public.challenge_rewards enable row level security;
alter table public.refund_requests enable row level security;
alter table public.affiliate_products enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_webhook_events enable row level security;
alter table public.notifications enable row level security;
alter table public.user_achievements enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Profiles: users read/update own non-privileged columns; admins read/manage all
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid() and role = 'user');
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (
    (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()))
    or public.is_admin()
  );

-- Private user-owned tables
create policy "fitness_goals_own" on public.fitness_goals
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "workout_sessions_own" on public.workout_sessions
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "running_sessions_select" on public.running_sessions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "running_sessions_insert_pending" on public.running_sessions
  for insert with check (user_id = auth.uid() and verification_status = 'pending');
create policy "running_sessions_admin_update" on public.running_sessions
  for update using (public.is_admin());

create policy "measurements_own" on public.fitness_measurements
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "meal_logs_own" on public.meal_logs
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "water_logs_own" on public.water_logs
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Public read catalogs, admin write
create policy "exercises_read" on public.exercises for select using (is_published = true or public.is_admin());
create policy "exercises_admin_write" on public.exercises for all using (public.is_admin()) with check (public.is_admin());

create policy "plans_read" on public.workout_plans for select using (is_published = true or public.is_admin());
create policy "plans_admin_write" on public.workout_plans for all using (public.is_admin()) with check (public.is_admin());

create policy "plan_items_read" on public.workout_plan_items for select using (true);
create policy "plan_items_admin_write" on public.workout_plan_items for all using (public.is_admin()) with check (public.is_admin());

create policy "challenges_read" on public.challenges for select using (is_active = true or public.is_admin());
create policy "challenges_admin_write" on public.challenges for all using (public.is_admin()) with check (public.is_admin());

-- Challenge members & logs: read leaderboard safely, never self-activate or self-verify
create policy "challenge_members_read" on public.challenge_members
  for select using (user_id = auth.uid() or public.is_admin() or status = 'active');
create policy "challenge_members_insert_pending" on public.challenge_members
  for insert with check (user_id = auth.uid() and status = 'pending_payment' and final_eligibility = 'in_progress');
create policy "challenge_members_admin_update" on public.challenge_members
  for update using (public.is_admin());

create policy "challenge_logs_select" on public.challenge_daily_logs
  for select using (user_id = auth.uid() or public.is_admin());
create policy "challenge_logs_insert_pending" on public.challenge_daily_logs
  for insert with check (user_id = auth.uid() and verification_status in ('pending', 'rest_approved'));
create policy "challenge_logs_admin_update" on public.challenge_daily_logs
  for update using (public.is_admin());

create policy "challenge_rewards_select" on public.challenge_rewards
  for select using (user_id = auth.uid() or public.is_admin());
create policy "challenge_rewards_admin" on public.challenge_rewards
  for all using (public.is_admin()) with check (public.is_admin());

create policy "refunds_select" on public.refund_requests
  for select using (user_id = auth.uid() or public.is_admin());
create policy "refunds_insert_pending" on public.refund_requests
  for insert with check (user_id = auth.uid() and status = 'pending');
create policy "refunds_admin_update" on public.refund_requests
  for update using (public.is_admin());

-- Affiliate & E-commerce
create policy "affiliate_products_read" on public.affiliate_products for select using (is_active = true or public.is_admin());
create policy "affiliate_products_admin" on public.affiliate_products for all using (public.is_admin()) with check (public.is_admin());

create policy "affiliate_clicks_insert" on public.affiliate_clicks for insert with check (user_id is null or user_id = auth.uid());
create policy "affiliate_clicks_admin_read" on public.affiliate_clicks for select using (public.is_admin());

create policy "categories_read" on public.product_categories for select using (true);
create policy "categories_admin" on public.product_categories for all using (public.is_admin()) with check (public.is_admin());

create policy "products_read" on public.products for select using (is_active = true or public.is_admin());
create policy "products_admin" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "addresses_own" on public.addresses for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "carts_own" on public.carts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "coupons_read" on public.coupons for select using (is_active = true or public.is_admin());
create policy "coupons_admin" on public.coupons for all using (public.is_admin()) with check (public.is_admin());

create policy "orders_select" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "orders_admin_update" on public.orders for update using (public.is_admin());

create policy "order_items_select" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
  );

-- Payments & Webhooks (strictly server/service-role writes)
create policy "payment_tx_select" on public.payment_transactions for select using (user_id = auth.uid() or public.is_admin());
create policy "webhook_events_admin" on public.payment_webhook_events for select using (public.is_admin());

-- Notifications, Achievements, Audit Logs
create policy "notifications_own" on public.notifications for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
create policy "achievements_own" on public.user_achievements for select using (user_id = auth.uid() or public.is_admin());
create policy "audit_logs_admin" on public.admin_audit_logs for select using (public.is_admin());
