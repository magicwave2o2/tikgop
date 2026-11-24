import React, { memo, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { DynamicIcon } from '../components/IconRenderer';
import { TransactionRow } from '../components/TransactionRow';
import { useFinance } from '../store/useFinanceStore';
import type { Transaction, TransactionType } from '../types/finance';
import { buildDailyMapForMonth, groupTransactionsByDate } from '../utils/analytics';
import {
  WEEKDAYS_SHORT_VI,
  formatCompactVND,
  formatVND,
  formatVietnameseDateHeader,
  getMonthCalendarGrid,
  getToday,
  pad2,
  toDateKey,
} from '../utils/format';

interface HistoryViewProps {
  initialCategoryFilter?: string | null;
  onClearInitialCategory?: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onQuickAddForDate: (dateKey: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = memo(
  ({
    initialCategoryFilter,
    onClearInitialCategory,
    onEditTransaction,
    onQuickAddForDate,
  }) => {
    const { state, deleteTransaction } = useFinance();
    const today = useMemo(() => getToday(), []);

    const [mode, setMode] = useState<'calendar' | 'list'>('calendar');
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());
    const [selectedDateKey, setSelectedDateKey] = useState<string>(toDateKey(today));

    // Search & collapsible filter states
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [memberFilter, setMemberFilter] = useState<string>('all');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [visibleGroupsCount, setVisibleGroupsCount] = useState<number>(15);

    useEffect(() => {
      setVisibleGroupsCount(15);
    }, [query, typeFilter, categoryFilter, memberFilter]);

    useEffect(() => {
      if (initialCategoryFilter) {
        setCategoryFilter(initialCategoryFilter);
        setMode('list');
        setFiltersOpen(true);
        onClearInitialCategory?.();
      }
    }, [initialCategoryFilter, onClearInitialCategory]);

    const catMap = useMemo(
      () => new Map(state.categories.map((c) => [c.id, c])),
      [state.categories],
    );
    const memMap = useMemo(
      () => new Map(state.members.map((m) => [m.id, m])),
      [state.members],
    );

    const calendarCells = useMemo(
      () => getMonthCalendarGrid(calYear, calMonth),
      [calYear, calMonth],
    );

    const dailyMap = useMemo(
      () => buildDailyMapForMonth(state.transactions, calYear, calMonth),
      [state.transactions, calYear, calMonth],
    );

    const monthTotals = useMemo(() => {
      let expense = 0;
      let income = 0;
      for (const v of dailyMap.values()) {
        expense += v.expense;
        income += v.income;
      }
      return { expense, income };
    }, [dailyMap]);

    const maxDayExpense = useMemo(() => {
      let max = 0;
      for (const v of dailyMap.values()) {
        if (v.expense > max) max = v.expense;
      }
      return max || 1;
    }, [dailyMap]);

    const selectedDayTxs = useMemo(() => {
      return state.transactions
        .filter((tx) => tx.date === selectedDateKey)
        .sort((a, b) => b.time.localeCompare(a.time) || b.createdAt - a.createdAt);
    }, [state.transactions, selectedDateKey]);

    const selectedDayTotals = useMemo(() => {
      let expense = 0;
      let income = 0;
      for (const tx of selectedDayTxs) {
        if (tx.type === 'expense') expense += tx.amount;
        else income += tx.amount;
      }
      return { expense, income };
    }, [selectedDayTxs]);

    const filteredTransactions = useMemo(() => {
      const q = query.trim().toLowerCase();
      return state.transactions.filter((tx) => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
        if (memberFilter !== 'all' && tx.memberId !== memberFilter) return false;
        if (q) {
          const cat = catMap.get(tx.categoryId)?.name.toLowerCase() || '';
          const mem = memMap.get(tx.memberId)?.name.toLowerCase() || '';
          const note = tx.note.toLowerCase();
          if (!note.includes(q) && !cat.includes(q) && !mem.includes(q) && !tx.date.includes(q)) {
            return false;
          }
        }
        return true;
      });
    }, [state.transactions, typeFilter, categoryFilter, memberFilter, query, catMap, memMap]);

    const groupedList = useMemo(
      () => groupTransactionsByDate(filteredTransactions),
      [filteredTransactions],
    );

    const filteredSummary = useMemo(() => {
      let expense = 0;
      let income = 0;
      for (const tx of filteredTransactions) {
        if (tx.type === 'expense') expense += tx.amount;
        else income += tx.amount;
      }
      return { expense, income };
    }, [filteredTransactions]);

    const shiftMonth = (delta: number) => {
      const next = new Date(calYear, calMonth + delta, 1);
      setCalYear(next.getFullYear());
      setCalMonth(next.getMonth());
      setSelectedDateKey(`${next.getFullYear()}-${pad2(next.getMonth() + 1)}-01`);
    };

    const selectedHeader = formatVietnameseDateHeader(selectedDateKey);

    const extraFilterCount =
      (categoryFilter !== 'all' ? 1 : 0) + (memberFilter !== 'all' ? 1 : 0);

    const hasActiveFilters =
      query.trim() !== '' ||
      typeFilter !== 'all' ||
      categoryFilter !== 'all' ||
      memberFilter !== 'all';

    const activeCategoryObj = categoryFilter !== 'all' ? catMap.get(categoryFilter) : undefined;
    const activeMemberObj = memberFilter !== 'all' ? memMap.get(memberFilter) : undefined;

    return (
      <div className="space-y-4">
        {/* Compact Single-Row Header + Mode Switcher */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            Lịch sử
          </h2>

          <div className="inline-grid grid-cols-2 p-1 rounded-2xl bg-white dark:bg-[#0b1019] border border-slate-200/70 dark:border-white/[0.08] shadow-xs">
            {(
              [
                { id: 'calendar', label: 'Lịch', icon: CalendarIcon },
                { id: 'list', label: 'Danh sách', icon: ListFilter },
              ] as const
            ).map((tab) => {
              const active = mode === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {mode === 'calendar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Interactive Month Heatmap Calendar */}
            <section className="lg:col-span-7 card-surface rounded-3xl p-3.5 sm:p-5">
              {/* Calendar Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => shiftMonth(-1)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-300 active:scale-90 transition-transform duration-100 cursor-pointer"
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <h3 className="px-1.5 text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                    Tháng {calMonth + 1}/{calYear}
                  </h3>
                  <button
                    type="button"
                    onClick={() => shiftMonth(1)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-300 active:scale-90 transition-transform duration-100 cursor-pointer"
                    aria-label="Tháng sau"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-[#0b1019] dark:border dark:border-white/[0.06] text-[11px] font-bold tabular-nums">
                    <span className="text-rose-500 dark:text-rose-400">-{formatCompactVND(monthTotals.expense)}</span>
                    <span className="text-slate-300 dark:text-white/15">|</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      +{formatCompactVND(monthTotals.income)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCalYear(today.getFullYear());
                      setCalMonth(today.getMonth());
                      setSelectedDateKey(toDateKey(today));
                    }}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 active:scale-95 transition-transform duration-100 cursor-pointer"
                  >
                    Hôm nay
                  </button>
                </div>
              </div>

              {/* Mobile compact month summary bar */}
              <div className="sm:hidden grid grid-cols-2 gap-2 mb-3">
                <div className="px-3 py-1.5 rounded-xl bg-rose-500/8 border border-rose-500/12 flex items-center justify-between text-xs">
                  <span className="font-semibold text-rose-500">Chi</span>
                  <span className="font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatCompactVND(monthTotals.expense)}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/12 flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">Thu</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatCompactVND(monthTotals.income)}
                  </span>
                </div>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS_SHORT_VI.map((dayName, idx) => (
                  <div
                    key={dayName}
                    className={`text-center text-[10px] font-bold py-0.5 ${
                      idx >= 5 ? 'text-rose-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Tight Heatmap Calendar Grid — pure CSS buttons (zero Framer Motion instances) */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell) => {
                  const data = dailyMap.get(cell.dateKey);
                  const isSelected = cell.dateKey === selectedDateKey;
                  const intensity = data?.expense
                    ? Math.min(1, data.expense / maxDayExpense)
                    : 0;

                  const cellSurface = isSelected
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30 dark:shadow-emerald-500/25'
                    : cell.isToday
                      ? 'bg-emerald-500/12 dark:bg-emerald-500/16 border-emerald-500/40 dark:border-emerald-400/45 text-emerald-700 dark:text-emerald-300'
                      : !cell.inMonth
                        ? 'bg-transparent border-transparent text-slate-300 dark:text-slate-600'
                        : intensity > 0.65
                          ? 'bg-rose-500/10 dark:bg-rose-500/16 border-rose-500/15 dark:border-rose-400/25 text-slate-900 dark:text-white'
                          : intensity > 0
                            ? 'bg-amber-500/8 dark:bg-amber-400/12 border-transparent dark:border-amber-400/15 text-slate-800 dark:text-slate-100'
                            : 'bg-slate-50/70 dark:bg-white/[0.025] border-transparent dark:border-white/[0.04] hover:border-slate-200 dark:hover:bg-white/[0.06] text-slate-800 dark:text-slate-200';

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(cell.dateKey);
                        if (!cell.inMonth) {
                          setCalYear(cell.date.getFullYear());
                          setCalMonth(cell.date.getMonth());
                        }
                      }}
                      className={`relative min-h-[46px] sm:min-h-[54px] p-1 rounded-xl sm:rounded-2xl flex flex-col items-center justify-between active:scale-92 transition-transform duration-100 cursor-pointer border ${cellSurface}`}
                    >
                      <span className="text-[11px] font-bold tabular-nums leading-none">
                        {cell.day}
                      </span>

                      <div className="w-full flex flex-col items-center gap-0.5">
                        {data && data.expense > 0 && (
                          <span
                            className={`text-[9px] font-bold tabular-nums leading-none truncate max-w-full ${
                              isSelected
                                ? 'text-white'
                                : intensity > 0.65
                                  ? 'text-rose-500 dark:text-rose-400'
                                  : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {formatCompactVND(data.expense)}
                          </span>
                        )}
                        {data && (
                          <div className="flex items-center gap-0.5">
                            {data.expense > 0 && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSelected
                                    ? 'bg-white'
                                    : intensity > 0.65
                                      ? 'bg-rose-500'
                                      : 'bg-amber-400'
                                }`}
                              />
                            )}
                            {data.income > 0 && (
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isSelected ? 'bg-emerald-200' : 'bg-emerald-500'
                                }`}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Selected Day Detail Panel */}
            <section className="lg:col-span-5 card-surface rounded-3xl p-4 sm:p-5 flex flex-col">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.07]">
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                    {selectedHeader.title}
                  </h3>
                  <p className="text-[11px] text-slate-400">{selectedHeader.subtitle}</p>
                </div>

                <button
                  type="button"
                  onClick={() => onQuickAddForDate(selectedDateKey)}
                  className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500 text-white dark:text-slate-950 text-xs font-bold shadow-sm shadow-emerald-500/25 hover:bg-emerald-600 dark:hover:bg-emerald-400 active:scale-95 transition-transform duration-100 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Ghi ngày này</span>
                </button>
              </div>

              {/* Compact inline Chi / Thu bar */}
              <div className="grid grid-cols-2 gap-2 my-3">
                <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1019] dark:border dark:border-white/[0.06] flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-slate-400">Chi</span>
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white tabular-nums truncate">
                    {formatVND(selectedDayTotals.expense)}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#0b1019] dark:border dark:border-white/[0.06] flex items-center justify-between gap-1">
                  <span className="text-[11px] font-semibold text-slate-400">Thu</span>
                  <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                    +{formatVND(selectedDayTotals.income)}
                  </span>
                </div>
              </div>

              {/* Transactions for selected date */}
              <div className="flex-1">
                {selectedDayTxs.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.05] text-slate-400 mx-auto flex items-center justify-center mb-2">
                      <CalendarIcon size={18} />
                    </div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Không có giao dịch ngày này
                    </p>
                  </div>
                ) : (
                  <div className="-mx-2 divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {selectedDayTxs.map((tx) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        category={catMap.get(tx.categoryId)}
                        member={memMap.get(tx.memberId)}
                        onEdit={onEditTransaction}
                        onDelete={deleteTransaction}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Streamlined Compact Search + Collapsible Filter Bar */}
            <section className="card-surface rounded-3xl p-3.5 space-y-2.5 min-w-0 overflow-hidden">
              {/* Row 1: Search Input + Collapsible Filter Toggle */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 flex items-center">
                  <Search size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm ghi chú, danh mục, người..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-[#0b1019] border border-slate-200/70 dark:border-white/[0.08] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400/70"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    filtersOpen || extraFilterCount > 0
                      ? 'bg-emerald-500/12 dark:bg-emerald-500/15 border-emerald-500/35 dark:border-emerald-400/35 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-50 dark:bg-[#0b1019] border-slate-200/70 dark:border-white/[0.08] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  <span>Lọc</span>
                  {extraFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white dark:text-slate-950 text-[10px] font-extrabold inline-flex items-center justify-center">
                      {extraFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Row 2: Type Segmented Pills + Live Filtered Totals */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-100 dark:bg-[#0b1019] dark:border dark:border-white/[0.06]">
                  {(
                    [
                      { id: 'all', label: 'Tất cả' },
                      { id: 'expense', label: 'Chi' },
                      { id: 'income', label: 'Thu' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTypeFilter(opt.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        typeFilter === opt.id
                          ? 'bg-white dark:bg-[#1a2335] text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2.5 text-[11px] font-bold tabular-nums">
                  <span className="text-slate-400">{filteredTransactions.length} mục</span>
                  <span className="text-rose-500">-{formatCompactVND(filteredSummary.expense)}</span>
                  {filteredSummary.income > 0 && (
                    <span className="text-emerald-500">
                      +{formatCompactVND(filteredSummary.income)}
                    </span>
                  )}
                </div>
              </div>

              {/* Dismissible active filter chips when drawer is collapsed */}
              {!filtersOpen && (activeCategoryObj || activeMemberObj) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {activeCategoryObj && (
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('all')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white cursor-pointer"
                      style={{ backgroundColor: activeCategoryObj.color }}
                    >
                      <DynamicIcon name={activeCategoryObj.icon} size={11} />
                      <span>{activeCategoryObj.shortName}</span>
                      <X size={11} />
                    </button>
                  )}
                  {activeMemberObj && (
                    <button
                      type="button"
                      onClick={() => setMemberFilter('all')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white cursor-pointer"
                      style={{ backgroundColor: activeMemberObj.color }}
                    >
                      <DynamicIcon name={activeMemberObj.icon} size={11} />
                      <span>{activeMemberObj.name}</span>
                      <X size={11} />
                    </button>
                  )}
                </div>
              )}

              {/* Collapsible Category + Member Drawer (instant render, zero height:auto layout animation) */}
              {filtersOpen && (
                <div className="pt-2.5 border-t border-slate-100 dark:border-white/[0.07] space-y-2.5 animate-ios-fade">
                  {/* Scrollable Category Strip */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('all')}
                      className={`shrink-0 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer ${
                        categoryFilter === 'all'
                          ? 'bg-slate-900 dark:bg-emerald-500/20 text-white dark:text-emerald-200 border-transparent dark:border-emerald-400/40'
                          : 'bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-white/[0.08]'
                      }`}
                    >
                      Mọi mục
                    </button>
                    {state.categories.map((cat) => {
                      const active = categoryFilter === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryFilter(active ? 'all' : cat.id)}
                          className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-colors cursor-pointer ${
                            active
                              ? 'text-white border-transparent shadow-xs'
                              : 'bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-white/[0.08]'
                          }`}
                          style={active ? { backgroundColor: cat.color } : undefined}
                        >
                          <DynamicIcon
                            name={cat.icon}
                            size={12}
                            style={!active ? { color: cat.color } : undefined}
                          />
                          <span>{cat.shortName}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Member Strip + Reset */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMemberFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        memberFilter === 'all'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                    >
                      Cả nhà
                    </button>
                    {state.members.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMemberFilter(memberFilter === m.id ? 'all' : m.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                          memberFilter === m.id
                            ? 'text-white'
                            : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300'
                        }`}
                        style={memberFilter === m.id ? { backgroundColor: m.color } : undefined}
                      >
                        <DynamicIcon name={m.icon} size={11} />
                        <span>{m.name}</span>
                      </button>
                    ))}

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          setTypeFilter('all');
                          setCategoryFilter('all');
                          setMemberFilter('all');
                        }}
                        className="ml-auto px-2 py-1 rounded-lg text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                      >
                        Đặt lại
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Chronological Date-Grouped Feed — content-visibility:auto skips offscreen layout/paint */}
            {groupedList.length === 0 ? (
              <div className="card-surface rounded-3xl py-10 text-center">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.05] text-slate-400 mx-auto flex items-center justify-center mb-2.5">
                  <Search size={19} />
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Không có giao dịch nào
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedList.slice(0, visibleGroupsCount).map((group) => (
                  <section
                    key={group.dateKey}
                    className="card-surface cv-auto rounded-3xl p-3.5 sm:p-4"
                  >
                    <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 dark:border-white/[0.07]">
                      <div className="flex items-baseline gap-2">
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                          {group.title}
                        </h4>
                        <span className="text-[11px] font-medium text-slate-400">
                          {group.subtitle}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-extrabold tabular-nums">
                        {group.totalIncome > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{formatCompactVND(group.totalIncome)}
                          </span>
                        )}
                        {group.totalExpense > 0 && (
                          <span className="text-rose-500 dark:text-rose-400">
                            -{formatVND(group.totalExpense)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="-mx-2 divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {group.items.map((tx) => (
                        <TransactionRow
                          key={tx.id}
                          transaction={tx}
                          category={catMap.get(tx.categoryId)}
                          member={memMap.get(tx.memberId)}
                          onEdit={onEditTransaction}
                          onDelete={deleteTransaction}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                {groupedList.length > visibleGroupsCount && (
                  <button
                    type="button"
                    onClick={() => setVisibleGroupsCount((n) => n + 20)}
                    className="w-full py-2.5 rounded-2xl card-surface text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/8 transition-colors cursor-pointer"
                  >
                    Xem thêm {groupedList.length - visibleGroupsCount} ngày cũ hơn
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);
