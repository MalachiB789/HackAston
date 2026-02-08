# Gym Buddy

Gym Buddy is an AI-powered workout partner that helps users train with better form, stay consistent, and feel part of a stronger gym community through points, leaderboards, and friendly competition.

## Features

- Live coaching with real-time cueing during workouts
- AI form analysis from captured workout frames
- AI-generated workout split suggestions based on user history and goals
- Routine builder and active workout session logging
- Gamification via points, rankings, and global leaderboard
- Solana Devnet rewards flow with Phantom wallet integration
- Voice feedback for coaching and summaries with ElevenLabs plus fallback audio handling

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- AI: Google Gemini (`@google/genai`)
- Voice: ElevenLabs streaming TTS
- Vision: MediaPipe Tasks Vision (pose landmarker)
- Auth: Auth0
- Web3: Solana Web3.js, Phantom wallet
- Storage: Browser `localStorage` (hackathon prototype persistence)

## How It Works

1. User signs in and manages workout routines.
2. During a workout, live coaching captures frame data and gives feedback cues.
3. Gemini analyzes sampled frames and returns structured form feedback.
4. Users log sets and complete sessions to earn points.
5. Leaderboards create social motivation and competition.
6. Users can connect Phantom and claim rewards on Solana Devnet.

## Project Structure

- `App.tsx`: Main app state, routing between views, workout and leaderboard logic
- `components/`: UI modules (coaching HUD, workout session, suggestion modal, wallet panel)
- `services/geminiService.ts`: Form analysis and workout suggestion prompts/schemas
- `services/elevenLabsService.ts`: TTS streaming and provider-specific error handling
- `services/solanaService.ts`: Wallet connection, balance checks, and reward transfers
- `types.ts`: Shared app types

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Phantom wallet extension (for Solana reward testing)

### Installation

```bash
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```bash
GEMINI_API_KEY=your_gemini_api_key
VITE_ELEVEN_LABS_API_KEY=your_elevenlabs_api_key
VITE_ELEVEN_LABS_VOICE_ID=optional_voice_id
VITE_TREASURY_PRIVATE_KEY=optional_json_array_private_key
```

Notes:

- `GEMINI_API_KEY` is required for Gemini features.
- `VITE_ELEVEN_LABS_API_KEY` is required for ElevenLabs voice.
- If ElevenLabs fails, the app falls back to Gemini-native audio for coaching cues.
- If `VITE_TREASURY_PRIVATE_KEY` is not set, the current implementation falls back to a demo key in `services/solanaService.ts` for hackathon use.

### Run Locally

```bash
npm run dev
```

App runs at `http://localhost:3000`.

### Build

```bash
npm run build
npm run preview
```

## Auth0 Configuration

Auth0 `domain` and `clientId` are currently set directly in `index.tsx`. Replace them with your own tenant/app values before deploying your own version.

## Known Limitations

- Data is stored in browser `localStorage`, so it is device/browser scoped.
- Solana reward flow is configured for Devnet and demo/hackathon behavior.
- Real-time coaching and analysis quality depends on camera quality, lighting, and network/API availability.

## Roadmap

- Move persistence to a backend database
- Add richer social features (teams, challenges, comments)
- Improve movement analysis accuracy and exercise-specific feedback depth
- Expand reward and progression systems beyond hackathon scope
