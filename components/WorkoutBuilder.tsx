import React, { useEffect, useMemo, useState } from 'react';
import { WorkoutRoutine } from '../types';

interface WorkoutBuilderProps {
  onSave: (workout: WorkoutRoutine | WorkoutRoutine[]) => void;
  onCancel: () => void;
  initialSplit?: WorkoutRoutine[];
  initialWorkout?: WorkoutRoutine | null;
}

type BuildMode = 'single' | 'split';
type DraftExercise = { id: string; type: string };
type SplitDay = { id: string; name: string; exercises: DraftExercise[]; routineId?: string };

const EXERCISE_LIBRARY: Record<string, string[]> = {
  Legs: ['Squat', 'Deadlift', 'Leg Press', 'Lunge', 'Leg Curl', 'Leg Extension', 'Calf Raise', 'Romanian Deadlift'],
  Chest: ['Bench Press', 'Incline Bench', 'Chest Fly', 'Push Up', 'Dips'],
  Back: ['Barbell Row', 'Lat Pulldown', 'Pull Up', 'Face Pull', 'T-Bar Row', 'Deadlift'],
  Shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Arnold Press'],
  Arms: ['Bicep Curl', 'Tricep Extension', 'Hammer Curl', 'Skullcrusher', 'Preacher Curl'],
  Core: ['Plank', 'Leg Raise', 'Russian Twist', 'Crunch', 'Hanging Leg Raise']
};

const createDay = (index: number, routineId?: string): SplitDay => ({
  id: crypto.randomUUID(),
  name: `Day ${index + 1}`,
  exercises: [],
  routineId,
});

