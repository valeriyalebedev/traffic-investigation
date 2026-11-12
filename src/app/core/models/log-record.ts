export interface LogRecord {
  lineNumber: number;
  rawLine: string;
  ip: string;
  identity: string;
  user: string;
  timestamp: Date;
  method: string;
  requestTarget: string;
  path: string;
  protocol: string;
  statusCode: number;
  responseSize: number | null;
  referrer: string;
  userAgent: string;
}

export interface InvalidLogRecord {
  lineNumber: number;
  rawLine: string;
  reason: string;
}

export interface ParseStats {
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
