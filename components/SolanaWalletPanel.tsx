
import React, { useState, useEffect } from 'react';
import { UserAccount } from '../types';
import { connectWallet, convertPointsToSol, distributeRevenue, getWalletBalance, POINTS_TO_SOL_RATE } from '../services/solanaService';

interface SolanaWalletPanelProps {
  currentUser: UserAccount;
  onUpdateUser: (updatedFields: Partial<UserAccount>) => void;
}

const SolanaWalletPanel: React.FC<SolanaWalletPanelProps> = ({ currentUser, onUpdateUser }) => {
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
      const wallet = await connectWallet();
      if (wallet) {
        onUpdateUser({ solanaWalletAddress: wallet.publicKey });
        setStatusMsg("Wallet connected!");
      } else {
        setStatusMsg("Wallet connection failed or rejected.");
      }
    } catch (e) {
      console.error(e);
      setStatusMsg("Error connecting wallet.");
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
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-zinc-400 text-sm mb-4">Solana Wallet not found.</p>
              <a href="https://phantom.app/" target="_blank" rel="noreferrer" className="text-indigo-400 font-bold hover:underline">Install Phantom Wallet</a>
          </div>
      )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-purple-400 uppercase tracking-[0.3em]">Crypto Rewards</h3>
          <div className="px-2 py-1 bg-purple-500/10 rounded-md border border-purple-500/20">
              <span className="text-[10px] font-bold text-purple-300">DEVNET</span>
          </div>
      </div>

      {!currentUser.solanaWalletAddress ? (
        <div className="text-center py-4">
          <p className="text-zinc-500 text-xs mb-4">Connect your Solana wallet to convert your hard-earned points into SOL (Devnet).</p>
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect Phantom Wallet'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
            <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Connected Wallet</p>
                <p className="text-white font-mono text-xs truncate">{currentUser.solanaWalletAddress}</p>
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
                    className="block text-[10px] text-purple-400 hover:underline truncate"
                >
                    View TX: {txSignature}
                </a>
            )}

            <button
                onClick={handleClaim}
                disabled={isClaiming || (currentUser.points || 0) <= 0}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl uppercase tracking-widest text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
            >
                {isClaiming ? 'Processing Transaction...' : 'Claim Rewards Now'}
            </button>
        </div>
      )}
    </div>
  );
};

export default SolanaWalletPanel;
