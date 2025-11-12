import { UsageRecord } from "./parser";

export interface DateRange {
  start?: Date;
  end?: Date;
}

export interface QuickRangeOption {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

export interface QuickRanges {
  days: QuickRangeOption[];
  months: QuickRangeOption[];
}

export function applyDateRange(records: UsageRecord[], range: DateRange): UsageRecord[] {
  if (!range.start && !range.end) {
    return records;
  }

  const startTime = range.start?.getTime();
  const endTime = range.end?.getTime();

  return records.filter((record) => {
    const recordTime = record.date.getTime();
    if (startTime !== undefined && recordTime < startTime) {
      return false;
    }
    if (endTime !== undefined && recordTime > endTime) {
      return false;
    }
    return true;
  });
}

export function normalizeRange(range: DateRange): DateRange {
  const { start, end } = range;
  if (start && end && start.getTime() > end.getTime()) {
    return { start: end, end: start };
  }
  return range;
}

export function buildQuickRanges(records: UsageRecord[]): QuickRanges {
  const dayMap = new Map<string, QuickRangeOption>();
  const monthMap = new Map<string, QuickRangeOption>();

  records.forEach((record) => {
    const dayKey = formatDateKey(record.date);
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, {
        key: `day-${dayKey}`,
        label: dayKey,
        start: startOfDay(record.date),
        end: endOfDay(record.date),
      });
    }

    const monthKey = formatMonthKey(record.date);
    if (!monthMap.has(monthKey)) {
      const range = monthRange(record.date);
      monthMap.set(monthKey, {
        key: `month-${monthKey}`,
        label: monthKey,
        start: range.start,
        end: range.end,
      });
    }
  });

  const days = Array.from(dayMap.values()).sort((a, b) => b.start.getTime() - a.start.getTime());
  const months = Array.from(monthMap.values()).sort((a, b) => b.start.getTime() - a.start.getTime());

  return { days, months };
}

export function startOfDay(date: Date): Date {
  const instance = new Date(date);
  instance.setHours(0, 0, 0, 0);
  return instance;
}

export function endOfDay(date: Date): Date {
  const instance = new Date(date);
  instance.setHours(23, 59, 59, 999);
  return instance;
}

export function monthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);

  return { start, end };
}

function formatDateKey(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function formatMonthKey(date: Date): string {
  return [date.getFullYear(), pad(date.getMonth() + 1)].join("-");
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

