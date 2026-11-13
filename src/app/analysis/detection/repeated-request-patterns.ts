import { LogRecord } from '../../core/models/log-record';
import { Finding, Severity } from './detection-models';

/** Minimum number of distinct steps (method + path pairs) in a detected sequence. */
export const PATTERN_MIN_SEQUENCE_LENGTH = 3;
/** Minimum number of consecutive repetitions of the sequence. */
export const PATTERN_MIN_REPETITIONS = 3;

/**
 * Detects repeated consecutive request sequences from the same IP.
 * Returns at most one finding per IP, selecting the match that covers the most records.
 * Sequences must contain more than one unique step to avoid matching simple repeated requests.
 */
export function detectRepeatedRequestPatterns(records: readonly LogRecord[]): Finding[] {
  const byIp = new Map<string, LogRecord[]>();

  for (const record of records) {
    const list = byIp.get(record.ip);
    if (list) {
      list.push(record);
    } else {
      byIp.set(record.ip, [record]);
    }
  }

  const findings: Finding[] = [];

  for (const [ip, ipRecords] of byIp) {
    const sorted = [...ipRecords].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const result = findRepeatedSequence(sorted);
    if (!result) continue;

    const severity = assignSeverity(result.repetitions, result.sequenceLength);

    findings.push({
      rule: 'REPEATED_REQUEST_PATTERNS',
      ip,
      summary: `${result.repetitions} repetitions of a ${result.sequenceLength}-request sequence`,
      description: `Source ${ip} repeated an identical sequence of ${result.sequenceLength} requests (${result.patternLabel}) ${result.repetitions} times in chronological order. Highly repetitive request sequences may indicate automated behavior.`,
      severity,
      requestCount: result.evidenceRecords.length,
      firstSeen: result.evidenceRecords[0].timestamp,
      lastSeen: result.evidenceRecords[result.evidenceRecords.length - 1].timestamp,
      evidenceRecords: result.evidenceRecords,
    });
  }

  return findings.sort((a, b) => b.requestCount - a.requestCount);
}

interface SequenceMatch {
  repetitions: number;
  sequenceLength: number;
  patternLabel: string;
  evidenceRecords: LogRecord[];
}

/**
 * Searches for a consecutive repeated sequence of request signatures.
 *
 * Uses a sliding window: for each candidate sequence length (starting at the minimum),
 * checks every starting position for consecutive repetitions of that exact sequence.
 * Returns the first match that covers the most records, or `null` if no sequence
 * meets both the minimum length and minimum repetition thresholds.
 * Stops after finding the first qualifying sequence length with a match.
 */
function findRepeatedSequence(sorted: LogRecord[]): SequenceMatch | null {
  if (sorted.length < PATTERN_MIN_SEQUENCE_LENGTH * PATTERN_MIN_REPETITIONS) return null;

  const signatures = sorted.map(r => normalizeSignature(r));
  let best: SequenceMatch | null = null;

  for (let seqLen = PATTERN_MIN_SEQUENCE_LENGTH; seqLen <= Math.floor(sorted.length / PATTERN_MIN_REPETITIONS); seqLen++) {
    for (let start = 0; start <= sorted.length - seqLen * PATTERN_MIN_REPETITIONS; start++) {
      const pattern = signatures.slice(start, start + seqLen);

      if (!isDistinctSequence(pattern)) continue;

      let reps = 1;
      let pos = start + seqLen;

      while (pos + seqLen <= sorted.length) {
        const candidate = signatures.slice(pos, pos + seqLen);
        if (sequencesMatch(pattern, candidate)) {
          reps++;
          pos += seqLen;
        } else {
          break;
        }
      }

      if (reps >= PATTERN_MIN_REPETITIONS) {
        const totalRecords = reps * seqLen;
        if (!best || totalRecords > best.evidenceRecords.length) {
          best = {
            repetitions: reps,
            sequenceLength: seqLen,
            patternLabel: pattern.join(' → '),
            evidenceRecords: sorted.slice(start, start + totalRecords),
          };
        }
      }
    }

    if (best) break;
  }

  return best;
}

function normalizeSignature(record: LogRecord): string {
  const path = record.path.indexOf('?') >= 0
    ? record.path.slice(0, record.path.indexOf('?'))
    : record.path;
  return `${record.method} ${path.toLowerCase()}`;
}

function isDistinctSequence(pattern: string[]): boolean {
  return new Set(pattern).size > 1;
}

function sequencesMatch(a: string[], b: string[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function assignSeverity(repetitions: number, sequenceLength: number): Severity {
  if (repetitions >= 5 && sequenceLength >= 4) return 'high';
  if (repetitions >= 4 || sequenceLength >= 5) return 'medium';
  return 'low';
}
