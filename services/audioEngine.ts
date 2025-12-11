import { WaveformType } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private masterGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
  private delayDryGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;

  private isPlaying: boolean = false;

  // Parameters
  private currentType: WaveformType = 'sine';
  private currentDelayMix: number = 0.3; // 0 to 1

  private driveNode: WaveShaperNode | null = null;
  private isAnalogMode: boolean = false;

  constructor() {
    // Initial setup is deferred until user interaction
  }

  public async init() {
    if (this.ctx) return;

    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Master Gain (Final Output Volume)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0; // Start silent

    // Analyser (Visualizer)
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Saturation / Drive Node (Analog Warmth)
    this.driveNode = this.ctx.createWaveShaper();
    this.driveNode.curve = this.makeDistortionCurve(50); // Warning: Heavy processing if re-calc
    this.driveNode.oversample = '4x';

    // Delay Network
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.4; // 400ms delay

    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.4; // Feedback amount

    this.delayWetGain = this.ctx.createGain();
    this.delayDryGain = this.ctx.createGain();

    this.updateDelayMix(this.currentDelayMix);

    // Routing: 
    // Osc -> Drive (optional) -> Split -> Dry/Delay -> Master

    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);

    this.delayWetGain.connect(this.masterGain);
    this.delayDryGain.connect(this.masterGain);
  }

  // Soft clipping curve for tube-like saturation
  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public start() {
    if (!this.ctx || this.isPlaying) return;

    this.osc = this.ctx.createOscillator();
    this.osc.type = this.currentType;
    this.osc.frequency.value = 440; // Default A4

    // Connect Osc to Saturation or directly to Mix
    this.connectOscillator();

    this.osc.start();
    this.isPlaying = true;

    // Resume context if suspended (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private connectOscillator() {
    if (!this.osc || !this.ctx) return;

    this.osc.disconnect();

    if (this.isAnalogMode && this.driveNode) {
      // Analog Mode: Osc -> Drive -> Split
      this.osc.connect(this.driveNode);
      this.driveNode.disconnect(); // Reset connections
      this.driveNode.connect(this.delayNode!);
      this.driveNode.connect(this.delayDryGain!);
    } else {
      // Digital Mode: Osc -> Split
      this.osc.connect(this.delayNode!);
      this.osc.connect(this.delayDryGain!);
    }
  }

  public setAnalogMode(enabled: boolean) {
    this.isAnalogMode = enabled;
    if (this.isPlaying) {
      this.connectOscillator();
    }
  }

  public stop() {
    if (this.osc) {
      this.osc.stop();
      this.osc.disconnect();
      this.osc = null;
    }
    this.isPlaying = false;

    // Mute output
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.1);
    }
  }

  public setFrequency(freq: number) {
    if (this.osc && this.ctx) {
      // Smooth transition
      this.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }
  }

  public setVolume(volume: number) {
    if (this.masterGain && this.ctx) {
      // Logarithmic Volume Curve: Vol^2
      // This makes the transition from silence much smoother
      const logVol = volume * volume;

      this.masterGain.gain.setTargetAtTime(logVol, this.ctx.currentTime, 0.05);
    }
  }

  public setWaveform(type: WaveformType) {
    this.currentType = type;
    if (this.osc) {
      this.osc.type = type;
    }
  }

  public setDelayMix(mix: number) {
    this.currentDelayMix = mix;
    this.updateDelayMix(mix);
  }

  private updateDelayMix(mix: number) {
    if (this.ctx && this.delayDryGain && this.delayWetGain) {
      const now = this.ctx.currentTime;
      this.delayDryGain.gain.setTargetAtTime(1 - mix, now, 0.1);
      this.delayWetGain.gain.setTargetAtTime(mix, now, 0.1);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }
}

export const audioEngine = new AudioEngine();