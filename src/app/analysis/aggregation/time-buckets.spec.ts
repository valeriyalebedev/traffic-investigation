import { LogRecord } from '../../core/models/log-record';
import { aggregateByTimeBucket, chooseBucketInterval } from './time-buckets';

function makeRecord(overrides: Partial<LogRecord> & Pick<LogRecord, 'ip'>): LogRecord {
  return {
    lineNumber: 1,
    rawLine: '',
    identity: '-',
    user: '-',
    timestamp: new Date('2015-05-17T10:05:00Z'),
    method: 'GET',
    requestTarget: '/',
    path: '/',
    protocol: 'HTTP/1.1',
    statusCode: 200,
    responseSize: null,
    referrer: '-',
    userAgent: '-',
    ...overrides,
  };
}

describe('chooseBucketInterval', () => {
  it('picks 1 minute for a ~1 hour range', () => {
    const oneHourMs = 60 * 60 * 1000;
    const interval = chooseBucketInterval(oneHourMs);
    expect(interval.label).toBe('1 minute');
  });

  it('picks hour for a ~3 day range', () => {
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const interval = chooseBucketInterval(threeDaysMs);
    expect(interval.label).toBe('hour');
  });

  it('picks day for a ~2 month range', () => {
    const twoMonthsMs = 60 * 24 * 60 * 60 * 1000;
    const interval = chooseBucketInterval(twoMonthsMs);
    expect(interval.label).toBe('day');
  });

  it('picks 5 minutes for a ~5 hour range', () => {
    const fiveHoursMs = 5 * 60 * 60 * 1000;
    const interval = chooseBucketInterval(fiveHoursMs);
    expect(interval.label).toBe('5 minutes');
  });

  it('defaults to hour for zero range', () => {
    const interval = chooseBucketInterval(0);
    expect(interval.label).toBe('hour');
  });
});

describe('aggregateByTimeBucket', () => {
  it('returns empty buckets for empty input', () => {
    const result = aggregateByTimeBucket([]);
    expect(result.buckets).toEqual([]);
  });

  it('groups records into correct buckets', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:05:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:45:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T11:05:00Z') }),
    ];

    const result = aggregateByTimeBucket(records);

    expect(result.buckets.length).toBeGreaterThanOrEqual(1);
    const totalCount = result.buckets.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(3);
  });

  it('returns buckets sorted chronologically', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T14:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T08:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T11:00:00Z') }),
    ];

    const result = aggregateByTimeBucket(records);
    const starts = result.buckets.map(b => b.start.getTime());

    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBeGreaterThan(starts[i - 1]);
    }
  });

  it('each bucket has correct start/end span', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:05:00Z') }),
    ];

    const result = aggregateByTimeBucket(records);

    for (const bucket of result.buckets) {
      expect(bucket.end.getTime() - bucket.start.getTime()).toBe(result.interval.ms);
    }
  });

  it('preserves total record count across all buckets', () => {
    const records: LogRecord[] = [];
    for (let i = 0; i < 200; i++) {
      const hour = Math.floor(i / 3);
      records.push(makeRecord({
        ip: '10.0.0.1',
        timestamp: new Date(`2015-05-17T${String(hour % 24).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00Z`),
      }));
    }

    const result = aggregateByTimeBucket(records);
    const totalCount = result.buckets.reduce((sum, b) => sum + b.count, 0);

    expect(totalCount).toBe(200);
  });

  it('uses smaller intervals for short time ranges', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:30:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T11:00:00Z') }),
    ];

    const result = aggregateByTimeBucket(records);
    expect(result.interval.ms).toBeLessThanOrEqual(3_600_000);
  });

  it('uses larger intervals for multi-day ranges', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-01T00:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-15T00:00:00Z') }),
    ];

    const result = aggregateByTimeBucket(records);
    expect(result.interval.ms).toBeGreaterThanOrEqual(3_600_000);
  });

  it('does not mutate the input array', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:05:00Z') }),
    ];
    Object.freeze(records);

    const result = aggregateByTimeBucket(records);
    expect(result.buckets.length).toBeGreaterThanOrEqual(1);
  });
});
