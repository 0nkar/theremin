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
  private currentDelayMix: number = 0.3;
  private currentVibratoDepth: number = 0;
  private currentVibratoRate: number = 5;

  private driveNode: WaveShaperNode | null = null;
  private isAnalogMode: boolean = false;

  // Vibrato LFO
  private vibratoLFO: OscillatorNode | null = null;
  private vibratoGain: GainNode | null = null;

  constructor() {
    // Deferred init until user gesture
  }

  public async init() {
    if (this.ctx) return;

    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Master Gain (Final Output Volume)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;

    // Analyser (Visualizer)
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    // Saturation / Drive Node (Analog Warmth)
    this.driveNode = this.ctx.createWaveShaper();
    this.driveNode.curve = this.makeDistortionCurve(50);
    this.driveNode.oversample = '4x';

    // Delay Network
    this.delayNode = this.ctx.createDelay(2.0);
    this.delayNode.delayTime.value = 0.4;

    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.4;

    this.delayWetGain = this.ctx.createGain();
    this.delayDryGain = this.ctx.createGain();

    this.updateDelayMix(this.currentDelayMix);

    // Routing: Osc -> Drive (optional) -> Split -> Dry/Delay -> Master
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);

    this.delayWetGain.connect(this.masterGain);
    this.delayDryGain.connect(this.masterGain);

    // Vibrato LFO setup
    this.vibratoLFO = this.ctx.createOscillator();
    this.vibratoLFO.type = 'sine';
    this.vibratoLFO.frequency.value = this.currentVibratoRate;

    this.vibratoGain = this.ctx.createGain();
    this.vibratoGain.gain.value = this.currentVibratoDepth;

    this.vibratoLFO.connect(this.vibratoGain);
    this.vibratoLFO.start();
  }

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
    this.osc.frequency.value = 440;

    // Connect vibrato LFO to oscillator frequency
    if (this.vibratoGain) {
      this.vibratoGain.connect(this.osc.frequency);
    }

    this.connectOscillator();

    this.osc.start();
    this.isPlaying = true;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private connectOscillator() {
    if (!this.osc || !this.ctx) return;

    this.osc.disconnect();

    if (this.isAnalogMode && this.driveNode) {
      this.osc.connect(this.driveNode);
      this.driveNode.disconnect();
      this.driveNode.connect(this.delayNode!);
      this.driveNode.connect(this.delayDryGain!);
    } else {
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
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.1);
    }
  }

  public setFrequency(freq: number) {
    if (this.osc && this.ctx) {
      this.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }
  }

  public setVolume(volume: number) {
    if (this.masterGain && this.ctx) {
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

  public setVibratoDepth(depth: number) {
    // depth: 0 to 1, mapped to 0–50 Hz cents deviation
    this.currentVibratoDepth = depth;
    if (this.vibratoGain && this.ctx) {
      const amount = depth * 50; // max 50 Hz of pitch wobble
      this.vibratoGain.gain.setTargetAtTime(amount, this.ctx.currentTime, 0.08);
    }
  }

  public setVibratoRate(rate: number) {
    // rate: 0.5 to 12 Hz
    this.currentVibratoRate = rate;
    if (this.vibratoLFO && this.ctx) {
      this.vibratoLFO.frequency.setTargetAtTime(rate, this.ctx.currentTime, 0.05);
    }
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public isInitialized(): boolean {
    return this.ctx !== null;
  }
}

export const audioEngine = new AudioEngine();