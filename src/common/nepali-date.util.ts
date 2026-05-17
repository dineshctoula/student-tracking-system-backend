import NepaliDate from 'nepali-date-converter';

const BS_YEAR_THRESHOLD = 2040;

const BS_DATE_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;

export function formatBsDate(value: Date | string | null | undefined): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new NepaliDate(d).format('YYYY-MM-DD');
}

export function formatBsDateLong(value: Date = new Date()): string {
  return new NepaliDate(value).format('dddd, DD MMMM YYYY', 'np');
}

export function formatBsDateForDisplay(
  value: Date | string | null | undefined,
): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new NepaliDate(d).format('DD MMMM YYYY', 'np');
}

export function parseDateInput(value: string): Date {
  const s = value.trim();
  if (!s) {
    throw new Error('Empty date');
  }

  const m = BS_DATE_RE.exec(s);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (year >= BS_YEAR_THRESHOLD) {
      const normalized = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return new NepaliDate(normalized).toJsDate();
    }
    const dt = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (
      dt.getFullYear() !== year ||
      dt.getMonth() !== month - 1 ||
      dt.getDate() !== day
    ) {
      throw new Error(`Invalid date: ${s}`);
    }
    return dt;
  }

  try {
    return new NepaliDate(s).toJsDate();
  } catch {
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) {
      throw new Error(`Invalid date: ${s}`);
    }
    return dt;
  }
}

export function parseDateInputStartOfDay(value: string): Date {
  const d = parseDateInput(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseDateInputEndOfDay(value: string): Date {
  const d = parseDateInput(value);
  d.setHours(23, 59, 59, 999);
  return d;
}
