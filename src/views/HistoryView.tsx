import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Plus,
  Search,
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

export const HistoryView: React.FC<HistoryViewProps> = ({
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

  // Search & filter states
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [visibleGroupsCount, setVisibleGroupsCount] = useState<number>(15);

  useEffect(() => {
    setVisibleGroupsCount(15);
  }, [query, typeFilter, categoryFilter, memberFilter]);

  useEffect(() => {
    if (initialCategoryFilter) {
      setCategoryFilter(initialCategoryFilter);
      setMode('list');
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

  // Calendar grid & daily totals map
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

  // Filtered full list
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

  const hasActiveFilters =
    query.trim() !== '' ||
    typeFilter !== 'all' ||
    categoryFilter !== 'all' ||
    memberFilter !== 'all';

  return (
    <div className="space-y-5">
      {/* Top Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Lịch sử & Ngày tháng
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Tra cứu chi tiêu từng ngày hoặc lọc theo danh mục & thành viên
          </p>
        </div>

        <div className="grid grid-cols-2 p-1 rounded-2xl bg-white dark:bg-[#141923] border border-slate-200/70 dark:border-slate-800 shadow-xs w-full sm:w-64">
          {(
            [
              { id: 'calendar', label: 'Lịch tháng', icon: CalendarIcon },
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
                className={`relative flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-colors z-10 cursor-pointer ${
                  active ? 'text-white' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="historyModePill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm -z-10"
                  />
                )}
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'calendar' ? (
          <motion.div
            key="calendar-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Interactive Month Calendar */}
            <section className="lg:col-span-7 card-surface rounded-3xl p-4 sm:p-5">
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => shiftMonth(-1)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 transition-colors cursor-pointer"
                    aria-label="Tháng trước"
                  >
                    <ChevronLeft size={17} />
                  </motion.button>
                  <div className="px-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Tháng {calMonth + 1}, {calYear}
                    </h3>
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.9 }}
                    onClick={() => shiftMonth(1)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-600 transition-colors cursor-pointer"
                    aria-label="Tháng sau"
                  >
                    <ChevronRight size={17} />
                  </motion.button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCalYear(today.getFullYear());
                    setCalMonth(today.getMonth());
                    setSelectedDateKey(toDateKey(today));
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                >
                  Hôm nay
                </button>
              </div>

              {/* Month summary strip */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="px-3.5 py-2.5 rounded-2xl bg-rose-500/8 border border-rose-500/15 flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    Tổng chi tháng
                  </span>
                  <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatCompactVND(monthTotals.expense)}
                  </span>
                </div>
                <div className="px-3.5 py-2.5 rounded-2xl bg-emerald-500/8 border border-emerald-500/15 flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Tổng thu tháng
                  </span>
                  <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatCompactVND(monthTotals.income)}
                  </span>
                </div>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {WEEKDAYS_SHORT_VI.map((dayName, idx) => (
                  <div
                    key={dayName}
                    className={`text-center text-[11px] font-bold py-1 ${
                      idx >= 5 ? 'text-rose-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {calendarCells.map((cell) => {
                  const data = dailyMap.get(cell.dateKey);
                  const isSelected = cell.dateKey === selectedDateKey;
                  const intensity = data?.expense
                    ? Math.min(1, data.expense / maxDayExpense)
                    : 0;

                  return (
                    <motion.button
                      key={cell.dateKey}
                      type="button"
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        setSelectedDateKey(cell.dateKey);
                        if (!cell.inMonth) {
                          setCalYear(cell.date.getFullYear());
                          setCalMonth(cell.date.getMonth());
                        }
                      }}
                      className={`relative min-h-[54px] sm:min-h-[62px] p-1.5 rounded-2xl flex flex-col items-center justify-between transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30'
                          : cell.isToday
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                            : cell.inMonth
                              ? 'bg-slate-50/70 dark:bg-slate-800/45 border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-800 dark:text-slate-200'
                              : 'bg-transparent border-transparent text-slate-300 dark:text-slate-700'
                      }`}
                    >
                      <span
                        className={`text-xs font-bold tabular-nums leading-none ${
                          isSelected ? 'text-white' : ''
                        }`}
                      >
                        {cell.day}
                      </span>

                      <div className="w-full flex flex-col items-center gap-0.5 mt-1">
                        {data && data.expense > 0 && (
                          <span
                            className={`text-[9px] sm:text-[10px] font-bold tabular-nums leading-none truncate max-w-full ${
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
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* Selected Day Detail Panel */}
            <section className="lg:col-span-5 card-surface rounded-3xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Chi tiết ngày đã chọn
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">
                    {selectedHeader.title}
                  </h3>
                  <p className="text-xs text-slate-400">{selectedHeader.subtitle}</p>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => onQuickAddForDate(selectedDateKey)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:bg-emerald-600 transition-colors cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Ghi ngày này</span>
                </motion.button>
              </div>

              {/* Selected day totals */}
              <div className="grid grid-cols-2 gap-2.5 my-4">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[11px] font-semibold text-slate-400">Chi trong ngày</span>
                  <div className="text-sm font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {formatVND(selectedDayTotals.expense)}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-[11px] font-semibold text-slate-400">Thu trong ngày</span>
                  <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
                    +{formatVND(selectedDayTotals.income)}
                  </div>
                </div>
              </div>

              {/* Transactions for selected date */}
              <div className="flex-1">
                {selectedDayTxs.length === 0 ? (
                  <div className="py-10 text-center">
                    <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-2.5">
                      <CalendarIcon size={20} />
                    </div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      Không có giao dịch ngày này
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Một ngày tiết kiệm trọn vẹn!
                    </p>
                  </div>
                ) : (
                  <div className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800/70">
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
          </motion.div>
        ) : (
          <motion.div
            key="list-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
          >
            {/* Search & Filters Card */}
            <section className="card-surface rounded-3xl p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1 flex items-center">
                  <Search size={16} className="absolute left-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Tìm ghi chú, danh mục, thành viên, ngày (vd: 2026-11)..."
                    className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-3 text-slate-400 hover:text-slate-600"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Type filter pills */}
                <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80 shrink-0">
                  {(
                    [
                      { id: 'all', label: 'Tất cả' },
                      { id: 'expense', label: 'Chi tiêu' },
                      { id: 'income', label: 'Thu nhập' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTypeFilter(opt.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        typeFilter === opt.id
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Icon Category Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                      : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                  }`}
                >
                  Mọi danh mục
                </button>
                {state.categories.map((cat) => {
                  const active = categoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(active ? 'all' : cat.id)}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        active
                          ? 'text-white border-transparent shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/70 dark:border-slate-700'
                      }`}
                      style={active ? { backgroundColor: cat.color } : undefined}
                    >
                      <DynamicIcon
                        name={cat.icon}
                        size={13}
                        style={!active ? { color: cat.color } : undefined}
                      />
                      <span>{cat.shortName}</span>
                    </button>
                  );
                })}
              </div>

              {/* Member filter & Filtered totals strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMemberFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      memberFilter === 'all'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-400 hover:text-slate-600'
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
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
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
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer"
                    >
                      Xóa bộ lọc
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs font-bold tabular-nums">
                  <span className="text-slate-400">{filteredTransactions.length} mục</span>
                  <span className="text-rose-500">-{formatCompactVND(filteredSummary.expense)}</span>
                  <span className="text-emerald-500">+{formatCompactVND(filteredSummary.income)}</span>
                </div>
              </div>
            </section>

            {/* Chronological Date-Grouped Feed */}
            {groupedList.length === 0 ? (
              <div className="card-surface rounded-3xl py-12 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
                  <Search size={22} />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Không tìm thấy giao dịch phù hợp
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {groupedList.slice(0, visibleGroupsCount).map((group) => (
                  <section key={group.dateKey} className="card-surface rounded-3xl p-4">
                    {/* Auto-subtotal Date Header */}
                    <div className="flex items-center justify-between pb-2.5 mb-1 border-b border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-baseline gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
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

                    <div className="-mx-2 divide-y divide-slate-100 dark:divide-slate-800/70">
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
                    className="w-full py-3 rounded-2xl card-surface text-xs font-extrabold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/8 transition-colors cursor-pointer"
                  >
                    Xem thêm {groupedList.length - visibleGroupsCount} ngày cũ hơn
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
