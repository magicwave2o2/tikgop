import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CategoryBreakdownItem } from '../types/finance';
import { formatCompactVND, formatVND } from '../utils/format';
import { DynamicIcon } from './IconRenderer';

interface CategoryDonutChartProps {
  items: CategoryBreakdownItem[];
  totalAmount: number;
  centerLabel?: string;
  onSelectCategory?: (categoryId: string) => void;
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  items,
  totalAmount,
  centerLabel = 'Tổng chi',
  onSelectCategory,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const size = 204;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Show top 6 slices + bundle rest into "Khác" so ring stays ultra-clean
  const topSlices = items.slice(0, 6);
  const restAmount = items.slice(6).reduce((acc, i) => acc + i.amount, 0);
  const restCount = items.slice(6).reduce((acc, i) => acc + i.count, 0);

  const chartSlices: CategoryBreakdownItem[] =
    restAmount > 0
      ? [
          ...topSlices,
          {
            category: {
              id: '__others__',
              name: 'Các mục khác',
              shortName: 'Khác',
              type: 'expense',
              icon: 'MoreHorizontal',
              color: '#94A3B8',
            },
            amount: restAmount,
            count: restCount,
            percentage: totalAmount > 0 ? (restAmount / totalAmount) * 100 : 0,
            avgAmount: Math.round(restAmount / Math.max(1, restCount)),
            budgetRatio: null,
          },
        ]
      : topSlices;

  const activeItem = chartSlices.find((s) => s.category.id === activeId) || null;

  let cumulativeFraction = 0;
  const gapPx = chartSlices.length > 1 ? 4 : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 overflow-visible"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-100 dark:text-white/[0.07]"
          />

          {totalAmount > 0 &&
            chartSlices.map((slice) => {
              const fraction = slice.amount / totalAmount;
              const segLen = Math.max(0, fraction * circumference - gapPx);
              const offset = -cumulativeFraction * circumference;
              cumulativeFraction += fraction;

              const isHighlighted = activeId === slice.category.id;
              const isDimmed = activeId !== null && !isHighlighted;

              return (
                <motion.circle
                  key={slice.category.id}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={slice.category.color}
                  strokeLinecap="round"
                  strokeDasharray={`${segLen} ${circumference}`}
                  strokeDashoffset={offset}
                  initial={{ strokeDasharray: `0 ${circumference}`, opacity: 0.4 }}
                  animate={{
                    strokeDasharray: `${segLen} ${circumference}`,
                    strokeWidth: isHighlighted ? strokeWidth + 4 : strokeWidth,
                    opacity: isDimmed ? 0.32 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                  className="cursor-pointer transition-opacity"
                  onMouseEnter={() => setActiveId(slice.category.id)}
                  onMouseLeave={() => setActiveId(null)}
                  onClick={() => {
                    if (activeId === slice.category.id) {
                      if (slice.category.id !== '__others__' && onSelectCategory) {
                        onSelectCategory(slice.category.id);
                      } else {
                        setActiveId(null);
                      }
                    } else {
                      setActiveId(slice.category.id);
                    }
                  }}
                />
              );
            })}
        </svg>

        {/* Center label readout */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none"
        >
          <AnimatePresence mode="wait">
            {activeItem ? (
              <motion.div
                key={activeItem.category.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.16 }}
                className="flex flex-col items-center"
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center mb-1"
                  style={{
                    backgroundColor: `${activeItem.category.color}20`,
                    color: activeItem.category.color,
                  }}
                >
                  <DynamicIcon name={activeItem.category.icon} size={16} />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">
                  {activeItem.category.shortName}
                </span>
                <span className="text-base font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {formatCompactVND(activeItem.amount)}
                </span>
                <span
                  className="text-[11px] font-bold tabular-nums"
                  style={{ color: activeItem.category.color }}
                >
                  {Math.round(activeItem.percentage)}%
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="total"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.16 }}
                className="flex flex-col items-center"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {centerLabel}
                </span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                  {totalAmount > 0 ? formatCompactVND(totalAmount) : '0 ₫'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {items.length > 0 ? `${items.length} danh mục` : 'Chưa có dữ liệu'}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Interactive quick legend pills */}
      {chartSlices.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
          {chartSlices.map((slice) => {
            const isSelected = activeId === slice.category.id;
            return (
              <motion.button
                key={slice.category.id}
                whileTap={{ scale: 0.95 }}
                onClick={() =>
                  setActiveId((prev) => (prev === slice.category.id ? null : slice.category.id))
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/45 shadow-sm'
                    : 'bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/15'
                }`}
                title={`${slice.category.name}: ${formatVND(slice.amount)}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: slice.category.color }}
                />
                <span>{slice.category.shortName}</span>
                <span className="opacity-70 tabular-nums">{Math.round(slice.percentage)}%</span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
};
