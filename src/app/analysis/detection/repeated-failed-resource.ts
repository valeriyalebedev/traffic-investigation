import { LogRecord } from '../../core/models/log-record';
import { Finding, Severity } from './detection-models';

/** Minimum requests to the same normalized path required to consider the group. */
export const FAILED_RESOURCE_MIN_REQUESTS = 5;
/** Minimum proportion of HTTP 4xx responses within the group. */
export const FAILED_RESOURCE_MIN_FAILURE_RATIO = 0.8;

/**
 * Detects repeated failed requests to the same resource from the same IP.
 * Only HTTP 4xx responses count as failures; 5xx is excluded.
 * Can produce multiple findings per IP when different paths each meet the thresholds.
 */
export function detectRepeatedFailedResource(records: readonly LogRecord[]): Finding[] {
  const byIpPath = new Map<string, LogRecord[]>();

  for (const record of records) {
    const key = `${record.ip}||${normalizePath(record.path)}`;
    const list = byIpPath.get(key);
    if (list) {
      list.push(record);
    } else {
      byIpPath.set(key, [record]);
    }
  }

  const findings: Finding[] = [];

  for (const [, group] of byIpPath) {
    if (group.length < FAILED_RESOURCE_MIN_REQUESTS) continue;

    const failedCount = group.filter(r => r.statusCode >= 400 && r.statusCode < 500).length;
    const failureRatio = failedCount / group.length;
    if (failureRatio < FAILED_RESOURCE_MIN_FAILURE_RATIO) continue;

    group.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const ip = group[0].ip;
    const path = group[0].path;
    const severity = assignSeverity(group.length, failureRatio);

    findings.push({
      rule: 'REPEATED_FAILED_RESOURCE',
      ip,
      summary: `${group.length} requests to ${path} with ${Math.round(failureRatio * 100)}% failure rate`,
      description: `Source ${ip} made ${group.length} requests to ${path}, of which ${failedCount} (${Math.round(failureRatio * 100)}%) received 4xx responses. Repeated failed requests to the same resource may indicate probing or misconfiguration.`,
      severity,
      requestCount: group.length,
      firstSeen: group[0].timestamp,
      lastSeen: group[group.length - 1].timestamp,
      evidenceRecords: group,
    });
  }

  return findings.sort((a, b) => b.requestCount - a.requestCount);
}

function normalizePath(path: string): string {
  const idx = path.indexOf('?');
  return (idx >= 0 ? path.slice(0, idx) : path).toLowerCase();
}

function assignSeverity(count: number, failureRatio: number): Severity {
  if (count >= 15 && failureRatio >= 0.95) return 'high';
  if (count >= 10 || failureRatio >= 0.9) return 'medium';
  return 'low';
}
