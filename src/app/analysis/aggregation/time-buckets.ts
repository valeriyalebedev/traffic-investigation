import { LogRecord } from '../../core/models/log-record';

export interface TimeBucket {
  /** Start of the bucket interval (UTC). */
  start: Date;
  /** End of the bucket interval (UTC, exclusive). */
  end: Date;
  count: number;
}

export interface BucketInterval {
  /** Duration of one bucket in milliseconds. */
  ms: number;
  /** Human-readable label, e.g. "hour", "5 minutes". */
  label: string;
}

const CANDIDATE_INTERVALS: BucketInterval[] = [
  { ms: 60_000,          label: '1 minute' },
  { ms: 5 * 60_000,     label: '5 minutes' },
  { ms: 15 * 60_000,    label: '15 minutes' },
  { ms: 30 * 60_000,    label: '30 minutes' },
  { ms: 3_600_000,      label: 'hour' },
  { ms: 3 * 3_600_000,  label: '3 hours' },
  { ms: 6 * 3_600_000,  label: '6 hours' },
  { ms: 12 * 3_600_000, label: '12 hours' },
  { ms: 86_400_000,     label: 'day' },
];

const TARGET_MIN = 50;
const TARGET_MAX = 100;

/**
 * Selects a bucket interval that produces approximately 50–100 data points
 * for the given time range.
 *
 * @param rangeMs - Total time range in milliseconds.
 * @returns The best-fit interval from the candidate list.
 */
export function chooseBucketInterval(rangeMs: number): BucketInterval {
  if (rangeMs <= 0) return CANDIDATE_INTERVALS[4]; // default: 1 hour

  const targetMid = (TARGET_MIN + TARGET_MAX) / 2;

  let best = CANDIDATE_INTERVALS[0];
  let bestDist = Infinity;

  for (const interval of CANDIDATE_INTERVALS) {
    const bucketCount = Math.ceil(rangeMs / interval.ms);
    const dist = Math.abs(bucketCount - targetMid);

    if (dist < bestDist) {
      bestDist = dist;
      best = interval;
    }
  }

  return best;
}

/** Floors a UTC timestamp to the start of its bucket. */
function floorToBucket(timestampMs: number, intervalMs: number): number {
  return Math.floor(timestampMs / intervalMs) * intervalMs;
}

export interface TimeBucketResult {
  buckets: TimeBucket[];
  interval: BucketInterval;
}

/**
 * Groups log records into adaptive time buckets, sorted chronologically.
 *
 * Automatically selects a bucket interval (1 min to 1 day) to produce
 * approximately 50–100 data points. Each record is assigned to the bucket
 * its timestamp falls into. Buckets with no requests are not included.
 *
 * @param records - Parsed log records. Not mutated.
 * @returns The bucketed data and the selected interval.
 */
export function aggregateByTimeBucket(records: readonly LogRecord[]): TimeBucketResult {
  if (records.length === 0) {
    return { buckets: [], interval: CANDIDATE_INTERVALS[4] };
  }

  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const record of records) {
    const t = record.timestamp.getTime();
    if (t < minMs) minMs = t;
    if (t > maxMs) maxMs = t;
  }

  const interval = chooseBucketInterval(maxMs - minMs);
  const map = new Map<number, TimeBucket>();

  for (const record of records) {
    const bucketStart = floorToBucket(record.timestamp.getTime(), interval.ms);

    const existing = map.get(bucketStart);
    if (existing) {
      existing.count++;
    } else {
      map.set(bucketStart, {
        start: new Date(bucketStart),
        end: new Date(bucketStart + interval.ms),
        count: 1,
      });
    }
  }

  return {
    buckets: Array.from(map.values()).sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    ),
    interval,
  };
}
