import { LogRecord } from '../../core/models/log-record';
import { Finding } from './detection-models';
import { detectRepeatedFailedResource } from './repeated-failed-resource';
import { detectRepeatedRequestPatterns } from './repeated-request-patterns';
import { detectVulnerabilityPathProbing } from './vulnerability-path-probing';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

/** Runs all detection rules and returns findings sorted by severity (high first), then request count descending. */
export function runDetection(records: readonly LogRecord[]): Finding[] {
  const findings: Finding[] = [
    ...detectVulnerabilityPathProbing(records),
    ...detectRepeatedFailedResource(records),
    ...detectRepeatedRequestPatterns(records),
  ];

  findings.sort((a, b) =>
    SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    || b.requestCount - a.requestCount,
  );

  return findings;
}
