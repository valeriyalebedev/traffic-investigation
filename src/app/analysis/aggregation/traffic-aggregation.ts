import { LogRecord } from '../../core/models/log-record';
import { SourceSummary } from '../models/source-summary';

/** Aggregates parsed log records by source IP, sorted by request count descending. */
export function aggregateByIp(records: readonly LogRecord[]): SourceSummary[] {
  const map = new Map<string, SourceSummary>();

  for (const record of records) {
    const existing = map.get(record.ip);

    if (existing) {
      existing.requestCount++;
      if (record.timestamp < existing.firstSeen) {
        existing.firstSeen = record.timestamp;
      }
      if (record.timestamp > existing.lastSeen) {
        existing.lastSeen = record.timestamp;
      }
      const statusKey = String(record.statusCode);
      existing.statusCounts[statusKey] = (existing.statusCounts[statusKey] ?? 0) + 1;
      existing.methodCounts[record.method] = (existing.methodCounts[record.method] ?? 0) + 1;
    } else {
      map.set(record.ip, {
        ip: record.ip,
        requestCount: 1,
        firstSeen: record.timestamp,
        lastSeen: record.timestamp,
        statusCounts: { [String(record.statusCode)]: 1 },
        methodCounts: { [record.method]: 1 },
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    b.requestCount - a.requestCount || a.ip.localeCompare(b.ip),
  );
}
