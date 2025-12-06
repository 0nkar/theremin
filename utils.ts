import { HandLandmark } from './types';

// Lerp helper for smoothing
export const lerp = (start: number, end: number, amt: number): number => {
  return (1 - amt) * start + amt * end;
};

// Geometry helper
export const getDistance = (p1: HandLandmark, p2: HandLandmark): number => {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
};
