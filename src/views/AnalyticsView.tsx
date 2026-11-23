import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  PieChart,
  RotateCcw,
  Users,
} from 'lucide-react';
import { CategoryDonutChart } from '../components/CategoryDonutChart';
import { CategoryIconBadge, DynamicIcon } from '../components/IconRenderer';
import { TrendBarChart } from '../components/TrendBarChart';
import { useFinance } from '../store/useFinanceStore';
import type { TransactionType } from '../types/finance';
import {
  aggregateByCategory,
  aggregateByMember,
  buildTrendSeries,
  filterTransactionsByRange,
  generateSmartInsights,
} from '../utils/analytics';
import {
  addDays,
  addMonths,
  formatCompactVND,
  formatVND,
  getPeriodRange,
  getToday,
  toDateKey,
} from '../utils/format';

interface AnalyticsViewProps {
  onSelectCategoryInHistory: (categoryId: string) => void;
}

type TrendMode = 'day' | 'week' | 'month';

const TONE_STYLES = {
  emerald:
    'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300',
  sky: 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-300',
  violet: 'bg-violet-500/10 border-violet-500/20 text-violet-700 dark:text-violet-300',
};

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  onSelectCategoryInHistory,
}) => {
  const { state } = useFinance();
  const [trendMode, setTrendMode] = useState<TrendMode>('week');
  const [anchorDate, setAnchorDate] = useState<Date>(() => getToday());
  const [showIncome, setShowIncome] = useState(false);
  const [breakdownType, setBreakdownType] = useState<TransactionType>('expense');

  const today = useMemo(() => getToday(), []);

  // Determine the overarching period range corresponding to trendMode
  // day -> shows 7 days of anchor's week
  // week -> shows weeks of anchor's month
  // month -> shows 6 months ending at anchor's month
  const activeTimeframe = trendMode === 'day' ? 'week' : trendMode === 'week' ? 'month' : 'year';
  const periodRange = useMemo(
    () => getPeriodRange(trendMode === 'day' ? 'week' : 'month', anchorDate),
    [trendMode, anchorDate],
  );

  const buckets = useMemo(
    () => buildTrendSeries(state.transactions, trendMode, anchorDate),
    [state.transactions, trendMode, anchorDate],
  );

  const periodTxs = useMemo(() => {
    if (buckets.length === 0) return [];
    const sKey = buckets[0].startDate;
    const eKey = buckets[buckets.length - 1].endDate;
    return state.transactions.filter((tx) => tx.date >= sKey && tx.date <= eKey);
  }, [state.transactions, buckets]);

  const totals = useMemo(() => {
    let expense = 0;
    let income = 0;
    for (const b of buckets) {
      expense += b.expense;
      income += b.income;
    }
    return {
      expense,
      income,
      net: income - expense,
      savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
    };
  }, [buckets]);

  const catBreakdown = useMemo(
    () => aggregateByCategory(periodTxs, state.categories, breakdownType),
    [periodTxs, state.categories, breakdownType],
  );

  const catBreakdownTotal = useMemo(
    () => catBreakdown.reduce((s, i) => s + i.amount, 0),
    [catBreakdown],
  );

  const memberBreakdown = useMemo(
    () => aggregateByMember(periodTxs, state.members, 'expense'),
    [periodTxs, state.members],
  );

  const insights = useMemo(
    () =>
      generateSmartInsights(
        state.transactions,
        state.categories,
        state.members,
        trendMode === 'day' ? 'week' : 'month',
        anchorDate,
        state.settings.monthlyBudget,
      ),
    [state.transactions, state.categories, state.members, trendMode, anchorDate, state.settings.monthlyBudget],
  );

  const shiftPeriod = (delta: number) => {
    if (trendMode === 'day') {
      setAnchorDate((d) => addDays(d, delta * 7));
    } else if (trendMode === 'week') {
      setAnchorDate((d) => addMonths(d, delta));
    } else {
      setAnchorDate((d) => addMonths(d, delta * 6));
    }
  };

  const isCurrentAnchor = useMemo(() => {
    if (trendMode === 'day') {
      return (
        toDateKey(getPeriodRange('week', anchorDate).start) ===
        toDateKey(getPeriodRange('week', today).start)
      );
    }
    return (
      anchorDate.getFullYear() === today.getFullYear() &&
      anchorDate.getMonth() === today.getMonth()
    );
  }, [trendMode, anchorDate, today]);

  const periodHeadline =
    trendMode === 'day'
      ? `Các ngày • ${periodRange.label}`
      : trendMode === 'week'
        ? `Các tuần • Tháng ${anchorDate.getMonth() + 1}/${anchorDate.getFullYear()}`
        : `6 tháng đến T${anchorDate.getMonth() + 1}/${anchorDate.getFullYear()}`;

  // Suppress unused import warning cleanly while keeping period calculation clear
  void activeTimeframe;
  void filterTransactionsByRange;

  const maxBucketExpense = Math.max(1, ...buckets.map((b) => b.expense));

  return (
    <div className="space-y-5">
      {/* Header & Grouping Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Phân tích & Tổng hợp
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Tự động chia tổng chi tiêu theo ngày, tuần, tháng và phân loại thông minh
          </p>
        </div>

        <div className="grid grid-cols-3 p-1 rounded-2xl bg-white dark:bg-[#141923] border border-slate-200/70 dark:border-slate-800 shadow-xs w-full sm:w-72">
          {(
            [
              { id: 'day', label: 'Theo Ngày' },
              { id: 'week', label: 'Theo Tuần' },
              { id: 'month', label: 'Theo Tháng' },
            ] as const
          ).map((m) => {
            const active = trendMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setTrendMode(m.id);
                  setAnchorDate(getToday());
                }}
                className={`relative py-2 rounded-xl text-xs font-bold transition-colors z-10 cursor-pointer ${
                  active ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="analyticsModePill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm -z-10"
                  />
                )}
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Period Navigation & KPI Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 flex items-center justify-between gap-2 card-surface rounded-2xl p-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => shiftPeriod(-1)}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            aria-label="Khoảng trước"
          >
            <ChevronLeft size={18} />
          </motion.button>

          <div className="text-center px-2">
            <div className="text-sm font-extrabold text-slate-900 dark:text-white">
              {periodHeadline}
            </div>
            {!isCurrentAnchor && (
              <button
                type="button"
                onClick={() => setAnchorDate(getToday())}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Về hiện tại</span>
              </button>
            )}
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => shiftPeriod(1)}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
            aria-label="Khoảng sau"
          >
            <ChevronRight size={18} />
          </motion.button>
        </div>

        <div className="lg:col-span-7 grid grid-cols-3 gap-2.5">
          <div className="card-surface rounded-2xl p-3">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-500">
              <ArrowUpRight size={13} />
              <span>Tổng chi</span>
            </div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums mt-1 truncate">
              {formatCompactVND(totals.expense)}
            </div>
          </div>

          <div className="card-surface rounded-2xl p-3">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
              <ArrowDownLeft size={13} />
              <span>Tổng thu</span>
            </div>
            <div className="text-sm sm:text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1 truncate">
              {formatCompactVND(totals.income)}
            </div>
          </div>

          <div className="card-surface rounded-2xl p-3">
            <div className="text-[11px] font-semibold text-slate-400">Tỷ lệ tiết kiệm</div>
            <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
              {totals.income > 0 ? `${totals.savingsRate}%` : '–'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart + Period Breakdown Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 card-surface rounded-3xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {trendMode === 'day'
                  ? 'Biểu đồ chi tiêu từng ngày (T2 – CN)'
                  : trendMode === 'week'
                    ? 'Biểu đồ tổng hợp từng tuần trong tháng'
                    : 'Biểu đồ xu hướng 6 tháng liên tiếp'}
              </h3>
              <p className="text-xs text-slate-400">
                Đường nét đứt thể hiện mức chi tiêu trung bình
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowIncome((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                showIncome
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {showIncome ? 'Đang hiện: Thu & Chi' : 'So sánh Thu & Chi'}
            </button>
          </div>

          <TrendBarChart buckets={buckets} showIncome={showIncome} />
        </section>

        {/* Detailed Auto-Summed Slice Breakdown */}
        <section className="lg:col-span-5 card-surface rounded-3xl p-5">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            Bảng tổng hợp tự động
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            {trendMode === 'day'
              ? 'Tổng chi tiêu cộng dồn theo từng ngày'
              : trendMode === 'week'
                ? 'Tổng chi tiêu chia theo từng tuần'
                : 'Tổng chi tiêu chia theo từng tháng'}
          </p>

          <div className="space-y-2.5">
            {buckets.map((b) => {
              const pct = Math.round((b.expense / maxBucketExpense) * 100);
              return (
                <div
                  key={b.key}
                  className={`p-3 rounded-2xl border transition-colors ${
                    b.isCurrent
                      ? 'bg-emerald-500/8 border-emerald-500/25'
                      : 'bg-slate-50/80 dark:bg-slate-800/45 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {b.label}
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {b.subLabel}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {formatVND(b.expense)}
                      </span>
                      {b.income > 0 && (
                        <span className="ml-2 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{formatCompactVND(b.income)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${b.expense > 0 ? Math.max(4, pct) : 0}%` }}
                        transition={{ type: 'spring', stiffness: 150, damping: 24 }}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                      {b.count} GD
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Smart Family Insights */}
      {insights.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Lightbulb size={15} />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              Nhận xét thông minh cho gia đình
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {insights.map((ins, i) => (
              <motion.div
                key={ins.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`rounded-2xl p-4 border ${TONE_STYLES[ins.tone]}`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/50 shrink-0">
                    <DynamicIcon name={ins.icon} size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold leading-snug">{ins.title}</h4>
                    <p className="text-[11px] opacity-85 mt-1 leading-relaxed">{ins.detail}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Detailed Category Classification & Family Member Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-8 card-surface rounded-3xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center">
                <PieChart size={17} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cơ cấu phân loại chi tiết
                </h3>
                <p className="text-xs text-slate-400">
                  Kèm mức trung bình mỗi lần & theo dõi hạn mức danh mục
                </p>
              </div>
            </div>

            <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              {(['expense', 'income'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBreakdownType(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    breakdownType === t
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t === 'expense' ? 'Chi tiêu' : 'Thu nhập'}
                </button>
              ))}
            </div>
          </div>

          {catBreakdown.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10">
              Chưa có dữ liệu {breakdownType === 'expense' ? 'chi tiêu' : 'thu nhập'} trong khoảng thời gian này.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-5 flex justify-center pt-2">
                <CategoryDonutChart
                  items={catBreakdown}
                  totalAmount={catBreakdownTotal}
                  centerLabel={breakdownType === 'expense' ? 'Tổng chi' : 'Tổng thu'}
                  onSelectCategory={onSelectCategoryInHistory}
                />
              </div>

              <div className="md:col-span-7 space-y-2.5">
                {catBreakdown.map((item) => {
                  const showBudget =
                    breakdownType === 'expense' &&
                    trendMode === 'week' &&
                    item.category.budget &&
                    item.category.budget > 0;
                  const budgetPct = showBudget
                    ? Math.round((item.amount / (item.category.budget || 1)) * 100)
                    : null;

                  return (
                    <button
                      key={item.category.id}
                      type="button"
                      onClick={() => onSelectCategoryInHistory(item.category.id)}
                      className="w-full text-left p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/45 hover:bg-slate-100/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <CategoryIconBadge
                          icon={item.category.icon}
                          color={item.category.color}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {item.category.name}
                            </span>
                            <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                              {formatVND(item.amount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                            <span>
                              {item.count} lần • TB {formatCompactVND(item.avgAmount)}
                            </span>
                            <span className="font-bold tabular-nums" style={{ color: item.category.color }}>
                              {item.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(3, item.percentage)}%` }}
                              transition={{ type: 'spring', stiffness: 150, damping: 24 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: item.category.color }}
                            />
                          </div>
                          {showBudget && budgetPct !== null && (
                            <div className="flex items-center justify-between mt-1.5 text-[10px]">
                              <span className="text-slate-400">
                                Hạn mức tháng: {formatCompactVND(item.category.budget!)}
                              </span>
                              <span
                                className={`font-bold tabular-nums ${
                                  budgetPct > 100
                                    ? 'text-rose-500'
                                    : budgetPct > 80
                                      ? 'text-amber-500'
                                      : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                Đã dùng {budgetPct}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Family Member Split */}
        <section className="lg:col-span-4 card-surface rounded-3xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-xl bg-violet-500/12 text-violet-500 flex items-center justify-center">
              <Users size={17} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Theo thành viên
              </h3>
              <p className="text-xs text-slate-400">Tỷ trọng chi tiêu gia đình</p>
            </div>
          </div>

          <div className="space-y-3">
            {memberBreakdown.map((m) => (
              <div
                key={m.member.id}
                className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/45 border border-slate-100 dark:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${m.member.color}1E`, color: m.member.color }}
                  >
                    <DynamicIcon name={m.member.icon} size={19} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {m.member.name}
                      </span>
                      <span className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {formatCompactVND(m.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                      <span>{m.count} khoản chi</span>
                      <span className="font-bold" style={{ color: m.member.color }}>
                        {Math.round(m.percentage)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${m.percentage}%` }}
                    transition={{ type: 'spring', stiffness: 140, damping: 22 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: m.member.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
