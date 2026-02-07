
import React, { useMemo, useState } from 'react';
import { WorkoutRoutine, SetLog, ExerciseType, WorkoutHistoryEntry } from '../types';

interface ActiveWorkoutSessionProps {
  workout: WorkoutRoutine;
  onLogSet: (exerciseId: string, set: SetLog) => void;
  onUpdateSet: (exerciseId: string, setId: string, updates: Pick<SetLog, 'weight' | 'reps'>) => void;
  onDeleteSet: (exerciseId: string, setId: string) => void;
  workoutHistory: WorkoutHistoryEntry[];
  onLaunchCoach: (exerciseId: string, type: ExerciseType) => void;
  onFinish: () => void;
}

const ActiveWorkoutSession: React.FC<ActiveWorkoutSessionProps> = ({
  workout,
  onLogSet,
  onUpdateSet,
  onDeleteSet,
  workoutHistory,
  onLaunchCoach,
  onFinish
}) => {
  const [activeExerciseIdx, setActiveExerciseIdx] = useState(0);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editingWeight, setEditingWeight] = useState(0);
  const [editingReps, setEditingReps] = useState(0);

  const activeExercise = workout.exercises[activeExerciseIdx];
  const latestSessionForRoutine = useMemo(
    () =>
      [...workoutHistory]
        .filter(entry => entry.routineId === workout.id)
        .sort((a, b) => b.performedAt - a.performedAt)[0],
    [workout.id, workoutHistory]
  );
  const previousExercise = useMemo(
    () =>
      latestSessionForRoutine?.exercises.find(
        ex => ex.type.toLowerCase() === activeExercise.type.toLowerCase()
      ),
    [activeExercise.type, latestSessionForRoutine]
  );

  const handleAddSet = () => {
    if (reps <= 0) return;
    onLogSet(activeExercise.id, {
      id: crypto.randomUUID(),
      reps,
      weight,
      timestamp: Date.now()
    });
    setReps(0);
  };

  const startEditingSet = (set: SetLog) => {
    setEditingSetId(set.id);
    setEditingWeight(set.weight);
    setEditingReps(set.reps);
  };

  const cancelEditingSet = () => {
    setEditingSetId(null);
  };

  const saveEditingSet = () => {
    if (!editingSetId || editingReps <= 0) return;
    onUpdateSet(activeExercise.id, editingSetId, { weight: editingWeight, reps: editingReps });
    setEditingSetId(null);
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white uppercase italic">{workout.name}</h2>
        <button onClick={onFinish} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-lg uppercase tracking-widest shadow-lg transition-all">
          End Session
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {workout.exercises.map((ex, idx) => (
          <button 
            key={ex.id}
            onClick={() => setActiveExerciseIdx(idx)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border ${
              activeExerciseIdx === idx 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}
          >
            {ex.type}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl">
        <div className="p-6 bg-gradient-to-br from-indigo-600/10 to-transparent flex justify-between items-start">
          <div>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Current Exercise</span>
            <h3 className="text-3xl font-black text-white mt-1">{activeExercise.type}</h3>
          </div>
          <button 
            onClick={() => onLaunchCoach(activeExercise.id, activeExercise.type)}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-[9px] font-black text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">AI Coach</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Weight (kg)</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setWeight(Math.max(0, weight - 2.5))} className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">-</button>
                <input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg text-center font-black py-2 focus:outline-none" />
                <button onClick={() => setWeight(weight + 2.5)} className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">+</button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Reps</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setReps(Math.max(0, reps - 1))} className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">-</button>
                <input type="number" value={reps} onChange={e => setReps(Number(e.target.value))} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg text-center font-black py-2 focus:outline-none" />
                <button onClick={() => setReps(reps + 1)} className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">+</button>
              </div>
            </div>
          </div>

          <button 
            onClick={handleAddSet}
            disabled={reps <= 0}
            className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 font-black rounded-xl uppercase tracking-widest text-sm shadow-xl transition-all disabled:opacity-20"
          >
            Log Set
          </button>

          {previousExercise && previousExercise.sets.length > 0 && (
            <div className="space-y-2 bg-zinc-950/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Previous Session ({new Date(latestSessionForRoutine!.performedAt).toLocaleDateString()})
              </p>
              <div className="flex flex-wrap gap-2">
                {previousExercise.sets.map((set, idx) => (
                  <span key={set.id} className="px-2 py-1 rounded-md bg-zinc-900 text-zinc-200 text-[10px] font-bold">
                    {idx + 1}: {set.weight}kg x {set.reps}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-zinc-800 pb-2">Completed Sets</h4>
            <div className="space-y-2">
              {activeExercise.sets.length === 0 ? (
                <p className="text-zinc-600 text-xs italic py-4">No sets logged yet for this exercise.</p>
              ) : (
                activeExercise.sets.map((set, i) => (
                  <div key={set.id} className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 group animate-in slide-in-from-right-4 duration-300">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-[10px] font-bold text-zinc-500">{i + 1}</div>
                      {editingSetId === set.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editingWeight}
                            onChange={e => setEditingWeight(Number(e.target.value))}
                            className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white"
                          />
                          <span className="text-zinc-500 text-xs">kg ×</span>
                          <input
                            type="number"
                            value={editingReps}
                            onChange={e => setEditingReps(Number(e.target.value))}
                            className="w-20 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white"
                          />
                          <span className="text-zinc-500 text-xs">reps</span>
                        </div>
                      ) : (
                        <span className="text-white font-bold">{set.weight}kg <span className="text-zinc-500 text-xs px-2">×</span> {set.reps} reps</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {set.formScore && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                           <span className="text-emerald-500 font-bold text-[10px]">AI Score: {set.formScore}</span>
                        </div>
                      )}

                      {editingSetId === set.id ? (
                        <>
                          <button
                            onClick={saveEditingSet}
                            className="px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditingSet}
                            className="px-2 py-1 rounded-md bg-zinc-700 text-zinc-200 text-[10px] font-black uppercase tracking-widest"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditingSet(set)}
                            className="p-1.5 text-zinc-400 hover:text-indigo-300 transition-all"
                            title="Edit set"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onDeleteSet(activeExercise.id, set.id)}
                            className="p-1.5 text-zinc-500 hover:text-rose-500 transition-all"
                            title="Delete set"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveWorkoutSession;
