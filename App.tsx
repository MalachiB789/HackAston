
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import LiveCoachingHUD from './components/LiveCoachingHUD';
import AnalysisResult from './components/AnalysisResult';
import WorkoutBuilder from './components/WorkoutBuilder';
import ActiveWorkoutSession from './components/ActiveWorkoutSession';
import AISuggestionModal from './components/AISuggestionModal';
import SolanaWalletPanel from './components/SolanaWalletPanel';
import { analyzeForm } from './services/geminiService';
import { AnalysisFeedback, ExerciseType, FrameData, WorkoutRoutine, SetLog, WorkoutHistoryEntry, UserAccount } from './types';

const App: React.FC = () => {
  const [accounts, setAccounts] = useState<UserAccount[]>(() => {
    const saved = localStorage.getItem('gymform_accounts');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => localStorage.getItem('gymform_current_user'));
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // User data
  const [routines, setRoutines] = useState<WorkoutRoutine[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutRoutine | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [editingSplitGroupId, setEditingSplitGroupId] = useState<string | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [isCoachingActive, setIsCoachingActive] = useState<{ exId: string, type: ExerciseType } | null>(null);
  const [feedback, setFeedback] = useState<AnalysisFeedback | null>(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sortedRoutines = [...routines].sort((a, b) => (b.lastPerformedAt ?? 0) - (a.lastPerformedAt ?? 0));
  const mySplitRoutines = sortedRoutines
    .filter(r => !!r.splitGroupId)
    .sort((a, b) => (a.dayIndex ?? 999) - (b.dayIndex ?? 999));
  const manualRoutines = sortedRoutines.filter(r => !r.splitGroupId);
  const sortedHistory = [...workoutHistory].sort((a, b) => b.performedAt - a.performedAt);
  const splitGroups = mySplitRoutines.reduce<Record<string, WorkoutRoutine[]>>((acc, routine) => {
    const groupId = routine.splitGroupId!;
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push(routine);
    return acc;
  }, {});
  const editingSplitRoutines = editingSplitGroupId
    ? (splitGroups[editingSplitGroupId] || []).sort((a, b) => (a.dayIndex ?? 999) - (b.dayIndex ?? 999))
    : [];
  const editingWorkout = editingRoutineId
    ? routines.find(r => r.id === editingRoutineId) || null
    : null;
  const currentUser = currentUserId ? accounts.find(a => a.id === currentUserId) || null : null;
  const leaderboard = [...accounts]
    .map(account => ({
      ...account,
      points: account.points ?? 0,
      workoutsCompleted: account.workoutsCompleted ?? 0,
      totalSetsCompleted: account.totalSetsCompleted ?? 0,
      bestFormScore: account.bestFormScore ?? 0,
    }))
    .sort((a, b) => {
      if ((b.points ?? 0) !== (a.points ?? 0)) return (b.points ?? 0) - (a.points ?? 0);
      return (b.workoutsCompleted ?? 0) - (a.workoutsCompleted ?? 0);
    });
  const currentUserRank = currentUser
    ? leaderboard.findIndex(account => account.id === currentUser.id) + 1
    : null;

  useEffect(() => {
    localStorage.setItem('gymform_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    if (currentUserId) localStorage.setItem('gymform_current_user', currentUserId);
    else localStorage.removeItem('gymform_current_user');
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setRoutines([]);
      setWorkoutHistory([]);
      return;
    }

    const savedRoutines = localStorage.getItem(`gymform_routines_${currentUserId}`);
    const savedHistory = localStorage.getItem(`gymform_history_${currentUserId}`);
    setRoutines(savedRoutines ? JSON.parse(savedRoutines) : []);
    setWorkoutHistory(savedHistory ? JSON.parse(savedHistory) : []);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    localStorage.setItem(`gymform_routines_${currentUserId}`, JSON.stringify(routines));
  }, [routines, currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    localStorage.setItem(`gymform_history_${currentUserId}`, JSON.stringify(workoutHistory));
  }, [workoutHistory, currentUserId]);

  const handleSignup = () => {
    const username = authUsername.trim();
    const password = authPassword.trim();
    if (!username || !password) {
      setAuthError('Username and password are required.');
      return;
    }
    if (accounts.some(a => a.username.toLowerCase() === username.toLowerCase())) {
      setAuthError('Username already exists.');
      return;
    }

    const account: UserAccount = {
      id: crypto.randomUUID(),
      username,
      password,
      createdAt: Date.now(),
      points: 0,
      workoutsCompleted: 0,
      totalSetsCompleted: 0,
      bestFormScore: 0,
    };
    setAccounts(prev => [...prev, account]);
    setCurrentUserId(account.id);
    setAuthError(null);
    setAuthUsername('');
    setAuthPassword('');
  };

  const handleLogin = () => {
    const username = authUsername.trim();
    const password = authPassword.trim();
    const account = accounts.find(
      a => a.username.toLowerCase() === username.toLowerCase() && a.password === password
    );
    if (!account) {
      setAuthError('Invalid username or password.');
      return;
    }
    setCurrentUserId(account.id);
    setAuthError(null);
    setAuthUsername('');
    setAuthPassword('');
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    setActiveWorkout(null);
    setIsBuilding(false);
    setIsSuggesting(false);
    setEditingRoutineId(null);
    setEditingSplitGroupId(null);
    setIsCoachingActive(null);
    setFeedback(null);
    setIsAnalyzingReport(false);
    setError(null);
  };

  const updateCurrentUserStats = (
    updater: (account: UserAccount) => UserAccount
  ) => {
    if (!currentUserId) return;
    setAccounts(prev =>
      prev.map(account => (account.id === currentUserId ? updater(account) : account))
    );
  };

  const awardWorkoutPoints = (workout: WorkoutRoutine) => {
    const sets = workout.exercises.flatMap(ex => ex.sets);
    const totalSets = sets.length;
    if (totalSets === 0) return;

    const formScores = sets
      .filter(set => typeof set.formScore === 'number')
      .map(set => set.formScore as number);

    const highFormBonus = formScores.reduce((acc, score) => {
      if (score >= 90) return acc + 20;
      if (score >= 80) return acc + 12;
      if (score >= 70) return acc + 6;
      return acc;
    }, 0);

    const consistencyBonus = totalSets >= 10 ? 20 : totalSets >= 6 ? 10 : 0;
    const pointsEarned = 25 + totalSets * 5 + highFormBonus + consistencyBonus;
    const bestFormInSession = formScores.length ? Math.max(...formScores) : undefined;

    updateCurrentUserStats(account => ({
      ...account,
      points: (account.points ?? 0) + pointsEarned,
      workoutsCompleted: (account.workoutsCompleted ?? 0) + 1,
      totalSetsCompleted: (account.totalSetsCompleted ?? 0) + totalSets,
      bestFormScore: Math.max(account.bestFormScore ?? 0, bestFormInSession ?? 0),
    }));
  };

  const handleCreateRoutine = (newRoutine: WorkoutRoutine | WorkoutRoutine[]) => {
    const toAdd = Array.isArray(newRoutine) ? newRoutine : [newRoutine];
    setRoutines(prev => {
      if (editingRoutineId) {
        return prev.map(r => (r.id === editingRoutineId ? toAdd[0] : r));
      }
      if (!editingSplitGroupId) return [...prev, ...toAdd];
      const remaining = prev.filter(r => r.splitGroupId !== editingSplitGroupId);
      return [...remaining, ...toAdd];
    });
    setIsBuilding(false);
    setIsSuggesting(false);
    setEditingSplitGroupId(null);
    setEditingRoutineId(null);
  };

  const handleStartSplitEdit = (splitGroupId: string) => {
    setEditingSplitGroupId(splitGroupId);
    setEditingRoutineId(null);
    setIsBuilding(true);
    setIsSuggesting(false);
  };

  const handleStartWorkoutEdit = (routineId: string) => {
    setEditingRoutineId(routineId);
    setEditingSplitGroupId(null);
    setIsBuilding(true);
    setIsSuggesting(false);
  };

  const handleDeleteSplit = (splitGroupId: string) => {
    setRoutines(prev => prev.filter(r => r.splitGroupId !== splitGroupId));
    if (editingSplitGroupId === splitGroupId) {
      setEditingSplitGroupId(null);
      setIsBuilding(false);
    }
    if (activeWorkout?.splitGroupId === splitGroupId) {
      setActiveWorkout(null);
    }
  };

  const deleteRoutine = (id: string) => {
    setRoutines(routines.filter(r => r.id !== id));
  };

  const deleteHistoryEntry = (entryId: string) => {
    setWorkoutHistory(prev => prev.filter(entry => entry.id !== entryId));
  };

  const deleteAllHistory = () => {
    setWorkoutHistory([]);
  };

  const startWorkoutSession = (routine: WorkoutRoutine) => {
    // Start each session with fresh sets while preserving routine template metadata.
    setActiveWorkout({
      ...routine,
      exercises: routine.exercises.map(ex => ({
        ...ex,
        sets: [],
      })),
    });
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

  const handleUpdateSet = (exerciseId: string, setId: string, updates: Pick<SetLog, 'weight' | 'reps'>) => {
    if (!activeWorkout) return;
    const updated: WorkoutRoutine = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.map(s => (s.id === setId ? { ...s, ...updates } : s)),
            }
          : ex
      ),
    };
    setActiveWorkout(updated);
  };

  const handleDeleteSet = (exerciseId: string, setId: string) => {
    if (!activeWorkout) return;
    const updated: WorkoutRoutine = {
      ...activeWorkout,
      exercises: activeWorkout.exercises.map(ex =>
        ex.id === exerciseId
          ? {
              ...ex,
              sets: ex.sets.filter(s => s.id !== setId),
            }
          : ex
      ),
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

  const handleFinishWorkoutSession = () => {
    if (!activeWorkout) return;

    const performedAt = Date.now();
    const historyEntry: WorkoutHistoryEntry = {
      id: crypto.randomUUID(),
      routineId: activeWorkout.id,
      routineName: activeWorkout.name,
      splitName: activeWorkout.splitName,
      performedAt,
      exercises: activeWorkout.exercises.map(ex => ({
        ...ex,
        sets: [...ex.sets],
      })),
    };

    setWorkoutHistory(prev => [historyEntry, ...prev]);
    setRoutines(prev =>
      prev.map(r => (r.id === activeWorkout.id ? { ...r, lastPerformedAt: performedAt } : r))
    );
    awardWorkoutPoints(activeWorkout);
    setActiveWorkout(null);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-black text-white uppercase italic">GYM BUDDY</h1>
            <p className="text-zinc-500 text-sm mt-1">Sign in to access collaborative features and your personal data.</p>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-1 w-fit">
            <button
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
              }}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                authMode === 'login' ? 'bg-indigo-600 text-white' : 'text-zinc-500'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setAuthMode('signup');
                setAuthError(null);
              }}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                authMode === 'signup' ? 'bg-indigo-600 text-white' : 'text-zinc-500'
              }`}
            >
              Sign Up
            </button>
          </div>

          <div className="space-y-3">
            <input
              value={authUsername}
              onChange={e => setAuthUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
              type="password"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
            {authError && <p className="text-rose-400 text-xs font-bold">{authError}</p>}
            <button
              onClick={authMode === 'login' ? handleLogin : handleSignup}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-all"
            >
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 flex flex-col">
      <Header currentUsername={currentUser.username} currentPoints={currentUser.points ?? 0} onLogout={handleLogout} />
      
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
                    onClick={() => {
                      setEditingSplitGroupId(null);
                      setEditingRoutineId(null);
                      setIsSuggesting(true);
                    }}
                    className="px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-indigo-500/30 text-indigo-400 font-black rounded-xl uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Suggest
                  </button>
                  <button 
                    onClick={() => {
                      setEditingSplitGroupId(null);
                      setEditingRoutineId(null);
                      setIsBuilding(true);
                    }}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                    </svg>
                    New Routine
                  </button>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-amber-300 uppercase tracking-[0.3em]">Global Leaderboard</h3>
                  {currentUserRank && (
                    <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                      Your Rank: #{currentUserRank}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {leaderboard.slice(0, 8).map((account, index) => (
                    <div
                      key={account.id}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 border ${
                        account.id === currentUser?.id
                          ? 'bg-indigo-500/10 border-indigo-500/30'
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-md bg-zinc-800 text-zinc-300 text-[10px] font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-sm font-bold text-white">@{account.username}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-300 text-xs font-black uppercase tracking-widest">{account.points} pts</p>
                        <p className="text-zinc-500 text-[10px] uppercase tracking-widest">{account.workoutsCompleted} workouts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <SolanaWalletPanel 
                currentUser={currentUser} 
                onUpdateUser={(updates) => updateCurrentUserStats(a => ({ ...a, ...updates }))} 
              />

              {routines.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-zinc-900 rounded-3xl bg-zinc-900/20">
                  <p className="text-zinc-600 font-bold uppercase tracking-widest text-xs mb-4">No routines found</p>
                  <button onClick={() => setIsBuilding(true)} className="text-indigo-400 font-black text-sm hover:underline uppercase tracking-widest">Create your first workout</button>
                </div>
              ) : (
                <div className="space-y-8">
                  {mySplitRoutines.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em]">My Routines</h3>
                      <div className="space-y-6">
                        {Object.entries(splitGroups).map(([groupId, routines]) => {
                          const orderedRoutines = [...routines].sort((a, b) => (a.dayIndex ?? 999) - (b.dayIndex ?? 999));
                          const title = orderedRoutines[0]?.splitName || 'My Split';
                          return (
                            <div key={groupId} className="space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] text-indigo-300 font-black uppercase tracking-[0.3em]">{title}</p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleStartSplitEdit(groupId)}
                                    className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30"
                                  >
                                    Edit Split
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSplit(groupId)}
                                    className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-600/20 text-rose-300 hover:bg-rose-600/30"
                                  >
                                    Delete Split
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {orderedRoutines.map(routine => (
                                  <div key={routine.id} className="group bg-zinc-900 rounded-2xl p-6 border border-indigo-500/30 hover:border-indigo-400/60 transition-all flex flex-col justify-between h-44">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest">{routine.splitName || 'My Split'}</p>
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
                                      onClick={() => startWorkoutSession(routine)}
                                      className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-xl uppercase tracking-widest text-[10px] transition-all"
                                    >
                                      Start Session
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {manualRoutines.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Other Workouts</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {manualRoutines.map(routine => (
                          <div key={routine.id} className="group bg-zinc-900 rounded-2xl p-6 border border-zinc-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between h-44">
                            <div className="flex justify-between items-start">
                              <div>
                                <h3 className="text-xl font-black text-white">{routine.name}</h3>
                                <p className="text-zinc-500 text-xs font-bold mt-1 uppercase tracking-tighter">
                                  {routine.exercises.length} Exercises
                                </p>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
                                <button
                                  onClick={() => handleStartWorkoutEdit(routine.id)}
                                  className="p-2 text-zinc-400 hover:text-indigo-300 transition-all"
                                  title="Edit workout"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.586-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.414-8.586z" />
                                  </svg>
                                </button>
                                <button onClick={() => deleteRoutine(routine.id)} className="p-2 text-zinc-600 hover:text-rose-500 transition-all">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            <button
                              onClick={() => startWorkoutSession(routine)}
                              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-xl uppercase tracking-widest text-[10px] transition-all"
                            >
                              Start Session
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {sortedHistory.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.3em]">Workout History</h3>
                        <button
                          onClick={deleteAllHistory}
                          className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-600/20 text-rose-300 hover:bg-rose-600/30"
                        >
                          Delete All
                        </button>
                      </div>
                      <div className="space-y-2">
                        {sortedHistory.slice(0, 10).map(entry => {
                          const totalSets = entry.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
                          const avgScoreRaw = entry.exercises
                            .flatMap(ex => ex.sets)
                            .filter(set => typeof set.formScore === 'number')
                            .map(set => set.formScore as number);
                          const avgScore = avgScoreRaw.length
                            ? Math.round(avgScoreRaw.reduce((a, b) => a + b, 0) / avgScoreRaw.length)
                            : null;

                          return (
                            <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-white font-bold">{entry.routineName}</p>
                                <p className="text-zinc-500 text-xs">
                                  {new Date(entry.performedAt).toLocaleString()}
                                </p>
                                <div className="mt-3 space-y-2">
                                  {entry.exercises.filter(ex => ex.sets.length > 0).map(ex => (
                                    <div key={`${entry.id}-${ex.id}`} className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-2">
                                      <p className="text-zinc-300 text-[10px] font-black uppercase tracking-widest mb-1">{ex.type}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {ex.sets.map((set, idx) => (
                                          <span key={set.id} className="px-2 py-1 rounded-md bg-zinc-900 text-zinc-200 text-[10px] font-bold">
                                            {idx + 1}: {set.weight}kg x {set.reps}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right ml-4 self-start">
                                <p className="text-zinc-300 text-xs font-bold uppercase tracking-widest">{totalSets} sets</p>
                                {avgScore !== null && (
                                  <p className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Avg AI Score: {avgScore}</p>
                                )}
                                <button
                                  onClick={() => deleteHistoryEntry(entry.id)}
                                  className="mt-2 p-2 rounded-md bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 transition-all"
                                  title="Delete history entry"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Builder View */}
          {isBuilding && (
            <WorkoutBuilder 
              initialSplit={editingSplitRoutines}
              initialWorkout={editingWorkout}
              onSave={handleCreateRoutine} 
              onCancel={() => {
                setIsBuilding(false);
                setEditingSplitGroupId(null);
                setEditingRoutineId(null);
              }} 
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
              onUpdateSet={handleUpdateSet}
              onDeleteSet={handleDeleteSet}
              workoutHistory={workoutHistory}
              onLaunchCoach={(exId, type) => setIsCoachingActive({ exId, type })}
              onFinish={handleFinishWorkoutSession}
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

    </div>
  );
};

export default App;
