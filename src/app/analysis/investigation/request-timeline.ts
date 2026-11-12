import { LogRecord } from '../../core/models/log-record';

/**
 * Returns all log records for the given IP address, sorted chronologically ascending.
 *
 * @param records - The full set of parsed log records. Not mutated.
 * @param ip - The source IP address to filter by.
 * @returns A new array of matching LogRecord references in chronological order.
 *   Records with identical timestamps preserve their original relative order.
 */
export function getRequestsByIp(
  records: readonly LogRecord[],
  ip: string
): LogRecord[] {
  return records
    .filter(record => record.ip === ip)
    // Stable sort: records with equal timestamps keep their filter-order (original relative order).
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}
