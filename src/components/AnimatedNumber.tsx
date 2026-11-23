import React, { useEffect, useRef, useState } from 'react';
import { formatCompactVND, formatVND } from '../utils/format';

interface AnimatedCurrencyProps {
  value: number;
  compact?: boolean;
  showUnit?: boolean;
  signed?: boolean;
  className?: string;
}

export const AnimatedCurrency: React.FC<AnimatedCurrencyProps> = ({
  value,
  compact = false,
  showUnit = true,
  signed = false,
  className = '',
}) => {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const startVal = prevRef.current;
    const endVal = value;
    if (startVal === endVal) return;

    const duration = 420;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Cubic ease-out for silky smooth settle
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevRef.current = endVal;
        setDisplay(endVal);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      prevRef.current = endVal;
    };
  }, [value]);

  const formatted = compact
    ? formatCompactVND(Math.round(display))
    : formatVND(Math.round(display), { showUnit, signed });

  return <span className={`tabular-nums ${className}`}>{formatted}</span>;
};
