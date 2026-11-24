import React, { memo, useEffect, useRef } from 'react';
import { formatCompactVND, formatVND } from '../utils/format';

interface AnimatedCurrencyProps {
  value: number;
  compact?: boolean;
  showUnit?: boolean;
  signed?: boolean;
  className?: string;
}

function formatVal(val: number, compact: boolean, showUnit: boolean, signed: boolean): string {
  const rounded = Math.round(val);
  return compact ? formatCompactVND(rounded) : formatVND(rounded, { showUnit, signed });
}

/**
 * Zero-re-render rolling currency readout: mutates textContent directly inside rAF
 * so iOS Safari/PWA never runs 25-30 React reconciliation passes per number transition.
 */
export const AnimatedCurrency: React.FC<AnimatedCurrencyProps> = memo(
  ({ value, compact = false, showUnit = true, signed = false, className = '' }) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const prevRef = useRef<number>(value);

    useEffect(() => {
      const el = spanRef.current;
      if (!el) return;

      const startVal = prevRef.current;
      const endVal = value;
      if (startVal === endVal) {
        el.textContent = formatVal(endVal, compact, showUnit, signed);
        return;
      }

      const duration = 240;
      const startTime = performance.now();
      let rafId = 0;

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - (1 - progress) * (1 - progress) * (1 - progress);
        const current = startVal + (endVal - startVal) * eased;
        el.textContent = formatVal(current, compact, showUnit, signed);

        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          prevRef.current = endVal;
          el.textContent = formatVal(endVal, compact, showUnit, signed);
        }
      };

      rafId = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(rafId);
        prevRef.current = endVal;
      };
    }, [value, compact, showUnit, signed]);

    return (
      <span ref={spanRef} className={`tabular-nums ${className}`}>
        {formatVal(value, compact, showUnit, signed)}
      </span>
    );
  },
);
