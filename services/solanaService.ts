
import { Connection, PublicKey, Transaction, SystemProgram, Keypair, LAMPORTS_PER_SOL, clusterApiUrl } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Access the global window object for Phantom wallet
declare global {
  interface Window {
    solana?: any;
  }
}

// Polyfill Buffer for the browser environment if needed
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

// Devnet endpoint
const NETWORK = clusterApiUrl('devnet');

export const getProvider = () => {
  if ('solana' in window) {
    const provider = window.solana;
    if (provider.isPhantom) {
      return provider;
    }
  }
  // Redirect to Phantom download if not found (or just return null to handle in UI)
  // window.open('https://phantom.app/', '_blank');
  return null;
};

export const connectWallet = async (): Promise<{ publicKey: string } | null> => {
  const provider = getProvider();
  if (provider) {
    try {
      const resp = await provider.connect();
      return { publicKey: resp.publicKey.toString() };
    } catch (err) {
      console.error("User rejected the request", err);
      return null;
    }
  }
  return null;
};

// treasury Keypair from environment variable
// Expects VITE_TREASURY_PRIVATE_KEY to be a JSON array of numbers, e.g. "[123, 45, ...]"
// HARDCODED KEY FOR DEMO PURPOSES ONLY - DO NOT USE IN PRODUCTION
const DEMO_TREASURY_SECRET_KEY = [
    71,243,123,59,118,71,159,70,162,82,92,186,122,131,231,29,
    120,132,220,94,33,19,23,98,215,244,100,0,118,8,26,129,
    242,89,230,45,11,72,64,62,100,225,177,52,210,4,32,115,
    149,7,192,36,47,206,118,177,241,211,90,30,18,169,114,111
];

const getTreasuryKeypair = (): Keypair | null => {
    // Try environment variable first
    const secretKeyString = import.meta.env.VITE_TREASURY_PRIVATE_KEY;
    
    if (secretKeyString) {
        try {
            // Handle both JSON array and likely Base58 strings if we added that support
            // For now, assuming JSON array or simple string
            let secretKey;
            if (secretKeyString.startsWith('[')) {
                secretKey = Uint8Array.from(JSON.parse(secretKeyString));
            } else {
                 // Needs bs58 for base58 string, but for now we stick to JSON/Array format to avoid deps
                 // or just fallback to the hardcoded one if parsing fails
                 console.warn("VITE_TREASURY_PRIVATE_KEY format not recognized (expected JSON array), using demo key.");
                 return Keypair.fromSecretKey(Uint8Array.from(DEMO_TREASURY_SECRET_KEY));
            }
            return Keypair.fromSecretKey(secretKey);
        } catch (e) {
            console.error("Invalid VITE_TREASURY_PRIVATE_KEY format", e);
        }
    }

    // Fallback to demo key
    console.warn("Using DEMO_TREASURY_SECRET_KEY. This is insecure for production.");
    return Keypair.fromSecretKey(Uint8Array.from(DEMO_TREASURY_SECRET_KEY));
}


export const getWalletBalance = async (publicKeyString: string): Promise<number> => {
    try {
        const connection = new Connection(NETWORK, 'confirmed');
        const balance = await connection.getBalance(new PublicKey(publicKeyString));
        return balance / LAMPORTS_PER_SOL;
    } catch (e) {
        console.error("Failed to get balance", e);
        return 0;
    }
};

export const airdropIfEmpty = async (publicKeyString: string): Promise<void> => {
    try {
        const connection = new Connection(NETWORK, 'confirmed');
        const publicKey = new PublicKey(publicKeyString);
        const balance = await connection.getBalance(publicKey);
        
        if (balance < 1 * LAMPORTS_PER_SOL) {
            console.log("Airdropping 1 SOL to", publicKeyString);
            const signature = await connection.requestAirdrop(publicKey, 1 * LAMPORTS_PER_SOL);
            await connection.confirmTransaction(signature);
            console.log("Airdrop confirmed");
        }
    } catch(e) {
        console.error("Airdrop failed", e);
    }
}


// Distribute rewards from Treasury to User
export const distributeRevenue = async (recipientAddress: string, amountSOL: number): Promise<{ success: boolean; signature?: string; error?: string }> => {
    const treasury = getTreasuryKeypair();
    if (!treasury) {
        return { success: false, error: "Treasury not configured" };
    }

    try {
        const connection = new Connection(NETWORK, 'confirmed');
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: treasury.publicKey,
                toPubkey: new PublicKey(recipientAddress),
                lamports: Math.round(amountSOL * LAMPORTS_PER_SOL),
            })
        );

        const signature = await connection.sendTransaction(transaction, [treasury]);
        await connection.confirmTransaction(signature);
        
        return { success: true, signature };
    } catch (err: any) {
        console.error("Transfer failed", err);
        return { success: false, error: err.message };
    }
};

export const POINTS_TO_SOL_RATE = 0.0001; // Example: 1 point = 0.0001 SOL (1000 pts = 0.1 SOL)

export const convertPointsToSol = (points: number): number => {
    return points * POINTS_TO_SOL_RATE;
}
