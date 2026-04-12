import React from 'react';
import { WaveformType } from '../types';

interface ControlsProps {
  waveform: WaveformType;
  onWaveformChange: (type: WaveformType) => void;
  delayMix: number;
  onDelayMixChange: (mix: number) => void;
  isAnalogMode: boolean;
  onAnalogModeChange: (enabled: boolean) => void;
  vibratoDepth: number;
  onVibratoDepthChange: (depth: number) => void;
  vibratoRate: number;
  onVibratoRateChange: (rate: number) => void;
}

const WAVES: { id: WaveformType; label: string; symbol: string }[] = [
  { id: 'sine',     label: 'Sine',     symbol: '∿' },
  { id: 'triangle', label: 'Tri',      symbol: '△' },
  { id: 'sawtooth', label: 'Saw',      symbol: '⊿' },
  { id: 'square',   label: 'Sqr',      symbol: '⊓' },
];

export const Controls = React.memo<ControlsProps>(({
  waveform,
  onWaveformChange,
  delayMix,
  onDelayMixChange,
  isAnalogMode,
  onAnalogModeChange,
  vibratoDepth,
  onVibratoDepthChange,
  vibratoRate,
  onVibratoRateChange,
}) => {
  return (
    <div className="controls-panel">

      {/* ── Left group: Oscillator ── */}
      <div className="ctrl-group">
        <label className="ctrl-label">Oscillator Waveform</label>
        <div className="wave-grid">
          {WAVES.map(({ id, label, symbol }) => (
            <button
              key={id}
              id={`wave-${id}`}
              onClick={() => onWaveformChange(id)}
              className={`wave-btn${waveform === id ? ' active' : ''}`}
              title={label}
            >
              <span style={{ fontSize: '1rem', display: 'block', lineHeight: 1.1 }}>{symbol}</span>
              <span style={{ fontSize: '0.55rem', opacity: 0.7 }}>{label}</span>
            </button>
          ))}
        </div>

        <div className="ctrl-divider" style={{ marginTop: 8 }} />

        {/* Analog Mode */}
        <div className="toggle-row" style={{ marginTop: 4 }}>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isAnalogMode}
              onChange={(e) => onAnalogModeChange(e.target.checked)}
            />
            <div className="toggle-track" />
          </label>
          <span className={`toggle-label ${isAnalogMode ? 'active' : 'inactive'}`}>
            Analog Warmth {isAnalogMode ? '[ON]' : '[OFF]'}
          </span>
        </div>
      </div>

      {/* ── Right group: FX ── */}
      <div className="ctrl-group">
        {/* Delay */}
        <label className="ctrl-label">Spooky Delay</label>
        <div className="ctrl-range-row">
          <span style={{ fontSize: '0.6rem', color: 'rgba(0,255,255,0.4)' }}>Mix</span>
          <span className="ctrl-range-val">{(delayMix * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          className="sci-range"
          min="0" max="0.8" step="0.01"
          value={delayMix}
          onChange={(e) => onDelayMixChange(parseFloat(e.target.value))}
        />
        <div className="range-ends"><span>DRY</span><span>WET</span></div>

        <div className="ctrl-divider" style={{ margin: '8px 0' }} />

        {/* Vibrato Depth */}
        <label className="ctrl-label">Vibrato</label>
        <div className="ctrl-range-row">
          <span style={{ fontSize: '0.6rem', color: 'rgba(0,255,255,0.4)' }}>Depth</span>
          <span className="ctrl-range-val">{(vibratoDepth * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          className="sci-range"
          min="0" max="1" step="0.01"
          value={vibratoDepth}
          onChange={(e) => onVibratoDepthChange(parseFloat(e.target.value))}
        />

        {/* Vibrato Rate */}
        <div className="ctrl-range-row" style={{ marginTop: 6 }}>
          <span style={{ fontSize: '0.6rem', color: 'rgba(0,255,255,0.4)' }}>Rate</span>
          <span className="ctrl-range-val">{vibratoRate.toFixed(1)} Hz</span>
        </div>
        <input
          type="range"
          className="sci-range"
          min="0.5" max="12" step="0.1"
          value={vibratoRate}
          onChange={(e) => onVibratoRateChange(parseFloat(e.target.value))}
        />
        <div className="range-ends"><span>SLOW</span><span>FAST</span></div>
      </div>

    </div>
  );
});

Controls.displayName = 'Controls';