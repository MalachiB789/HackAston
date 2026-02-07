
import React from 'react';
import { ExerciseType } from '../types';

interface WorkoutSelectorProps {
  selected: ExerciseType;
  onChange: (value: ExerciseType) => void;
  disabled?: boolean;
}

const EXERCISES: ExerciseType[] = ['Squat', 'Deadlift', 'Bench Press', 'Overhead Press', 'Row', 'Other'];

const WorkoutSelector: React.FC<WorkoutSelectorProps> = ({ selected, onChange, disabled }) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">Select Exercise Target</label>
      <div className="flex flex-wrap gap-2">
        {EXERCISES.map((exercise) => (
          <button
            key={exercise}
            disabled={disabled}
            onClick={() => onChange(exercise)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
              selected === exercise 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {exercise}
          </button>
        ))}
      </div>
    </div>
  );
};

export default WorkoutSelector;
