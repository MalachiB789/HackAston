
import React from 'react';
import { AnalysisFeedback } from '../types';

interface AnalysisResultProps {
  feedback: AnalysisFeedback;
  onReset: () => void;
}

const AnalysisResult: React.FC<AnalysisResultProps> = ({ feedback, onReset }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
          <div>
            <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Exercise Analysis</h2>
            <h3 className="text-2xl font-bold text-white mt-1">{feedback.exerciseName}</h3>
          </div>
          <div className="text-center">
            <span className={`text-5xl font-black ${getScoreColor(feedback.score)}`}>
              {feedback.score}
            </span>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-tighter">Form Score</p>
          </div>
        </div>

        <div className="p-6">
          <p className="text-zinc-300 leading-relaxed italic border-l-4 border-indigo-500 pl-4 py-2 bg-indigo-500/5 rounded-r-lg">
            "{feedback.overallSummary}"
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-800">
          <div className="bg-zinc-900 p-6">
            <h4 className="flex items-center gap-2 text-emerald-400 font-bold mb-4 uppercase text-xs tracking-widest">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Strengths
            </h4>
            <ul className="space-y-3">
              {feedback.pros.map((pro, i) => (
                <li key={i} className="text-zinc-400 text-sm flex gap-3">
                  <span className="text-emerald-500/50">•</span>
                  {pro}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-zinc-900 p-6">
            <h4 className="flex items-center gap-2 text-rose-400 font-bold mb-4 uppercase text-xs tracking-widest">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Technique Errors
            </h4>
            <ul className="space-y-3">
              {feedback.cons.map((con, i) => (
                <li key={i} className="text-zinc-400 text-sm flex gap-3">
                  <span className="text-rose-500/50">•</span>
                  {con}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {feedback.safetyWarnings.length > 0 && (
          <div className="p-6 bg-rose-500/10 border-y border-rose-500/20">
            <h4 className="text-rose-500 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Safety Critical
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {feedback.safetyWarnings.map((warn, i) => (
                <div key={i} className="bg-rose-500/20 p-3 rounded-lg text-rose-300 text-xs font-medium">
                  {warn}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-6 bg-zinc-950/50">
          <h4 className="text-indigo-400 font-bold text-xs uppercase tracking-widest mb-4">Actionable Tips</h4>
          <div className="grid gap-3">
            {feedback.suggestions.map((tip, i) => (
              <div key={i} className="flex gap-4 items-start bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center flex-shrink-0 text-xs font-black">
                  {i + 1}
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={onReset}
        className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-2xl transition-all border border-zinc-700 flex items-center justify-center"
      >
        Done
      </button>
    </div>
  );
};

export default AnalysisResult;
