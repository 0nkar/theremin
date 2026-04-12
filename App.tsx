import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from './services/audioEngine';
import { Visualizer } from './components/Visualizer';
import { Controls } from './components/Controls';
import { HUD, HUDRef } from './components/HUD';
import { WaveformType, Results, HandLandmark } from './types';
import './index.css';

// Lerp helper for smoothing
const lerp = (start: number, end: number, amt: number) => (1 - amt) * start + amt * end;

// Geometry helpers
const getDistance = (p1: HandLandmark, p2: HandLandmark) =>
  Math.hypot(p1.x - p2.x, p1.y - p2.y);

/* ── Particle system canvas ── */
function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    let id: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,255,255,${p.opacity})`;
        ctx.fill();
      }
      id = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(id);
    };
  }, []);

  return <canvas id="particle-canvas" ref={canvasRef} />;
}

/* ══════════════════════════════════════════ */
const App: React.FC = () => {
  const [isStarted, setIsStarted]   = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Audio State
  const [waveform, setWaveform]           = useState<WaveformType>('sine');
  const [delayMix, setDelayMix]           = useState(0.3);
  const [isAnalogMode, setIsAnalogMode]   = useState(false);
  const [vibratoDepth, setVibratoDepth]   = useState(0);
  const [vibratoRate,  setVibratoRate]    = useState(5);

  // Gesture feedback
  const [gestureFeedback, setGestureFeedback] = useState<string | null>(null);

  // Refs
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef    = useRef<HUDRef>(null);

  const targetPitch     = useRef(440);
  const currentPitch    = useRef(440);
  const targetVol       = useRef(0);
  const currentVol      = useRef(0);
  const animationFrameRef = useRef<number>(0);
  const handsRef        = useRef<any>(null);
  const cameraRef       = useRef<any>(null);
  const lastGestureTime = useRef<number>(0);

  const gestureCooldown = 1000;
  const MIN_FREQ = 100;
  const MAX_FREQ = 1500;
  const WAVES: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];

  // Refs mirror for use inside onResults (stale closure avoidance)
  const waveformRef    = useRef(waveform);
  const delayMixRef    = useRef(delayMix);
  useEffect(() => { waveformRef.current = waveform; },  [waveform]);
  useEffect(() => { delayMixRef.current = delayMix; },  [delayMix]);

  // ── Handlers (memoized) ──
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

  const handleVibratoDepthChange = useCallback((depth: number) => {
    setVibratoDepth(depth);
    audioEngine.setVibratoDepth(depth);
  }, []);

  const handleVibratoRateChange = useCallback((rate: number) => {
    setVibratoRate(rate);
    audioEngine.setVibratoRate(rate);
  }, []);

  // ── Haptics ──
  const triggerHaptic = (duration: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  };

  // ── Gesture feedback ──
  const showGestureFeedback = (text: string) => {
    setGestureFeedback(text);
    setTimeout(() => setGestureFeedback(null), 1400);
  };

  // ── Gesture detection ──
  const handleGestureDetection = (landmarks: HandLandmark[], label: string) => {
    const now = Date.now();
    if (now - lastGestureTime.current < gestureCooldown) return;

    if (label === 'Right') {
      // PINCH → cycle waveform
      const pinchDist = getDistance(landmarks[4], landmarks[8]);
      if (pinchDist < 0.05) {
        const next = WAVES[(WAVES.indexOf(waveformRef.current) + 1) % WAVES.length];
        handleWaveformChange(next);
        triggerHaptic(50);
        showGestureFeedback(`WAVEFORM: ${next.toUpperCase()}`);
        lastGestureTime.current = now;
      }
    }

    if (label === 'Left') {
      // FIST → toggle delay
      const wrist = landmarks[0];
      const tips  = [8, 12, 16, 20];
      let curled  = 0;
      for (const t of tips) {
        if (getDistance(landmarks[t], wrist) < 0.15) curled++;
      }
      if (curled >= 3) {
        const newMix = delayMixRef.current > 0.1 ? 0 : 0.5;
        handleDelayChange(newMix);
        triggerHaptic(50);
        showGestureFeedback(`DELAY: ${newMix > 0 ? 'ON' : 'OFF'}`);
        lastGestureTime.current = now;
      }
    }
  };

  // ── Audio smoothing loop ──
  const updateAudio = useCallback(() => {
    currentPitch.current = lerp(currentPitch.current, targetPitch.current, 0.15);
    currentVol.current   = lerp(currentVol.current,   targetVol.current,   0.15);

    audioEngine.setFrequency(currentPitch.current);
    audioEngine.setVolume(currentVol.current);

    if (hudRef.current) {
      hudRef.current.updateValues(currentPitch.current, currentVol.current);
    }

    animationFrameRef.current = requestAnimationFrame(updateAudio);
  }, []);

  // ── MediaPipe onResults ──
  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const ctx    = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // Subtle grid overlay
    ctx.strokeStyle = 'rgba(0,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
    ctx.setLineDash([]);

    let rHandFound = false;
    let lHandFound = false;

    if (results.multiHandLandmarks?.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks  = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i];
        const label      = handedness.label;
        const indexTip   = landmarks[8];

        window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
          color: label === 'Right' ? '#00ffff' : '#00ff88',
          lineWidth: 2,
        });
        window.drawLandmarks(ctx, landmarks, {
          color: '#fff',
          lineWidth: 1,
          radius: 3,
        });

        handleGestureDetection(landmarks, label);

        if (label === 'Right') {
          rHandFound = true;
          const pitchVal = MIN_FREQ + (1 - indexTip.x) * (MAX_FREQ - MIN_FREQ);
          targetPitch.current = Math.max(MIN_FREQ, Math.min(MAX_FREQ, pitchVal));

          // Pitch marker ring
          ctx.beginPath();
          ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 18, 0, 2 * Math.PI);
          ctx.strokeStyle = '#00ffff';
          ctx.lineWidth = 2;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#00ffff';
          ctx.stroke();
          ctx.shadowBlur = 0;

        } else {
          lHandFound = true;
          const volVal = 1 - indexTip.y;
          targetVol.current = Math.max(0, Math.min(1, volVal));

          // Volume marker ring (scales with vol)
          const radius = 14 + volVal * 22;
          ctx.beginPath();
          ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, radius, 0, 2 * Math.PI);
          ctx.strokeStyle = `rgba(0,255,136,${0.5 + volVal * 0.5})`;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#00ff88';
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }

    if (!lHandFound) targetVol.current = 0;

    if (hudRef.current) {
      hudRef.current.setRightHandActive(rHandFound);
      hudRef.current.setLeftHandActive(lHandFound);
    }

    ctx.restore();
  }, []);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!isStarted) return;
      if (e.key === '1') handleWaveformChange('sine');
      if (e.key === '2') handleWaveformChange('triangle');
      if (e.key === '3') handleWaveformChange('sawtooth');
      if (e.key === '4') handleWaveformChange('square');
      if (e.key === 'a' || e.key === 'A') handleAnalogModeChange(!isAnalogMode);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isStarted, isAnalogMode, handleWaveformChange, handleAnalogModeChange]);

  // ── Initialize ──
  const initializeTheremin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await audioEngine.init();
      audioEngine.start();

      cancelAnimationFrame(animationFrameRef.current);
      updateAudio();

      if (videoRef.current && canvasRef.current) {
        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.6,
          minTrackingConfidence: 0.5,
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
          height: 720,
        });

        cameraRef.current = camera;
        await camera.start();
      }

      setIsStarted(true);
    } catch (err: any) {
      console.error(err);
      setError('Failed to initialize camera or audio. Please ensure permissions are granted.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ──
  return (
    <>
      <ParticleBackground />

      <div className="app-root">

        {/* ── Header ── */}
        <header className="app-header">
          <div className="header-brand">
            <h1 className="glow-text">
              THEREMIN<span className="exe">.exe</span>
            </h1>
            <p>Touchless Audio Synthesis Interface</p>
          </div>
          <div className="header-status">
            <div style={{ color: isStarted ? 'var(--green)' : '#ff4444', fontSize: '0.65rem' }}>
              <span className={`status-dot ${isStarted ? 'online' : 'offline'}`} />
              {isStarted ? 'SYSTEM ONLINE' : 'STANDBY'}
            </div>
            <div className="header-version">v2.0.0 // ENHANCED</div>
          </div>
        </header>

        {/* ── Main Viewport ── */}
        <main className="app-main">
          <div className="video-container">

            {/* Zone guide lines (shown when started) */}
            {isStarted && (
              <div className="zone-guides">
                <div className="zone-pitch-marker" />
                <div className="zone-vol-marker" />
                <span className="zone-label pitch-low">◀ LOW PITCH</span>
                <span className="zone-label pitch-high">HIGH PITCH ▶</span>
                <span className="zone-label vol-high">▲ LOUD</span>
                <span className="zone-label vol-low">▼ QUIET</span>
              </div>
            )}

            {/* Hidden source video */}
            <video ref={videoRef} className="source-video" playsInline />

            {/* Output canvas (mirrored) */}
            <canvas
              ref={canvasRef}
              className="output-canvas"
              width={1280}
              height={720}
            />

            {/* HUD */}
            <HUD ref={hudRef} />

            {/* Gesture Feedback */}
            {gestureFeedback && (
              <div className="gesture-popup">{gestureFeedback}</div>
            )}

            {/* Start Overlay */}
            {!isStarted && !isLoading && (
              <div className="start-overlay">
                <h2 className="glow-text">EtherWave Theremin</h2>

                <div className="instructions-grid">
                  <div className="instruction-card">
                    <div className="hand-icon">🤚</div>
                    <div className="hand-label">Right Hand</div>
                    <div className="hand-desc">Move ←→ to change pitch</div>
                  </div>
                  <div className="instruction-card left">
                    <div className="hand-icon">🤚</div>
                    <div className="hand-label">Left Hand</div>
                    <div className="hand-desc">Move ↑↓ to control volume</div>
                  </div>
                  <div className="instruction-card">
                    <div className="hand-icon">🤏</div>
                    <div className="hand-label">Pinch (Right)</div>
                    <div className="hand-desc">Cycle waveform</div>
                  </div>
                  <div className="instruction-card left">
                    <div className="hand-icon">✊</div>
                    <div className="hand-label">Fist (Left)</div>
                    <div className="hand-desc">Toggle spooky delay</div>
                  </div>
                </div>

                <button id="btn-initialize" className="btn-init" onClick={initializeTheremin}>
                  Initialize System
                </button>

                {error && <p className="error-msg">{error}</p>}
              </div>
            )}

            {/* Loading Overlay */}
            {isLoading && (
              <div className="loading-overlay">
                <div className="spinner" />
                <p className="loading-text">Calibrating Sensors...</p>
              </div>
            )}
          </div>
        </main>

        {/* ── Footer: Visualizer + Controls ── */}
        <footer className="app-footer">
          <div className="footer-row">
            <Visualizer />
            <Controls
              waveform={waveform}
              onWaveformChange={handleWaveformChange}
              delayMix={delayMix}
              onDelayMixChange={handleDelayChange}
              isAnalogMode={isAnalogMode}
              onAnalogModeChange={handleAnalogModeChange}
              vibratoDepth={vibratoDepth}
              onVibratoDepthChange={handleVibratoDepthChange}
              vibratoRate={vibratoRate}
              onVibratoRateChange={handleVibratoRateChange}
            />
          </div>

          <div className="kb-hints">
            <span className="kb-key"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> Waveform</span>
            <span>·</span>
            <span className="kb-key"><kbd>A</kbd> Analog Mode</span>
            <span>·</span>
            <span>Pinch (Right) = cycle wave · Fist (Left) = toggle delay</span>
          </div>

          <div className="footer-credits">
            Latency: Low &nbsp;·&nbsp; Audio: WebAudio API &nbsp;·&nbsp; Vision: MediaPipe Hands
          </div>
        </footer>

      </div>

      {/* CRT scanlines */}
      <div className="scanlines" style={{ position: 'fixed', inset: 0 }} />
    </>
  );
};

export default App;