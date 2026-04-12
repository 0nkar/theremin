import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../services/audioEngine';

type VisMode = 'wave' | 'bars';

export const Visualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef<VisMode>('wave');
  const [mode, setMode] = useState<VisMode>('wave');
  const animIdRef = useRef<number>(0);

  const toggleMode = () => {
    const next: VisMode = modeRef.current === 'wave' ? 'bars' : 'wave';
    modeRef.current = next;
    setMode(next);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animIdRef.current = requestAnimationFrame(draw);

      // Poll analyser every frame — works even if audio starts after mount
      const analyser = audioEngine.getAnalyser();
      const W = canvas.width;
      const H = canvas.height;

      if (!analyser) {
        // Draw idle flatline
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(0,255,255,0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        return;
      }

      if (modeRef.current === 'wave') {
        drawWaveform(ctx, analyser, W, H);
      } else {
        drawBars(ctx, analyser, W, H);
      }
    };

    draw();

    return () => { cancelAnimationFrame(animIdRef.current); };
  }, []);

  return (
    <div className="visualizer-wrap">
      <canvas
        ref={canvasRef}
        className="vis-canvas"
        width={640}
        height={160}
      />
      <button className="vis-mode-btn" onClick={toggleMode}>
        {mode === 'wave' ? 'FREQ' : 'WAVE'}
      </button>
    </div>
  );
};

/* ── Waveform (oscilloscope) ── */
function drawWaveform(ctx: CanvasRenderingContext2D, analyser: AnalyserNode, W: number, H: number) {
  const bufLen = analyser.frequencyBinCount;
  const data = new Uint8Array(bufLen);
  analyser.getByteTimeDomainData(data);

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(0,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += H / 4) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();

  // Waveform glow layers
  for (let pass = 0; pass < 2; pass++) {
    ctx.lineWidth = pass === 0 ? 4 : 1.5;
    ctx.strokeStyle = pass === 0 ? 'rgba(0,255,255,0.12)' : '#00ffff';
    ctx.shadowBlur = pass === 0 ? 0 : 8;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();

    const sliceW = W / bufLen;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = data[i] / 128.0;
      const y = (v * H) / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceW;
    }
    ctx.lineTo(W, H / 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

/* ── Frequency bars ── */
function drawBars(ctx: CanvasRenderingContext2D, analyser: AnalyserNode, W: number, H: number) {
  const bufLen = analyser.frequencyBinCount;
  const data = new Uint8Array(bufLen);
  analyser.getByteFrequencyData(data);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, W, H);

  const barCount = 80;
  const barW = (W / barCount) - 1;

  for (let i = 0; i < barCount; i++) {
    const idx = Math.floor(i * (bufLen / 2) / barCount);
    const val = data[idx] / 255;
    const barH = val * H;

    const hue = 160 + val * 80; // cyan → green
    ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${0.7 + val * 0.3})`;
    ctx.shadowBlur = val > 0.5 ? 8 : 0;
    ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.8)`;
    ctx.fillRect(i * (barW + 1), H - barH, barW, barH);
  }
  ctx.shadowBlur = 0;
}