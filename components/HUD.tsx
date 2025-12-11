import React, { useImperativeHandle, forwardRef, useState, useRef, useEffect } from 'react';

export interface HUDRef {
    updateValues: (pitch: number, volume: number) => void;
    setRightHandActive: (active: boolean) => void;
    setLeftHandActive: (active: boolean) => void;
}

export const HUD = forwardRef<HUDRef, {}>((props, ref) => {
    const [pitch, setPitch] = useState(0);
    const [vol, setVol] = useState(0);
    const [rightActive, setRightActive] = useState(false);
    const [leftActive, setLeftActive] = useState(false);

    // Throttling ref
    const lastUpdate = useRef(0);

    useImperativeHandle(ref, () => ({
        updateValues: (newPitch: number, newVol: number) => {
            const now = Date.now();
            // Update at max 30fps to keep UI responsive but not overload React
            if (now - lastUpdate.current > 32) {
                setPitch(Math.round(newPitch));
                setVol(Math.round(newVol * 100));
                lastUpdate.current = now;
            }
        },
        setRightHandActive: (active: boolean) => setRightActive(active),
        setLeftHandActive: (active: boolean) => setLeftActive(active)
    }));

    if (!rightActive && !leftActive) return null;

    return (
        <>
            {leftActive && (
                <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
                    <div className="p-2 rounded border transition-colors duration-300 border-green-500 bg-green-900/20 text-green-400">
                        <div className="text-[10px] uppercase tracking-wider">Left Hand (Vol)</div>
                        <div className="text-xl font-bold">{vol}%</div>
                        {/* Gesture feedback is handled by main app for now, or could be moved here too */}
                    </div>
                </div>
            )}
            {rightActive && (
                <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-none text-right">
                    <div className="p-2 rounded border transition-colors duration-300 border-cyan-500 bg-cyan-900/20 text-cyan-400">
                        <div className="text-[10px] uppercase tracking-wider">Right Hand (Pitch)</div>
                        <div className="text-xl font-bold">{pitch} Hz</div>
                    </div>
                </div>
            )}
        </>
    );
});

HUD.displayName = 'HUD';
