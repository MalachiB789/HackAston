
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6.5 6.5 11 11"/>
            <path d="m21 21-1-1"/>
            <path d="m3 3 1 1"/>
            <path d="m18 22 4-4"/>
            <path d="m2 6 4-4"/>
            <path d="m3 10 7-7"/>
            <path d="m14 21 7-7"/>
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          GYM<span className="text-indigo-400">FORM</span> AI
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-full text-xs font-medium border border-zinc-700">
          BETA 1.0
        </span>
      </div>
    </header>
  );
};

export default Header;
