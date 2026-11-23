import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Mic,
  PiggyBank,
  PlusCircle,
  RotateCcw,
  ScanLine,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { AnimatedCurrency } from '../components/AnimatedNumber';
import { CategoryDonutChart } from '../components/CategoryDonutChart';
import { CategoryIconBadge, DynamicIcon } from '../components/IconRenderer';
import { TransactionRow } from '../components/TransactionRow';
import { TrendBarChart } from '../components/TrendBarChart';
import { useFinance } from '../store/useFinanceStore';
import type { AppTab, Timeframe, Transaction } from '../types/finance';
import {
  aggregateByCategory,
  aggregateByMember,
  buildTrendSeries,
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
  const { state, activeMember, setActiveMember, deleteTransaction } = useFinance();
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => getToday());
  /** 'all' = shared total for all 4 family members (default so everyone sees the whole family) */
  const [viewScope, setViewScope] = useState<'all' | string>('all');

  const today = useMemo(() => getToday(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
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

  // Always compute full family member breakdown in the active period
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

  // Dedicated Today's Daily Category Breakdown (Phân loại chi tiêu hằng ngày)
  const todayTxs = useMemo(
    () => scopedTransactions.filter((tx) => tx.date === todayKey && tx.type === 'expense'),
    [scopedTransactions, todayKey],
  );

  const todayCategoryBreakdown = useMemo(
    () => aggregateByCategory(todayTxs, state.categories, 'expense'),
    [todayTxs, state.categories],
  );

  const todayExpenseTotal = useMemo(
    () => todayTxs.reduce((s, t) => s + t.amount, 0),
    [todayTxs],
  );

  const miniTrendMode: 'day' | 'week' | 'month' =
    timeframe === 'day' || timeframe === 'week'
      ? 'day'
      : timeframe === 'month'
        ? 'week'
        : 'month';

  const miniTrendBuckets = useMemo(
    () => buildTrendSeries(scopedTransactions, miniTrendMode, anchorDate),
    [scopedTransactions, miniTrendMode, anchorDate],
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
    <div className="space-y-5">
      {/* Shared 4-Member Family Bar: Every member sees the whole family's expenses */}
      <section className="card-surface rounded-3xl p-3.5 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
              style={{ backgroundColor: activeMember.color }}
            >
              <DynamicIcon name={activeMember.icon} size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Xin chào, {activeMember.name}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  <Eye size={10} />
                  {viewScope === 'all'
                    ? `Xem chung cả ${state.members.length} thành viên`
                    : `Đang lọc: ${viewingMemberObj?.name}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Chạm tên thành viên để đổi người dùng • Ai cũng xem được tổng chi tiêu cả nhà
              </p>
            </div>
          </div>

          {/* 4-Member Profile Switcher Pills (2x2 clean grid on mobile so all 4 are visible at once) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
            {state.members.map((m) => {
              const isMe = m.id === activeMember.id;
              return (
                <motion.button
                  key={m.id}
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setActiveMember(m.id)}
                  className={`inline-flex items-center justify-center sm:justify-start gap-1.5 px-2.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isMe
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700 hover:border-slate-300'
                  }`}
                  style={isMe ? { backgroundColor: m.color } : undefined}
                >
                  <DynamicIcon
                    name={m.icon}
                    size={13}
                    style={!isMe ? { color: m.color } : undefined}
                  />
                  <span className="truncate">{m.name}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeframe Segmented Control + Period Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="grid grid-cols-4 p-1 rounded-2xl bg-white dark:bg-[#141923] border border-slate-200/70 dark:border-slate-800 shadow-xs sm:w-72">
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
                className={`relative py-2 rounded-xl text-xs font-bold transition-colors z-10 cursor-pointer ${
                  active
                    ? 'text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="overviewTimeframePill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/25 -z-10"
                  />
                )}
                {tf.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          {!isAtCurrentPeriod && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setAnchorDate(getToday())}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Hiện tại</span>
            </motion.button>
          )}

          <div className="flex items-center gap-1 bg-white dark:bg-[#141923] border border-slate-200/70 dark:border-slate-800 rounded-2xl p-1 shadow-xs flex-1 sm:flex-initial justify-between">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setAnchorDate((d) => shiftAnchorDate(timeframe, d, -1))}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              aria-label="Kỳ trước"
            >
              <ChevronLeft size={17} />
            </motion.button>

            <div className="px-2 text-center">
              <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                {range.label}
              </div>
              <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                {range.subLabel}
              </div>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setAnchorDate((d) => shiftAnchorDate(timeframe, d, 1))}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              aria-label="Kỳ sau"
            >
              <ChevronRight size={17} />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Hero Summary Card */}
      <motion.section
        layout
        className="relative overflow-hidden rounded-[2rem] p-5 sm:p-6 text-white bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 shadow-xl shadow-emerald-600/20"
      >
        <div className="pointer-events-none absolute -top-16 -right-12 w-52 h-52 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-teal-300/20 blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/16 backdrop-blur-md text-[11px] font-semibold">
                <Wallet size={13} />
                <span>
                  {viewScope === 'all'
                    ? `Tổng chi cả gia đình • ${range.shortLabel}`
                    : `Chi tiêu của ${viewingMemberObj?.name} • ${range.shortLabel}`}
                </span>
              </div>

              <div className="mt-2.5 text-3xl sm:text-4xl font-extrabold tracking-tight">
                <AnimatedCurrency value={summary.totalExpense} />
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {summary.expenseDeltaPct !== null && (
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-2xl text-xs font-bold backdrop-blur-md ${
                    summary.expenseDeltaPct <= 0
                      ? 'bg-white/20 text-emerald-50'
                      : 'bg-rose-500/35 text-rose-50 border border-rose-200/30'
                  }`}
                >
                  {summary.expenseDeltaPct <= 0 ? (
                    <TrendingDown size={14} />
                  ) : (
                    <TrendingUp size={14} />
                  )}
                  <span className="tabular-nums">
                    {summary.expenseDeltaPct > 0 ? '+' : ''}
                    {summary.expenseDeltaPct}%
                  </span>
                </div>
              )}

              {viewScope !== 'all' && (
                <button
                  type="button"
                  onClick={() => setViewScope('all')}
                  className="px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-[11px] font-bold backdrop-blur-md cursor-pointer"
                >
                  Xem lại cả nhà
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
            <div className="rounded-2xl bg-white/14 backdrop-blur-md p-3 border border-white/15">
              <div className="flex items-center gap-1 text-[11px] text-emerald-50/85 font-medium">
                <ArrowDownLeft size={13} className="text-emerald-200" />
                <span>Thu nhập</span>
              </div>
              <div className="mt-1 text-sm sm:text-base font-extrabold tabular-nums truncate">
                {formatCompactVND(summary.totalIncome)}
              </div>
            </div>

            <div className="rounded-2xl bg-white/14 backdrop-blur-md p-3 border border-white/15">
              <div className="flex items-center gap-1 text-[11px] text-emerald-50/85 font-medium">
                <PiggyBank size={13} className="text-amber-200" />
                <span>Số dư kỳ</span>
              </div>
              <div className="mt-1 text-sm sm:text-base font-extrabold tabular-nums truncate">
                {summary.netBalance >= 0 ? '+' : ''}
                {formatCompactVND(summary.netBalance)}
              </div>
            </div>

            <div className="rounded-2xl bg-white/14 backdrop-blur-md p-3 border border-white/15">
              <div className="flex items-center gap-1 text-[11px] text-emerald-50/85 font-medium">
                <Clock size={13} className="text-sky-200" />
                <span>TB / ngày</span>
              </div>
              <div className="mt-1 text-sm sm:text-base font-extrabold tabular-nums truncate">
                {formatCompactVND(summary.dailyAverage)}
              </div>
            </div>
          </div>

          {viewScope === 'all' && periodBudget > 0 && (
            <div className="mt-4 pt-3.5 border-t border-white/15">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-emerald-50/90">
                  {timeframe === 'month'
                    ? 'Hạn mức chi tiêu cả gia đình (tháng)'
                    : `Ước tính hạn mức (${range.shortLabel})`}
                </span>
                <span className="font-bold tabular-nums">
                  {Math.round((summary.totalExpense / periodBudget) * 100)}% •{' '}
                  {formatCompactVND(periodBudget)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/20 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${budgetPct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                  className={`h-full rounded-full ${
                    isOverBudget
                      ? 'bg-gradient-to-r from-amber-300 to-rose-400'
                      : budgetPct > 80
                        ? 'bg-gradient-to-r from-amber-200 to-amber-400'
                        : 'bg-gradient-to-r from-emerald-200 to-white'
                  }`}
                />
              </div>
            </div>
          )}
        </div>
      </motion.section>

      {/* Smart Input Action Bar: Receipt OCR Scan + Vietnamese Voice + Manual */}
      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenReceiptScan}
          className="card-surface p-3.5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 text-center sm:text-left hover:border-emerald-400/60 transition-all cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/25">
            <ScanLine size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
              Quét hóa đơn
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">
              Chụp bill OCR
            </div>
          </div>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenVoiceInput}
          className="card-surface p-3.5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 text-center sm:text-left hover:border-violet-400/60 transition-all cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-violet-500/25">
            <Mic size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
              Nhập giọng nói
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">
              Nói tiếng Việt
            </div>
          </div>
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={onQuickAdd}
          className="card-surface p-3.5 rounded-2xl flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 text-center sm:text-left hover:border-sky-400/60 transition-all cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/25">
            <PlusCircle size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
              Ghi nhanh tay
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 line-clamp-1">
              Chọn danh mục
            </div>
          </div>
        </motion.button>
      </section>

      {/* Auto-Aggregated Quick Rollups Strip: Ngày / Tuần / Tháng at a glance */}
      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {(
          [
            {
              id: 'day' as Timeframe,
              title: 'Hôm nay',
              amount: quickRollups.todayExpense,
              sub: `${quickRollups.todayCount} khoản chi`,
              icon: Sparkles,
              accent: 'text-amber-500 bg-amber-500/12',
            },
            {
              id: 'week' as Timeframe,
              title: 'Tuần này',
              amount: quickRollups.weekExpense,
              sub: `${quickRollups.weekCount} khoản chi`,
              icon: CalendarDays,
              accent: 'text-sky-500 bg-sky-500/12',
            },
            {
              id: 'month' as Timeframe,
              title: 'Tháng này',
              amount: quickRollups.monthExpense,
              sub: `${quickRollups.monthCount} khoản chi`,
              icon: BarChart3,
              accent: 'text-emerald-500 bg-emerald-500/12',
            },
          ]
        ).map((card) => {
          const Icon = card.icon;
          const active = timeframe === card.id && isAtCurrentPeriod;
          return (
            <motion.button
              key={card.id}
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setTimeframe(card.id);
                setAnchorDate(getToday());
              }}
              className={`card-surface text-left p-3 sm:p-4 rounded-2xl transition-all cursor-pointer ${
                active
                  ? 'ring-2 ring-emerald-500/70 border-emerald-500/40'
                  : 'hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.accent}`}>
                  <Icon size={16} />
                </div>
                {active && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
              </div>
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {card.title}
              </div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
                {formatCompactVND(card.amount)}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                {card.sub}
              </div>
            </motion.button>
          );
        })}
      </section>

      {/* Main Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Dedicated Daily Categorized Breakdown (Phân loại chi tiêu hằng ngày) */}
          <section className="card-surface rounded-3xl p-5">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Phân loại chi tiêu hôm nay
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Tổng hợp rõ ràng từng nhóm chi trong ngày của cả gia đình
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-amber-500/12 text-amber-700 dark:text-amber-300 text-xs font-extrabold tabular-nums shrink-0">
                {formatVND(todayExpenseTotal)}
              </span>
            </div>

            {todayCategoryBreakdown.length === 0 ? (
              <div className="py-5 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/40">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Hôm nay chưa có khoản chi nào.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {todayCategoryBreakdown.map((item) => {
                  const membersInCat = Array.from(
                    new Set(
                      todayTxs
                        .filter((tx) => tx.categoryId === item.category.id)
                        .map((tx) => memMap.get(tx.memberId)?.name)
                        .filter(Boolean),
                    ),
                  );
                  return (
                    <motion.button
                      key={item.category.id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onNavigateTab('history', item.category.id)}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/85 dark:bg-slate-800/45 hover:bg-slate-100/90 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800 text-left transition-colors cursor-pointer"
                    >
                      <CategoryIconBadge
                        icon={item.category.icon}
                        color={item.category.color}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                            {item.category.name}
                          </span>
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                            {formatCompactVND(item.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[10px] text-slate-400 truncate">
                            {membersInCat.join(', ')} • {item.count} khoản
                          </span>
                          <span
                            className="text-[10px] font-bold tabular-nums shrink-0"
                            style={{ color: item.category.color }}
                          >
                            {Math.round(item.percentage)}%
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Smart Period Category Classification Card */}
          <section className="card-surface rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Phân loại chi tiêu ({range.shortLabel})
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Tự động tổng hợp theo danh mục
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('analytics')}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <span>Chi tiết</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {categoryBreakdown.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
                  <Sparkles size={22} />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Chưa có khoản chi trong kỳ này
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Quét hóa đơn, nói tiếng Việt hoặc bấm + để ghi nhận ngay.
                </p>
                <button
                  type="button"
                  onClick={onQuickAdd}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/25 cursor-pointer"
                >
                  + Thêm giao dịch ngay
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                <div className="sm:col-span-5 flex justify-center">
                  <CategoryDonutChart
                    items={categoryBreakdown}
                    totalAmount={summary.totalExpense}
                    centerLabel={range.shortLabel}
                    onSelectCategory={(catId) => onNavigateTab('history', catId)}
                  />
                </div>

                <div className="sm:col-span-7 space-y-2.5">
                  {categoryBreakdown.slice(0, 5).map((item, index) => (
                    <motion.button
                      key={item.category.id}
                      type="button"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      whileTap={{ scale: 0.985 }}
                      onClick={() => onNavigateTab('history', item.category.id)}
                      className="w-full text-left p-2.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <CategoryIconBadge
                          icon={item.category.icon}
                          color={item.category.color}
                          size="sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                              {item.category.name}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                              {formatVND(item.amount)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(4, item.percentage)}%` }}
                                transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                                className="h-full rounded-full"
                                style={{ backgroundColor: item.category.color }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 tabular-nums w-8 text-right">
                              {Math.round(item.percentage)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 4 Family Members Spending Breakdown — Tap any member to filter dashboard */}
          <section className="card-surface rounded-3xl p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-500/12 text-violet-500 flex items-center justify-center">
                  <Users size={17} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Chi tiêu 4 thành viên ({range.shortLabel})
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Chạm từng người để lọc chi tiết hoặc xem chung cả nhà
                  </p>
                </div>
              </div>

              {viewScope !== 'all' && (
                <button
                  type="button"
                  onClick={() => setViewScope('all')}
                  className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                >
                  Cả nhà
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {memberBreakdown.map((item) => {
                const isFiltered = viewScope === item.member.id;
                return (
                  <motion.button
                    key={item.member.id}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() =>
                      setViewScope((prev) => (prev === item.member.id ? 'all' : item.member.id))
                    }
                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                      isFiltered
                        ? 'bg-white dark:bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/25 shadow-sm'
                        : 'bg-slate-50/90 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{
                          backgroundColor: `${item.member.color}1E`,
                          color: item.member.color,
                        }}
                      >
                        <DynamicIcon name={item.member.icon} size={18} />
                      </div>
                      <span
                        className="text-[11px] font-extrabold tabular-nums"
                        style={{ color: item.member.color }}
                      >
                        {Math.round(item.percentage)}%
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {item.member.name}
                    </div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                      {formatCompactVND(item.amount)}
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${item.percentage}%` }}
                        transition={{ type: 'spring', stiffness: 130, damping: 20 }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.member.color }}
                      />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Auto Trend Preview & Recent Transactions */}
        <div className="lg:col-span-5 space-y-5">
          <section className="card-surface rounded-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {miniTrendMode === 'day'
                    ? 'Chi tiêu 7 ngày tuần này'
                    : miniTrendMode === 'week'
                      ? 'Tổng hợp các tuần trong tháng'
                      : 'Xu hướng 6 tháng gần nhất'}
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Chạm từng cột để xem số liệu chi tiết
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('analytics')}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors cursor-pointer"
                aria-label="Mở phân tích đầy đủ"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>

            <TrendBarChart buckets={miniTrendBuckets} />
          </section>

          <section className="card-surface rounded-3xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Giao dịch gần đây
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Chạm giao dịch để sửa hoặc xem ảnh hóa đơn
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('history')}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                <span>Lịch sử</span>
                <ArrowRight size={14} />
              </button>
            </div>

            {recentTxs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
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
    </div>
  );
};
