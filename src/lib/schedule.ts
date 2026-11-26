// Helpers for the program schedules in src/content/program-schedules.json.
// Times are stored as 24-hour "HH:MM" strings and shown as "h:mmam".
// Keep this file to erasable TypeScript only (no enums, no namespaces) so
// `node --test` can load it directly.

export type ScheduleRow = {
  day: string;
  start: string;
  end: string;
  format: string;
  audience: string;
  notes: string;
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "13:00" -> "1:00pm", "00:30" -> "12:30am", "12:00" -> "12:00pm". */
export function formatTime(value: string): string {
  const match = TIME_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Invalid time "${value}": expected 24-hour HH:MM`);
  }
  const hours = Number(match[1]);
  const suffix = hours < 12 ? 'am' : 'pm';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${match[2]}${suffix}`;
}

/** ("11:00", "12:15") -> "11:00am – 12:15pm" (spaced en dash). */
export function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

function weekdayIndex(day: string): number {
  const index = WEEKDAYS.indexOf(day);
  if (index === -1) {
    throw new Error(`Unknown day "${day}"`);
  }
  return index;
}

/** Monday-first by weekday, then by start time. Returns a new array. */
export function sortRows<T extends { day: string; start: string }>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) => weekdayIndex(a.day) - weekdayIndex(b.day) || a.start.localeCompare(b.start),
  );
}
