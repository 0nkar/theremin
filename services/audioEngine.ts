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

    // Delay Network
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.value = 0.4; // 400ms delay

    this.feedbackGain = this.ctx.createGain();
    this.feedbackGain.gain.value = 0.4; // Feedback amount

    this.delayWetGain = this.ctx.createGain();
    this.delayDryGain = this.ctx.createGain();
    
    this.updateDelayMix(this.currentDelayMix);

    // Routing: 
    // Source -> Split -> DryGain -> Master
    //          -> Delay -> Feedback -> Delay
    //          -> Delay -> WetGain -> Master
    
    // Since source is created on start, we just set up the delay loop here
    this.delayNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);
    this.delayNode.connect(this.delayWetGain);
    
    this.delayWetGain.connect(this.masterGain);
    this.delayDryGain.connect(this.masterGain);
  }

  public start() {
    if (!this.ctx || this.isPlaying) return;

    this.osc = this.ctx.createOscillator();
    this.osc.type = this.currentType;
    this.osc.frequency.value = 440; // Default A4

    // Connect Osc to Delay Network inputs
    this.osc.connect(this.delayNode!); // To Delay
    this.osc.connect(this.delayDryGain!); // To Dry

    this.osc.start();
    this.isPlaying = true;
    
    // Resume context if suspended (browser policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
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
      // Smooth transition
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
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