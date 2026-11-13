/** A successfully parsed Apache Combined Log Format entry. */
export interface LogRecord {
  /** 1-based line number in the source file, preserved for traceability. */
  lineNumber: number;
  rawLine: string;
  ip: string;
  identity: string;
  user: string;
  /** Timestamp converted to UTC regardless of the original timezone offset. */
  timestamp: Date;
  method: string;
  /** The full HTTP request target as it appeared in the log (may include query parameters). */
  requestTarget: string;
  /** URL path extracted from `requestTarget`, without query parameters. */
  path: string;
  protocol: string;
  statusCode: number;
  /** Response size in bytes, or `null` when the log field was `-` (absent). */
  responseSize: number | null;
  referrer: string;
  userAgent: string;
}

/** A log line that failed validation, retained with its original content and error reason. */
export interface InvalidLogRecord {
  lineNumber: number;
  rawLine: string;
  reason: string;
}

/** Parsing statistics for the entire file. */
export interface ParseStats {
  /** Total number of lines in the file, including empty lines. */
  totalLines: number;
  validCount: number;
  invalidCount: number;
  emptyLineCount: number;
}

export interface ParseResult {
  records: LogRecord[];
  invalid: InvalidLogRecord[];
  stats: ParseStats;
}
