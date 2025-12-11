import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from './services/audioEngine';
import { Visualizer } from './components/Visualizer';
import { Controls } from './components/Controls';
import { HUD, HUDRef } from './components/HUD';
import { WaveformType, Results, HandLandmark } from './types';

// Lerp helper for smoothing
const lerp = (start: number, end: number, amt: number) => {
  return (1 - amt) * start + amt * end;
};

// Geometry helpers
const getDistance = (p1: HandLandmark, p2: HandLandmark) => {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
};

const App: React.FC = () => {
  const [isStarted, setIsStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio State
  const [waveform, setWaveform] = useState<WaveformType>('sine');
  const [delayMix, setDelayMix] = useState(0.3);
  const [isAnalogMode, setIsAnalogMode] = useState(false);


  // Handle Controls - Memoized to prevent re-renders of Controls component
  const handleWaveformChange = useCallback((type: WaveformType) => {
    setWaveform(type);
    audioEngine.setWaveform(type);
  }, []);

  const handleDelayChange = useCallback((mix: number) => {
    setDelayMix(mix);
    audioEngine.setDelayMix(mix);
  }, []);

  const handleAnalogModeChange = useCallback((enabled: boolean) => {
    setIsAnalogMode(enabled);
    audioEngine.setAnalogMode(enabled);
  }, []);

  // UI Feedback State
  // Removed high-freq state: activePitch, activeVol, rightHandActive, leftHandActive
  // Replaced with HUD Ref

  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);

  // Refs for logic
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HUDRef>(null);

  const targetPitch = useRef(440);
  const currentPitch = useRef(440);
  const targetVol = useRef(0);
  const currentVol = useRef(0);
  const animationFrameRef = useRef<number>(0);
  const handsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  // Gesture Refs
  const lastGestureTime = useRef<number>(0);
  const gestureCooldown = 1000; // ms

  // Haptics Helper
  const triggerHaptic = (duration: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  };

  // Constants
  const MIN_FREQ = 100;
  const MAX_FREQ = 1500;
  const WAVES: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];

  // Logic functions referenced in onResults need to access current state, 
  // so we use refs or functional updates.
  const waveformRef = useRef(waveform);
  const delayMixRef = useRef(delayMix);

  useEffect(() => { waveformRef.current = waveform; }, [waveform]);
  useEffect(() => { delayMixRef.current = delayMix; }, [delayMix]);

  // Smoothing loop
  const updateAudio = useCallback(() => {
    // Smooth the values
    currentPitch.current = lerp(currentPitch.current, targetPitch.current, 0.15);
    currentVol.current = lerp(currentVol.current, targetVol.current, 0.15);

    // Apply to engine
    audioEngine.setFrequency(currentPitch.current);
    audioEngine.setVolume(currentVol.current);

    // Perform direct DOM/State update on HUD via ref (No App re-render!)
    if (hudRef.current) {
      hudRef.current.updateValues(currentPitch.current, currentVol.current);
    }

    animationFrameRef.current = requestAnimationFrame(updateAudio);
  }, []);

  const handleGestureDetection = (landmarks: HandLandmark[], label: string) => {
    const now = Date.now();
    if (now - lastGestureTime.current < gestureCooldown) return;

    // GESTURE 1: PINCH (Index + Thumb) on RIGHT HAND (Pitch) -> Cycle Waveform
    if (label === 'Right') {
      const pinchDist = getDistance(landmarks[4], landmarks[8]);
      if (pinchDist < 0.05) { // Threshold for pinch
        const currentIndex = WAVES.indexOf(waveformRef.current);
        const nextIndex = (currentIndex + 1) % WAVES.length;
        const nextWave = WAVES[nextIndex];

        handleWaveformChange(nextWave);
        triggerHaptic(50);
        showGestureFeedback(`WAVEFORM: ${nextWave.toUpperCase()}`);
        lastGestureTime.current = now;
      }
    }

    // GESTURE 2: FIST (Closed Hand) on LEFT HAND (Volume) -> Toggle Delay
    if (label === 'Left') {
      // Check if fingers are curled (Tips close to Wrist)
      const wrist = landmarks[0];
      const tips = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky
      let curledCount = 0;
      for (const t of tips) {
        if (getDistance(landmarks[t], wrist) < 0.15) curledCount++;
      }

      if (curledCount >= 3) {
        // Toggle Delay
        const newMix = delayMixRef.current > 0.1 ? 0 : 0.5;
        handleDelayChange(newMix);
        triggerHaptic(50);
        showGestureFeedback(`DELAY: ${newMix > 0 ? 'ON' : 'OFF'}`);
        lastGestureTime.current = now;
      }
    }
  };

  const showGestureFeedback = (text: string) => {
    setGestureFeedback(text);
    setTimeout(() => setGestureFeedback(null), 1500);
  };

  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx) return;

    // Reset canvas
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // Draw sci-fi grid overlay
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    // Horizontal line (Volume median)
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    // Vertical line (Pitch median)
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    let rHandFound = false;
    let lHandFound = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i];

        window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#00ffff', lineWidth: 2 });
        window.drawLandmarks(ctx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 3 });

        const label = handedness.label; // "Left" or "Right"
        const indexTip = landmarks[8];

        // Check Gestures
        handleGestureDetection(landmarks, label);

        if (label === 'Right') {
          // PITCH CONTROL (User's Right Hand)
          rHandFound = true;

          // Map X (0-1) to Frequency
          // Use raw X (0 is left of image, 1 is right of image)
          const pitchVal = MIN_FREQ + (1 - indexTip.x) * (MAX_FREQ - MIN_FREQ);
          targetPitch.current = Math.max(MIN_FREQ, Math.min(MAX_FREQ, pitchVal));

          // Visual Marker for Pitch
          ctx.beginPath();
          ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 15, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0ff';
          ctx.font = '12px monospace';
          ctx.fillText(`FREQ: ${Math.round(targetPitch.current)}Hz`, indexTip.x * canvas.width + 20, indexTip.y * canvas.height);

        } else {
          // VOLUME CONTROL (User's Left Hand)
          lHandFound = true;

          // Map Y (0-1) to Volume
          // 0 (Top) -> Loud (1.0), 1 (Bottom) -> Quiet (0.0)
          const volVal = 1 - indexTip.y;
          targetVol.current = Math.max(0, Math.min(1, volVal));

          // Visual Marker for Volume
          ctx.beginPath();
          ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 15 + (volVal * 20), 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(0, 255, 100, ${0.3 + volVal * 0.5})`;
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0f8';
          ctx.font = '12px monospace';
          ctx.fillText(`VOL: ${Math.round(volVal * 100)}%`, indexTip.x * canvas.width + 20, indexTip.y * canvas.height);
        }
      }
    }

    // Auto-mute if hands are missing
    if (!lHandFound) {
      targetVol.current = 0;
    }

    // Update HUD state for hands presence
    if (hudRef.current) {
      hudRef.current.setRightHandActive(rHandFound);
      hudRef.current.setLeftHandActive(lHandFound);
    }

    // We already trigger haptics in gesture detection, 
    // basic entry haptics can be omitted or moved to HUD logic if needed, 
    // but for now keeping it simple.

    ctx.restore();
  }, []);

  const initializeTheremin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Init Audio
      await audioEngine.init();
      audioEngine.start();

      // Update Audio Loop
      cancelAnimationFrame(animationFrameRef.current);
      updateAudio();

      // 2. Init Camera & MediaPipe
      if (videoRef.current && canvasRef.current) {
        const hands = new window.Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          }
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults(onResults);
        handsRef.current = hands;

        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && handsRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width: 1280,
          height: 720
        });

        cameraRef.current = camera;
        await camera.start();
      }

      setIsStarted(true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to initialize camera or audio. Please ensure permissions are granted.");
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-4 bg-slate-950 overflow-hidden text-cyan-400 font-mono">

      {/* Header */}
      <header className="z-10 w-full max-w-4xl flex justify-between items-end border-b border-cyan-800 pb-2 mb-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tighter glow-text">THEREMIN<span className="text-sm align-top opacity-70">.exe</span></h1>
          <p className="text-xs md:text-sm text-cyan-600 tracking-widest uppercase">Touchless Audio Synthesis Interface</p>
        </div>
        <div className="text-right hidden md:block">
          <div className={`text-xs ${isStarted ? 'text-green-400' : 'text-red-500'}`}>
            SYSTEM STATUS: {isStarted ? 'ONLINE' : 'STANDBY'}
          </div>
          <div className="text-[10px] text-cyan-700">v1.1.0 // OPTIMIZED</div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="relative z-10 w-full max-w-4xl flex-1 flex flex-col items-center justify-center min-h-[300px]">

        {/* Video Container */}
        <div className="relative w-full h-full bg-black rounded-lg border-2 border-cyan-900 shadow-[0_0_20px_rgba(0,255,255,0.1)] overflow-hidden">

          {/* Hidden Source Video */}
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover opacity-0 pointer-events-none"
            playsInline
          />

          {/* Output Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100"
            width={1280}
            height={720}
          />

          {/* HUD Overlay for High Freq Stats */}
          <HUD ref={hudRef} />

          {/* Gesture Feedback Overlay */}
          {gestureFeedback && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
              <div className="bg-black/70 border-2 border-cyan-400 text-cyan-400 px-6 py-4 rounded-xl text-2xl font-bold tracking-widest animate-bounce shadow-[0_0_30px_rgba(0,255,255,0.3)] backdrop-blur-md">
                {gestureFeedback}
              </div>
            </div>
          )}

          {/* Start Overlay */}
          {!isStarted && !isLoading && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
              <button
                onClick={initializeTheremin}
                className="group relative px-8 py-4 bg-transparent border-2 border-cyan-500 text-cyan-500 text-xl font-bold uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all duration-300 neon-border"
              >
                Initialize System
                <div className="absolute inset-0 bg-cyan-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
              {error && <p className="mt-4 text-red-500 bg-black/50 p-2 rounded border border-red-900">{error}</p>}
            </div>
          )}

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
              <div className="w-16 h-16 border-4 border-cyan-900 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
              <p className="text-cyan-400 animate-pulse tracking-widest">CALIBRATING SENSORS...</p>
            </div>
          )}
        </div>

      </main>

      {/* Controls & Visualizer Footer */}
      <footer className="z-10 w-full max-w-4xl mt-4 flex flex-col gap-4">

        <div className="flex flex-col md:flex-row gap-4 w-full items-stretch">
          <Visualizer />
          <Controls
            waveform={waveform}
            onWaveformChange={handleWaveformChange}
            delayMix={delayMix}
            onDelayMixChange={handleDelayChange}
            isAnalogMode={isAnalogMode}
            onAnalogModeChange={handleAnalogModeChange}
          />
        </div>

        <div className="w-full text-center text-[10px] text-cyan-900/50 uppercase">
          Latency: Low • Audio: WebAudio API • Vision: MediaPipe Hands • Gestures: Pinch/Fist
        </div>
      </footer>

    </div>
  );
};

export default App;