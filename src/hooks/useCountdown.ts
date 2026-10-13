import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A pausable countdown measured against a deadline rather than by counting ticks, so it stays accurate when the
 * browser throttles timers in a background tab.
 */
export function useCountdown(onFinish: () => void) {
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const endsAt = useRef<number | null>(null);
  const remainingRef = useRef(0);
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  }, [onFinish]);

  const secondsLeft = () => (endsAt.current === null ? remainingRef.current : Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000)));
  const update = (seconds: number) => {
    remainingRef.current = seconds;
    setRemaining(seconds);
  };

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      const left = secondsLeft();
      update(left);
      if (left === 0) {
        endsAt.current = null;
        setRunning(false);
        finish.current();
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [running]);

  const start = useCallback(() => {
    if (endsAt.current !== null || remainingRef.current <= 0) return;
    endsAt.current = Date.now() + remainingRef.current * 1000;
    setRunning(true);
  }, []);
  const pause = useCallback(() => {
    update(secondsLeft());
    endsAt.current = null;
    setRunning(false);
  }, []);
  const reset = useCallback((seconds: number) => {
    endsAt.current = null;
    update(seconds);
    setRunning(false);
  }, []);

  return { remaining, running, start, pause, reset };
}
