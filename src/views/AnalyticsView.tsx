import React, { memo, useMemo, useState } from 'react';
import {
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

export const AnalyticsView: React.FC<AnalyticsViewProps> = memo(
  ({ onSelectCategoryInHistory }) => {
    const { state } = useFinance();
    const [trendMode, setTrendMode] = useState<TrendMode>('week');
    const [anchorDate, setAnchorDate] = useState<Date>(() => getToday());
    const [showIncome, setShowIncome] = useState(false);
    const [breakdownType, setBreakdownType] = useState<TransactionType>('expense');

    const today = useMemo(() => getToday(), []);

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
      [
        state.transactions,
        state.categories,
        state.members,
        trendMode,
        anchorDate,
        state.settings.monthlyBudget,
      ],
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
        ? periodRange.label
        : trendMode === 'week'
          ? `Tháng ${anchorDate.getMonth() + 1}/${anchorDate.getFullYear()}`
          : `6 tháng → T${anchorDate.getMonth() + 1}/${anchorDate.getFullYear()}`;

    const maxBucketExpense = Math.max(1, ...buckets.map((b) => b.expense));

    return (
      <div className="space-y-4">
        {/* Compact Header & Grouping Switcher */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            Phân tích
          </h2>

          <div className="inline-grid grid-cols-3 p-1 rounded-2xl bg-white dark:bg-[#0b1019] border border-slate-200/70 dark:border-white/[0.08] shadow-xs">
            {(
              [
                { id: 'day', label: 'Ngày' },
                { id: 'week', label: 'Tuần' },
                { id: 'month', label: '6 Tháng' },
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Unified Period Stepper + 3-Metric Strip */}
        <section className="card-surface rounded-3xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => shiftPeriod(-1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-300 active:scale-90 transition-transform duration-100 cursor-pointer"
              aria-label="Khoảng trước"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {periodHeadline}
              </span>
              {!isCurrentAnchor && (
                <button
                  type="button"
                  onClick={() => setAnchorDate(getToday())}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/12 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 cursor-pointer shrink-0"
                >
                  <RotateCcw size={10} />
                  <span>Hiện tại</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => shiftPeriod(1)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-300 active:scale-90 transition-transform duration-100 cursor-pointer"
              aria-label="Khoảng sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-white/[0.07] rounded-2xl bg-slate-50/90 dark:bg-[#0b1019] dark:border dark:border-white/[0.06] py-2.5">
            <div className="px-2.5 text-center">
              <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">Chi</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5 truncate">
                {formatCompactVND(totals.expense)}
              </div>
            </div>
            <div className="px-2.5 text-center">
              <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Thu</div>
              <div className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 truncate">
                {formatCompactVND(totals.income)}
              </div>
            </div>
            <div className="px-2.5 text-center">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tiết kiệm</div>
              <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {totals.income > 0 ? `${totals.savingsRate}%` : '–'}
              </div>
            </div>
          </div>
        </section>

        {/* Main Chart + Period Breakdown Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-7 card-surface rounded-3xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                {trendMode === 'day'
                  ? 'Biểu đồ T2 – CN'
                  : trendMode === 'week'
                    ? 'Biểu đồ các tuần'
                    : 'Xu hướng 6 tháng'}
              </h3>

              <button
                type="button"
                onClick={() => setShowIncome((v) => !v)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                  showIncome
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                }`}
              >
                {showIncome ? 'Thu & Chi' : '+ So sánh Thu'}
              </button>
            </div>

            <TrendBarChart buckets={buckets} showIncome={showIncome} />
          </section>

          {/* Detailed Auto-Summed Slice Breakdown */}
          <section className="lg:col-span-5 card-surface rounded-3xl p-4 sm:p-5">
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mb-3">
              Chi tiết từng kỳ
            </h3>

            <div className="space-y-2">
              {buckets.map((b) => {
                const ratio = b.expense > 0 ? Math.max(0.04, b.expense / maxBucketExpense) : 0;
                return (
                  <div
                    key={b.key}
                    className={`px-3 py-2.5 rounded-2xl border transition-colors ${
                      b.isCurrent
                        ? 'bg-emerald-500/8 dark:bg-emerald-500/12 border-emerald-500/25 dark:border-emerald-400/30'
                        : 'bg-slate-50/80 dark:bg-white/[0.03] border-transparent dark:border-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          {b.label}
                        </span>
                        <span className="text-[10px] text-slate-400 tabular-nums truncate">
                          {b.subLabel}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {formatVND(b.expense)}
                        </span>
                        {b.income > 0 && (
                          <span className="ml-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            +{formatCompactVND(b.income)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden">
                        <div
                          className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 origin-left transition-transform duration-300 ease-out"
                          style={{ transform: `scaleX(${ratio})` }}
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
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Lightbulb size={15} className="text-amber-500" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Nhận xét nhanh
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {insights.map((ins) => (
                <div
                  key={ins.id}
                  className={`rounded-2xl p-3.5 border ${TONE_STYLES[ins.tone]}`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-xl bg-white/70 dark:bg-slate-900/50 shrink-0">
                      <DynamicIcon name={ins.icon} size={16} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold leading-snug">{ins.title}</h4>
                      <p className="text-[11px] opacity-85 mt-0.5 leading-relaxed">{ins.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Detailed Category Classification & Family Member Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <section className="lg:col-span-8 card-surface rounded-3xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center">
                  <PieChart size={15} />
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  Phân loại
                </h3>
              </div>

              <div className="flex p-0.5 rounded-xl bg-slate-100 dark:bg-[#0b1019] dark:border dark:border-white/[0.06]">
                {(['expense', 'income'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBreakdownType(t)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      breakdownType === t
                        ? 'bg-white dark:bg-[#1a2335] text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {t === 'expense' ? 'Chi' : 'Thu'}
                  </button>
                ))}
              </div>
            </div>

            {catBreakdown.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">
                Chưa có dữ liệu trong khoảng này.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                <div className="md:col-span-5 flex justify-center">
                  <CategoryDonutChart
                    items={catBreakdown}
                    totalAmount={catBreakdownTotal}
                    centerLabel={breakdownType === 'expense' ? 'Tổng chi' : 'Tổng thu'}
                    onSelectCategory={onSelectCategoryInHistory}
                  />
                </div>

                <div className="md:col-span-7 space-y-2">
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
                        className="w-full text-left p-2.5 rounded-2xl bg-slate-50/70 dark:bg-white/[0.03] border border-transparent dark:border-white/[0.05] hover:bg-slate-100/80 dark:hover:bg-white/[0.06] active:scale-[0.99] transition-transform duration-100 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <CategoryIconBadge
                            icon={item.category.icon}
                            color={item.category.color}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                                {item.category.name}
                              </span>
                              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0">
                                {formatVND(item.amount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-0.5">
                              <span>
                                {item.count} lần • TB {formatCompactVND(item.avgAmount)}
                              </span>
                              <span
                                className="font-bold tabular-nums dark:brightness-125"
                                style={{ color: item.category.color }}
                              >
                                {item.percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden">
                              <div
                                className="h-full w-full rounded-full origin-left transition-transform duration-300 ease-out"
                                style={{
                                  transform: `scaleX(${Math.max(0.03, item.percentage / 100)})`,
                                  backgroundColor: item.category.color,
                                }}
                              />
                            </div>
                            {showBudget && budgetPct !== null && (
                              <div className="flex items-center justify-between mt-1 text-[10px]">
                                <span className="text-slate-400">
                                  Hạn mức: {formatCompactVND(item.category.budget!)}
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
                                  {budgetPct}%
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
          <section className="lg:col-span-4 card-surface rounded-3xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3.5">
              <div className="w-7 h-7 rounded-xl bg-violet-500/12 text-violet-500 flex items-center justify-center">
                <Users size={15} />
              </div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                Thành viên
              </h3>
            </div>

            <div className="space-y-2.5">
              {memberBreakdown.map((m) => (
                <div
                  key={m.member.id}
                  className="p-3 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100/80 dark:border-white/[0.05]"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 dark:brightness-115"
                      style={{ backgroundColor: `${m.member.color}20`, color: m.member.color }}
                    >
                      <DynamicIcon name={m.member.icon} size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {m.member.name}
                        </span>
                        <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
                          {formatCompactVND(m.amount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{m.count} khoản</span>
                        <span
                          className="font-bold tabular-nums dark:brightness-125"
                          style={{ color: m.member.color }}
                        >
                          {Math.round(m.percentage)}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200/70 dark:bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full w-full rounded-full origin-left transition-transform duration-300 ease-out"
                      style={{
                        transform: `scaleX(${Math.min(1, m.percentage / 100)})`,
                        backgroundColor: m.member.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  },
);
