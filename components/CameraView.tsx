
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { FrameData } from '../types';

interface CameraViewProps {
  onCaptureComplete: (frames: FrameData[]) => void;
  isAnalyzing: boolean;
}

const CameraView: React.FC<CameraViewProps> = ({ onCaptureComplete, isAnalyzing }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [capturedFrames, setCapturedFrames] = useState<FrameData[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_RECORDING_SECONDS = 8;
  const FRAME_INTERVAL = 1000; // Capture a frame every second

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error("Camera access denied", err);
      alert("Please allow camera access to analyze your form.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    setCapturedFrames(prev => [...prev, { dataUrl, timestamp: Date.now() }]);
  }, []);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_SECONDS) {
            stopRecording();
            return prev;
          }
          captureFrame();
          return prev + 1;
        });
      }, FRAME_INTERVAL);
    }
    return () => clearInterval(interval);
  }, [isRecording, captureFrame]);

  const startRecording = () => {
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev === 1) {
          clearInterval(timer);
          setIsRecording(true);
          setRecordingTime(0);
          setCapturedFrames([]);
          return null;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  useEffect(() => {
    if (!isRecording && capturedFrames.length > 0) {
      onCaptureComplete(capturedFrames);
    }
  }, [isRecording, capturedFrames, onCaptureComplete]);

  return (
    <div className="relative w-full aspect-video bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="w-full h-full object-cover mirror-mode"
      />
      
      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlays */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
            <span className="text-white text-xs font-bold tracking-widest uppercase">
              {isRecording ? 'Recording Set' : 'Live Feed'}
            </span>
          </div>
          {isRecording && (
            <div className="bg-red-500/90 text-white px-3 py-1 rounded-lg text-sm font-mono font-bold shadow-lg">
              00:{recordingTime.toString().padStart(2, '0')}
            </div>
          )}
        </div>

        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="text-9xl font-black text-white animate-bounce">{countdown}</div>
          </div>
        )}

        <div className="flex justify-center pointer-events-auto">
          {!isRecording && countdown === null && !isAnalyzing && (
            <button 
              onClick={startRecording}
              className="group flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center border-4 border-indigo-900 transition-all hover:scale-110 active:scale-95 shadow-xl">
                <div className="w-6 h-6 bg-white rounded-sm" />
              </div>
              <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest group-hover:text-white transition-colors">Start Analysis Set</span>
            </button>
          )}

          {isRecording && (
            <button 
              onClick={stopRecording}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center border-4 border-red-900 transition-all animate-pulse shadow-xl">
                <div className="w-8 h-8 bg-white rounded-full" />
              </div>
              <span className="text-red-400 text-xs font-bold uppercase tracking-widest">Finish Set</span>
            </button>
          )}
        </div>
      </div>

      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-center flex-col items-center justify-center z-20">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-white font-bold tracking-widest text-lg uppercase">AI Analyzing Movement...</p>
          <p className="text-zinc-500 text-sm mt-2">Checking kinematics and posture</p>
        </div>
      )}
    </div>
  );
};

export default CameraView;
