import React, { useRef, useState, useCallback } from 'react';
import { Visualizer } from './components/Visualizer';
import { Controls } from './components/Controls';
import { useHandTracking } from './hooks/useHandTracking';
import { useAudioEngine } from './hooks/useAudioEngine';

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const showGestureFeedback = (text: string) => {
    setGestureFeedback(text);
    setTimeout(() => setGestureFeedback(null), 1500);
  };

  const handleGesture = useCallback((gesture: string) => {
    if (gesture === 'cycleWaveform') {
      const nextWave = audio.cycleWaveform();
      showGestureFeedback(`WAVE: ${nextWave.toUpperCase()}`);
    } else if (gesture === 'toggleDelay') {
      const newMix = audio.toggleDelay();
      showGestureFeedback(`DELAY: ${newMix > 0 ? 'ON' : 'OFF'}`);
    }
  }, [audio]);

  const hands = useHandTracking(videoRef, canvasRef, { onGesture: handleGesture });
  const audio = useAudioEngine(hands.targetPitch, hands.targetVol);

  const isStarted = audio.isReady;
  const error = hands.error;

  const initializeTheremin = async () => {
    setIsLoading(true);
    await audio.initialize();
    await hands.initialize();
    setIsLoading(false);
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
          <div className="text-[10px] text-cyan-700">v2.0.0 // HOOK_ARCHITECTURE</div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="relative z-10 w-full max-w-4xl flex-1 flex flex-col items-center justify-center min-h-[300px]">
        
        <div className="relative w-full h-full bg-black rounded-lg border-2 border-cyan-900 shadow-[0_0_20px_rgba(0,255,255,0.1)] overflow-hidden">
          
          <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline />
          
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100" width={1280} height={720} />

          {gestureFeedback && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
               <div className="bg-black/70 border-2 border-cyan-400 text-cyan-400 px-6 py-4 rounded-xl text-2xl font-bold tracking-widest animate-bounce shadow-[0_0_30px_rgba(0,255,255,0.3)] backdrop-blur-md">
                 {gestureFeedback}
               </div>
            </div>
          )}

          {!isStarted && !isLoading && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
              <button onClick={initializeTheremin} className="group relative px-8 py-4 bg-transparent border-2 border-cyan-500 text-cyan-500 text-xl font-bold uppercase tracking-widest hover:bg-cyan-500 hover:text-black transition-all duration-300 neon-border">
                Initialize System
                <div className="absolute inset-0 bg-cyan-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
              {error && <p className="mt-4 text-red-500 bg-black/50 p-2 rounded border border-red-900">{error}</p>}
            </div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
              <div className="w-16 h-16 border-4 border-cyan-900 border-t-cyan-400 rounded-full animate-spin mb-4"></div>
              <p className="text-cyan-400 animate-pulse tracking-widest">CALIBRATING SENSORS...</p>
            </div>
          )}
        </div>
        
        {isStarted && (
          <>
            <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
              <div className={`p-2 rounded border transition-colors duration-300 ${hands.leftHandActive ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-slate-700 bg-black/50 text-slate-500'}`}>
                <div className="text-[10px] uppercase tracking-wider">Left Hand (Vol)</div>
                <div className="text-xl font-bold">{audio.activeVol}%</div>
              </div>
            </div>
            <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none text-right">
              <div className={`p-2 rounded border transition-colors duration-300 ${hands.rightHandActive ? 'border-cyan-500 bg-cyan-900/20 text-cyan-400' : 'border-slate-700 bg-black/50 text-slate-500'}`}>
                <div className="text-[10px] uppercase tracking-wider">Right Hand (Pitch)</div>
                <div className="text-xl font-bold">{audio.activePitch} Hz</div>
              </div>
            </div>
          </>
        )}

      </main>

      {/* Controls & Visualizer Footer */}
      <footer className="z-10 w-full max-w-4xl mt-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 w-full items-stretch">
          <Visualizer isStarted={isStarted} />
          <Controls 
            waveform={audio.waveform}
            onWaveformChange={audio.handleWaveformChange}
            delayMix={audio.delayMix}
            onDelayMixChange={audio.handleDelayChange}
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