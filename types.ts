export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface MultiHandLandmarks extends Array<HandLandmark> {}

export interface Results {
  multiHandLandmarks: MultiHandLandmarks[];
  multiHandedness: { label: string; score: number; index: number }[];
  image: HTMLVideoElement | HTMLCanvasElement | OffscreenCanvas;
}

export interface Hands {
  setOptions(options: {
    maxNumHands?: number;
    modelComplexity?: number;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }): void;
  onResults(listener: (results: Results) => void): void;
  send(input: { image: HTMLVideoElement | HTMLCanvasElement }): Promise<void>;
  close(): Promise<void>;
}

export interface Camera {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';

// Extend window to include MediaPipe globals
declare global {
  interface Window {
    Hands: new (config: { locateFile: (file: string) => string }) => Hands;
    Camera: new (
      element: HTMLVideoElement,
      config: {
        onFrame: () => Promise<void>;
        width?: number;
        height?: number;
      }
    ) => Camera;
    drawConnectors: (
      ctx: CanvasRenderingContext2D,
      landmarks: HandLandmark[],
      connections: any[],
      options?: any
    ) => void;
    drawLandmarks: (
      ctx: CanvasRenderingContext2D,
      landmarks: HandLandmark[],
      options?: any
    ) => void;
    HAND_CONNECTIONS: any[];
  }
}