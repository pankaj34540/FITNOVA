import { db, hashPassword, uuid } from './db.ts';

const IMG_HERO = '/src/assets/images/hero_athlete_training_1795116821241.jpg';
const IMG_TSHIRT = '/src/assets/images/challenge_tshirt_reward_1795116820835.jpg';
const IMG_BARBELL = '/src/assets/images/workout_strength_barbell_1795116820325.jpg';
const IMG_SHOES = '/src/assets/images/gear_running_shoes_1795116820962.jpg';
const IMG_KIT = '/src/assets/images/gear_fitness_kit_1795116821024.jpg';

export function seedReferenceCatalog(): void {
  // 1. Bootstrap server-side Admin user if not present
  const adminEmail = (process.env.FITNOVA_ADMIN_EMAIL || 'admin@fitnova.in').toLowerCase();
  const adminPassword = process.env.FITNOVA_ADMIN_PASSWORD || 'FitnovaAdmin@2026';
  const existingAdmin = db.prepare('SELECT id FROM profiles WHERE email = ?').get(adminEmail) as { id: string } | undefined;
  if (!existingAdmin) {
    const adminId = uuid();
    db.prepare(`
      INSERT INTO profiles (id, email, password_hash, full_name, role, email_verified, onboarding_completed, fitness_goal, fitness_level, height_cm, weight_kg, age, consent_accepted_at)
      VALUES (?, ?, ?, ?, 'admin', 1, 1, 'general_fitness', 'advanced', 176, 72, 29, datetime('now'))
    `).run(adminId, adminEmail, hashPassword(adminPassword), 'FITNOVA Operations Admin');
  }

  // 2. Seed Exercises across all 12 categories if empty
  const exCount = (db.prepare('SELECT COUNT(*) as c FROM exercises').get() as { c: number }).c;
  const exerciseIds: Record<string, string> = {};
  if (exCount === 0) {
    const catalog = [
      { name: 'Standard Push-Ups', category: 'Chest', muscles: ['Pectoralis Major', 'Anterior Deltoids', 'Triceps'], difficulty: 'beginner', equipment: 'Bodyweight', sets: 3, reps: '12-15', rest: 60, cal: 7.2, instructions: 'Keep body in a straight plank line, lower chest to two inches above floor, press explosively through palms.', img: IMG_HERO },
      { name: 'Incline Dumbbell Press', category: 'Chest', muscles: ['Upper Pectorals', 'Front Delts'], difficulty: 'intermediate', equipment: 'Dumbbells & Bench', sets: 4, reps: '10-12', rest: 75, cal: 6.8, instructions: 'Set bench to 30 degrees. Lower dumbbells slowly for 3 seconds, drive upward without locking elbows.', img: IMG_BARBELL },
      { name: 'Pull-Ups', category: 'Back', muscles: ['Latissimus Dorsi', 'Rhomboids', 'Biceps'], difficulty: 'intermediate', equipment: 'Pull-up Bar', sets: 4, reps: '6-10', rest: 90, cal: 8.5, instructions: 'Grip bar slightly wider than shoulders, depress shoulder blades, pull chest toward bar with controlled descent.', img: IMG_BARBELL },
      { name: 'Bent-Over Dumbbell Row', category: 'Back', muscles: ['Mid Back', 'Lats', 'Rear Delts'], difficulty: 'beginner', equipment: 'Dumbbells', sets: 3, reps: '12', rest: 60, cal: 6.4, instructions: 'Hinge at hips with flat spine, row weights toward waist pockets, squeeze shoulder blades for 1 second.', img: IMG_BARBELL },
      { name: 'Overhead Dumbbell Press', category: 'Shoulders', muscles: ['Anterior & Medial Delts', 'Triceps'], difficulty: 'beginner', equipment: 'Dumbbells', sets: 3, reps: '10-12', rest: 60, cal: 6.2, instructions: 'Brace core and glutes, press dumbbells straight overhead with elbows tucked slightly forward.', img: IMG_BARBELL },
      { name: 'Lateral Raises', category: 'Shoulders', muscles: ['Medial Deltoids'], difficulty: 'beginner', equipment: 'Light Dumbbells', sets: 3, reps: '15', rest: 45, cal: 5.0, instructions: 'Raise arms to shoulder height with soft elbow bend, avoid swinging torso, lower with 2-second control.', img: IMG_BARBELL },
      { name: 'Alternating Bicep Curls', category: 'Biceps', muscles: ['Biceps Brachii', 'Brachialis'], difficulty: 'beginner', equipment: 'Dumbbells', sets: 3, reps: '12 each', rest: 45, cal: 5.2, instructions: 'Keep elbows pinned at sides, supinate wrists as dumbbells rise, avoid shoulder momentum.', img: IMG_BARBELL },
      { name: 'Hammer Curls', category: 'Biceps', muscles: ['Brachioradialis', 'Biceps'], difficulty: 'beginner', equipment: 'Dumbbells', sets: 3, reps: '12', rest: 45, cal: 5.2, instructions: 'Hold dumbbells in neutral palms-facing grip and curl smoothly to shoulder level.', img: IMG_BARBELL },
      { name: 'Chair Tricep Dips', category: 'Triceps', muscles: ['Triceps Brachii', 'Anterior Delts'], difficulty: 'beginner', equipment: 'Bench or Chair', sets: 3, reps: '12-15', rest: 45, cal: 6.0, instructions: 'Place hands shoulder-width on bench edge, keep back close to bench, lower until elbows reach 90 degrees.', img: IMG_HERO },
      { name: 'Overhead Tricep Extension', category: 'Triceps', muscles: ['Triceps Long Head'], difficulty: 'intermediate', equipment: 'Dumbbell', sets: 3, reps: '12', rest: 60, cal: 5.5, instructions: 'Hold single dumbbell overhead with both hands, lower behind head keeping elbows pointed forward.', img: IMG_BARBELL },
      { name: 'Goblet Squats', category: 'Legs', muscles: ['Quadriceps', 'Glutes', 'Core'], difficulty: 'beginner', equipment: 'Dumbbell or Bodyweight', sets: 4, reps: '12-15', rest: 75, cal: 8.2, instructions: 'Hold weight at chest, track knees over toes, sit hips down below parallel, drive through mid-foot.', img: IMG_BARBELL },
      { name: 'Walking Lunges', category: 'Legs', muscles: ['Glutes', 'Quads', 'Hamstrings'], difficulty: 'intermediate', equipment: 'Bodyweight or Dumbbells', sets: 3, reps: '20 steps', rest: 60, cal: 8.0, instructions: 'Step forward into a 90-90 lunge, keep torso upright, drive through front heel into next stride.', img: IMG_HERO },
      { name: 'Romanian Deadlifts', category: 'Legs', muscles: ['Hamstrings', 'Glutes', 'Erector Spinae'], difficulty: 'intermediate', equipment: 'Barbell or Dumbbells', sets: 4, reps: '10', rest: 90, cal: 7.8, instructions: 'Soft knee bend, push hips back while sliding weights along thighs until deep hamstring stretch.', img: IMG_BARBELL },
      { name: 'Forearm Plank Hold', category: 'Abs', muscles: ['Transverse Abdominis', 'Rectus Abdominis'], difficulty: 'beginner', equipment: 'Mat', sets: 3, reps: '45-60s', rest: 45, cal: 5.5, instructions: 'Elbows under shoulders, tuck pelvis slightly, squeeze glutes and quads to prevent lower back sag.', img: IMG_HERO },
      { name: 'Hanging Leg Raises', category: 'Abs', muscles: ['Lower Abs', 'Hip Flexors'], difficulty: 'advanced', equipment: 'Pull-up Bar', sets: 3, reps: '10-12', rest: 60, cal: 6.8, instructions: 'Hang without swinging, curl pelvis upward bringing knees or toes toward bar with controlled lower.', img: IMG_BARBELL },
      { name: 'Burpees', category: 'Full Body', muscles: ['Full Body', 'Cardiovascular System'], difficulty: 'intermediate', equipment: 'Bodyweight', sets: 4, reps: '12', rest: 60, cal: 11.5, instructions: 'Squat down, kick feet to plank, complete push-up, jump feet forward and explode vertically.', img: IMG_HERO },
      { name: 'Kettlebell / Dumbbell Thrusters', category: 'Full Body', muscles: ['Quads', 'Glutes', 'Shoulders', 'Core'], difficulty: 'advanced', equipment: 'Dumbbells', sets: 4, reps: '12', rest: 75, cal: 10.2, instructions: 'Squat deep with weights racked at shoulders and use hip drive to press smoothly overhead.', img: IMG_BARBELL },
      { name: 'Tempo Interval Run Drills', category: 'Cardio', muscles: ['Calves', 'Quads', 'Aerobic System'], difficulty: 'intermediate', equipment: 'Running Shoes', sets: 5, reps: '3 min run / 1 min walk', rest: 60, cal: 11.0, instructions: 'Maintain tall posture, mid-foot strike cadence around 170 spm, controlled rhythmic nasal/mouth breathing.', img: IMG_HERO },
      { name: 'Jumping Jacks & High Knees', category: 'Cardio', muscles: ['Calves', 'Hip Flexors', 'Heart & Lungs'], difficulty: 'beginner', equipment: 'Bodyweight', sets: 3, reps: '60s', rest: 30, cal: 9.8, instructions: 'Land softly on balls of feet, drive arms overhead cleanly and keep core engaged.', img: IMG_HERO },
      { name: 'Tabata Mountain Climbers', category: 'HIIT', muscles: ['Core', 'Shoulders', 'Hip Flexors'], difficulty: 'intermediate', equipment: 'Bodyweight', sets: 6, reps: '20s sprint / 10s rest', rest: 30, cal: 12.2, instructions: 'Maintain flat plank shoulders over wrists, drive alternating knees rapidly toward chest.', img: IMG_HERO },
      { name: 'Explosive Squat Jumps', category: 'HIIT', muscles: ['Quads', 'Glutes', 'Calves'], difficulty: 'advanced', equipment: 'Bodyweight', sets: 4, reps: '15', rest: 45, cal: 11.8, instructions: 'Drop into quarter squat and explode upward, absorb landing softly with bent knees.', img: IMG_HERO },
      { name: 'Surya Namaskar (Sun Salutation)', category: 'Yoga', muscles: ['Spine', 'Hamstrings', 'Shoulders', 'Core'], difficulty: 'beginner', equipment: 'Yoga Mat', sets: 4, reps: '3 rounds', rest: 30, cal: 4.5, instructions: 'Flow continuously through 12 traditional postures synchronized with slow inhales and exhales.', img: IMG_KIT },
      { name: 'Downward Dog to Cobra Flow', category: 'Yoga', muscles: ['Posterior Chain', 'Thoracic Spine'], difficulty: 'beginner', equipment: 'Yoga Mat', sets: 3, reps: '8 slow breaths', rest: 30, cal: 3.8, instructions: 'Press heels toward floor in inverted V, transition smoothly forward into gentle upward chest lift.', img: IMG_KIT },
      { name: 'Hip Flexor & Hamstring Recovery Stretch', category: 'Stretching', muscles: ['Hip Flexors', 'Hamstrings', 'Lower Back'], difficulty: 'beginner', equipment: 'Yoga Mat', sets: 2, reps: '45s each side', rest: 15, cal: 2.5, instructions: 'Hold gentle tension without bouncing; breathe deeply to relax post-run lower body tightness.', img: IMG_KIT },
    ];
    const insertEx = db.prepare(`
      INSERT INTO exercises (id, name, category, target_muscles, difficulty, equipment, default_sets, default_reps, rest_seconds, calories_per_min, instructions, media_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ex of catalog) {
      const id = uuid();
      exerciseIds[ex.name] = id;
      insertEx.run(id, ex.name, ex.category, JSON.stringify(ex.muscles), ex.difficulty, ex.equipment, ex.sets, ex.reps, ex.rest, ex.cal, ex.instructions, ex.img);
    }
  } else {
    const rows = db.prepare('SELECT id, name FROM exercises').all() as Array<{ id: string; name: string }>;
    for (const r of rows) exerciseIds[r.name] = r.id;
  }

  // 3. Seed Workout Plans (7-day, 30-day, 60-day, 90-day across Beginner/Intermediate/Advanced)
  const planCount = (db.prepare('SELECT COUNT(*) as c FROM workout_plans').get() as { c: number }).c;
  if (planCount === 0) {
    const plans = [
      {
        title: '7-Day Home Ignition',
        description: 'Zero-equipment daily movement routine to build workout consistency and joint mobility.',
        difficulty: 'beginner',
        duration_days: 7,
        goal_focus: 'general_fitness',
        estimated_minutes: 25,
        items: ['Standard Push-Ups', 'Goblet Squats', 'Forearm Plank Hold', 'Jumping Jacks & High Knees', 'Surya Namaskar (Sun Salutation)'],
      },
      {
        title: '30-Day Fat Burn & Core Conditioning',
        description: 'Structured progressive cardio, bodyweight strength, and active yoga recovery days.',
        difficulty: 'beginner',
        duration_days: 30,
        goal_focus: 'weight_loss',
        estimated_minutes: 35,
        items: ['Jumping Jacks & High Knees', 'Standard Push-Ups', 'Goblet Squats', 'Forearm Plank Hold', 'Hip Flexor & Hamstring Recovery Stretch'],
      },
      {
        title: '30-Day Hybrid Runner Strength',
        description: 'Pair 3x weekly runs with lower-body stability, core strength, and upper-body tone.',
        difficulty: 'intermediate',
        duration_days: 30,
        goal_focus: 'endurance_improvement',
        estimated_minutes: 40,
        items: ['Walking Lunges', 'Romanian Deadlifts', 'Pull-Ups', 'Tabata Mountain Climbers', 'Hip Flexor & Hamstring Recovery Stretch'],
      },
      {
        title: '60-Day Lean Muscle Hypertrophy',
        description: 'Upper/lower split with progressive dumbbell overload and structured 75s rest blocks.',
        difficulty: 'intermediate',
        duration_days: 60,
        goal_focus: 'muscle_gain',
        estimated_minutes: 50,
        items: ['Incline Dumbbell Press', 'Bent-Over Dumbbell Row', 'Overhead Dumbbell Press', 'Alternating Bicep Curls', 'Overhead Tricep Extension'],
      },
      {
        title: '90-Day Athletic Transformation',
        description: 'Full-spectrum strength, high-output HIIT conditioning, and mobility periodization.',
        difficulty: 'advanced',
        duration_days: 90,
        goal_focus: 'abs_building',
        estimated_minutes: 55,
        items: ['Kettlebell / Dumbbell Thrusters', 'Pull-Ups', 'Explosive Squat Jumps', 'Hanging Leg Raises', 'Burpees'],
      },
    ];
    const insertPlan = db.prepare('INSERT INTO workout_plans (id, title, description, difficulty, duration_days, goal_focus, estimated_minutes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const insertItem = db.prepare('INSERT INTO workout_plan_items (id, plan_id, exercise_id, day_number, sort_order, sets, reps, rest_seconds) VALUES (?, ?, ?, 1, ?, 3, ?, ?)');
    for (const p of plans) {
      const pid = uuid();
      insertPlan.run(pid, p.title, p.description, p.difficulty, p.duration_days, p.goal_focus, p.estimated_minutes);
      p.items.forEach((exName, idx) => {
        const exId = exerciseIds[exName];
        if (exId) {
          insertItem.run(uuid(), pid, exId, idx + 1, '12', 60);
        }
      });
    }
  }

  // 4. Seed 30-Day Fitness Challenges (Main USP)
  const challengeCount = (db.prepare('SELECT COUNT(*) as c FROM challenges').get() as { c: number }).c;
  if (challengeCount === 0) {
    const commonRules = [
      '1. Registration fee is ₹399 (inclusive of GST). Challenge activates only after server-side Razorpay payment verification.',
      '2. Recovery & Safety: Every 7th day (Days 7, 14, 21, 28) is a scheduled Rest & Mobility day requiring zero intense training.',
      '3. Daily Verification: Active days require completing both the daily workout target and GPS-verified running target (or verified indoor workout check-in on recovery days).',
      '4. GPS Anti-Cheat: Runs must be tracked via the FITNOVA GPS tracker. Poor accuracy (>50m) or unrealistic speed spikes (>32 km/h) are automatically flagged and excluded.',
      '5. Missed Days & Grace Policy: Maximum 2 missed days permitted across 30 days. More than 2 missed active days disqualifies refund eligibility while keeping app access active.',
      '6. Rewards & Timeline: Participants completing >=24 verified active days + 4 rest days receive a FITNOVA Dri-Fit T-shirt (shipped within 10 business days) and ₹299 completion refund (processed to original UPI/card within 5–7 business days after final admin audit).',
      '7. Legal & Fair Play: Rewards are strictly conditional completion incentives for personal consistency—no gambling, lottery, or chance mechanics apply. Cancellations are allowed within 24 hours of registration if Day 1 has not started.',
    ].join('\n');

    const challenges = [
      {
        title: 'FITNOVA 30-Day Starter Challenge',
        tier: 'beginner',
        description: 'Build a sustainable daily habit with 2.0 km runs, 20-minute guided workouts, and 4 built-in recovery days.',
        runKm: 2.0,
        workoutMin: 20,
      },
      {
        title: 'FITNOVA 30-Day Hybrid Athlete Challenge',
        tier: 'intermediate',
        description: 'Elevate endurance and lean strength with 3.5 km runs, 30-minute strength/HIIT workouts, and 4 recovery days.',
        runKm: 3.5,
        workoutMin: 30,
      },
      {
        title: 'FITNOVA 30-Day Pro Endurance Challenge',
        tier: 'advanced',
        description: 'Peak athletic conditioning with 5.0 km GPS-verified runs, 40-minute structured workouts, and 4 recovery days.',
        runKm: 5.0,
        workoutMin: 40,
      },
    ];
    const stmt = db.prepare(`
      INSERT INTO challenges (id, title, tier, description, registration_fee_inr, refund_reward_inr, duration_days, daily_run_km_target, daily_workout_minutes_target, rest_days_included, rules_markdown)
      VALUES (?, ?, ?, ?, 399, 299, 30, ?, ?, 4, ?)
    `);
    for (const c of challenges) {
      stmt.run(uuid(), c.title, c.tier, c.description, c.runKm, c.workoutMin, commonRules);
    }
  }

  // 5. Seed Affiliate Marketplace (10 categories)
  const affCount = (db.prepare('SELECT COUNT(*) as c FROM affiliate_products').get() as { c: number }).c;
  if (affCount === 0) {
    const affItems = [
      { title: 'Nike Pegasus 41 Road Running Shoes', category: 'Running shoes', merchant: 'Amazon India', price: 11895, url: 'https://www.amazon.in/s?k=running+shoes', img: IMG_SHOES, desc: 'Responsive ReactX foam daily trainer built for Indian road running and marathon prep.' },
      { title: 'AdjustaPro Cast Iron Hex Dumbbells (Pair 10kg)', category: 'Dumbbells', merchant: 'Flipkart', price: 2499, url: 'https://www.flipkart.com/search?q=hex+dumbbells', img: IMG_BARBELL, desc: 'Rubber-encased hexagonal grip dumbbells that prevent floor roll during home strength sessions.' },
      { title: 'Boldfit Heavy Resistance Loop Bands (Set of 5)', category: 'Resistance bands', merchant: 'Amazon India', price: 699, url: 'https://www.amazon.in/s?k=resistance+bands', img: IMG_KIT, desc: 'Color-coded progressive tension fabric and latex bands for warm-ups, glutes, and pull-up assistance.' },
      { title: 'WiseLife Pro Alignment 6mm TPE Yoga Mat', category: 'Yoga mats', merchant: 'Amazon India', price: 1199, url: 'https://www.amazon.in/s?k=tpe+yoga+mat', img: IMG_KIT, desc: 'Anti-skid dual-layer cushioning mat with laser-etched alignment lines for yoga and core work.' },
      { title: 'Nivia Wrist-Wrap Padded Gym Gloves', category: 'Gym gloves', merchant: 'Flipkart', price: 549, url: 'https://www.flipkart.com/search?q=gym+gloves', img: IMG_BARBELL, desc: 'Breathable mesh palm protection with integrated velcro wrist support for barbell lifts.' },
      { title: 'HRX Rapid-Dry Compression Training Tee', category: 'Sportswear', merchant: 'Myntra', price: 799, url: 'https://www.myntra.com/sportswear', img: IMG_TSHIRT, desc: 'Moisture-wicking athletic jersey designed for humid outdoor runs and intense gym circuits.' },
      { title: 'Garmin Forerunner 165 GPS Running Watch', category: 'Smartwatches', merchant: 'Amazon India', price: 29990, url: 'https://www.amazon.in/s?k=garmin+forerunner', img: IMG_HERO, desc: 'AMOLED GPS sports watch with HRV status, pace alerts, and wrist-based running dynamics.' },
      { title: 'Puma Challenger 35L Training Duffel Bag', category: 'Gym bags', merchant: 'Myntra', price: 1699, url: 'https://www.myntra.com/gym-bags', img: IMG_KIT, desc: 'Ventilated shoe compartment and water-resistant base tailored for daily gym commutes.' },
      { title: 'Strauss Speed Bearing Skipping Rope', category: 'Fitness accessories', merchant: 'Amazon India', price: 399, url: 'https://www.amazon.in/s?k=speed+skipping+rope', img: IMG_KIT, desc: 'Tangle-free steel cable jump rope with dual ball bearings for HIIT conditioning.' },
      { title: 'Milton Thermosteel 1000ml Hydration Flask', category: 'Water bottles', merchant: 'Flipkart', price: 949, url: 'https://www.flipkart.com/search?q=thermosteel+bottle', img: IMG_KIT, desc: '24-hour cold retention stainless steel bottle built for outdoor track sessions.' },
    ];
    const stmt = db.prepare(`
      INSERT INTO affiliate_products (id, title, category, merchant_name, displayed_price_inr, affiliate_url, image_url, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const a of affItems) {
      stmt.run(uuid(), a.title, a.category, a.merchant, a.price, a.url, a.img, a.desc);
    }
  }

  // 6. Seed Own E-Commerce Store Products
  const prodCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
  if (prodCount === 0) {
    const storeProducts = [
      { category: 'Fitness clothing', name: 'FITNOVA Pro Dri-Fit Edition Tee', desc: 'Signature 160 GSM breathable athletic jersey with reflective neon chest crest.', price: 699, compare: 999, stock: 48, sku: 'FN-TEE-001', img: IMG_TSHIRT, cod: 1 },
      { category: 'Running accessories', name: 'FITNOVA CarbonStride Training Socks (3-Pack)', desc: 'Arch-compressed anti-blister merino blend socks for 5K–21K runs.', price: 499, compare: 699, stock: 65, sku: 'FN-SOCK-002', img: IMG_SHOES, cod: 1 },
      { category: 'Water bottles', name: 'FITNOVA Matte Insulated Steel Bottle 900ml', desc: 'Powder-coated 304 stainless steel hydration flask with leak-proof loop cap.', price: 799, compare: 1099, stock: 40, sku: 'FN-BTL-003', img: IMG_KIT, cod: 1 },
      { category: 'Home workout equipment', name: 'FITNOVA Woven Fabric Resistance Band Set', desc: 'Non-slip 3-level fabric resistance bands (Light, Medium, Heavy) with carry pouch.', price: 899, compare: 1299, stock: 35, sku: 'FN-BND-004', img: IMG_KIT, cod: 1 },
      { category: 'Gym bags', name: 'FITNOVA Utility 30L Matte Gym Duffel', desc: 'Water-repellent ballistic nylon duffel with dedicated bottle pocket and laptop sleeve.', price: 1899, compare: 2499, stock: 22, sku: 'FN-BAG-005', img: IMG_KIT, cod: 1 },
      { category: 'Gym equipment', name: 'FITNOVA Knurled 15kg Adjustable Dumbbell Pair', desc: 'Precision steel plates with spin-lock collars for progressive home strength training.', price: 3499, compare: 4299, stock: 14, sku: 'FN-DMB-006', img: IMG_BARBELL, cod: 0 },
      { category: 'Exercise accessories', name: 'FITNOVA High-Density 8mm NBR Exercise Mat', desc: 'Extra-thick joint-protective floor mat with carry strap for HIIT, abs, and yoga.', price: 1199, compare: 1599, stock: 30, sku: 'FN-MAT-007', img: IMG_KIT, cod: 1 },
      { category: 'Running accessories', name: 'FITNOVA Reflective Waist Running Belt', desc: 'Bounce-free weatherproof phone and key pouch engineered for outdoor GPS tracking.', price: 549, compare: 799, stock: 55, sku: 'FN-BLT-008', img: IMG_HERO, cod: 1 },
    ];
    const stmt = db.prepare(`
      INSERT INTO products (id, category_name, name, description, price_inr, compare_at_price_inr, stock_quantity, sku, image_url, cod_supported)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const p of storeProducts) {
      stmt.run(uuid(), p.category, p.name, p.desc, p.price, p.compare, p.stock, p.sku, p.img, p.cod);
    }
  }

  // 7. Seed Coupons
  const couponCount = (db.prepare('SELECT COUNT(*) as c FROM coupons').get() as { c: number }).c;
  if (couponCount === 0) {
    db.prepare('INSERT INTO coupons (id, code, discount_type, discount_value, min_order_inr, max_uses) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), 'FITNOVA50', 'flat_inr', 50, 499, 500);
    db.prepare('INSERT INTO coupons (id, code, discount_type, discount_value, min_order_inr, max_uses) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), 'TRAIN10', 'percent', 10, 999, 500);
  }

  // 8. App Settings
  const adSetting = db.prepare('SELECT key FROM app_settings WHERE key = ?').get('ads_config');
  if (!adSetting) {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run(
      'ads_config',
      JSON.stringify({
        admob_enabled: true,
        banner_home: true,
        banner_workout_library: true,
        banner_calculators: true,
        ad_free_price_inr: 149,
        admob_unit_id: process.env.VITE_ADMOB_BANNER_UNIT_ID || 'ca-app-pub-fitnova-banner-india',
      })
    );
  }
}
