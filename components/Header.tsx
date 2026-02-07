
import React from 'react';

interface HeaderProps {
  currentUsername?: string;
  currentPoints?: number;
  onLogout?: () => void;
  onOpenWallet?: () => void;
  onLogoClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUsername, currentPoints, onLogout, onOpenWallet, onLogoClick }) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
      <div 
        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={onLogoClick}
      >
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
          GYM <span className="text-indigo-400">BUDDY</span>
        </h1>
      </div>
      <div className="flex items-center gap-4">
        {currentUsername && onLogout && (
          <>
            <button 
              onClick={onOpenWallet}
              className="p-2 text-zinc-400 hover:text-purple-400 hover:bg-purple-500/10 rounded-full transition-all"
              title="Crypto Wallet"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </button>
            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 rounded-full text-xs font-medium border border-indigo-500/30">
              @{currentUsername}
            </span>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-300 rounded-full text-xs font-medium border border-emerald-500/30">
              {currentPoints ?? 0} pts
            </span>
            <button
              onClick={onLogout}
              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full text-xs font-medium border border-zinc-700 transition-colors"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Header;
