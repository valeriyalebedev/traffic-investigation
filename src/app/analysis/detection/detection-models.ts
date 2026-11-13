import { LogRecord } from '../../core/models/log-record';

/** Identifier for each detection heuristic. */
export type DetectionRule =
  | 'VULNERABILITY_PATH_PROBING'
  | 'REPEATED_FAILED_RESOURCE'
  | 'REPEATED_REQUEST_PATTERNS';

/** Investigation priority level — not a probability of malicious intent. */
export type Severity = 'low' | 'medium' | 'high';

/** A specific match produced by a detection rule for a single source IP. */
export interface Finding {
  rule: DetectionRule;
  ip: string;
  /**
   * Human-readable summary of what was detected. Contains rule-specific detail
   * (e.g. the target path for REPEATED_FAILED_RESOURCE) and is used together with
   * `ip` and `rule` to form the finding identity in the UI.
   */
  summary: string;
  description: string;
  severity: Severity;
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
  /** The actual log records that matched the rule, supporting traceability to source lines. */
  evidenceRecords: LogRecord[];
}
