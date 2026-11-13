import { LogRecord } from '../../core/models/log-record';

export type DetectionRule =
  | 'VULNERABILITY_PATH_PROBING'
  | 'REPEATED_FAILED_RESOURCE'
  | 'REPEATED_REQUEST_PATTERNS';

export type Severity = 'low' | 'medium' | 'high';

export interface Finding {
  rule: DetectionRule;
  ip: string;
  summary: string;
  description: string;
  severity: Severity;
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
  evidenceRecords: LogRecord[];
}
