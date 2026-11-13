import { LogRecord } from '../../core/models/log-record';

export interface StatusCodeDetail {
  code: number;
  count: number;
  description: string;
}

export interface StatusClassGroup {
  label: string;
  classRange: string;
  count: number;
  percentage: number;
  description: string;
  note: string | null;
  details: StatusCodeDetail[];
}

interface ClassDef {
  label: string;
  classRange: string;
  min: number;
  max: number;
  description: string;
  note: string | null;
}

const STATUS_CLASSES: ClassDef[] = [
  { label: '2xx Success', classRange: '2xx', min: 200, max: 299, description: 'Successful responses', note: null },
  { label: '3xx Redirection', classRange: '3xx', min: 300, max: 399, description: 'Redirection responses', note: '304 is a cache validation response, not a typical redirect.' },
  { label: '4xx Client errors', classRange: '4xx', min: 400, max: 499, description: 'Client-side request errors', note: 'Client errors indicate failed requests, not necessarily attacks.' },
  { label: '5xx Server errors', classRange: '5xx', min: 500, max: 599, description: 'Server-side errors', note: 'Server errors reflect backend failures, not malicious intent.' },
];

const HTTP_STATUS_DESCRIPTIONS: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols',
  200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 206: 'Partial Content',
  301: 'Moved Permanently', 302: 'Found', 303: 'See Other', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  406: 'Not Acceptable', 408: 'Request Timeout', 409: 'Conflict', 410: 'Gone', 411: 'Length Required',
  413: 'Content Too Large', 414: 'URI Too Long', 415: 'Unsupported Media Type', 429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
};

/** Returns a human-readable description for a known HTTP status code, or a generic fallback. */
export function httpStatusDescription(code: number): string {
  return HTTP_STATUS_DESCRIPTIONS[code] ?? `Status ${code}`;
}

/** Groups log records by HTTP status class (2xx–5xx + Other), sorted by count descending. */
export function aggregateByStatusClass(records: readonly LogRecord[]): StatusClassGroup[] {
  if (records.length === 0) return [];

  const codeCounts = new Map<number, number>();
  for (const record of records) {
    codeCounts.set(record.statusCode, (codeCounts.get(record.statusCode) ?? 0) + 1);
  }

  const total = records.length;
  const groups: StatusClassGroup[] = [];
  const claimed = new Set<number>();

  for (const cls of STATUS_CLASSES) {
    let count = 0;
    const details: StatusCodeDetail[] = [];

    for (const [code, n] of codeCounts) {
      if (code >= cls.min && code <= cls.max) {
        count += n;
        details.push({ code, count: n, description: httpStatusDescription(code) });
        claimed.add(code);
      }
    }

    if (count === 0) continue;

    details.sort((a, b) => b.count - a.count);
    groups.push({
      label: cls.label,
      classRange: cls.classRange,
      count,
      percentage: round1((count / total) * 100),
      description: cls.description,
      note: cls.note,
      details,
    });
  }

  let otherCount = 0;
  const otherDetails: StatusCodeDetail[] = [];
  for (const [code, n] of codeCounts) {
    if (!claimed.has(code)) {
      otherCount += n;
      otherDetails.push({ code, count: n, description: httpStatusDescription(code) });
    }
  }

  if (otherCount > 0) {
    otherDetails.sort((a, b) => b.count - a.count);
    groups.push({
      label: 'Other',
      classRange: 'other',
      count: otherCount,
      percentage: round1((otherCount / total) * 100),
      description: 'Status codes outside the standard 200–599 range',
      note: null,
      details: otherDetails,
    });
  }

  groups.sort((a, b) => b.count - a.count);
  return groups;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
