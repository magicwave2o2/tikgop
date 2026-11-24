import type { PeriodRange, Timeframe } from '../types/finance';

const WEEKDAYS_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

export const WEEKDAYS_SHORT_VI = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), maxDay));
  return target;
}

/** Monday-start week (Vietnamese standard: Thứ 2 -> Chủ Nhật) */
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getEndOfWeek(date: Date): Date {
  return addDays(getStartOfWeek(date), 6);
}

export function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function shiftAnchorDate(timeframe: Timeframe, anchor: Date, delta: number): Date {
  switch (timeframe) {
    case 'day':
      return addDays(anchor, delta);
    case 'week':
      return addDays(anchor, delta * 7);
    case 'month':
      return addMonths(anchor, delta);
    case 'year':
      return new Date(anchor.getFullYear() + delta, anchor.getMonth(), 1);
  }
}

export function getISOWeekNumber(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatDayMonth(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
}

export function formatFullDate(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function getPeriodRange(timeframe: Timeframe, anchor: Date): PeriodRange {
  const today = getToday();
  const todayKey = toDateKey(today);

  if (timeframe === 'day') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    const end = start;
    const prevStart = addDays(start, -1);
    const prevEnd = prevStart;
    const key = toDateKey(start);
    const yesterdayKey = toDateKey(addDays(today, -1));
    const tomorrowKey = toDateKey(addDays(today, 1));

    let label = formatFullDate(start);
    if (key === todayKey) label = 'Hôm nay';
    else if (key === yesterdayKey) label = 'Hôm qua';
    else if (key === tomorrowKey) label = 'Ngày mai';

    return {
      start,
      end,
      prevStart,
      prevEnd,
      label,
      shortLabel: key === todayKey ? 'Hôm nay' : formatDayMonth(start),
      subLabel: `${WEEKDAYS_VI[start.getDay()]}, ${formatFullDate(start)}`,
      daysCount: 1,
    };
  }

  if (timeframe === 'week') {
    const start = getStartOfWeek(anchor);
    const end = getEndOfWeek(anchor);
    const prevStart = addDays(start, -7);
    const prevEnd = addDays(end, -7);
    const currentWeekStart = toDateKey(getStartOfWeek(today));
    const prevWeekStart = toDateKey(addDays(getStartOfWeek(today), -7));
    const startKey = toDateKey(start);

    let label = `Tuần ${getISOWeekNumber(start)}`;
    if (startKey === currentWeekStart) label = 'Tuần này';
    else if (startKey === prevWeekStart) label = 'Tuần trước';

    return {
      start,
      end,
      prevStart,
      prevEnd,
      label,
      shortLabel: label,
      subLabel: `${formatDayMonth(start)} – ${formatDayMonth(end)}/${end.getFullYear()}`,
      daysCount: 7,
    };
  }

  if (timeframe === 'month') {
    const start = getStartOfMonth(anchor);
    const end = getEndOfMonth(anchor);
    const prevAnchor = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
    const prevStart = getStartOfMonth(prevAnchor);
    const prevEnd = getEndOfMonth(prevAnchor);
    const isCurrentMonth =
      start.getFullYear() === today.getFullYear() && start.getMonth() === today.getMonth();

    return {
      start,
      end,
      prevStart,
      prevEnd,
      label: isCurrentMonth
        ? `Tháng ${start.getMonth() + 1} (Hiện tại)`
        : `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`,
      shortLabel: `T${start.getMonth() + 1}/${start.getFullYear()}`,
      subLabel: `${formatDayMonth(start)} – ${formatDayMonth(end)}/${end.getFullYear()}`,
      daysCount: end.getDate(),
    };
  }

  // Year
  const year = anchor.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const prevStart = new Date(year - 1, 0, 1);
  const prevEnd = new Date(year - 1, 11, 31);
  const daysCount = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return {
    start,
    end,
    prevStart,
    prevEnd,
    label: year === today.getFullYear() ? `Năm ${year} (Hiện tại)` : `Năm ${year}`,
    shortLabel: `${year}`,
    subLabel: `01/01/${year} – 31/12/${year}`,
    daysCount,
  };
}

export function formatVietnameseDateHeader(dateKey: string): { title: string; subtitle: string } {
  const date = parseDateKey(dateKey);
  const today = getToday();
  const todayKey = toDateKey(today);
  const yesterdayKey = toDateKey(addDays(today, -1));
  const weekday = WEEKDAYS_VI[date.getDay()];

  if (dateKey === todayKey) {
    return { title: 'Hôm nay', subtitle: `${weekday}, ${formatDayMonth(date)}` };
  }
  if (dateKey === yesterdayKey) {
    return { title: 'Hôm qua', subtitle: `${weekday}, ${formatDayMonth(date)}` };
  }
  return {
    title: `${weekday}, ${formatDayMonth(date)}`,
    subtitle: `${date.getFullYear()}`,
  };
}

export function getMonthCalendarGrid(year: number, month: number): Array<{
  date: Date;
  dateKey: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon=0..Sun=6
  const totalDays = lastDay.getDate();
  const cellsCount = Math.ceil((startWeekday + totalDays) / 7) * 7;
  const startGridDate = addDays(firstDay, -startWeekday);
  const todayKey = toDateKey(getToday());

  const cells = [];
  for (let i = 0; i < cellsCount; i++) {
    const d = addDays(startGridDate, i);
    const key = toDateKey(d);
    cells.push({
      date: d,
      dateKey: key,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: key === todayKey,
    });
  }
  return cells;
}

// Cached singleton formatter: avoids ~100x slower per-call Intl construction on iOS JavaScriptCore
const VI_INT_FORMATTER = new Intl.NumberFormat('vi-VN');

export function formatVND(amount: number, opts?: { showUnit?: boolean; signed?: boolean }): string {
  const showUnit = opts?.showUnit ?? true;
  const absVal = Math.round(Math.abs(amount));
  const formatted = VI_INT_FORMATTER.format(absVal);
  const sign = opts?.signed ? (amount > 0 ? '+' : amount < 0 ? '-' : '') : amount < 0 ? '-' : '';
  return showUnit ? `${sign}${formatted} ₫` : `${sign}${formatted}`;
}

export function formatCompactVND(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs === 0) return '0';
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1).replace('.', ',').replace(',0', '')}tỷ`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return `${sign}${val.toFixed(val >= 10 ? 1 : 2).replace('.', ',').replace(/,?0+$/, '')}tr`;
  }
  if (abs >= 1_000) {
    return `${sign}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${abs}`;
}

export function formatRawAmount(digits: string): string {
  const cleaned = digits.replace(/\D/g, '');
  if (!cleaned) return '';
  return VI_INT_FORMATTER.format(Number(cleaned));
}

export function parseRawAmount(formatted: string): number {
  const cleaned = formatted.replace(/\D/g, '');
  return cleaned ? Number(cleaned) : 0;
}
