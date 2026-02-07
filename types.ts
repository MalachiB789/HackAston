
export type ExerciseType = string; // Broadened to support custom names

export interface AnalysisFeedback {
  exerciseName: string;
  score: number;
  pros: string[];
  cons: string[];
  suggestions: string[];
  safetyWarnings: string[];
  overallSummary: string;
}

export interface FrameData {
  dataUrl: string;
  timestamp: number;
}

export interface SetLog {
  id: string;
  reps: number;
  weight: number;
  formScore?: number;
  timestamp: number;
}

export interface WorkoutExercise {
  id: string;
  type: string;
  customName?: string;
  sets: SetLog[];
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  exercises: WorkoutExercise[];
  lastPerformedAt?: number;
}
