import React, { useImperativeHandle, forwardRef, useRef, useCallback } from 'react';

// Mapping of frequencies to note names
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function freqToNote(freq: number): string {
  if (freq <= 0) return '---';
  const noteNum = 12 * (Math.log2(freq / 440)) + 69;
  const noteIndex = Math.round(noteNum) % 12;
  const octave = Math.floor(Math.round(noteNum) / 12) - 1;
  const noteIdx = ((noteIndex % 12) + 12) % 12;
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}

export interface HUDRef {
  updateValues: (pitch: number, volume: number) => void;
  setRightHandActive: (active: boolean) => void;
  setLeftHandActive: (active: boolean) => void;
}

export const HUD = forwardRef<HUDRef, {}>((props, ref) => {
  // Use direct DOM manipulation to avoid React re-render overhead at 60fps
  const pitchValRef = useRef<HTMLDivElement>(null);
  const noteValRef  = useRef<HTMLDivElement>(null);
  const volValRef   = useRef<HTMLDivElement>(null);
  const volBarRef   = useRef<HTMLDivElement>(null);
  const leftPanelRef  = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const noteBadgeRef  = useRef<HTMLDivElement>(null);

  const lastUpdate = useRef(0);
  const rightActive = useRef(false);
  const leftActive  = useRef(false);

  const updateDOM = useCallback((pitch: number, vol: number) => {
    if (pitchValRef.current)  pitchValRef.current.textContent  = `${Math.round(pitch)} Hz`;
    if (noteValRef.current)   noteValRef.current.textContent   = freqToNote(pitch);
    if (volValRef.current)    volValRef.current.textContent    = `${Math.round(vol * 100)}%`;
    if (volBarRef.current)    volBarRef.current.style.width    = `${Math.round(vol * 100)}%`;
    if (noteBadgeRef.current) noteBadgeRef.current.textContent = `♪ ${freqToNote(pitch)}  ·  ${Math.round(pitch)} Hz`;
  }, []);

  useImperativeHandle(ref, () => ({
    updateValues: (pitch: number, vol: number) => {
      const now = Date.now();
      if (now - lastUpdate.current > 30) { // ~33fps cap
        lastUpdate.current = now;
        updateDOM(pitch, vol);
      }
    },
    setRightHandActive: (active: boolean) => {
      if (rightActive.current === active) return;
      rightActive.current = active;
      if (rightPanelRef.current) {
        rightPanelRef.current.style.display = active ? 'block' : 'none';
      }
      // Show/hide note badge if either hand is visible
      if (noteBadgeRef.current) {
        noteBadgeRef.current.style.display = (active || leftActive.current) ? 'block' : 'none';
      }
    },
    setLeftHandActive: (active: boolean) => {
      if (leftActive.current === active) return;
      leftActive.current = active;
      if (leftPanelRef.current) {
        leftPanelRef.current.style.display = active ? 'block' : 'none';
      }
      if (noteBadgeRef.current) {
        noteBadgeRef.current.style.display = (active || rightActive.current) ? 'block' : 'none';
      }
    }
  }));

  return (
    <>
      {/* Left hand: Volume */}
      <div ref={leftPanelRef} className="hud-panel left" style={{ display: 'none' }}>
        <div className="hud-label">Left Hand · Vol</div>
        <div ref={volValRef} className="hud-value">0%</div>
        <div className="vol-bar">
          <div ref={volBarRef} className="vol-bar-fill" style={{ width: '0%' }} />
        </div>
      </div>

      {/* Right hand: Pitch */}
      <div ref={rightPanelRef} className="hud-panel right" style={{ display: 'none' }}>
        <div className="hud-label">Right Hand · Pitch</div>
        <div ref={pitchValRef} className="hud-value">440 Hz</div>
        <div ref={noteValRef} className="hud-sub">A4</div>
      </div>

      {/* Center note badge */}
      <div ref={noteBadgeRef} className="note-badge" style={{ display: 'none' }}>
        ♪ A4 · 440 Hz
      </div>
    </>
  );
});

HUD.displayName = 'HUD';
