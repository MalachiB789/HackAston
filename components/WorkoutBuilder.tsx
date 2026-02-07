
import React, { useState } from 'react';
import { WorkoutRoutine } from '../types';

interface WorkoutBuilderProps {
  onSave: (workout: WorkoutRoutine) => void;
  onCancel: () => void;
}

const EXERCISE_LIBRARY: Record<string, string[]> = {
  "Legs": ["Squat", "Deadlift", "Leg Press", "Lunge", "Leg Curl", "Leg Extension", "Calf Raise", "Romanian Deadlift"],
  "Chest": ["Bench Press", "Incline Bench", "Chest Fly", "Push Up", "Dips"],
  "Back": ["Barbell Row", "Lat Pulldown", "Pull Up", "Face Pull", "T-Bar Row", "Deadlift"],
  "Shoulders": ["Overhead Press", "Lateral Raise", "Front Raise", "Rear Delt Fly", "Arnold Press"],
  "Arms": ["Bicep Curl", "Tricep Extension", "Hammer Curl", "Skullcrusher", "Preacher Curl"],
  "Core": ["Plank", "Leg Raise", "Russian Twist", "Crunch", "Hanging Leg Raise"]
};

const WorkoutBuilder: React.FC<WorkoutBuilderProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<{ id: string, type: string }[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [activeCategory, setActiveCategory] = useState("Legs");

  const addExercise = (type: string) => {
    setExercises([...exercises, { id: crypto.randomUUID(), type }]);
  };

  const addCustom = () => {
    if (!customInput.trim()) return;
    addExercise(customInput.trim());
    setCustomInput('');
  };

  const removeExercise = (id: string) => {
    setExercises(exercises.filter(e => e.id !== id));
  };

  const handleSave = () => {
    if (!name || exercises.length === 0) return;
    onSave({
      id: crypto.randomUUID(),
      name,
      exercises: exercises.map(e => ({ id: e.id, type: e.type, sets: [] })),
    });
  };

  return (
    <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-6 animate-in fade-in zoom-in-95 duration-300 shadow-2xl">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">Routine Name</label>
        <input 
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Hypertrophy Upper Body"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Library */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">Exercise Library</label>
            <div className="flex gap-1">
               {Object.keys(EXERCISE_LIBRARY).map(cat => (
                 <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[9px] font-black uppercase px-2 py-1 rounded ${activeCategory === cat ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                 >
                   {cat}
                 </button>
               ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {EXERCISE_LIBRARY[activeCategory].map(ex => (
              <button 
                key={ex}
                onClick={() => addExercise(ex)}
                className="px-3 py-3 bg-zinc-950 hover:bg-zinc-800 rounded-xl text-left text-xs font-bold text-zinc-300 border border-zinc-800 hover:border-indigo-500/50 transition-all flex justify-between items-center group"
              >
                {ex}
                <svg className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">Custom Movement</label>
            <div className="flex gap-2">
              <input 
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder="Enter exercise name..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              />
              <button 
                onClick={addCustom}
                className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Right: Planned Routine */}
        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">Your Routine ({exercises.length})</label>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 min-h-[250px] space-y-2 overflow-y-auto max-h-[300px] custom-scrollbar">
            {exercises.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-700 py-10">
                <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-xs font-bold uppercase tracking-widest">Add exercises from the left</p>
              </div>
            ) : (
              exercises.map((ex, idx) => (
                <div key={ex.id} className="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 animate-in slide-in-from-right-4">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 flex items-center justify-center bg-zinc-800 rounded-md text-[10px] font-black text-zinc-500">{idx + 1}</span>
                    <span className="text-white font-bold text-sm">{ex.type}</span>
                  </div>
                  <button onClick={() => removeExercise(ex.id)} className="p-1.5 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-6 border-t border-zinc-800">
        <button onClick={onCancel} className="flex-1 py-4 text-zinc-500 font-black text-xs uppercase tracking-[0.3em] hover:text-white transition-colors">Discard</button>
        <button 
          onClick={handleSave}
          disabled={!name || exercises.length === 0}
          className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 text-white font-black rounded-2xl shadow-xl transition-all uppercase tracking-[0.2em] text-xs shadow-indigo-500/20 active:scale-95"
        >
          Save & Exit
        </button>
      </div>
    </div>
  );
};

export default WorkoutBuilder;
