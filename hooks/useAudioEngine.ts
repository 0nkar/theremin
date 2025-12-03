import { useState, useRef, useCallback, useEffect } from 'react';
import { audioEngine, AudioEngine } from '../services/audioEngine';
import { WaveformType } from '../types';
import { lerp } from '../utils';

export const useAudioEngine = (targetPitch: React.RefObject<number>, targetVol: React.RefObject<number>) => {
  const [isReady, setIsReady] = useState(false);
  const [waveform, setWaveform] = useState<WaveformType>('sine');
  const [delayMix, setDelayMix] = useState(0.3);

  const [activePitch, setActivePitch] = useState(0);
  const [activeVol, setActiveVol] = useState(0);

  const engineRef = useRef<AudioEngine | null>(null);
  const animationFrameRef = useRef<number>(0);

  const currentPitch = useRef(targetPitch.current || 440);
  const currentVol = useRef(targetVol.current || 0);

  const WAVES: WaveformType[] = ['sine', 'triangle', 'sawtooth', 'square'];

  const updateAudio = useCallback(() => {
    if (!engineRef.current) return;

    currentPitch.current = lerp(currentPitch.current, targetPitch.current!, 0.15);
    currentVol.current = lerp(currentVol.current, targetVol.current!, 0.15);

    engineRef.current.setFrequency(currentPitch.current);
    engineRef.current.setVolume(currentVol.current);

    setActivePitch(Math.round(currentPitch.current));
    setActiveVol(Math.round(currentVol.current * 100));

    animationFrameRef.current = requestAnimationFrame(updateAudio);
  }, [targetPitch, targetVol]);

  const initialize = useCallback(async () => {
    await audioEngine.init();
    audioEngine.start();
    engineRef.current = audioEngine;

    cancelAnimationFrame(animationFrameRef.current);
    updateAudio();
    setIsReady(true);
  }, [updateAudio]);

  const cycleWaveform = useCallback(() => {
    const currentIndex = WAVES.indexOf(waveform);
    const nextIndex = (currentIndex + 1) % WAVES.length;
    const nextWave = WAVES[nextIndex];
    setWaveform(nextWave);
    engineRef.current?.setWaveform(nextWave);
    return nextWave;
  }, [waveform]);

  const toggleDelay = useCallback(() => {
    const newMix = delayMix > 0.1 ? 0 : 0.5;
    setDelayMix(newMix);
    engineRef.current?.setDelayMix(newMix);
    return newMix;
  }, [delayMix]);

  const handleWaveformChange = useCallback((type: WaveformType) => {
    setWaveform(type);
    engineRef.current?.setWaveform(type);
  }, []);

  const handleDelayChange = useCallback((mix: number) => {
    setDelayMix(mix);
    engineRef.current?.setDelayMix(mix);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      engineRef.current?.stop();
    };
  }, []);

  return {
    isReady,
    initialize,
    waveform,
    delayMix,
    activePitch,
    activeVol,
    cycleWaveform,
    toggleDelay,
    handleWaveformChange,
    handleDelayChange,
  };
};
