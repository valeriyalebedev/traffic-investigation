import { parseLine, parseLogContent } from './log-parser';
import type { InvalidLogRecord, LogRecord } from '../models/log-record';

function isValid(result: LogRecord | InvalidLogRecord): result is LogRecord {
  return !('reason' in result);
}

function isInvalid(result: LogRecord | InvalidLogRecord): result is InvalidLogRecord {
  return 'reason' in result;
}

const VALID_LINE =
  '172.16.0.3 - frank [25/Dec/2024:10:15:32 +0000] "GET /index.html HTTP/1.1" 200 2326 "https://example.com" "Mozilla/5.0"';

describe('parseLine', () => {
  it('parses a valid Apache Combined Log Format line', () => {
    const result = parseLine(VALID_LINE, 1);
    expect(isValid(result)).toBe(true);
    if (!isValid(result)) return;

    expect(result.lineNumber).toBe(1);
    expect(result.rawLine).toBe(VALID_LINE);
    expect(result.ip).toBe('172.16.0.3');
    expect(result.identity).toBe('-');
    expect(result.user).toBe('frank');
    expect(result.timestamp).toEqual(new Date('2024-12-25T10:15:32.000Z'));
    expect(result.method).toBe('GET');
    expect(result.requestTarget).toBe('/index.html');
    expect(result.path).toBe('/index.html');
    expect(result.protocol).toBe('HTTP/1.1');
    expect(result.statusCode).toBe(200);
    expect(result.responseSize).toBe(2326);
    expect(result.referrer).toBe('https://example.com');
    expect(result.userAgent).toBe('Mozilla/5.0');
  });

  it('preserves request target with query parameters', () => {
    const line =
      '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET /search?q=test&page=2 HTTP/1.1" 200 512 "-" "-"';
    const result = parseLine(line, 5);
    expect(isValid(result)).toBe(true);
    if (!isValid(result)) return;

    expect(result.requestTarget).toBe('/search?q=test&page=2');
    expect(result.path).toBe('/search');
  });

  it('handles missing fields represented by dashes', () => {
    const line =
      '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "HEAD / HTTP/1.1" 204 - "-" "-"';
    const result = parseLine(line, 1);
    expect(isValid(result)).toBe(true);
    if (!isValid(result)) return;

    expect(result.identity).toBe('-');
    expect(result.user).toBe('-');
    expect(result.responseSize).toBeNull();
    expect(result.referrer).toBe('-');
    expect(result.userAgent).toBe('-');
  });

  it('handles response size zero', () => {
    const line =
      '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 200 0 "-" "-"';
    const result = parseLine(line, 1);
    expect(isValid(result)).toBe(true);
    if (!isValid(result)) return;

    expect(result.responseSize).toBe(0);
  });

  it('unescapes quotes in user-agent', () => {
    const line =
      '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 200 0 "-" "Mozilla \\"Firefox\\""';
    const result = parseLine(line, 1);
    expect(isValid(result)).toBe(true);
    if (!isValid(result)) return;

    expect(result.userAgent).toBe('Mozilla "Firefox"');
  });

  it('unescapes quotes in referrer', () => {
    const line =
      '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 200 0 "https://example.com/p?a=\\"b\\"" "-"';
    const result = parseLine(line, 1);
    expect(isValid(result)).toBe(true);
    if (!isValid(result)) return;

    expect(result.referrer).toBe('https://example.com/p?a="b"');
  });

  describe('timestamp parsing', () => {
    it('parses negative timezone offset correctly', () => {
      const line =
        '10.0.0.1 - - [25/Dec/2024:10:15:32 -0700] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isValid(result)).toBe(true);
      if (!isValid(result)) return;

      expect(result.timestamp).toEqual(new Date('2024-12-25T17:15:32.000Z'));
    });

    it('parses positive timezone offset correctly', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:02:30:00 +0530] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isValid(result)).toBe(true);
      if (!isValid(result)) return;

      expect(result.timestamp).toEqual(new Date('2024-12-31T21:00:00.000Z'));
    });

    it('parses zero timezone offset', () => {
      const line =
        '10.0.0.1 - - [15/Jun/2024:12:00:00 +0000] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isValid(result)).toBe(true);
      if (!isValid(result)) return;

      expect(result.timestamp).toEqual(new Date('2024-06-15T12:00:00.000Z'));
    });

    it('rejects invalid month abbreviation', () => {
      const line =
        '10.0.0.1 - - [25/Xyz/2024:10:15:32 +0000] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;

      expect(result.reason).toContain('Invalid timestamp');
    });

    it('rejects malformed timestamp format', () => {
      const line =
        '10.0.0.1 - - [2024-12-25 10:15:32] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
    });

    it('rejects February 31', () => {
      const line =
        '10.0.0.1 - - [31/Feb/2024:10:00:00 +0000] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid timestamp');
    });

    it('rejects day 31 for a 30-day month', () => {
      const line =
        '10.0.0.1 - - [31/Apr/2024:10:00:00 +0000] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid timestamp');
    });

    it('rejects hour 24', () => {
      const line =
        '10.0.0.1 - - [15/Jan/2024:24:00:00 +0000] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid timestamp');
    });

    it('rejects minute 60', () => {
      const line =
        '10.0.0.1 - - [15/Jan/2024:10:60:00 +0000] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid timestamp');
    });

    it('rejects second 60', () => {
      const line =
        '10.0.0.1 - - [15/Jan/2024:10:30:60 +0000] "GET / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid timestamp');
    });
  });

  describe('request line validation', () => {
    it('rejects request line without protocol', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET /path" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;

      expect(result.reason).toContain('Invalid request line');
    });

    it('rejects lowercase HTTP method', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "get / HTTP/1.1" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;

      expect(result.reason).toContain('Invalid request line');
    });

    it('rejects empty request line', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "" 200 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;

      expect(result.reason).toContain('Invalid request line');
    });

    it('accepts various HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'];
      for (const method of methods) {
        const line = `10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "${method} / HTTP/1.1" 200 0 "-" "-"`;
        const result = parseLine(line, 1);
        expect(isValid(result), `method ${method} should produce a valid record`).toBe(true);
      }
    });
  });

  describe('status code validation', () => {
    it('accepts boundary status code 100', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 100 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isValid(result)).toBe(true);
      if (!isValid(result)) return;
      expect(result.statusCode).toBe(100);
    });

    it('accepts boundary status code 599', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 599 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isValid(result)).toBe(true);
      if (!isValid(result)) return;
      expect(result.statusCode).toBe(599);
    });

    it('rejects status code below 100', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 99 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid status code');
    });

    it('rejects status code above 599', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 600 0 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid status code');
    });
  });

  describe('response size validation', () => {
    it('rejects decimal response size', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 200 23.5 "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid response size');
    });

    it('rejects non-numeric response size', () => {
      const line =
        '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET / HTTP/1.1" 200 abc "-" "-"';
      const result = parseLine(line, 1);
      expect(isInvalid(result)).toBe(true);
      if (!isInvalid(result)) return;
      expect(result.reason).toContain('Invalid response size');
    });
  });

  it('rejects a completely invalid line', () => {
    const result = parseLine('this is not a log line', 42);
    expect(isInvalid(result)).toBe(true);
    if (!isInvalid(result)) return;

    expect(result.lineNumber).toBe(42);
    expect(result.rawLine).toBe('this is not a log line');
    expect(result.reason).toContain('does not match');
  });

  it('preserves line number in error result', () => {
    const result = parseLine('garbage', 999);
    expect(isInvalid(result)).toBe(true);
    if (!isInvalid(result)) return;

    expect(result.lineNumber).toBe(999);
    expect(result.rawLine).toBe('garbage');
  });
});

