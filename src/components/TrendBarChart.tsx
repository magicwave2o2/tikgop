import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { TrendBucket } from '../types/finance';
import { formatCompactVND, formatVND } from '../utils/format';

interface TrendBarChartProps {
  buckets: TrendBucket[];
  showIncome?: boolean;
  onSelectBucket?: (bucket: TrendBucket) => void;
}

export const TrendBarChart: React.FC<TrendBarChartProps> = ({
  buckets,
  showIncome = false,
  onSelectBucket,
}) => {
  const currentIdx = buckets.findIndex((b) => b.isCurrent);
  const [selectedKey, setSelectedKey] = useState<string>(
    currentIdx >= 0 ? buckets[currentIdx].key : buckets[buckets.length - 1]?.key || '',
  );

  // Keep selection valid when timeframe switches
  useEffect(() => {
    if (!buckets.some((b) => b.key === selectedKey)) {
      const idx = buckets.findIndex((b) => b.isCurrent);
      setSelectedKey(idx >= 0 ? buckets[idx].key : buckets[buckets.length - 1]?.key || '');
    }
  }, [buckets, selectedKey]);

  const maxVal = Math.max(
    1,
    ...buckets.map((b) => (showIncome ? Math.max(b.expense, b.income) : b.expense)),
  );

  const nonZeroExpenses = buckets.filter((b) => b.expense > 0);
  const avgExpense =
    nonZeroExpenses.length > 0
      ? Math.round(nonZeroExpenses.reduce((s, b) => s + b.expense, 0) / nonZeroExpenses.length)
      : 0;
  const avgLinePct = maxVal > 0 ? Math.min(94, Math.round((avgExpense / maxVal) * 100)) : 0;

  const selected = buckets.find((b) => b.key === selectedKey) || buckets[buckets.length - 1];

  return (
    <div className="w-full">
      {/* Interactive selected bucket readout */}
      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {selected.label}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                • {selected.subLabel}
              </span>
              {selected.isCurrent && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  Hiện tại
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {selected.count} giao dịch
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-rose-500">
                Chi tiêu
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                {formatVND(selected.expense)}
              </div>
            </div>
            {showIncome && (
              <div className="pl-3 border-l border-slate-200 dark:border-slate-700">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-emerald-500">
                  Thu nhập
                </div>
                <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatVND(selected.income)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bars stage */}
      <div className="relative h-48 pt-6 pb-2 flex items-end justify-between gap-1.5 sm:gap-2.5">
        {/* Dashed average reference line */}
        {!showIncome && avgExpense > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-emerald-500/45 pointer-events-none z-10 flex justify-end"
            style={{ bottom: `calc(${avgLinePct * 0.72}% + 28px)` }}
          >
            <span className="-mt-4 px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold tabular-nums backdrop-blur-sm">
              TB {formatCompactVND(avgExpense)}
            </span>
          </div>
        )}

        {buckets.map((bucket, idx) => {
          const isSelected = bucket.key === selected?.key;
          const expPct = bucket.expense > 0 ? Math.max(6, Math.round((bucket.expense / maxVal) * 100)) : 2;
          const incPct = bucket.income > 0 ? Math.max(6, Math.round((bucket.income / maxVal) * 100)) : 0;

          return (
            <button
              key={bucket.key}
              type="button"
              onClick={() => {
                setSelectedKey(bucket.key);
                onSelectBucket?.(bucket);
              }}
              className="group flex-1 h-full flex flex-col items-center justify-end focus:outline-none cursor-pointer"
            >
              {/* Value label above bar */}
              <span
                className={`text-[10px] font-bold tabular-nums mb-1 transition-all ${
                  isSelected
                    ? 'text-emerald-600 dark:text-emerald-400 scale-105'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                }`}
              >
                {bucket.expense > 0 ? formatCompactVND(bucket.expense) : '–'}
              </span>

              {/* Bar container */}
              <div className="w-full flex-1 flex items-end justify-center gap-1 px-0.5">
                {showIncome && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${incPct}%` }}
                    transition={{
                      type: 'spring',
                      stiffness: 190,
                      damping: 24,
                      delay: idx * 0.03,
                    }}
                    className={`w-2.5 sm:w-3.5 rounded-t-lg transition-colors ${
                      isSelected
                        ? 'bg-emerald-500 shadow-md shadow-emerald-500/30'
                        : 'bg-emerald-400/55 dark:bg-emerald-500/45 group-hover:bg-emerald-400'
                    }`}
                  />
                )}

                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${expPct}%` }}
                  transition={{
                    type: 'spring',
                    stiffness: 190,
                    damping: 22,
                    delay: idx * 0.035,
                  }}
                  className={`${
                    showIncome ? 'w-2.5 sm:w-3.5' : 'w-full max-w-[34px]'
                  } rounded-t-xl transition-all ${
                    bucket.expense === 0
                      ? 'bg-slate-200/70 dark:bg-slate-800'
                      : isSelected
                        ? showIncome
                          ? 'bg-rose-500 shadow-lg shadow-rose-500/30'
                          : 'bg-gradient-to-t from-emerald-600 to-teal-400 shadow-lg shadow-emerald-500/30'
                        : bucket.isCurrent
                          ? showIncome
                            ? 'bg-rose-400/80'
                            : 'bg-emerald-500/70'
                          : showIncome
                            ? 'bg-rose-400/45 dark:bg-rose-500/40 group-hover:bg-rose-400/75'
                            : 'bg-slate-200 dark:bg-slate-700/80 group-hover:bg-emerald-400/60'
                  }`}
                />
              </div>

              {/* X-axis label */}
              <span
                className={`mt-2 text-[11px] font-semibold transition-colors ${
                  isSelected
                    ? 'text-slate-900 dark:text-white'
                    : bucket.isCurrent
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {bucket.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
