import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Mic,
  Plus,
  RotateCcw,
  ScanLine,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AnimatedCurrency } from '../components/AnimatedNumber';
import { CategoryIconBadge, DynamicIcon } from '../components/IconRenderer';
import { TransactionRow } from '../components/TransactionRow';
import { useFinance } from '../store/useFinanceStore';
import type { AppTab, Timeframe, Transaction } from '../types/finance';
import {
  aggregateByCategory,
  aggregateByMember,
  computePeriodSummary,
  computeQuickRollups,
  filterTransactionsByRange,
} from '../utils/analytics';
import {
  formatCompactVND,
  formatVND,
  getPeriodRange,
  getToday,
  shiftAnchorDate,
  toDateKey,
} from '../utils/format';

interface OverviewViewProps {
  onEditTransaction: (tx: Transaction) => void;
  onNavigateTab: (tab: AppTab, categoryFilter?: string) => void;
  onQuickAdd: () => void;
  onOpenReceiptScan: () => void;
  onOpenVoiceInput: () => void;
}

const TIMEFRAMES: Array<{ id: Timeframe; label: string }> = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  onEditTransaction,
  onNavigateTab,
  onQuickAdd,
  onOpenReceiptScan,
  onOpenVoiceInput,
}) => {
  const { state, deleteTransaction } = useFinance();
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => getToday());
  const [viewScope, setViewScope] = useState<'all' | string>('all');

  const today = useMemo(() => getToday(), []);
  const range = useMemo(() => getPeriodRange(timeframe, anchorDate), [timeframe, anchorDate]);

  const scopedTransactions = useMemo(() => {
    if (viewScope === 'all') return state.transactions;
    return state.transactions.filter((tx) => tx.memberId === viewScope);
  }, [state.transactions, viewScope]);

  const isAtCurrentPeriod = useMemo(() => {
    const curRange = getPeriodRange(timeframe, today);
    return toDateKey(range.start) === toDateKey(curRange.start);
  }, [timeframe, range.start, today]);

  const periodTxs = useMemo(
    () => filterTransactionsByRange(scopedTransactions, range.start, range.end),
    [scopedTransactions, range.start, range.end],
  );

  const fullFamilyPeriodTxs = useMemo(
    () => filterTransactionsByRange(state.transactions, range.start, range.end),
    [state.transactions, range.start, range.end],
  );

  const summary = useMemo(
    () => computePeriodSummary(scopedTransactions, timeframe, anchorDate),
    [scopedTransactions, timeframe, anchorDate],
  );

  const quickRollups = useMemo(
    () => computeQuickRollups(scopedTransactions),
    [scopedTransactions],
  );

  const categoryBreakdown = useMemo(
    () => aggregateByCategory(periodTxs, state.categories, 'expense'),
    [periodTxs, state.categories],
  );

  const memberBreakdown = useMemo(
    () => aggregateByMember(fullFamilyPeriodTxs, state.members, 'expense'),
    [fullFamilyPeriodTxs, state.members],
  );

  const recentTxs = useMemo(() => {
    const source = periodTxs.length > 0 ? periodTxs : scopedTransactions;
    return [...source]
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        if (a.time !== b.time) return b.time.localeCompare(a.time);
        return b.createdAt - a.createdAt;
      })
      .slice(0, 6);
  }, [periodTxs, scopedTransactions]);

  const catMap = useMemo(
    () => new Map(state.categories.map((c) => [c.id, c])),
    [state.categories],
  );
  const memMap = useMemo(
    () => new Map(state.members.map((m) => [m.id, m])),
    [state.members],
  );

  const viewingMemberObj = viewScope === 'all' ? null : memMap.get(viewScope) || null;

  const periodBudget =
    timeframe === 'month'
      ? state.settings.monthlyBudget
      : timeframe === 'week'
        ? Math.round(state.settings.monthlyBudget / 4.3)
        : timeframe === 'day'
          ? Math.round(state.settings.monthlyBudget / 30)
          : state.settings.monthlyBudget * 12;

  const budgetPct =
    periodBudget > 0 ? Math.min(100, Math.round((summary.totalExpense / periodBudget) * 100)) : 0;
  const isOverBudget = periodBudget > 0 && summary.totalExpense > periodBudget;

  return (
    <div className="space-y-4">
      {/* UNIFIED LUMINOUS HERO CARD: Inline Timeframe + Totals + Budget + Rollup Ribbon */}
      <motion.section
        layout
        className="relative overflow-hidden rounded-[2rem] p-4 sm:p-6 text-white bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-xl shadow-emerald-600/20"
      >
        {/* Subtle ambient mesh */}
        <div className="pointer-events-none absolute -top-20 -right-14 w-56 h-56 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-60 h-60 rounded-full bg-teal-300/20 blur-3xl" />

        <div className="relative z-10 space-y-4">
          {/* Top Integrated Controls: Timeframe Pills + Period Stepper */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex p-0.5 rounded-xl bg-black/15 backdrop-blur-md">
              {TIMEFRAMES.map((tf) => {
                const active = timeframe === tf.id;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => {
                      setTimeframe(tf.id);
                      setAnchorDate(getToday());
                    }}
                    className={`relative px-2.5 sm:px-3 py-1.5 rounded-[10px] text-[11px] font-extrabold transition-colors z-10 cursor-pointer ${
                      active ? 'text-emerald-700' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="heroTimeframePill"
                        transition={{ type: 'spring', stiffness: 440, damping: 32 }}
                        className="absolute inset-0 rounded-[10px] bg-white shadow-xs -z-10"
                      />
                    )}
                    {tf.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1">
              {!isAtCurrentPeriod && (
                <button
                  type="button"
                  onClick={() => setAnchorDate(getToday())}
                  className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 transition-colors cursor-pointer"
                  aria-label="Về hiện tại"
                  title="Về hiện tại"
                >
                  <RotateCcw size={13} />
                </button>
              )}
              <div className="inline-flex items-center gap-0.5 bg-black/15 backdrop-blur-md rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setAnchorDate((d) => shiftAnchorDate(timeframe, d, -1))}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                  aria-label="Kỳ trước"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-1.5 text-[11px] font-bold tabular-nums whitespace-nowrap">
                  {range.shortLabel}
                </span>
                <button
                  type="button"
                  onClick={() => setAnchorDate((d) => shiftAnchorDate(timeframe, d, 1))}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                  aria-label="Kỳ sau"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Center Big Rolling Total + Inline Metrics */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-emerald-50/85">
                  {viewingMemberObj ? `Chi tiêu của ${viewingMemberObj.name}` : 'Tổng chi gia đình'}
                </span>
                {viewingMemberObj && (
                  <button
                    type="button"
                    onClick={() => setViewScope('all')}
                    className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-[10px] font-bold cursor-pointer"
                  >
                    Cả nhà
                  </button>
                )}
              </div>

              {summary.expenseDeltaPct !== null && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold backdrop-blur-md ${
                    summary.expenseDeltaPct <= 0
                      ? 'bg-white/20 text-emerald-50'
                      : 'bg-rose-500/40 text-rose-50'
                  }`}
                >
                  {summary.expenseDeltaPct <= 0 ? (
                    <TrendingDown size={12} />
                  ) : (
                    <TrendingUp size={12} />
                  )}
                  <span className="tabular-nums">
                    {summary.expenseDeltaPct > 0 ? '+' : ''}
                    {summary.expenseDeltaPct}%
                  </span>
                </span>
              )}
            </div>

            <div className="mt-1 text-3xl sm:text-[40px] font-extrabold tracking-tight leading-none">
              <AnimatedCurrency value={summary.totalExpense} />
            </div>

            {/* Sleek single-line inline KPIs */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-emerald-50/90 tabular-nums">
              <span>
                Thu <strong className="text-white">{formatCompactVND(summary.totalIncome)}</strong>
              </span>
              <span className="opacity-40">•</span>
              <span>
                Dư{' '}
                <strong className="text-white">
                  {summary.netBalance >= 0 ? '+' : ''}
                  {formatCompactVND(summary.netBalance)}
                </strong>
              </span>
              <span className="opacity-40">•</span>
              <span>
                TB/ngày <strong className="text-white">{formatCompactVND(summary.dailyAverage)}</strong>
              </span>
            </div>

            {/* Thin Luminous Budget Progress */}
            {viewScope === 'all' && periodBudget > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-emerald-50/85 mb-1 tabular-nums">
                  <span>Hạn mức {range.shortLabel}</span>
                  <span className="font-bold text-white">
                    {Math.round((summary.totalExpense / periodBudget) * 100)}% •{' '}
                    {formatCompactVND(periodBudget)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/20 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${budgetPct}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    className={`h-full rounded-full ${
                      isOverBudget
                        ? 'bg-gradient-to-r from-amber-300 to-rose-400'
                        : budgetPct > 80
                          ? 'bg-amber-300'
                          : 'bg-white'
                    }`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Integrated Glass Rollup Ribbon: Hôm nay | Tuần này | Tháng này */}
          <div className="grid grid-cols-3 divide-x divide-white/15 rounded-2xl bg-black/15 backdrop-blur-md border border-white/10 overflow-hidden">
            {(
              [
                { id: 'day' as Timeframe, label: 'Hôm nay', val: quickRollups.todayExpense },
                { id: 'week' as Timeframe, label: 'Tuần này', val: quickRollups.weekExpense },
                { id: 'month' as Timeframe, label: 'Tháng này', val: quickRollups.monthExpense },
              ]
            ).map((r) => {
              const isCurrent = timeframe === r.id && isAtCurrentPeriod;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setTimeframe(r.id);
                    setAnchorDate(getToday());
                  }}
                  className={`py-2.5 px-2 text-center transition-colors cursor-pointer ${
                    isCurrent ? 'bg-white/16' : 'hover:bg-white/8'
                  }`}
                >
                  <div className="text-[10px] font-semibold text-emerald-50/80">{r.label}</div>
                  <div className="text-xs sm:text-sm font-extrabold text-white tabular-nums mt-0.5 truncate">
                    {formatCompactVND(r.val)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* SLEEK UNIFIED 3-WAY QUICK CAPTURE BAR (Mobile/Tablet; Desktop has Sidebar shortcuts) */}
      <section className="lg:hidden card-surface rounded-2xl p-1.5 grid grid-cols-3 gap-1.5">
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onOpenReceiptScan}
          className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/18 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
        >
          <ScanLine size={17} strokeWidth={2.3} />
          <span className="text-xs font-extrabold whitespace-nowrap">Quét bill</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onOpenVoiceInput}
          className="relative flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/18 text-violet-700 dark:text-violet-300 transition-colors cursor-pointer"
        >
          <span className="relative flex items-center justify-center">
            <Mic size={17} strokeWidth={2.3} />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          </span>
          <span className="text-xs font-extrabold whitespace-nowrap">Giọng nói</span>
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={onQuickAdd}
          className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/18 text-sky-700 dark:text-sky-300 transition-colors cursor-pointer"
        >
          <Plus size={17} strokeWidth={2.5} />
          <span className="text-xs font-extrabold whitespace-nowrap">Ghi tay</span>
        </motion.button>
      </section>

      {/* CREATIVE 4-MEMBER RADIAL-RING AVATAR STRIP */}
      <section className="card-surface rounded-3xl p-3.5 sm:p-4">
        <div className="grid grid-cols-4 gap-2">
          {memberBreakdown.map((item) => {
            const isFiltered = viewScope === item.member.id;
            const ringRadius = 21;
            const ringCirc = 2 * Math.PI * ringRadius;
            const ringDash = (Math.min(100, item.percentage) / 100) * ringCirc;

            return (
              <motion.button
                key={item.member.id}
                type="button"
                whileTap={{ scale: 0.94 }}
                onClick={() =>
                  setViewScope((prev) => (prev === item.member.id ? 'all' : item.member.id))
                }
                className={`flex flex-col items-center py-2 px-1 rounded-2xl transition-all cursor-pointer ${
                  isFiltered
                    ? 'bg-emerald-500/10 ring-2 ring-emerald-500/60'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {/* Avatar with Creative Circular Spending Progress Ring */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="absolute inset-0 w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                    <circle
                      cx="24"
                      cy="24"
                      r={ringRadius}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-slate-100 dark:text-slate-800"
                    />
                    {item.percentage > 0 && (
                      <motion.circle
                        cx="24"
                        cy="24"
                        r={ringRadius}
                        fill="none"
                        stroke={item.member.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        initial={{ strokeDasharray: `0 ${ringCirc}` }}
                        animate={{ strokeDasharray: `${ringDash} ${ringCirc}` }}
                        transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                      />
                    )}
                  </svg>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-transform"
                    style={{
                      backgroundColor: isFiltered ? item.member.color : `${item.member.color}1C`,
                      color: isFiltered ? '#ffffff' : item.member.color,
                    }}
                  >
                    <DynamicIcon name={item.member.icon} size={17} />
                  </div>
                </div>

                <span className="mt-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate max-w-full">
                  {item.member.name}
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatCompactVND(item.amount)}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* PRAGMATIC 2-COLUMN BENTO CORE: Category Bar & Ranked List + Recent Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Category Classification with Creative Apple-Storage Stacked Bar */}
        <section className="lg:col-span-6 card-surface rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Phân loại ({range.shortLabel})
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('analytics')}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <span>Phân tích</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {categoryBreakdown.length === 0 ? (
            <div className="py-7 text-center">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-2">
                <Sparkles size={18} />
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">
                Chưa có khoản chi nào
              </p>
              <button
                type="button"
                onClick={onQuickAdd}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-sm shadow-emerald-500/25 cursor-pointer"
              >
                + Ghi khoản đầu tiên
              </button>
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Stacked Proportional Color Ribbon */}
              <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex gap-0.5 p-0.5">
                {categoryBreakdown.slice(0, 7).map((item) => (
                  <motion.div
                    key={item.category.id}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(4, item.percentage)}%` }}
                    transition={{ type: 'spring', stiffness: 150, damping: 24 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.category.color }}
                    title={`${item.category.name}: ${formatVND(item.amount)} (${Math.round(item.percentage)}%)`}
                  />
                ))}
              </div>

              {/* Compact Ranked Category Rows */}
              <div className="space-y-1">
                {categoryBreakdown.slice(0, 6).map((item) => (
                  <motion.button
                    key={item.category.id}
                    type="button"
                    whileTap={{ scale: 0.985 }}
                    onClick={() => onNavigateTab('history', item.category.id)}
                    className="w-full flex items-center gap-3 p-2 -mx-2 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                  >
                    <CategoryIconBadge
                      icon={item.category.icon}
                      color={item.category.color}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {item.category.name}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {item.count}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {formatVND(item.amount)}
                      </span>
                      <span
                        className="text-[10px] font-extrabold tabular-nums w-8 text-right"
                        style={{ color: item.category.color }}
                      >
                        {Math.round(item.percentage)}%
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="lg:col-span-6 card-surface rounded-3xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              Giao dịch gần đây
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('history')}
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              <span>Tất cả</span>
              <ArrowRight size={13} />
            </button>
          </div>

          {recentTxs.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">
              Chưa có giao dịch nào được ghi nhận.
            </p>
          ) : (
            <div className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800/70">
              {recentTxs.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  category={catMap.get(tx.categoryId)}
                  member={memMap.get(tx.memberId)}
                  onEdit={onEditTransaction}
                  onDelete={deleteTransaction}
                  showDate
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