describe('parseLogContent', () => {
  const LINE_A =
    '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET /a HTTP/1.1" 200 100 "-" "-"';
  const LINE_B =
    '10.0.0.2 - - [01/Jan/2025:00:00:01 +0000] "POST /b HTTP/1.1" 201 200 "-" "-"';

  it('parses multiple valid lines', () => {
    const result = parseLogContent(`${LINE_A}\n${LINE_B}`);
    expect(result.records).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
    expect(result.stats.totalLines).toBe(2);
    expect(result.stats.validCount).toBe(2);
  });

  it('handles mixed valid and invalid lines', () => {
    const content = `${LINE_A}\nbad line\n${LINE_B}`;
    const result = parseLogContent(content);
    expect(result.records).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].lineNumber).toBe(2);
    expect(result.stats.totalLines).toBe(3);
  });

  it('returns zero totalLines for empty input', () => {
    const result = parseLogContent('');
    expect(result.stats.totalLines).toBe(0);
    expect(result.stats.validCount).toBe(0);
    expect(result.stats.invalidCount).toBe(0);
    expect(result.stats.emptyLineCount).toBe(0);
    expect(result.records).toHaveLength(0);
    expect(result.invalid).toHaveLength(0);
  });

  it('does not count trailing LF as an extra line', () => {
    const result = parseLogContent(`${LINE_A}\n`);
    expect(result.stats.totalLines).toBe(1);
    expect(result.stats.validCount).toBe(1);
  });

  it('does not count trailing CRLF as an extra line', () => {
    const result = parseLogContent(`${LINE_A}\r\n${LINE_B}\r\n`);
    expect(result.stats.totalLines).toBe(2);
    expect(result.stats.validCount).toBe(2);
  });

  it('handles CRLF line endings', () => {
    const result = parseLogContent(`${LINE_A}\r\n${LINE_B}`);
    expect(result.records).toHaveLength(2);
    expect(result.stats.totalLines).toBe(2);
  });

  it('counts empty lines separately', () => {
    const content = `${LINE_A}\n\n${LINE_B}`;
    const result = parseLogContent(content);
    expect(result.stats.totalLines).toBe(3);
    expect(result.stats.validCount).toBe(2);
    expect(result.stats.invalidCount).toBe(0);
    expect(result.stats.emptyLineCount).toBe(1);
  });

  it('preserves correct line numbers across empty lines', () => {
    const content = `\n${LINE_A}\n\n${LINE_B}\n`;
    const result = parseLogContent(content);
    expect(result.records[0].lineNumber).toBe(2);
    expect(result.records[1].lineNumber).toBe(4);
    expect(result.stats.totalLines).toBe(4);
    expect(result.stats.emptyLineCount).toBe(2);
  });

  it('maintains invariant: totalLines = validCount + invalidCount + emptyLineCount', () => {
    const content = `${LINE_A}\nbad\n\n${LINE_B}\nanother bad\n`;
    const result = parseLogContent(content);
    const { totalLines, validCount, invalidCount, emptyLineCount } = result.stats;
    expect(totalLines).toBe(validCount + invalidCount + emptyLineCount);
    expect(totalLines).toBe(5);
    expect(validCount).toBe(2);
    expect(invalidCount).toBe(2);
    expect(emptyLineCount).toBe(1);
  });

  it('handles a malformed line among valid records', () => {
    const content = [LINE_A, 'truncated line without closing quote', LINE_B].join('\n');
    const result = parseLogContent(content);
    expect(result.records).toHaveLength(2);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].lineNumber).toBe(2);
    expect(result.invalid[0].reason).toBeTruthy();
  });

  it('handles whitespace-only lines as empty', () => {
    const content = `${LINE_A}\n   \n${LINE_B}`;
    const result = parseLogContent(content);
    expect(result.stats.emptyLineCount).toBe(1);
    expect(result.stats.validCount).toBe(2);
  });
});
