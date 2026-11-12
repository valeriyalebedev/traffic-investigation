import { LogRecord } from '../../core/models/log-record';
import { aggregateByHour } from './hourly-traffic';

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

describe('aggregateByHour', () => {
  it('returns an empty array for empty input', () => {
    expect(aggregateByHour([])).toEqual([]);
  });

  it('groups records into the correct hour bucket', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:05:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:45:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T11:05:00Z') }),
    ];

    const result = aggregateByHour(records);

    expect(result).toHaveLength(2);
    expect(result[0].hour).toEqual(new Date('2015-05-17T10:00:00Z'));
    expect(result[0].count).toBe(2);
    expect(result[1].hour).toEqual(new Date('2015-05-17T11:00:00Z'));
    expect(result[1].count).toBe(1);
  });

  it('returns buckets sorted chronologically', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T14:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T08:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T11:00:00Z') }),
    ];

    const result = aggregateByHour(records);

    expect(result.map(b => b.hour.getUTCHours())).toEqual([8, 11, 14]);
  });

  it('counts records from different IPs in the same bucket', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:05:00Z') }),
      makeRecord({ ip: '10.0.0.2', timestamp: new Date('2015-05-17T10:30:00Z') }),
    ];

    const result = aggregateByHour(records);

    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(2);
  });

  it('does not include hours with zero requests', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T08:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T12:00:00Z') }),
    ];

    const result = aggregateByHour(records);

    expect(result).toHaveLength(2);
    expect(result[0].hour).toEqual(new Date('2015-05-17T08:00:00Z'));
    expect(result[1].hour).toEqual(new Date('2015-05-17T12:00:00Z'));
  });

  it('does not mutate the input array', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: new Date('2015-05-17T10:05:00Z') }),
    ];
    Object.freeze(records);

    const result = aggregateByHour(records);

    expect(result).toHaveLength(1);
  });
});
