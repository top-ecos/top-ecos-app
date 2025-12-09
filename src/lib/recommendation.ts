import { SDD } from "@/hooks/useSDD";

/**
 * Linear Congruential Generator (LCG) for seeded random numbers.
 * Using constants from Numerical Recipes.
 */
class SeededRandom {
  private m = 2 ** 32;
  private a = 1664525;
  private c = 1013904223;
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Returns a float between 0 and 1
   */
  next(): number {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state / this.m;
  }

  /**
   * Returns an integer between min (inclusive) and max (exclusive)
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }
}

/**
 * Generates a stable daily seed based on the date string YYYY-MM-DD.
 * This ensures all users get the same seed for the same day.
 */
export const getDailySeed = (date: Date = new Date()): number => {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/**
 * Selects the "Station of the Day" using the daily seed.
 * This station is the same for everyone on a given day.
 */
export const getStationOfTheDay = (sdds: SDD[], date: Date = new Date()): SDD | null => {
  if (!sdds || sdds.length === 0) return null;

  // Use a stable sort first to ensure index consistency
  const sorted = [...sdds].sort((a, b) => a.id.localeCompare(b.id));

  const seed = getDailySeed(date);
  const rng = new SeededRandom(seed);
  
  const index = rng.nextInt(0, sorted.length);
  return sorted[index];
};

/**
 * Selects a recommended station for the user.
 * 
 * Logic:
 * 1. If "Station of the Day" is NOT completed, return it.
 * 2. If "Station of the Day" IS completed, return a random UNCOMPLETED station.
 *    (We use a seeded random here too for stability across page reloads on the same day).
 * 3. If all uncompleted, return a random COMPLETED station (Review mode).
 */
export const getNextRecommendedStation = (
  sdds: SDD[], 
  completedIds: Set<string>, 
  stationOfTheDay: SDD | null,
  date: Date = new Date()
): SDD | null => {
  if (!sdds.length) return null;

  // Priority 1: Station of the Day (if uncompleted)
  if (stationOfTheDay && !completedIds.has(stationOfTheDay.sdd_id)) {
    return stationOfTheDay;
  }

  // Derive a stable seed for the backup choice
  // Mixing the daily seed with a constant to ensure it's different from the primary pick logic
  // but still stable for the day.
  const seed = getDailySeed(date);
  const backupSeed = seed + 9999; 
  const rng = new SeededRandom(backupSeed);

  // Priority 2: Random Uncompleted
  // Stable sort is crucial for stable seeded selection
  const uncompleted = sdds.filter(s => !completedIds.has(s.sdd_id)).sort((a, b) => a.id.localeCompare(b.id));
  
  if (uncompleted.length > 0) {
    const index = rng.nextInt(0, uncompleted.length);
    return uncompleted[index];
  }

  // Priority 3: Random Completed (Review)
  const sorted = [...sdds].sort((a, b) => a.id.localeCompare(b.id));
  const index = rng.nextInt(0, sorted.length);
  return sorted[index];
};
