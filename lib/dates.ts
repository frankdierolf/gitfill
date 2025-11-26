import { format } from "@std/datetime";

/** Format a date as YYYY-MM-DD */
export function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/** Format a date as YYYY-MM-DD HH:mm:ss for git */
export function formatDateTime(date: Date): string {
  return format(date, "yyyy-MM-dd HH:mm:ss");
}

/** Get all dates between start and end (inclusive) */
export function getDateRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/** Get a random time during the day (8am - 11pm) */
export function getRandomTimeOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(
    8 + Math.floor(Math.random() * 16), // 8-23
    Math.floor(Math.random() * 60),
    Math.floor(Math.random() * 60),
  );
  return result;
}

/** Filter contributions to only include dates within range */
export function filterByDateRange(
  data: Record<string, number>,
  from: string,
  to: string,
): Record<string, number> {
  const result: Record<string, number> = {};
  const fromDate = new Date(from);
  const toDate = new Date(to);

  for (const [date, count] of Object.entries(data)) {
    const d = new Date(date);
    if (d >= fromDate && d <= toDate && count > 0) {
      result[date] = count;
    }
  }
  return result;
}
