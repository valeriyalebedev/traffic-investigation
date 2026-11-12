import { describe, it, expect } from 'vitest';
import { LogRecord } from '../../core/models/log-record';
import { aggregateByStatusClass, httpStatusDescription } from './status-code-breakdown';

function makeRecord(statusCode: number): LogRecord {
  return {
    lineNumber: 1,
    rawLine: '',
    ip: '127.0.0.1',
    identity: '-',
    user: '-',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    method: 'GET',
    requestTarget: 'GET / HTTP/1.1',
    path: '/',
    protocol: 'HTTP/1.1',
    statusCode,
    responseSize: 0,
    referrer: '-',
    userAgent: '-',
  };
}

function repeat(code: number, n: number): LogRecord[] {
  return Array.from({ length: n }, () => makeRecord(code));
}

describe('aggregateByStatusClass', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateByStatusClass([])).toEqual([]);
  });

  it('groups a single 200 into 2xx', () => {
    const result = aggregateByStatusClass([makeRecord(200)]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('2xx Success');
    expect(result[0].count).toBe(1);
    expect(result[0].percentage).toBe(100);
  });

  it('groups multiple status codes within the same class', () => {
    const records = [...repeat(200, 5), ...repeat(201, 3)];
    const result = aggregateByStatusClass(records);
    expect(result).toHaveLength(1);
    expect(result[0].classRange).toBe('2xx');
    expect(result[0].count).toBe(8);
    expect(result[0].details).toEqual([
      { code: 200, count: 5, description: 'OK' },
      { code: 201, count: 3, description: 'Created' },
    ]);
  });

  it('groups codes into separate classes', () => {
    const records = [
      ...repeat(200, 6),
      ...repeat(404, 3),
      ...repeat(500, 1),
    ];
    const result = aggregateByStatusClass(records);
    const labels = result.map(g => g.classRange);
    expect(labels).toEqual(['2xx', '4xx', '5xx']);
    expect(result[0].percentage).toBe(60);
    expect(result[1].percentage).toBe(30);
    expect(result[2].percentage).toBe(10);
  });

  it('places codes outside 200-599 into Other with detail breakdown', () => {
    const records = [
      ...repeat(100, 2),
      ...repeat(600, 1),
    ];
    const result = aggregateByStatusClass(records);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Other');
    expect(result[0].count).toBe(3);
    expect(result[0].details[0]).toMatchObject({ code: 100, count: 2 });
    expect(result[0].details[1]).toMatchObject({ code: 600, count: 1 });
  });

  it('mixes standard classes and Other', () => {
    const records = [
      ...repeat(200, 4),
      ...repeat(100, 1),
    ];
    const result = aggregateByStatusClass(records);
    expect(result).toHaveLength(2);
    expect(result[0].classRange).toBe('2xx');
    expect(result[1].label).toBe('Other');
    expect(result[1].percentage).toBe(20);
  });

  it('omits zero-count classes', () => {
    const records = repeat(304, 5);
    const result = aggregateByStatusClass(records);
    expect(result).toHaveLength(1);
    expect(result[0].classRange).toBe('3xx');
  });

  it('sorts by count descending', () => {
    const records = [
      ...repeat(500, 1),
      ...repeat(404, 5),
      ...repeat(200, 3),
    ];
    const result = aggregateByStatusClass(records);
    const counts = result.map(g => g.count);
    expect(counts).toEqual([5, 3, 1]);
  });

  it('rounds percentages to one decimal place', () => {
    const records = [
      ...repeat(200, 1),
      ...repeat(404, 2),
    ];
    const result = aggregateByStatusClass(records);
    const twoXx = result.find(g => g.classRange === '2xx');
    const fourXx = result.find(g => g.classRange === '4xx');
    expect(twoXx?.percentage).toBe(33.3);
    expect(fourXx?.percentage).toBe(66.7);
  });

  it('includes description and note for standard classes', () => {
    const result = aggregateByStatusClass([makeRecord(200)]);
    expect(result[0].description).toBe('Successful responses');
    expect(result[0].note).toBeNull();
  });

  it('includes contextual note for 3xx class', () => {
    const result = aggregateByStatusClass([makeRecord(304)]);
    expect(result[0].note).toContain('304');
  });

  it('includes contextual note for 4xx class', () => {
    const result = aggregateByStatusClass([makeRecord(404)]);
    expect(result[0].note).toBeTruthy();
    expect(result[0].note).toContain('not necessarily attacks');
  });

  it('Other group has null note and actual details', () => {
    const records = [...repeat(100, 2), ...repeat(199, 3)];
    const result = aggregateByStatusClass(records);
    const other = result.find(g => g.label === 'Other')!;
    expect(other.note).toBeNull();
    expect(other.details).toHaveLength(2);
  });

  it('details within a class are sorted by count descending', () => {
    const records = [
      ...repeat(401, 2),
      ...repeat(404, 7),
      ...repeat(403, 1),
    ];
    const result = aggregateByStatusClass(records);
    expect(result[0].details.map(d => d.code)).toEqual([404, 401, 403]);
  });

  it('details include HTTP status descriptions', () => {
    const records = [...repeat(200, 3), ...repeat(404, 1)];
    const result = aggregateByStatusClass(records);
    const twoXx = result.find(g => g.classRange === '2xx')!;
    expect(twoXx.details[0].description).toBe('OK');
    const fourXx = result.find(g => g.classRange === '4xx')!;
    expect(fourXx.details[0].description).toBe('Not Found');
  });
});

describe('httpStatusDescription', () => {
  it('returns known descriptions', () => {
    expect(httpStatusDescription(200)).toBe('OK');
    expect(httpStatusDescription(301)).toBe('Moved Permanently');
    expect(httpStatusDescription(404)).toBe('Not Found');
    expect(httpStatusDescription(500)).toBe('Internal Server Error');
  });

  it('returns fallback for unknown codes', () => {
    expect(httpStatusDescription(999)).toBe('Status 999');
  });
});
