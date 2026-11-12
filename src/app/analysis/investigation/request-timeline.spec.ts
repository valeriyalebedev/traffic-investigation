import { LogRecord } from '../../core/models/log-record';
import { getRequestsByIp } from './request-timeline';

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

describe('getRequestsByIp', () => {
  it('returns an empty array for empty input', () => {
    expect(getRequestsByIp([], '10.0.0.1')).toEqual([]);
  });

  it('returns an empty array when no records match the IP', () => {
    const records = [
      makeRecord({ ip: '10.0.0.2' }),
      makeRecord({ ip: '10.0.0.3' }),
    ];

    expect(getRequestsByIp(records, '10.0.0.1')).toEqual([]);
  });

  it('returns a single matching record', () => {
    const target = makeRecord({ ip: '10.0.0.1', lineNumber: 5 });
    const records = [
      makeRecord({ ip: '10.0.0.2', lineNumber: 1 }),
      target,
      makeRecord({ ip: '10.0.0.3', lineNumber: 10 }),
    ];

    const result = getRequestsByIp(records, '10.0.0.1');

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(target);
  });

  it('returns multiple records for the selected IP', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', lineNumber: 1, timestamp: new Date('2015-05-17T08:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', lineNumber: 2, timestamp: new Date('2015-05-17T09:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', lineNumber: 3, timestamp: new Date('2015-05-17T10:00:00Z') }),
    ];

    const result = getRequestsByIp(records, '10.0.0.1');

    expect(result).toHaveLength(3);
  });

  it('sorts records in chronological ascending order', () => {
    const t1 = new Date('2015-05-17T08:00:00Z');
    const t2 = new Date('2015-05-17T12:00:00Z');
    const t3 = new Date('2015-05-17T10:00:00Z');

    const records = [
      makeRecord({ ip: '10.0.0.1', lineNumber: 1, timestamp: t2 }),
      makeRecord({ ip: '10.0.0.1', lineNumber: 2, timestamp: t1 }),
      makeRecord({ ip: '10.0.0.1', lineNumber: 3, timestamp: t3 }),
    ];

    const result = getRequestsByIp(records, '10.0.0.1');

    expect(result.map(r => r.lineNumber)).toEqual([2, 3, 1]);
  });

  it('excludes records belonging to other IPs', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', lineNumber: 1 }),
      makeRecord({ ip: '10.0.0.2', lineNumber: 2 }),
      makeRecord({ ip: '10.0.0.1', lineNumber: 3 }),
      makeRecord({ ip: '10.0.0.3', lineNumber: 4 }),
    ];

    const result = getRequestsByIp(records, '10.0.0.1');

    expect(result).toHaveLength(2);
    expect(result.every(r => r.ip === '10.0.0.1')).toBe(true);
  });

  it('preserves original relative order for records with equal timestamps', () => {
    const sameTime = new Date('2015-05-17T10:00:00Z');

    const records = [
      makeRecord({ ip: '10.0.0.1', lineNumber: 5, timestamp: sameTime }),
      makeRecord({ ip: '10.0.0.1', lineNumber: 2, timestamp: sameTime }),
      makeRecord({ ip: '10.0.0.1', lineNumber: 8, timestamp: sameTime }),
    ];

    const result = getRequestsByIp(records, '10.0.0.1');

    expect(result.map(r => r.lineNumber)).toEqual([5, 2, 8]);
  });

  it('does not mutate the original input array', () => {
    const records = [
      makeRecord({ ip: '10.0.0.1', lineNumber: 3, timestamp: new Date('2015-05-17T12:00:00Z') }),
      makeRecord({ ip: '10.0.0.1', lineNumber: 1, timestamp: new Date('2015-05-17T08:00:00Z') }),
    ];

    Object.freeze(records);

    const result = getRequestsByIp(records, '10.0.0.1');

    expect(result).toHaveLength(2);
    expect(result[0].lineNumber).toBe(1);
  });

  it('returns original LogRecord objects by reference, not copies', () => {
    const r1 = makeRecord({ ip: '10.0.0.1', lineNumber: 1 });
    const r2 = makeRecord({ ip: '10.0.0.1', lineNumber: 2 });
    const records = [r1, r2];

    const result = getRequestsByIp(records, '10.0.0.1');

    expect(result[0]).toBe(r1);
    expect(result[1]).toBe(r2);
  });
});
