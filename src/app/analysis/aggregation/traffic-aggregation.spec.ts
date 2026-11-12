import { LogRecord } from '../../core/models/log-record';
import { aggregateByIp } from './traffic-aggregation';

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

describe('aggregateByIp', () => {
  it('returns an empty array for empty input', () => {
    expect(aggregateByIp([])).toEqual([]);
  });

  it('aggregates a single IP with multiple requests', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', statusCode: 200, method: 'GET' }),
      makeRecord({ ip: '10.0.0.1', statusCode: 404, method: 'POST' }),
      makeRecord({ ip: '10.0.0.1', statusCode: 200, method: 'GET' }),
    ];

    const result = aggregateByIp(records);

    expect(result).toHaveLength(1);
    expect(result[0].ip).toBe('10.0.0.1');
    expect(result[0].requestCount).toBe(3);
  });

  it('aggregates multiple IPs', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1' }),
      makeRecord({ ip: '10.0.0.2' }),
      makeRecord({ ip: '10.0.0.1' }),
    ];

    const result = aggregateByIp(records);

    expect(result).toHaveLength(2);
    expect(result[0].ip).toBe('10.0.0.1');
    expect(result[0].requestCount).toBe(2);
    expect(result[1].ip).toBe('10.0.0.2');
    expect(result[1].requestCount).toBe(1);
  });

  it('counts status codes per IP', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', statusCode: 200 }),
      makeRecord({ ip: '10.0.0.1', statusCode: 200 }),
      makeRecord({ ip: '10.0.0.1', statusCode: 404 }),
      makeRecord({ ip: '10.0.0.1', statusCode: 500 }),
    ];

    const result = aggregateByIp(records);

    expect(result[0].statusCounts).toEqual({ '200': 2, '404': 1, '500': 1 });
  });

  it('counts HTTP methods per IP', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', method: 'GET' }),
      makeRecord({ ip: '10.0.0.1', method: 'POST' }),
      makeRecord({ ip: '10.0.0.1', method: 'GET' }),
    ];

    const result = aggregateByIp(records);

    expect(result[0].methodCounts).toEqual({ 'GET': 2, 'POST': 1 });
  });

  it('calculates firstSeen and lastSeen timestamps', () => {
    const t1 = new Date('2015-05-17T08:00:00Z');
    const t2 = new Date('2015-05-17T12:00:00Z');
    const t3 = new Date('2015-05-17T10:00:00Z');

    const records = [
      makeRecord({ ip: '10.0.0.1', timestamp: t2 }),
      makeRecord({ ip: '10.0.0.1', timestamp: t1 }),
      makeRecord({ ip: '10.0.0.1', timestamp: t3 }),
    ];

    const result = aggregateByIp(records);

    expect(result[0].firstSeen).toEqual(t1);
    expect(result[0].lastSeen).toEqual(t2);
  });

  it('sorts by request count descending', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1' }),
      makeRecord({ ip: '10.0.0.2' }),
      makeRecord({ ip: '10.0.0.2' }),
      makeRecord({ ip: '10.0.0.2' }),
      makeRecord({ ip: '10.0.0.3' }),
      makeRecord({ ip: '10.0.0.3' }),
    ];

    const result = aggregateByIp(records);

    expect(result.map(s => s.ip)).toEqual(['10.0.0.2', '10.0.0.3', '10.0.0.1']);
  });

  it('uses IP ascending as a deterministic tie-breaker', () => {
    const records = [
      makeRecord({ ip: '10.0.0.3' }),
      makeRecord({ ip: '10.0.0.1' }),
      makeRecord({ ip: '10.0.0.2' }),
    ];

    const result = aggregateByIp(records);

    expect(result.map(s => s.ip)).toEqual(['10.0.0.1', '10.0.0.2', '10.0.0.3']);
  });

  it('does not mutate the input array or records', () => {
    const record = makeRecord({ ip: '10.0.0.1', statusCode: 200, method: 'GET' });
    const records = [record];
    const frozenRecord = { ...record };
    const originalLength = records.length;

    Object.freeze(records);

    aggregateByIp(records);

    expect(records.length).toBe(originalLength);
    expect(record).toEqual(frozenRecord);
  });
});
