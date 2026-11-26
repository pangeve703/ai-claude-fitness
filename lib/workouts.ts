/**
 * Calories burned, defined once for the dashboard and the training page:
 * only completed workouts count, and only calories that were actually
 * recorded (from an app screenshot or a described workout). Planned
 * exercises without data add nothing; earlier versions guessed 5 kcal/min,
 * which made the training page and the dashboard disagree.
 */
export interface WorkoutNotes {
  distance?: string;
  pace?: string;
  heartRate?: string;
  caloriesBurned?: number;
  details?: string;
}

/** Parses the JSON notes AI logging writes; plain-text notes return null. */
export function parseWorkoutNotes(notes: string | null | undefined): WorkoutNotes | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function caloriesBurned(logs: { completed: boolean; notes?: string | null }[]): number {
  return Math.round(
    logs.reduce((sum, log) => {
      if (!log.completed) return sum;
      const kcal = Number(parseWorkoutNotes(log.notes)?.caloriesBurned);
      return Number.isFinite(kcal) && kcal > 0 ? sum + kcal : sum;
    }, 0)
  );
}
