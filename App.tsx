
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LiveCoachingHUD from './components/LiveCoachingHUD';
import AnalysisResult from './components/AnalysisResult';
import WorkoutBuilder from './components/WorkoutBuilder';
import ActiveWorkoutSession from './components/ActiveWorkoutSession';
import AISuggestionModal from './components/AISuggestionModal';
import { analyzeForm } from './services/geminiService';
import { AnalysisFeedback, ExerciseType, FrameData, WorkoutRoutine, SetLog } from './types';

const App: React.FC = () => {
  // Persistence
  const [routines, setRoutines] = useState<WorkoutRoutine[]>(() => {
    const saved = localStorage.getItem('gymform_routines');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeWorkout, setActiveWorkout] = useState<WorkoutRoutine | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isCoachingActive, setIsCoachingActive] = useState<{ exId: string, type: ExerciseType } | null>(null);
  const [feedback, setFeedback] = useState<AnalysisFeedback | null>(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('gymform_routines', JSON.stringify(routines));
  }, [routines]);

  const handleCreateRoutine = (newRoutine: WorkoutRoutine) => {
    setRoutines([...routines, newRoutine]);
    setIsBuilding(false);
    setIsSuggesting(false);
  };

  const deleteRoutine = (id: string) => {
    setRoutines(routines.filter(r => r.id !== id));
  };

  const handleLogSet = (exerciseId: string, set: SetLog) => {
    if (!activeWorkout) return;
    const updated = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex => 
        ex.id === exerciseId ? { ...ex, sets: [...ex.sets, set] } : ex
      )
    };
    setActiveWorkout(updated);
  };

  const handleSessionComplete = async (frames: FrameData[]) => {
    const context = isCoachingActive;
    setIsCoachingActive(null);
    if (frames.length === 0 || !context) return;
    
    setIsAnalyzingReport(true);
    setError(null);
    
    try {
      const sampled = frames.length > 12 
        ? frames.filter((_, i) => i % Math.floor(frames.length / 12) === 0).slice(0, 12)
        : frames;
        
      const result = await analyzeForm(sampled, context.type);
      setFeedback(result);

      // Auto-log the set if in active session
      if (activeWorkout) {
        handleLogSet(context.exId, {
          id: crypto.randomUUID(),
          reps: 0, // AI could estimate this, for now we let user edit or manual entry
          weight: 0,
          formScore: result.score,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `Analysis error: ${err.message}` : "Analysis encountered an error.");
    } finally {
      setIsAnalyzingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      <Header />
      
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 md:py-12 w-full">
        <div className="space-y-8">
          
          {/* Dashboard View */}
          {!activeWorkout && !isBuilding && !feedback && !isAnalyzingReport && (
            <section className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black tracking-tight text-white uppercase italic">Workouts</h2>
                  <p className="text-zinc-500 text-sm max-w-xl">
                    Plan your routines and log your sessions with integrated biometric feedback.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsSuggesting(true)}
                    className="px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-indigo-500/30 text-indigo-400 font-black rounded-xl uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Suggest
                  </button>
                  <button 
                    onClick={() => setIsBuilding(true)}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    New Routine
                  </button>
                </div>
              </div>

              {routines.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-3xl bg-zinc-900/20">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs mb-4">No routines found</p>
                  <button onClick={() => setIsBuilding(true)} className="text-indigo-400 font-black text-sm hover:underline uppercase tracking-widest">Create your first workout</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {routines.map(routine => (
                    <div key={routine.id} className="group bg-zinc-900 rounded-2xl p-6 border border-zinc-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between h-44">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-black text-white">{routine.name}</h3>
                          <p className="text-zinc-500 text-xs font-bold mt-1 uppercase tracking-tighter">
                            {routine.exercises.length} Exercises
                          </p>
                        </div>
                        <button onClick={() => deleteRoutine(routine.id)} className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-rose-500 transition-all">
                           <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                           </svg>
                        </button>
                      </div>
                      <button 
                        onClick={() => setActiveWorkout(routine)}
                        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-xl uppercase tracking-widest text-[10px] transition-all"
                      >
                        Start Session
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Builder View */}
          {isBuilding && (
            <WorkoutBuilder 
              onSave={handleCreateRoutine} 
              onCancel={() => setIsBuilding(false)} 
            />
          )}

          {/* Suggesting View */}
          {isSuggesting && (
            <AISuggestionModal 
              history={routines}
              onSave={handleCreateRoutine}
              onCancel={() => setIsSuggesting(false)}
            />
          )}

          {/* Active Session View */}
          {activeWorkout && !isCoachingActive && !feedback && !isAnalyzingReport && (
            <ActiveWorkoutSession 
              workout={activeWorkout}
              onLogSet={handleLogSet}
              onLaunchCoach={(exId, type) => setIsCoachingActive({ exId, type })}
              onFinish={() => setActiveWorkout(null)}
            />
          )}

          {/* Analysis Processing View */}
          {isAnalyzingReport && (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
              <div className="relative w-24 h-24 mb-8">
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin" />
                <div className="absolute inset-4 bg-indigo-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Analyzing Set</h3>
              <p className="text-zinc-500 text-sm">Reviewing biometric data points...</p>
            </div>
          )}

          {/* Report View */}
          {feedback && !isAnalyzingReport && (
            <div className="space-y-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-black">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-emerald-400 font-bold uppercase text-[10px] tracking-widest">Technique Review Logged</span>
              </div>
              <AnalysisResult 
                feedback={feedback} 
                onReset={() => setFeedback(null)} 
              />
            </div>
          )}
        </div>
      </main>

      {/* Overlays */}
      {isCoachingActive && (
        <LiveCoachingHUD 
          exercise={isCoachingActive.type} 
          onComplete={handleSessionComplete}
          onCancel={() => setIsCoachingActive(null)}
          onTtsError={(message) => setError(message)}
        />
      )}

      {error && (
        <div className="fixed bottom-6 right-6 p-4 bg-rose-500 text-white rounded-xl shadow-2xl z-[200] animate-in slide-in-from-right-8">
          {error}
          <button onClick={() => setError(null)} className="ml-4 font-black">✕</button>
        </div>
      )}

      <footer className="py-8 text-center border-t border-zinc-900">
        <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-[0.3em]">
          BIO-PERFORMANCE INTELLIGENCE v3.0
        </p>
      </footer>
    </div>
  );
};

export default App;
