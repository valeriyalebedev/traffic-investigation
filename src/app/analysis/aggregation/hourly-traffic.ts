import { LogRecord } from '../../core/models/log-record';

export interface HourlyBucket {
  /** Start of the hour (minutes, seconds, ms zeroed out). */
  hour: Date;
  count: number;
}

/**
 * Groups log records into hourly buckets, sorted chronologically.
 *
 * Each bucket represents one clock hour. Records are assigned to the hour
 * their timestamp falls into (floor to hour). The returned array is sorted
 * by hour ascending. Hours with no requests are not included.
 *
 * @param records - Parsed log records. Not mutated.
 * @returns Hourly buckets sorted chronologically.
 */
export function aggregateByHour(records: readonly LogRecord[]): HourlyBucket[] {
  const map = new Map<number, HourlyBucket>();

  for (const record of records) {
    const d = record.timestamp;
    const hourMs = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
    );

    const existing = map.get(hourMs);
    if (existing) {
      existing.count++;
    } else {
      map.set(hourMs, { hour: new Date(hourMs), count: 1 });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => a.hour.getTime() - b.hour.getTime(),
  );
}
