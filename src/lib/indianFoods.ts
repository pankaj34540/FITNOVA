export interface IndianFoodItem {
  name: string;
  servingLabel: string;
  dietType: 'veg' | 'non_veg';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const INDIAN_FOOD_DATABASE: IndianFoodItem[] = [
  { name: 'Vegetable Poha with Peanuts', servingLabel: '1 medium bowl (200g)', dietType: 'veg', calories: 250, protein: 6.2, carbs: 42.0, fat: 6.5 },
  { name: 'Idli with Sambar (3 pcs)', servingLabel: '3 idlis + 150ml sambar', dietType: 'veg', calories: 290, protein: 10.4, carbs: 54.0, fat: 3.2 },
  { name: 'Moong Dal Chilla (2 pcs)', servingLabel: '2 chillas + mint chutney', dietType: 'veg', calories: 270, protein: 15.6, carbs: 36.0, fat: 6.8 },
  { name: 'Paneer Bhurji (Low Oil)', servingLabel: '150g serving', dietType: 'veg', calories: 310, protein: 21.0, carbs: 8.5, fat: 21.5 },
  { name: 'Dal Tadka + 2 Whole Wheat Rotis', servingLabel: '1 bowl dal + 2 rotis', dietType: 'veg', calories: 420, protein: 16.5, carbs: 68.0, fat: 9.0 },
  { name: 'Rajma Chawal (Brown/Steamed)', servingLabel: '1 plate (320g)', dietType: 'veg', calories: 445, protein: 15.2, carbs: 78.0, fat: 7.4 },
  { name: 'Sprouts Chaat with Lemon & Onion', servingLabel: '1 bowl (150g)', dietType: 'veg', calories: 165, protein: 11.5, carbs: 26.0, fat: 1.5 },
  { name: 'Homemade Curd / Dahi (Low Fat)', servingLabel: '1 cup (200g)', dietType: 'veg', calories: 120, protein: 7.2, carbs: 9.5, fat: 5.5 },
  { name: 'Masala Oats Upma', servingLabel: '1 bowl (220g)', dietType: 'veg', calories: 235, protein: 8.4, carbs: 38.0, fat: 5.2 },
  { name: 'Roasted Chana & Almonds Snack', servingLabel: '40g mix', dietType: 'veg', calories: 185, protein: 8.2, carbs: 18.0, fat: 8.8 },
  { name: 'Boiled Eggs (3 Whole)', servingLabel: '3 large eggs', dietType: 'non_veg', calories: 215, protein: 18.9, carbs: 1.8, fat: 14.4 },
  { name: 'Egg Bhurji (3 Eggs) + 2 Rotis', servingLabel: '1 plate', dietType: 'non_veg', calories: 430, protein: 24.0, carbs: 42.0, fat: 18.0 },
  { name: 'Tandoori Chicken Breast (Skinless)', servingLabel: '180g cooked', dietType: 'non_veg', calories: 285, protein: 46.0, carbs: 3.5, fat: 9.0 },
  { name: 'Homestyle Chicken Curry + Rice', servingLabel: '1 bowl curry + 150g rice', dietType: 'non_veg', calories: 510, protein: 34.0, carbs: 56.0, fat: 15.5 },
  { name: 'Grilled Rohu / Pomfret Fish Masala', servingLabel: '160g fillet', dietType: 'non_veg', calories: 260, protein: 32.0, carbs: 4.0, fat: 12.0 },
  { name: 'Banana Whey Protein Shake', servingLabel: '1 scoop + 250ml toned milk', dietType: 'veg', calories: 295, protein: 29.0, carbs: 34.0, fat: 4.5 },
];

export function calcBMI(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  let category = 'Normal range';
  if (bmi < 18.5) category = 'Underweight';
  else if (bmi >= 23 && bmi < 25) category = 'Overweight (Asian-Indian cut-off)';
  else if (bmi >= 25) category = 'Obese (Asian-Indian cut-off)';
  return { bmi: Number(bmi.toFixed(1)), category };
}

export function calcBMR(weightKg: number, heightCm: number, age: number, gender: 'male' | 'female') {
  const s = gender === 'female' ? -161 : 5;
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + s);
}

export function calcTDEE(bmr: number, activityMultiplier: number) {
  return Math.round(bmr * activityMultiplier);
}

export function calcBodyFatNavy(gender: 'male' | 'female', waistCm: number, neckCm: number, heightCm: number, hipCm = 95) {
  if (gender === 'male') {
    const val = 495 / (1.0324 - 0.19077 * Math.log10(Math.max(10, waistCm - neckCm)) + 0.15456 * Math.log10(heightCm)) - 450;
    return Number(Math.max(4, Math.min(55, val)).toFixed(1));
  }
  const val = 495 / (1.29579 - 0.35004 * Math.log10(Math.max(10, waistCm + hipCm - neckCm)) + 0.221 * Math.log10(heightCm)) - 450;
  return Number(Math.max(8, Math.min(60, val)).toFixed(1));
}

export function calcIdealWeight(heightCm: number, gender: 'male' | 'female') {
  const inchesOver5Ft = Math.max(0, heightCm / 2.54 - 60);
  const base = gender === 'female' ? 45.5 : 50;
  return Number((base + 2.3 * inchesOver5Ft).toFixed(1));
}

export function calc1RM(weightKg: number, reps: number) {
  if (reps <= 1) return Math.round(weightKg);
  return Math.round(weightKg * (1 + reps / 30));
}
