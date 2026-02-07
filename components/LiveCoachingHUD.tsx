
import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { decodeBase64, decodeAudioData, createPcmBlob } from '../services/audioUtils';
import { formatElevenLabsErrorForUi, synthesizeSpeech } from '../services/elevenLabsService';
import { FrameData } from '../types';

interface LiveCoachingHUDProps {
  exercise: string;
  onComplete: (frames: FrameData[]) => void;
  onCancel: () => void;
  onTtsError?: (message: string) => void;
}

const DEFAULT_TTS_PROVIDER = 'elevenlabs' as const;
type TtsProvider = typeof DEFAULT_TTS_PROVIDER | 'gemini-native';

const LiveCoachingHUD: React.FC<LiveCoachingHUDProps> = ({ exercise, onComplete, onCancel, onTtsError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [status, setStatus] = useState("Initializing Vision...");
  const [capturedFrames, setCapturedFrames] = useState<FrameData[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const ttsProviderRef = useRef<TtsProvider>(DEFAULT_TTS_PROVIDER);
  const latestCueRef = useRef<string>('');
  const hasMissingKeyNotificationRef = useRef<boolean>(false);
  const isClosedRef = useRef<boolean>(false);

  const drawOctopusFaceOverlay = (
    ctx: CanvasRenderingContext2D,
    landmarks: Array<{ x: number; y: number }>
  ) => {
    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    if (!nose || !leftEar || !rightEar) return;

    const earDistance = Math.hypot((leftEar.x - rightEar.x) * ctx.canvas.width, (leftEar.y - rightEar.y) * ctx.canvas.height);
    const size = Math.max(64, Math.min(190, earDistance * 2.1));
    const centerX = nose.x * ctx.canvas.width;
    const centerY = nose.y * ctx.canvas.height - size * 0.15;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(size)}px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
    ctx.fillText("🐙", centerX, centerY);
    ctx.restore();
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frameInterval: number | null = null;
    let animationFrameId: number | null = null;
    let inputAudioContext: AudioContext | null = null;
    isClosedRef.current = false;

    const stopAudioAndSession = async () => {
      isClosedRef.current = true;
      if (sessionRef.current) sessionRef.current.close();
      sourcesRef.current.forEach(s => s.stop());
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
      latestCueRef.current = '';
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close().catch(() => undefined);
      }
      if (inputAudioContext && inputAudioContext.state !== 'closed') {
        await inputAudioContext.close().catch(() => undefined);
      }
    };

    const queueAudioBuffer = (buffer: AudioBuffer) => {
      const ctx = audioContextRef.current;
      if (!ctx || isClosedRef.current) return;

      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += buffer.duration;
      sourcesRef.current.add(source);
      source.onended = () => sourcesRef.current.delete(source);
    };

    const playGeminiAudioChunk = async (audioBase64?: string | null) => {
      if (!audioBase64 || !audioContextRef.current || isClosedRef.current) return false;
      try {
        const ctx = audioContextRef.current;
        const buffer = await decodeAudioData(decodeBase64(audioBase64), ctx, 24000, 1);
        queueAudioBuffer(buffer);
        return true;
      } catch (error) {
        console.error('Failed to play Gemini native audio chunk:', error);
        return false;
      }
    };

    const decodeElevenLabsBuffer = async (audioBytes: ArrayBuffer) => {
      const ctx = audioContextRef.current;
      if (!ctx || isClosedRef.current) return null;

      try {
        return await ctx.decodeAudioData(audioBytes.slice(0));
      } catch (error) {
        throw new Error(
          `Unable to decode ElevenLabs audio response: ${error instanceof Error ? error.message : 'Unknown decode error'}`
        );
      }
    };

    const getCueTextFromMessage = (msg: LiveServerMessage) => {
      // Read only what is shown on-screen in the "Live Cue" panel.
      return msg.serverContent?.outputTranscription?.text?.trim() || '';
    };

    const notifyTtsError = (message: string) => {
      if (onTtsError) onTtsError(message);
      console.error(message);
    };

    const speakWithDefaultProvider = async (cueText: string, fallbackAudioBase64?: string | null) => {
      const provider = ttsProviderRef.current;

      if (provider === 'gemini-native') {
        await playGeminiAudioChunk(fallbackAudioBase64);
        return;
      }

      try {
        const audioStream = await synthesizeSpeech(cueText);
        if (isClosedRef.current) return;

        const chunks: Uint8Array[] = [];
        for await (const chunk of audioStream) {
            if (isClosedRef.current) return;
            chunks.push(chunk);
        }

        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const audioBytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            audioBytes.set(chunk, offset);
            offset += chunk.length;
        }

        const decoded = await decodeElevenLabsBuffer(audioBytes.buffer);
        if (isClosedRef.current) return;
        if (!decoded) throw new Error('Audio context is not available.');
        queueAudioBuffer(decoded);
      } catch (error) {
        const formattedError = formatElevenLabsErrorForUi(error);
        const isMissingKeyError = typeof error === 'object' && !!error && (error as any).code === 'missing_api_key';
        if (!isMissingKeyError || !hasMissingKeyNotificationRef.current) {
          notifyTtsError(formattedError);
          if (isMissingKeyError) hasMissingKeyNotificationRef.current = true;
        }

        const fallbackPlayed = await playGeminiAudioChunk(fallbackAudioBase64);
        if (!fallbackPlayed) {
          setStatus('Audio fallback unavailable; continuing coaching...');
        }
      }
    };

    const initVision = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        startSession();
      } catch (err) {
        console.error("Vision Init Error:", err);
        setStatus("Vision Engine Failed");
      }
    };

    const startSession = async () => {
      try {
        setStatus("Connecting to AI Coach...");
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const waitForVideoReady = async (video: HTMLVideoElement) => {
          if (video.readyState >= 2) {
            await video.play().catch(() => undefined);
            return;
          }
          await new Promise<void>((resolve) => {
            const onLoaded = () => {
              video.removeEventListener('loadedmetadata', onLoaded);
              resolve();
            };
            video.addEventListener('loadedmetadata', onLoaded, { once: true });
          });
          await video.play().catch(() => undefined);
        };
        
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: 640, height: 480 },
          audio: true 
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await waitForVideoReady(videoRef.current);
        }

        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume().catch(() => undefined);
        }
        if (inputAudioContext.state === 'suspended') {
          await inputAudioContext.resume().catch(() => undefined);
        }

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              setIsLive(true);
              setStatus("Watching Form...");
              
              const source = inputAudioContext.createMediaStreamSource(stream!);
              const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
              scriptProcessor.onaudioprocess = (e) => {
                if (!sessionRef.current || isClosedRef.current) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = createPcmBlob(inputData);
                sessionRef.current.sendRealtimeInput({ media: { data: pcmData, mimeType: 'audio/pcm;rate=16000' } });
              };
              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioContext.destination);

              frameInterval = window.setInterval(() => {
                if (videoRef.current && canvasRef.current) {
                  const ctx = canvasRef.current.getContext('2d');
                  if (ctx) {
                    canvasRef.current.width = 320;
                    canvasRef.current.height = 240;
                    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
                    const base64 = dataUrl.split(',')[1];
                    
                    setCapturedFrames(prev => {
                      const newFrames = [...prev, { dataUrl, timestamp: Date.now() }];
                      if (newFrames.length > 15) return newFrames.slice(newFrames.length - 15);
                      return newFrames;
                    });

                    if (sessionRef.current && !isClosedRef.current) {
                      sessionRef.current.sendRealtimeInput({ media: { data: base64, mimeType: 'image/jpeg' } });
                    }
                  }
                }
              }, 1200);

              startTrackingLoop();
            },
            onmessage: async (msg: LiveServerMessage) => {
              if (msg.serverContent?.outputTranscription) {
                setTranscription(prev => (prev + " " + msg.serverContent?.outputTranscription?.text).slice(-150));
              }

              const audioBase64 =
                msg.serverContent?.modelTurn?.parts?.find((part: any) => !!part?.inlineData?.data)?.inlineData?.data;
              const cueText = getCueTextFromMessage(msg);

              if (cueText && cueText !== latestCueRef.current) {
                latestCueRef.current = cueText;
                await speakWithDefaultProvider(cueText, audioBase64);
              } else if (audioBase64 && ttsProviderRef.current === 'gemini-native') {
                await playGeminiAudioChunk(audioBase64);
              }

              if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                latestCueRef.current = '';
              }
            },
            onerror: (e) => console.error("Live Error:", e),
            onclose: () => setIsLive(false)
          },
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: `You are a high-energy gym coach. Watch the user perform ${exercise} live. 
            Provide IMMEDIATE, SHORT verbal cues. Focus on back position, depth, and safety. 
            If it's a custom exercise you're not fully familiar with, offer general ergonomic and posture cues (straight back, controlled tempo).`,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
            outputAudioTranscription: {}
          }
        });

        sessionPromise.then(s => {
          sessionRef.current = s;
        });
        await sessionPromise;
      } catch (err) {
        console.error(err);
        setStatus("Error: Check permissions");
      }
    };

    const startTrackingLoop = () => {
      const render = () => {
        if (videoRef.current && overlayCanvasRef.current && poseLandmarkerRef.current) {
          const video = videoRef.current;
          const canvas = overlayCanvasRef.current;
          const ctx = canvas.getContext('2d');
          
          if (ctx && video.readyState >= 2) {
            canvas.width = video.clientWidth;
            canvas.height = video.clientHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let result: any;
            try {
              result = poseLandmarkerRef.current.detectForVideo(video, performance.now());
            } catch (error) {
              animationFrameId = requestAnimationFrame(render);
              return;
            }
            
            if (result.landmarks && result.landmarks.length > 0) {
              const landmarks = result.landmarks[0];

              drawOctopusFaceOverlay(ctx, landmarks);
              
              let minX = 1, minY = 1, maxX = 0, maxY = 0;
              landmarks.forEach(lm => {
                minX = Math.min(minX, lm.x);
                minY = Math.min(minY, lm.y);
                maxX = Math.max(maxX, lm.x);
                maxY = Math.max(maxY, lm.y);
              });

              const padding = 0.08;
              minX = Math.max(0, minX - padding);
              minY = Math.max(0, minY - padding);
              maxX = Math.min(1, maxX + padding);
              maxY = Math.min(1, maxY + padding);

              const left = minX * canvas.width;
              const top = minY * canvas.height;
              const width = (maxX - minX) * canvas.width;
              const height = (maxY - minY) * canvas.height;

              ctx.strokeStyle = '#6366f1'; 
              ctx.lineWidth = 3;
              const bLen = Math.min(width, height) * 0.2;
              
              // Draw Corners
              ctx.beginPath();
              ctx.moveTo(left, top + bLen); ctx.lineTo(left, top); ctx.lineTo(left + bLen, top);
              ctx.stroke();
              
              ctx.beginPath();
              ctx.moveTo(left + width - bLen, top); ctx.lineTo(left + width, top); ctx.lineTo(left + width, top + bLen);
              ctx.stroke();
              
              ctx.beginPath();
              ctx.moveTo(left, top + height - bLen); ctx.lineTo(left, top + height); ctx.lineTo(left + bLen, top + height);
              ctx.stroke();
              
              ctx.beginPath();
              ctx.moveTo(left + width - bLen, top + height); ctx.lineTo(left + width, top + height); ctx.lineTo(left + width, top + height - bLen);
              ctx.stroke();

              // Tracking Label Overlay
              ctx.fillStyle = 'rgba(99, 102, 241, 0.9)';
              ctx.fillRect(left, top - 24, 120, 20);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 9px Inter';
              ctx.fillText('TARGET: ' + exercise.toUpperCase(), left + 6, top - 10);
            }
          }
        }
        animationFrameId = requestAnimationFrame(render);
      };
      render();
    };

    initVision();

    return () => {
      if (frameInterval) clearInterval(frameInterval);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (poseLandmarkerRef.current) poseLandmarkerRef.current.close();
      stopAudioAndSession();
    };
  }, [exercise]);

  const handleFinish = () => {
    isClosedRef.current = true;
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    latestCueRef.current = '';
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
    }
    if (sessionRef.current) sessionRef.current.close();
    onComplete(capturedFrames);
  };

  const handleCancel = () => {
    isClosedRef.current = true;
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    latestCueRef.current = '';
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => undefined);
    }
    if (sessionRef.current) sessionRef.current.close();
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="relative flex-1 bg-zinc-950 overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror-mode" />
        <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none mirror-mode" />
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 self-start">
                <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-zinc-500'}`} />
                <span className="text-white text-[10px] font-black tracking-widest uppercase">
                  {isLive ? 'Live Coaching Active' : status}
                </span>
              </div>
            </div>
            
            <button 
              onClick={handleCancel}
              className="pointer-events-auto w-10 h-10 bg-white/10 hover:bg-rose-500/50 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6 flex flex-col items-center">
            {transcription && (
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl max-w-lg w-full animate-in slide-in-from-bottom-2 duration-300">
                <p className="text-indigo-300 text-[10px] font-black uppercase tracking-widest mb-1">Live Cue:</p>
                <p className="text-white text-lg font-medium leading-tight">
                  {transcription}
                </p>
              </div>
            )}
            
            <div className="w-full flex justify-center pointer-events-auto pb-4">
              <button 
                onClick={handleFinish}
                className="group flex flex-col items-center gap-3"
              >
                <div className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center border-4 border-red-900 shadow-2xl transition-all scale-100 active:scale-95 group-hover:scale-105">
                   <div className="w-8 h-8 bg-white rounded-md" />
                </div>
                <span className="text-white text-[10px] font-black uppercase tracking-[0.3em] drop-shadow-lg">Finish Workout Set</span>
              </button>
            </div>

            <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 flex items-center gap-4">
               <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className={`w-1 bg-indigo-500 rounded-full animate-bounce`} style={{ height: `${Math.random() * 15 + 4}px`, animationDelay: `${i * 0.1}s` }} />
                  ))}
               </div>
               <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em]">Kinematic Analysis Active ({capturedFrames.length})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveCoachingHUD;
