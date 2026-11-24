import type {
  Category,
  CategoryBreakdownItem,
  DateGroup,
  FamilyMember,
  MemberBreakdownItem,
  SmartInsight,
  Timeframe,
  Transaction,
  TransactionType,
  TrendBucket,
} from '../types/finance';
import {
  WEEKDAYS_SHORT_VI,
  addDays,
  formatCompactVND,
  formatDayMonth,
  formatVND,
  formatVietnameseDateHeader,
  getEndOfMonth,
  getEndOfWeek,
  getPeriodRange,
  getStartOfMonth,
  getStartOfWeek,
  getToday,
  pad2,
  parseDateKey,
  toDateKey,
} from './format';

export function filterTransactionsByRange(
  transactions: Transaction[],
  start: Date,
  end: Date,
): Transaction[] {
  const startKey = toDateKey(start);
  const endKey = toDateKey(end);
  return transactions.filter((tx) => tx.date >= startKey && tx.date <= endKey);
}

export interface PeriodSummary {
  totalExpense: number;
  totalIncome: number;
  netBalance: number;
  savingsRate: number;
  prevExpense: number;
  prevIncome: number;
  expenseDeltaPct: number | null;
  dailyAverage: number;
  transactionCount: number;
  expenseCount: number;
  incomeCount: number;
}

export function computePeriodSummary(
  transactions: Transaction[],
  timeframe: Timeframe,
  anchor: Date,
): PeriodSummary {
  const range = getPeriodRange(timeframe, anchor);
  const currentTxs = filterTransactionsByRange(transactions, range.start, range.end);
  const prevTxs = filterTransactionsByRange(transactions, range.prevStart, range.prevEnd);

  let totalExpense = 0;
  let totalIncome = 0;
  let expenseCount = 0;
  let incomeCount = 0;

  for (const tx of currentTxs) {
    if (tx.type === 'expense') {
      totalExpense += tx.amount;
      expenseCount++;
    } else {
      totalIncome += tx.amount;
      incomeCount++;
    }
  }

  let prevExpense = 0;
  let prevIncome = 0;
  for (const tx of prevTxs) {
    if (tx.type === 'expense') prevExpense += tx.amount;
    else prevIncome += tx.amount;
  }

  const expenseDeltaPct =
    prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : null;

  // Smart elapsed-days divisor for current period so average/day reflects actual spending pace
  const today = getToday();
  let effectiveDays = range.daysCount;
  if (toDateKey(today) >= toDateKey(range.start) && toDateKey(today) <= toDateKey(range.end)) {
    effectiveDays = Math.max(
      1,
      Math.round((today.getTime() - range.start.getTime()) / 86400000) + 1,
    );
  }

  const netBalance = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  return {
    totalExpense,
    totalIncome,
    netBalance,
    savingsRate,
    prevExpense,
    prevIncome,
    expenseDeltaPct,
    dailyAverage: Math.round(totalExpense / Math.max(1, effectiveDays)),
    transactionCount: currentTxs.length,
    expenseCount,
    incomeCount,
  };
}

export interface QuickRollups {
  todayExpense: number;
  todayCount: number;
  weekExpense: number;
  weekCount: number;
  weekDeltaPct: number | null;
  monthExpense: number;
  monthIncome: number;
  monthCount: number;
  monthDeltaPct: number | null;
  yearExpense: number;
}

