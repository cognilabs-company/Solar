import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  durationMs?: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Counts from the previously shown value to `value` with an ease-out curve.
 * The final frame always renders the exact formatted value.
 */
function AnimatedNumber({ value, format, durationMs = 1100 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(() =>
    prefersReducedMotion() ? value : 0,
  );
  const fromRef = useRef(displayValue);

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(value)) {
      fromRef.current = value;
      setDisplayValue(value);
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = progress >= 1 ? value : from + (value - from) * eased;
      fromRef.current = next;
      setDisplayValue(next);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  const isFinal = displayValue === value;
  return <>{format(isFinal ? value : Math.round(displayValue))}</>;
}

export default AnimatedNumber;
