
import React, { useState } from 'react';
import { suggestWorkout } from '../services/geminiService';
import { WorkoutRoutine } from '../types';

interface AISuggestionModalProps {
  history: WorkoutRoutine[];
  onSave: (workout: WorkoutRoutine) => void;
  onCancel: () => void;
}

const AISuggestionModal: React.FC<AISuggestionModalProps> = ({ history, onSave, onCancel }) => {
  const [goal, setGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<{ routine: WorkoutRoutine; reasoning: string } | null>(null);

  const handleGenerate = async () => {
    if (!goal.trim()) return;
    setIsGenerating(true);
    try {
      const result = await suggestWorkout(goal, history);
      setSuggestion(result);
    } catch (err) {
      console.error(err);
      alert("Failed to generate suggestion. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-900 w-full max-w-lg rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 bg-gradient-to-br from-indigo-600/20 to-transparent border-b border-zinc-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-white uppercase italic tracking-wider">AI Training Assistant</h2>
          </div>
          <p className="text-zinc-400 text-xs">I'll analyze your history and build a routine optimized for your goals.</p>
        </div>

        <div className="p-6 space-y-6">
          {!suggestion ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">What's your focus for today?</label>
                <textarea 
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="e.g. Focus on compound lifts to build leg strength, but keep it low impact on knees."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 h-24 resize-none transition-all"
                />
              </div>
              <button 
                onClick={handleGenerate}
                disabled={isGenerating || !goal.trim()}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Analyzing Bio-Data...
                  </>
                ) : (
                  'Generate Smart Routine'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-zinc-950/50 border border-indigo-500/20 p-4 rounded-xl space-y-2">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Reasoning
                </h3>
                <p className="text-zinc-300 text-xs italic leading-relaxed">"{suggestion.reasoning}"</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Suggested Plan</h4>
                <div className="space-y-2">
                  {suggestion.routine.exercises.map((ex, i) => (
                    <div key={ex.id} className="flex items-center gap-3 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                      <span className="text-indigo-500 font-mono text-[10px] font-bold">{i+1}</span>
                      <span className="text-white font-bold text-sm">{ex.type}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setSuggestion(null)} className="flex-1 py-3 text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:text-white">Start Over</button>
                <button 
                  onClick={() => onSave(suggestion.routine)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl uppercase tracking-widest text-[10px] shadow-lg shadow-emerald-500/20"
                >
                  Accept & Save
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end">
          <button onClick={onCancel} className="text-zinc-600 hover:text-white text-[10px] font-black uppercase tracking-widest">Close</button>
        </div>
      </div>
    </div>
  );
};

export default AISuggestionModal;
