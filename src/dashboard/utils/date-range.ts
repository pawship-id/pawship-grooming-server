export interface DateRange {
  from: Date;
  to: Date;
}

export function toUtcStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function toUtcEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Parse YYYY-MM-DD inputs to a UTC day-bounded range.
 * Falls back to "today" when arguments are missing or invalid.
 */
export function parseRange(from?: string, to?: string): DateRange {
  const parsedFrom = parseYmd(from);
  const parsedTo = parseYmd(to);

  if (parsedFrom && parsedTo) {
    return {
      from: toUtcStartOfDay(parsedFrom),
      to: toUtcEndOfDay(parsedTo),
    };
  }

  const today = new Date();
  return {
    from: toUtcStartOfDay(today),
    to: toUtcEndOfDay(today),
  };
}

export function previousRange(range: DateRange): DateRange {
  const durationMs =
    toUtcStartOfDay(range.to).getTime() -
    toUtcStartOfDay(range.from).getTime() +
    24 * 60 * 60 * 1000; // inclusive day count
  const prevTo = new Date(range.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - (durationMs - 1));
  return {
    from: toUtcStartOfDay(prevFrom),
    to: toUtcEndOfDay(prevTo),
  };
}

function parseYmd(input?: string): Date | null {
  if (!input) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
}
