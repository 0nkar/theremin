import { useState, useRef, useCallback, useEffect } from 'react';
import { Results, HandLandmark } from '../types';
import { getDistance } from '../utils';

// Constants
const MIN_FREQ = 100;
const MAX_FREQ = 1500;
const GESTURE_COOLDOWN = 1000; // ms

interface HandTrackingOptions {
  onGesture: (gesture: string) => void;
}

export const useHandTracking = (videoRef: React.RefObject<HTMLVideoElement>, canvasRef: React.RefObject<HTMLCanvasElement>, { onGesture }: HandTrackingOptions) => {
  const [rightHandActive, setRightHandActive] = useState(false);
  const [leftHandActive, setLeftHandActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetPitch = useRef(MIN_FREQ);
  const targetVol = useRef(0);
  const handsRef = useRef<any>(null);
  const lastGestureTime = useRef<number>(0);

  const triggerHaptic = (duration: number) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(duration);
    }
  };

  const handleGestureDetection = (landmarks: HandLandmark[], label: string) => {
    const now = Date.now();
    if (now - lastGestureTime.current < GESTURE_COOLDOWN) return;

    // Right Hand Gesture: PINCH (Index + Thumb) -> Cycle Waveform
    if (label === 'Right') {
      const pinchDist = getDistance(landmarks[4], landmarks[8]);
      if (pinchDist < 0.05) {
        onGesture('cycleWaveform');
        lastGestureTime.current = now;
      }
    }

    // Left Hand Gesture: FIST (Closed Hand) -> Toggle Delay
    if (label === 'Left') {
      const wrist = landmarks[0];
      const tips = [8, 12, 16, 20];
      let curledCount = 0;
      for (const t of tips) {
        if (getDistance(landmarks[t], wrist) < 0.15) curledCount++;
      }
      if (curledCount >= 3) {
        onGesture('toggleDelay');
        lastGestureTime.current = now;
      }
    }
  };

  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Drawing logic
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // Overlay
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height/2);
    ctx.lineTo(canvas.width, canvas.height/2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, 0);
    ctx.lineTo(canvas.width/2, canvas.height);
    ctx.stroke();

    let rHandFound = false;
    let lHandFound = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i];

        window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, { color: '#00ffff', lineWidth: 2 });
        window.drawLandmarks(ctx, landmarks, { color: '#ffffff', lineWidth: 1, radius: 3 });

        const label = handedness.label;
        const indexTip = landmarks[8];

        handleGestureDetection(landmarks, label);

        if (label === 'Right') {
          rHandFound = true;
          const pitchVal = MIN_FREQ + (1 - indexTip.x) * (MAX_FREQ - MIN_FREQ);
          targetPitch.current = Math.max(MIN_FREQ, Math.min(MAX_FREQ, pitchVal));

          ctx.beginPath();
          ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 15, 0, 2 * Math.PI);
          ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
          ctx.fill();

          ctx.fillStyle = '#0ff';
          ctx.font = '12px monospace';
          ctx.fillText(`FREQ: ${Math.round(targetPitch.current)}Hz`, indexTip.x * canvas.width + 20, indexTip.y * canvas.height);

        } else {
          lHandFound = true;
          const volVal = 1 - indexTip.y;
          targetVol.current = Math.max(0, Math.min(1, volVal));

          ctx.beginPath();
          ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 15 + (volVal * 20), 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(0, 255, 100, ${0.3 + volVal * 0.5})`;
          ctx.fill();

          ctx.fillStyle = '#0f8';
          ctx.font = '12px monospace';
          ctx.fillText(`VOL: ${Math.round(volVal * 100)}%`, indexTip.x * canvas.width + 20, indexTip.y * canvas.height);
        }
      }
    }

    if (!lHandFound) {
      targetVol.current = 0;
    }

    setRightHandActive(prev => {
      if (!prev && rHandFound) triggerHaptic(15);
      return rHandFound;
    });
    setLeftHandActive(prev => {
      if (!prev && lHandFound) triggerHaptic(15);
      return lHandFound;
    });

    ctx.restore();
  }, [canvasRef, onGesture]);

  const initialize = useCallback(async () => {
    try {
      if (videoRef.current) {
        const hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
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
        await camera.start();
      }
    } catch (err) {
      setError("Failed to initialize camera. Please grant permissions.");
      console.error(err);
    }
  }, [videoRef, onResults]);

  useEffect(() => {
    return () => {
      handsRef.current?.close();
    };
  }, []);

  return {
    initialize,
    targetPitch,
    targetVol,
    rightHandActive,
    leftHandActive,
    error,
  };
};
