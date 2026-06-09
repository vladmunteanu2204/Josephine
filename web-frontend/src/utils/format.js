// Shared display formatters.

/**
 * Format a decimal-hours duration as "h:mm" (e.g. 4.42 -> "4:25", 5 -> "5:00").
 * Mirrors how Outdooractive shows durations. Returns null for missing/zero.
 */
export function fmtDuration(hours) {
  const n = Number(hours);
  if (!isFinite(n) || n <= 0) return null;
  const total = Math.round(n * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${hh}:${String(mm).padStart(2, '0')}`;
}