export function computeQuickRollups(transactions: Transaction[]): QuickRollups {
  const today = getToday();
  const todayKey = toDateKey(today);
  const weekStartKey = toDateKey(getStartOfWeek(today));
  const weekEndKey = toDateKey(getEndOfWeek(today));
  const prevWeekStartKey = toDateKey(addDays(getStartOfWeek(today), -7));
  const prevWeekEndKey = toDateKey(addDays(getEndOfWeek(today), -7));
  const monthPrefix = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-`;
  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevMonthPrefix = `${prevMonthDate.getFullYear()}-${pad2(prevMonthDate.getMonth() + 1)}-`;
  const yearPrefix = `${today.getFullYear()}-`;

  let todayExpense = 0;
  let todayCount = 0;
  let weekExpense = 0;
  let weekCount = 0;
  let prevWeekExpense = 0;
  let monthExpense = 0;
  let monthIncome = 0;
  let monthCount = 0;
  let prevMonthExpense = 0;
  let yearExpense = 0;

  for (const tx of transactions) {
    const d = tx.date;
    const isExp = tx.type === 'expense';

    if (isExp) {
      if (d === todayKey) {
        todayExpense += tx.amount;
        todayCount++;
      }
      if (d >= weekStartKey && d <= weekEndKey) {
        weekExpense += tx.amount;
        weekCount++;
      } else if (d >= prevWeekStartKey && d <= prevWeekEndKey) {
        prevWeekExpense += tx.amount;
      }
      if (d.startsWith(monthPrefix)) {
        monthExpense += tx.amount;
        monthCount++;
      } else if (d.startsWith(prevMonthPrefix)) {
        prevMonthExpense += tx.amount;
      }
      if (d.startsWith(yearPrefix)) {
        yearExpense += tx.amount;
      }
    } else if (d.startsWith(monthPrefix)) {
      monthIncome += tx.amount;
    }
  }

  return {
    todayExpense,
    todayCount,
    weekExpense,
    weekCount,
    weekDeltaPct:
      prevWeekExpense > 0
        ? Math.round(((weekExpense - prevWeekExpense) / prevWeekExpense) * 100)
        : null,
    monthExpense,
    monthIncome,
    monthCount,
    monthDeltaPct:
      prevMonthExpense > 0
        ? Math.round(((monthExpense - prevMonthExpense) / prevMonthExpense) * 100)
        : null,
    yearExpense,
  };
}

export function aggregateByCategory(
  transactions: Transaction[],
  categories: Category[],
  type: TransactionType = 'expense',
): CategoryBreakdownItem[] {
  const filtered = transactions.filter((tx) => tx.type === type);
  const total = filtered.reduce((acc, tx) => acc + tx.amount, 0);

  const map = new Map<string, { amount: number; count: number }>();
  for (const tx of filtered) {
    const prev = map.get(tx.categoryId) || { amount: 0, count: 0 };
    prev.amount += tx.amount;
    prev.count += 1;
    map.set(tx.categoryId, prev);
  }

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const items: CategoryBreakdownItem[] = [];

  for (const [catId, stats] of map.entries()) {
    const category = catMap.get(catId) ?? {
      id: catId,
      name: 'Danh mục khác',
      shortName: 'Khác',
      type,
      icon: 'MoreHorizontal' as const,
      color: '#64748B',
    };
    items.push({
      category,
      amount: stats.amount,
      count: stats.count,
      percentage: total > 0 ? (stats.amount / total) * 100 : 0,
      avgAmount: Math.round(stats.amount / Math.max(1, stats.count)),
      budgetRatio: category.budget && category.budget > 0 ? stats.amount / category.budget : null,
    });
  }

  return items.sort((a, b) => b.amount - a.amount);
}

export function aggregateByMember(
  transactions: Transaction[],
  members: FamilyMember[],
  type: TransactionType = 'expense',
): MemberBreakdownItem[] {
  const filtered = transactions.filter((tx) => tx.type === type);
  const total = filtered.reduce((acc, tx) => acc + tx.amount, 0);

  const map = new Map<string, { amount: number; count: number }>();
  for (const tx of filtered) {
    const prev = map.get(tx.memberId) || { amount: 0, count: 0 };
    prev.amount += tx.amount;
    prev.count += 1;
    map.set(tx.memberId, prev);
  }

  return members
    .map((member) => {
      const stats = map.get(member.id) || { amount: 0, count: 0 };
      return {
        member,
        amount: stats.amount,
        count: stats.count,
        percentage: total > 0 ? (stats.amount / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function groupTransactionsByDate(transactions: Transaction[]): DateGroup[] {
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.time !== b.time) return b.time.localeCompare(a.time);
    return b.createdAt - a.createdAt;
  });

  const groups = new Map<string, DateGroup>();
  for (const tx of sorted) {
    let group = groups.get(tx.date);
    if (!group) {
      const header = formatVietnameseDateHeader(tx.date);
      group = {
        dateKey: tx.date,
        title: header.title,
        subtitle: header.subtitle,
        totalExpense: 0,
        totalIncome: 0,
        items: [],
      };
      groups.set(tx.date, group);
    }
    group.items.push(tx);
    if (tx.type === 'expense') group.totalExpense += tx.amount;
    else group.totalIncome += tx.amount;
  }

  return Array.from(groups.values());
}

export function buildDailyMapForMonth(
  transactions: Transaction[],
  year: number,
  month: number,
): Map<string, { expense: number; income: number; count: number }> {
  const prefix = `${year}-${pad2(month + 1)}-`;
  const map = new Map<string, { expense: number; income: number; count: number }>();

  for (const tx of transactions) {
    if (!tx.date.startsWith(prefix)) continue;
    const entry = map.get(tx.date) || { expense: 0, income: 0, count: 0 };
    if (tx.type === 'expense') entry.expense += tx.amount;
    else entry.income += tx.amount;
    entry.count += 1;
    map.set(tx.date, entry);
  }

  return map;
}

/**
 * Single-pass O(N) aggregator into Day (Mon-Sun), Week (Weeks of Month),
 * or Month (Last 6 months) series for silky-smooth chart performance even with thousands of entries.
 */
export function buildTrendSeries(
  transactions: Transaction[],
  mode: 'day' | 'week' | 'month',
  anchor: Date,
): TrendBucket[] {
  const today = getToday();
  const todayKey = toDateKey(today);

  if (mode === 'day') {
    const start = getStartOfWeek(anchor);
    const buckets: TrendBucket[] = [];
    const byKey = new Map<string, TrendBucket>();
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const key = toDateKey(d);
      const bucket: TrendBucket = {
        key,
        label: WEEKDAYS_SHORT_VI[i],
        subLabel: formatDayMonth(d),
        expense: 0,
        income: 0,
        count: 0,
        isCurrent: key === todayKey,
        startDate: key,
        endDate: key,
      };
      buckets.push(bucket);
      byKey.set(key, bucket);
    }
    for (const tx of transactions) {
      const b = byKey.get(tx.date);
      if (!b) continue;
      if (tx.type === 'expense') b.expense += tx.amount;
      else b.income += tx.amount;
      b.count += 1;
    }
    return buckets;
  }

  if (mode === 'week') {
    const monthStart = getStartOfMonth(anchor);
    const monthEnd = getEndOfMonth(anchor);
    const monthStartKey = toDateKey(monthStart);
    const monthEndKey = toDateKey(monthEnd);
    const buckets: TrendBucket[] = [];

    let cursor = new Date(monthStart);
    let weekIndex = 1;
    while (cursor <= monthEnd) {
      const weekEndCandidate = getEndOfWeek(cursor);
      const sliceStart = new Date(cursor);
      const sliceEnd = weekEndCandidate > monthEnd ? new Date(monthEnd) : weekEndCandidate;
      const sKey = toDateKey(sliceStart);
      const eKey = toDateKey(sliceEnd);

      buckets.push({
        key: `${sKey}_${eKey}`,
        label: `Tuần ${weekIndex}`,
        subLabel: `${pad2(sliceStart.getDate())}–${pad2(sliceEnd.getDate())}/${pad2(sliceEnd.getMonth() + 1)}`,
        expense: 0,
        income: 0,
        count: 0,
        isCurrent: todayKey >= sKey && todayKey <= eKey,
        startDate: sKey,
        endDate: eKey,
      });

      cursor = addDays(sliceEnd, 1);
      weekIndex++;
    }

    for (const tx of transactions) {
      if (tx.date < monthStartKey || tx.date > monthEndKey) continue;
      const b = buckets.find((w) => tx.date >= w.startDate && tx.date <= w.endDate);
      if (!b) continue;
      if (tx.type === 'expense') b.expense += tx.amount;
      else b.income += tx.amount;
      b.count += 1;
    }
    return buckets;
  }

  // Month mode: 6 months ending at anchor's month
  const buckets: TrendBucket[] = [];
  const byMonthKey = new Map<string, TrendBucket>();
  for (let i = 5; i >= 0; i--) {
    const mDate = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    const mStart = getStartOfMonth(mDate);
    const mEnd = getEndOfMonth(mDate);
    const sKey = toDateKey(mStart);
    const eKey = toDateKey(mEnd);
    const mKey = `${mDate.getFullYear()}-${pad2(mDate.getMonth() + 1)}`;
    const isCurrent =
      mDate.getFullYear() === today.getFullYear() && mDate.getMonth() === today.getMonth();

    const bucket: TrendBucket = {
      key: mKey,
      label: `T${mDate.getMonth() + 1}`,
      subLabel: `Tháng ${mDate.getMonth() + 1}/${mDate.getFullYear()}`,
      expense: 0,
      income: 0,
      count: 0,
      isCurrent,
      startDate: sKey,
      endDate: eKey,
    };
    buckets.push(bucket);
    byMonthKey.set(mKey, bucket);
  }

  for (const tx of transactions) {
    const b = byMonthKey.get(tx.date.slice(0, 7));
    if (!b) continue;
    if (tx.type === 'expense') b.expense += tx.amount;
    else b.income += tx.amount;
    b.count += 1;
  }
  return buckets;
}

export function generateSmartInsights(
  transactions: Transaction[],
  categories: Category[],
  members: FamilyMember[],
  timeframe: Timeframe,
  anchor: Date,
  monthlyBudget: number,
): SmartInsight[] {
  const range = getPeriodRange(timeframe, anchor);
  const periodTxs = filterTransactionsByRange(transactions, range.start, range.end);
  const summary = computePeriodSummary(transactions, timeframe, anchor);
  const catBreakdown = aggregateByCategory(periodTxs, categories, 'expense');
  const memberBreakdown = aggregateByMember(periodTxs, members, 'expense');

  const insights: SmartInsight[] = [];

  // 1. Top category highlight
  if (catBreakdown.length > 0) {
    const top = catBreakdown[0];
    insights.push({
      id: 'top_cat',
      icon: top.category.icon,
      tone: 'amber',
      title: `${top.category.name} chiếm ${Math.round(top.percentage)}% tổng chi`,
      detail: `Tổng ${formatVND(top.amount)} qua ${top.count} giao dịch (TB ${formatCompactVND(top.avgAmount)}/lần).`,
    });
  }

  // 2. Period comparison insight
  if (summary.expenseDeltaPct !== null) {
    const absDelta = Math.abs(summary.expenseDeltaPct);
    const periodWord =
      timeframe === 'day'
        ? 'hôm qua'
        : timeframe === 'week'
          ? 'tuần trước'
          : timeframe === 'month'
            ? 'tháng trước'
            : 'năm trước';

    if (summary.expenseDeltaPct <= -5) {
      insights.push({
        id: 'delta_down',
        icon: 'TrendingUp',
        tone: 'emerald',
        title: `Tiết kiệm hơn ${absDelta}% so với ${periodWord}`,
        detail: `Gia đình đang kiểm soát chi tiêu rất tốt (giảm ${formatCompactVND(summary.prevExpense - summary.totalExpense)}).`,
      });
    } else if (summary.expenseDeltaPct >= 10) {
      insights.push({
        id: 'delta_up',
        icon: 'Zap',
        tone: 'rose',
        title: `Chi tiêu tăng ${absDelta}% so với ${periodWord}`,
        detail: `Tăng thêm ${formatCompactVND(summary.totalExpense - summary.prevExpense)}, nên rà soát lại các khoản lớn.`,
      });
    }
  }

  // 3. Peak spending day in period
  const byDay = new Map<string, number>();
  for (const tx of periodTxs) {
    if (tx.type === 'expense') {
      byDay.set(tx.date, (byDay.get(tx.date) || 0) + tx.amount);
    }
  }
  let peakDate = '';
  let peakAmount = 0;
  for (const [d, amt] of byDay.entries()) {
    if (amt > peakAmount) {
      peakAmount = amt;
      peakDate = d;
    }
  }
  if (peakDate && byDay.size > 1) {
    const d = parseDateKey(peakDate);
    insights.push({
      id: 'peak_day',
      icon: 'Sparkles',
      tone: 'violet',
      title: `Ngày chi cao nhất: ${formatDayMonth(d)} (${formatCompactVND(peakAmount)})`,
      detail: `Trung bình mỗi ngày gia đình chi khoảng ${formatVND(summary.dailyAverage)}.`,
    });
  } else if (timeframe === 'month' && monthlyBudget > 0 && summary.totalExpense > 0) {
    const pct = Math.round((summary.totalExpense / monthlyBudget) * 100);
    insights.push({
      id: 'budget_pace',
      icon: 'PiggyBank',
      tone: pct > 90 ? 'rose' : 'sky',
      title: `Đã dùng ${pct}% ngân sách tháng`,
      detail:
        pct <= 100
          ? `Còn lại ${formatVND(monthlyBudget - summary.totalExpense)} trong hạn mức tháng.`
          : `Đã vượt ngân sách tháng ${formatVND(summary.totalExpense - monthlyBudget)}.`,
    });
  } else if (memberBreakdown.length > 0 && memberBreakdown[0].amount > 0) {
    const topMember = memberBreakdown[0];
    insights.push({
      id: 'top_member',
      icon: topMember.member.icon,
      tone: 'sky',
      title: `${topMember.member.name} ghi nhận ${Math.round(topMember.percentage)}% chi tiêu`,
      detail: `Tổng ${formatVND(topMember.amount)} trong kỳ đang xem.`,
    });
  }

  return insights.slice(0, 3);
}
