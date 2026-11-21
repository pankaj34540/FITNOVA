export type FitnessGoalType =
  | 'weight_loss'
  | 'muscle_gain'
  | 'weight_gain'
  | 'abs_building'
  | 'general_fitness'
  | 'endurance_improvement';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  account_status: string;
  email_verified: boolean;
  date_of_birth: string | null;
  age: number | null;
  gender: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  fitness_goal: FitnessGoalType | null;
  fitness_level: 'beginner' | 'intermediate' | 'advanced';
  workout_preference: string;
  available_equipment: string[];
  activity_level: string;
  ad_free_member: boolean;
  onboarding_completed: boolean;
  consent_accepted_at: string | null;
  created_at: string;
}

export interface FitnessGoals {
  id: string;
  goal_type: string;
  target_weight_kg: number | null;
  daily_calorie_target: number;
  daily_protein_g: number;
  daily_water_ml: number;
  weekly_run_km_target: number;
  weekly_workout_target: number;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  target_muscles: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string;
  default_sets: number;
  default_reps: string;
  rest_seconds: number;
  calories_per_min: number;
  instructions: string;
  media_url: string;
}

export interface WorkoutPlanItem {
  id: string;
  exercise_id: string;
  exercise_name: string;
  category: string;
  instructions: string;
  media_url: string;
  calories_per_min: number;
  equipment: string;
  sets: number;
  reps: string;
  rest_seconds: number;
}

export interface WorkoutPlan {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_days: number;
  goal_focus: string;
  estimated_minutes: number;
  items: WorkoutPlanItem[];
}

export interface GpsPoint {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface RunningSession {
  id: string;
  distance_meters: number;
  duration_seconds: number;
  avg_pace_sec_per_km: number;
  avg_speed_kmh: number;
  calories_burned: number;
  route_points: GpsPoint[];
  rejected_points_count: number;
  verification_status: 'pending' | 'verified' | 'flagged' | 'rejected';
  verification_notes: string;
  synced_from_offline: number;
  started_at: string;
}

export interface Challenge {
  id: string;
  title: string;
  tier: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  registration_fee_inr: number;
  refund_reward_inr: number;
  duration_days: number;
  daily_run_km_target: number;
  daily_workout_minutes_target: number;
  rest_days_included: number;
  rules_markdown: string;
}

export interface ChallengeMember {
  id: string;
  challenge_id: string;
  status: string;
  tshirt_size: string | null;
  start_date: string;
  completed_days: number;
  missed_days: number;
  points: number;
  final_eligibility: string;
}

export interface ChallengeDailyLog {
  id: string;
  day_number: number;
  log_type: 'active' | 'rest';
  run_distance_km: number;
  workout_minutes: number;
  verification_status: 'pending' | 'verified' | 'rejected' | 'rest_approved';
  reviewer_notes: string | null;
}

export interface AffiliateProduct {
  id: string;
  title: string;
  category: string;
  merchant_name: string;
  displayed_price_inr: number;
  affiliate_url: string;
  image_url: string;
  description: string;
}

export interface StoreProduct {
  id: string;
  category_name: string;
  name: string;
  description: string;
  price_inr: number;
  compare_at_price_inr: number | null;
  stock_quantity: number;
  sku: string;
  image_url: string;
  cod_supported: number;
}

export interface AdsConfig {
  admob_enabled: boolean;
  banner_home: boolean;
  banner_workout_library: boolean;
  banner_calculators: boolean;
  ad_free_price_inr: number;
  admob_unit_id: string;
}
