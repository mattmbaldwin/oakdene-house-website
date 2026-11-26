// Helpers for the Community Programs pages (website-editor stage W9, issue #17).
import { renderProse } from './prose';
import { fieldSource } from './pages';

interface Row {
  label: string;
  value: string;
}

/**
 * The rows of a "Service details" table: first the rows whose value comes from Opening hours (labels from the
 * page file, values from src/content/opening-hours.json), then the rows written in the page file.
 */
export function detailRows(
  id: string,
  details: { hoursLabels?: Record<string, string>; rows: Row[] },
  hoursValues: [key: string, value: string][] = [],
): Row[] {
  const fromHours = hoursValues.map(([key, value]) => ({ label: details.hoursLabels?.[key] ?? '', value }));
  const written = details.rows.map((row, i) => ({
    label: row.label,
    value: renderProse(row.value, fieldSource(id, `details.rows.${i}.value`)),
  }));
  return [...fromHours, ...written];
}

/** Put the opening hours phrase where the page file says {hours}. */
export function fillHours(text: string, hours: string): string {
  return text.replace('{hours}', () => hours);
}
