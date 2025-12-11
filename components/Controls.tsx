import React from 'react';
import { WaveformType } from '../types';

interface ControlsProps {
  waveform: WaveformType;
  onWaveformChange: (type: WaveformType) => void;
  delayMix: number;
  onDelayMixChange: (mix: number) => void;
  isAnalogMode: boolean;
  onAnalogModeChange: (enabled: boolean) => void;
}

export const Controls = React.memo<ControlsProps>(({
  waveform,
  onWaveformChange,
  delayMix,
  onDelayMixChange,
  isAnalogMode,
  onAnalogModeChange
}) => {

  const waves: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];

  return (
    <div className="flex flex-col md:flex-row gap-6 bg-slate-900/80 p-6 rounded-xl border border-cyan-800 shadow-[0_0_15px_rgba(0,255,255,0.1)] backdrop-blur-md w-full max-w-2xl z-20">

      {/* Waveform Selector */}
      <div className="flex-1">
        <label className="block text-cyan-400 text-xs font-mono uppercase mb-3 tracking-widest">
          Oscillator Waveform
        </label>
        <div className="grid grid-cols-4 gap-2">
          {waves.map((w) => (
            <button
              key={w}
              onClick={() => onWaveformChange(w)}
              className={`
                h-10 rounded border border-cyan-700 text-xs font-bold uppercase tracking-wider transition-all
                ${waveform === w
                  ? 'bg-cyan-500 text-black shadow-[0_0_10px_#0ff]'
                  : 'bg-transparent text-cyan-600 hover:bg-cyan-900/50 hover:text-cyan-300'
                }
              `}
            >
              {w.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Delay/Reverb Control */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-3">
          <label className="text-cyan-400 text-xs font-mono uppercase tracking-widest">
            Delay Feedback (Spooky Factor)
          </label>
          <span className="text-cyan-200 text-xs font-mono">{(delayMix * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="0.8"
          step="0.01"
          value={delayMix}
          onChange={(e) => onDelayMixChange(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer border border-cyan-900 accent-cyan-400"
        />
        <div className="flex justify-between text-[10px] text-cyan-700 font-mono mt-1 mb-4">
          <span>DRY</span>
          <span>WET</span>
        </div>

        {/* Analog Mode Toggle */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isAnalogMode}
              onChange={(e) => onAnalogModeChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
          </label>
          <span className={`text-xs font-bold tracking-widest ${isAnalogMode ? 'text-cyan-400 glow-text' : 'text-slate-500'}`}>
            ANALOG MODE {isAnalogMode ? '[ON]' : '[OFF]'}
          </span>
        </div>
      </div>

    </div>
  );
});

Controls.displayName = 'Controls';