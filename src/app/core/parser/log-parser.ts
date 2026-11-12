import type { InvalidLogRecord, LogRecord, ParseResult } from '../models/log-record';

const LOG_LINE_REGEX =
  /^(\S+) (\S+) (\S+) \[([^\]]+)\] "((?:[^"\\]|\\.)*)" (\d+) (\S+) "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)"$/;

const REQUEST_LINE_REGEX = /^([A-Z]+) (.+) (HTTP\/\d+(?:\.\d+)?)$/;

const TIMESTAMP_REGEX =
  /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/;

const MONTHS: Readonly<Record<string, number>> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseTimestamp(raw: string): Date | null {
  const match = raw.match(TIMESTAMP_REGEX);
  if (!match) return null;

  const [, dayStr, monthStr, yearStr, hourStr, minStr, secStr, tzStr] = match;

  const month = MONTHS[monthStr];
  if (month === undefined) return null;

  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);
  const sec = parseInt(secStr, 10);

  if (hour > 23 || min > 59 || sec > 59) return null;

  const utcMs = Date.UTC(year, month, day, hour, min, sec);
  const probe = new Date(utcMs);
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month || probe.getUTCDate() !== day) {
    return null;
  }

  const tzSign = tzStr[0] === '+' ? 1 : -1;
  const tzHours = parseInt(tzStr.slice(1, 3), 10);
  const tzMins = parseInt(tzStr.slice(3, 5), 10);
  const tzOffsetMinutes = tzSign * (tzHours * 60 + tzMins);

  return new Date(utcMs - tzOffsetMinutes * 60_000);
}

function unescapeQuoted(value: string): string {
  return value.replace(/\\(.)/g, '$1');
}

/**
 * Parses a single Apache Combined Log Format entry.
 *
 * Returns either a valid LogRecord or a validation error.
 * The parser is intentionally strict about the expected log format
 * to avoid silently accepting malformed records.
 */
export function parseLine(line: string, lineNumber: number): LogRecord | InvalidLogRecord {
  const match = line.match(LOG_LINE_REGEX);
  if (!match) {
    return { lineNumber, rawLine: line, reason: 'Line does not match Apache Combined Log Format' };
  }

  const [, ip, identity, user, rawTimestamp, rawRequest, statusStr, sizeStr, rawReferrer, rawUserAgent] = match;

  const timestamp = parseTimestamp(rawTimestamp);
  if (!timestamp) {
    return { lineNumber, rawLine: line, reason: `Invalid timestamp: ${rawTimestamp}` };
  }

  const requestMatch = unescapeQuoted(rawRequest).match(REQUEST_LINE_REGEX);
  if (!requestMatch) {
    return { lineNumber, rawLine: line, reason: `Invalid request line: ${rawRequest}` };
  }
  const [, method, requestTarget, protocol] = requestMatch;

  const statusCode = parseInt(statusStr, 10);
  if (statusCode < 100 || statusCode > 599) {
    return { lineNumber, rawLine: line, reason: `Invalid status code: ${statusStr}` };
  }

  let responseSize: number | null;
  if (sizeStr === '-') {
    responseSize = null;
  } else if (/^\d+$/.test(sizeStr)) {
    responseSize = parseInt(sizeStr, 10);
  } else {
    return { lineNumber, rawLine: line, reason: `Invalid response size: ${sizeStr}` };
  }

  const queryIndex = requestTarget.indexOf('?');
  const path = queryIndex === -1 ? requestTarget : requestTarget.substring(0, queryIndex);

  return {
    lineNumber,
    rawLine: line,
    ip,
    identity,
    user,
    timestamp,
    method,
    requestTarget,
    path,
    protocol,
    statusCode,
    responseSize,
    referrer: unescapeQuoted(rawReferrer),
    userAgent: unescapeQuoted(rawUserAgent),
  };
}

export function parseLogContent(content: string): ParseResult {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  const records: LogRecord[] = [];
  const invalid: InvalidLogRecord[] = [];
  let emptyLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      emptyLineCount++;
      continue;
    }

    const result = parseLine(line, i + 1);
    if ('reason' in result) {
      invalid.push(result);
    } else {
      records.push(result);
    }
  }

  return {
    records,
    invalid,
    stats: {
      totalLines: lines.length,
      validCount: records.length,
      invalidCount: invalid.length,
      emptyLineCount,
    },
  };
}