const WorkoutBuilder: React.FC<WorkoutBuilderProps> = ({ onSave, onCancel, initialSplit = [], initialWorkout = null }) => {
  const isEditingSplit = initialSplit.length > 0;
  const isEditingSingle = !!initialWorkout && !isEditingSplit;
  const [buildMode, setBuildMode] = useState<BuildMode>(isEditingSplit ? 'split' : 'single');
  const [name, setName] = useState(initialWorkout?.name || '');
  const [exercises, setExercises] = useState<DraftExercise[]>(
    initialWorkout?.exercises.map(ex => ({ id: ex.id, type: ex.type })) || []
  );
  const [splitName, setSplitName] = useState(initialSplit[0]?.splitName || '');
  const [splitDays, setSplitDays] = useState<SplitDay[]>(
    isEditingSplit
      ? [...initialSplit]
          .sort((a, b) => (a.dayIndex ?? 999) - (b.dayIndex ?? 999))
          .map((routine, index) => ({
            id: crypto.randomUUID(),
            routineId: routine.id,
            name: routine.name || `Day ${index + 1}`,
            exercises: routine.exercises.map(ex => ({ id: ex.id, type: ex.type })),
          }))
      : [createDay(0)]
  );
  const [activeDayId, setActiveDayId] = useState<string>(isEditingSplit ? crypto.randomUUID() : '');
  const [customInput, setCustomInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('Legs');

  useEffect(() => {
    if (splitDays.length === 0) return;
    setActiveDayId(prev => (prev && splitDays.some(day => day.id === prev) ? prev : splitDays[0].id));
  }, [splitDays]);

  const activeDay = useMemo(
    () => splitDays.find(day => day.id === activeDayId) || splitDays[0],
    [activeDayId, splitDays]
  );

  const currentExercises = buildMode === 'single' ? exercises : activeDay?.exercises || [];

  const addExercise = (type: string) => {
    if (buildMode === 'single') {
      setExercises(prev => [...prev, { id: crypto.randomUUID(), type }]);
      return;
    }

    if (!activeDay) return;
    setSplitDays(prev =>
      prev.map(day => (day.id === activeDay.id ? { ...day, exercises: [...day.exercises, { id: crypto.randomUUID(), type }] } : day))
    );
  };

  const addCustom = () => {
    if (!customInput.trim()) return;
    addExercise(customInput.trim());
    setCustomInput('');
  };

  const removeExercise = (id: string) => {
    if (buildMode === 'single') {
      setExercises(prev => prev.filter(e => e.id !== id));
      return;
    }

    if (!activeDay) return;
    setSplitDays(prev =>
      prev.map(day => (day.id === activeDay.id ? { ...day, exercises: day.exercises.filter(e => e.id !== id) } : day))
    );
  };

  const addDay = () => {
    setSplitDays(prev => {
      const next = [...prev, createDay(prev.length)];
      setActiveDayId(next[next.length - 1].id);
      return next;
    });
  };

  const removeDay = (dayId: string) => {
    setSplitDays(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(day => day.id !== dayId);
      if (dayId === activeDayId) {
        setActiveDayId(next[0].id);
      }
      return next;
    });
  };

  const updateDayName = (dayId: string, value: string) => {
    setSplitDays(prev => prev.map(day => (day.id === dayId ? { ...day, name: value } : day)));
  };

  const handleSave = () => {
    if (buildMode === 'single') {
      if (!name.trim() || exercises.length === 0) return;
      const existingByType = new Map<string, WorkoutRoutine['exercises'][number]>(
        (initialWorkout?.exercises || []).map(ex => [ex.type.toLowerCase(), ex])
      );
      onSave({
        id: initialWorkout?.id || crypto.randomUUID(),
        name: name.trim(),
        lastPerformedAt: initialWorkout?.lastPerformedAt,
        exercises: exercises.map(e => {
          const matched = existingByType.get(e.type.toLowerCase());
          return {
            id: matched?.id || e.id || crypto.randomUUID(),
            type: e.type,
            sets: matched?.sets || [],
          };
        }),
      });
      return;
    }

    const cleanSplitName = splitName.trim();
    if (!cleanSplitName) return;

    const validDays = splitDays.filter(day => day.exercises.length > 0);
    if (validDays.length === 0) return;

    const existingSplitGroupId = initialSplit[0]?.splitGroupId;
    const splitGroupId = existingSplitGroupId || crypto.randomUUID();
    const existingById = new Map(initialSplit.map(r => [r.id, r]));
    const routines: WorkoutRoutine[] = validDays.map((day, index) => ({
      id: day.routineId || crypto.randomUUID(),
      name: day.name.trim() || `Day ${index + 1}`,
      splitName: cleanSplitName,
      splitGroupId,
      dayIndex: index,
      generatedByAI: existingById.get(day.routineId || '')?.generatedByAI ?? false,
      lastPerformedAt: existingById.get(day.routineId || '')?.lastPerformedAt,
      exercises: day.exercises.map(ex => {
        const existingRoutine = existingById.get(day.routineId || '');
        const matched = existingRoutine?.exercises.find(
          old => old.type.toLowerCase() === ex.type.toLowerCase()
        );
        return {
          id: matched?.id || ex.id || crypto.randomUUID(),
          type: ex.type,
          sets: matched?.sets || [],
        };
      }),
    }));
    onSave(routines);
  };

  const canSave =
    buildMode === 'single'
      ? !!name.trim() && exercises.length > 0
      : !!splitName.trim() && splitDays.some(day => day.exercises.length > 0);

  return (
    <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 space-y-6 animate-in fade-in zoom-in-95 duration-300 shadow-2xl">
      <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1 w-fit">
        <button
          disabled={isEditingSplit}
          onClick={() => setBuildMode('single')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            buildMode === 'single' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
          } ${isEditingSplit ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Single Routine
        </button>
        <button
          disabled={isEditingSingle}
          onClick={() => setBuildMode('split')}
          className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            buildMode === 'split' ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
          } ${isEditingSingle ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          Build Split
        </button>
      </div>

      {buildMode === 'single' ? (
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
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">Split Name</label>
            <input
              autoFocus
              value={splitName}
              onChange={e => setSplitName(e.target.value)}
              placeholder="e.g. Push Pull Legs"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {splitDays.map((day, index) => (
              <button
                key={day.id}
                onClick={() => setActiveDayId(day.id)}
                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeDayId === day.id ? 'bg-indigo-600 text-white' : 'bg-zinc-950 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {day.name || `Day ${index + 1}`}
              </button>
            ))}
            <button
              onClick={addDay}
              className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              + Add Day
            </button>
            {splitDays.length > 1 && activeDay && (
              <button
                onClick={() => removeDay(activeDay.id)}
                className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-600/20 text-rose-300 hover:bg-rose-600/30"
              >
                Remove Day
              </button>
            )}
          </div>
          {activeDay && (
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">Active Day Name</label>
              <input
                value={activeDay.name}
                onChange={e => updateDayName(activeDay.id, e.target.value)}
                placeholder="e.g. Push Day"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">Exercise Library</label>
            <div className="flex gap-1">
              {Object.keys(EXERCISE_LIBRARY).map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
                    activeCategory === cat ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
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
                onKeyDown={e => e.key === 'Enter' && addCustom()}
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

        <div className="space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 ml-1">
            {buildMode === 'single' ? 'Your Routine' : `Day Plan: ${activeDay?.name || 'Active Day'}`} ({currentExercises.length})
          </label>
          <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 min-h-[250px] space-y-2 overflow-y-auto max-h-[300px] custom-scrollbar">
            {currentExercises.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-700 py-10">
                <svg className="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-xs font-bold uppercase tracking-widest">Add exercises from the left</p>
              </div>
            ) : (
              currentExercises.map((ex, idx) => (
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
          disabled={!canSave}
          className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-zinc-800 text-white font-black rounded-2xl shadow-xl transition-all uppercase tracking-[0.2em] text-xs shadow-indigo-500/20 active:scale-95"
        >
          {buildMode === 'single' ? 'Save Routine' : 'Save Split'}
        </button>
      </div>
    </div>
  );
};

export default WorkoutBuilder;
