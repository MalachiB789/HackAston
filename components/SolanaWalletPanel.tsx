
import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { connectWallet, convertPointsToSol, distributeRevenue, getWalletBalance, POINTS_TO_SOL_RATE } from '../services/solanaService';

interface SolanaWalletPanelProps {
  currentUser: UserAccount;
  onUpdateUser: (updatedFields: Partial<UserAccount>) => void;
  onClose?: () => void;
}

const SolanaWalletPanel: React.FC<SolanaWalletPanelProps> = ({ currentUser, onUpdateUser, onClose }) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser.solanaWalletAddress) {
      checkBalance(currentUser.solanaWalletAddress);
    }
  }, [currentUser.solanaWalletAddress]);

  const checkBalance = async (address: string) => {
    const bal = await getWalletBalance(address);
    setBalance(bal);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setStatusMsg(null);
    try {
      console.log("Attempting to connect wallet...");
      const wallet = await connectWallet();
      console.log("Wallet connection result:", wallet);
      if (wallet) {
        onUpdateUser({ solanaWalletAddress: wallet.publicKey });
        setStatusMsg("Wallet connected!");
      } else {
        setStatusMsg("Connection rejected or failed. Check console popup.");
      }
    } catch (e: any) {
      console.error("Wallet connection error:", e);
      setStatusMsg(`Error: ${e.message || "Unknown error"}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClaim = async () => {
    if (!currentUser.solanaWalletAddress) return;
    
    // Calculate pending points
    // For this hackathon, let's assume all current points are "claimable" for simplicity
    // or use a dedicated 'pendingSolanaRewards' field if managed.
    // Let's use 'points' as the source of truth for now, and deduct them after claim? 
    // Or just claim a fixed amount / pending amount.
    // The previous code had `pendingSolanaRewards`. Let's allow converting ALL points.
    
    const pointsToConvert = currentUser.points || 0;
    if (pointsToConvert <= 0) {
      setStatusMsg("No points to claim.");
      return;
    }

    const solAmount = convertPointsToSol(pointsToConvert);
    setIsClaiming(true);
    setStatusMsg(`Initiating claim for ${solAmount.toFixed(4)} SOL...`);
    setTxSignature(null);

    try {
      const result = await distributeRevenue(currentUser.solanaWalletAddress, solAmount);
      
      if (result.success) {
         setTxSignature(result.signature || null);
         setStatusMsg(`Success! Claimed ${solAmount.toFixed(4)} SOL.`);
         // Reset points/pending rewards after successful claim
         onUpdateUser({ 
             points: 0, 
             pendingSolanaRewards: 0,
             // accumulators might need adjustment depending on game logic, 
             // but here we just reset available points to 0.
         });
         await checkBalance(currentUser.solanaWalletAddress);
      } else {
        setStatusMsg(`Claim failed: ${result.error}`);
      }
    } catch (e: any) {
        setStatusMsg(`Error claiming: ${e.message}`);
    } finally {
        setIsClaiming(false);
    }
  };

  // Safe check for phantom
  const hasPhantom = 'solana' in window && (window as any).solana.isPhantom;

  if (!hasPhantom) {
      return (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center max-w-md mx-auto mt-20">
               {onClose && (
                  <div className="flex justify-end mb-4">
                      <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
                  </div>
              )}
              <p className="text-zinc-400 text-sm mb-4">Solana Wallet not found.</p>
              <a href="https://phantom.app/" target="_blank" rel="noreferrer" className="text-indigo-400 font-bold hover:underline">Install Phantom Wallet</a>
          </div>
      )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 max-w-lg mx-auto mt-10 shadow-2xl">
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-black text-purple-400 uppercase tracking-[0.3em]">Crypto Rewards</h3>
            <div className="px-2 py-1 bg-purple-500/10 rounded-md border border-purple-500/20">
                <span className="text-[10px] font-bold text-purple-300">DEVNET</span>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          )}
      </div>

      {!currentUser.solanaWalletAddress ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
          </div>
          <p className="text-zinc-400 text-sm mb-6 max-w-xs mx-auto">Connect your Solana wallet to convert your hard-earned points into SOL (Devnet).</p>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
          >
            {isConnecting ? 'Connecting...' : 'Connect Phantom Wallet'}
          </button>
          {statusMsg && (
             <p className="mt-4 text-xs text-rose-400 font-bold">{statusMsg}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Connected Wallet</p>
                <div className="flex items-center justify-between">
                    <p className="text-white font-mono text-xs truncate w-48">{currentUser.solanaWalletAddress}</p>
                    <button onClick={() => {
                        onUpdateUser({ solanaWalletAddress: undefined }); 
                        setStatusMsg(null);
                    }} className="text-[10px] text-rose-400 hover:underline uppercase font-bold">Disconnect</button>
                </div>
                {balance !== null && (
                    <p className="text-zinc-400 text-xs mt-2">Balance: <span className="text-white font-bold">{balance.toFixed(4)} SOL</span></p>
                )}
            </div>

            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Available to Claim</p>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-white">{currentUser.points || 0}</span>
                    <span className="text-xs font-bold text-zinc-500 mb-1">PTS</span>
                    <span className="text-zinc-600 mb-1">≈</span>
                    <span className="text-xl font-black text-purple-400">{convertPointsToSol(currentUser.points || 0).toFixed(4)}</span>
                    <span className="text-xs font-bold text-purple-500 mb-1">SOL</span>
                </div>
            </div>

            {statusMsg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${statusMsg.includes('Success') ? 'bg-emerald-500/10 text-emerald-300' : 'bg-zinc-800 text-zinc-300'}`}>
                    {statusMsg}
                </div>
            )}
            
            {txSignature && (
                <a 
                    href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block text-[10px] text-purple-400 hover:underline truncate bg-purple-500/10 p-2 rounded-lg"
                >
                    View TX: {txSignature}
                </a>
            )}

            <div className="pt-2">
                <button
                    onClick={handleClaim}
                    disabled={isClaiming || (currentUser.points || 0) <= 0}
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
                >
                    {isClaiming ? 'Processing Transaction...' : 'Claim Rewards Now'}
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default SolanaWalletPanel;
