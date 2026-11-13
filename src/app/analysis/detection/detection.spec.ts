import { describe, it, expect } from 'vitest';
import { LogRecord } from '../../core/models/log-record';
import { detectVulnerabilityPathProbing, VULN_PROBE_MIN_HITS } from './vulnerability-path-probing';
import { detectRepeatedFailedResource, FAILED_RESOURCE_MIN_REQUESTS, FAILED_RESOURCE_MIN_FAILURE_RATIO } from './repeated-failed-resource';
import { detectRepeatedRequestPatterns, PATTERN_MIN_REPETITIONS, PATTERN_MIN_SEQUENCE_LENGTH } from './repeated-request-patterns';
import { runDetection } from './run-detection';
import { isSensitivePath } from './sensitive-paths';

function makeRecord(overrides: Partial<LogRecord>): LogRecord {
  return {
    lineNumber: 1,
    rawLine: '',
    ip: '10.0.0.1',
    identity: '-',
    user: '-',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    method: 'GET',
    requestTarget: 'GET / HTTP/1.1',
    path: '/',
    protocol: 'HTTP/1.1',
    statusCode: 200,
    responseSize: 0,
    referrer: '-',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

// --- Sensitive paths ---

describe('isSensitivePath', () => {
  it('matches exact sensitive paths', () => {
    expect(isSensitivePath('/.env')).toBe(true);
    expect(isSensitivePath('/wp-login.php')).toBe(true);
    expect(isSensitivePath('/phpinfo.php')).toBe(true);
  });

  it('matches directory-based paths with trailing content', () => {
    expect(isSensitivePath('/phpmyadmin/index.php')).toBe(true);
    expect(isSensitivePath('/fckeditor/editor/filemanager/upload.php')).toBe(true);
    expect(isSensitivePath('/wp-admin/admin.php')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isSensitivePath('/PhpMyAdmin/')).toBe(true);
    expect(isSensitivePath('/.ENV')).toBe(true);
  });

  it('strips query parameters before matching', () => {
    expect(isSensitivePath('/.env?foo=bar')).toBe(true);
  });

  it('does not match ordinary paths', () => {
    expect(isSensitivePath('/')).toBe(false);
    expect(isSensitivePath('/index.html')).toBe(false);
    expect(isSensitivePath('/api/users')).toBe(false);
  });

  it('does not match partial substrings', () => {
    expect(isSensitivePath('/some-admin-page')).toBe(false);
    expect(isSensitivePath('/my-phpmyadmin-tool')).toBe(false);
  });

  it('matches directory path without trailing slash', () => {
    expect(isSensitivePath('/phpmyadmin')).toBe(true);
  });

  it('matches sensitive directory nested under another path', () => {
    expect(isSensitivePath('/blog/page/fckeditor/editor/fckeditor.html')).toBe(true);
    expect(isSensitivePath('/app/phpmyadmin/index.php')).toBe(true);
    expect(isSensitivePath('/site/wp-admin/admin-ajax.php')).toBe(true);
    expect(isSensitivePath('/deep/nested/path/cgi-bin/test.cgi')).toBe(true);
  });

  it('matches nested sensitive directory case-insensitively', () => {
    expect(isSensitivePath('/blog/page/FCKeditor/editor/fckeditor.html')).toBe(true);
    expect(isSensitivePath('/app/PhpMyAdmin/index.php')).toBe(true);
  });

  it('does not match directory prefixes that extend the sensitive name', () => {
    expect(isSensitivePath('/fckeditor-backup/file.html')).toBe(false);
    expect(isSensitivePath('/phpmyadmin-old/index.php')).toBe(false);
  });

  it('does not match when sensitive name is a suffix of a longer segment', () => {
    expect(isSensitivePath('/not-fckeditor/editor/file.html')).toBe(false);
    expect(isSensitivePath('/custom-phpmyadmin/index.php')).toBe(false);
  });

  it('does not match file entries nested under another path', () => {
    expect(isSensitivePath('/app/.env')).toBe(false);
    expect(isSensitivePath('/blog/wp-login.php')).toBe(false);
  });
});

// --- VULNERABILITY_PATH_PROBING ---

describe('detectVulnerabilityPathProbing', () => {
  it('returns empty for empty input', () => {
    expect(detectVulnerabilityPathProbing([])).toEqual([]);
  });

  it('does not trigger below threshold', () => {
    const records = [
      makeRecord({ path: '/phpmyadmin/', timestamp: new Date('2024-01-01T00:00:00Z') }),
      makeRecord({ path: '/.env', timestamp: new Date('2024-01-01T00:01:00Z') }),
    ];
    expect(detectVulnerabilityPathProbing(records)).toEqual([]);
  });

  it('triggers at threshold with sensitive paths', () => {
    const records = Array.from({ length: VULN_PROBE_MIN_HITS }, (_, i) =>
      makeRecord({
        path: '/phpmyadmin/index.php',
        timestamp: new Date(`2024-01-01T00:0${i}:00Z`),
      }),
    );
    const findings = detectVulnerabilityPathProbing(records);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('VULNERABILITY_PATH_PROBING');
    expect(findings[0].ip).toBe('10.0.0.1');
    expect(findings[0].evidenceRecords).toHaveLength(VULN_PROBE_MIN_HITS);
  });

  it('does not trigger on non-sensitive paths regardless of count', () => {
    const records = Array.from({ length: 20 }, (_, i) =>
      makeRecord({ path: '/api/users', timestamp: new Date(`2024-01-01T00:0${i}:00Z`) }),
    );
    expect(detectVulnerabilityPathProbing(records)).toEqual([]);
  });

  it('separates findings by IP', () => {
    const records = [
      ...Array.from({ length: 3 }, () => makeRecord({ ip: '10.0.0.1', path: '/.env' })),
      ...Array.from({ length: 3 }, () => makeRecord({ ip: '10.0.0.2', path: '/.env' })),
    ];
    const findings = detectVulnerabilityPathProbing(records);
    expect(findings).toHaveLength(2);
    expect(new Set(findings.map(f => f.ip))).toEqual(new Set(['10.0.0.1', '10.0.0.2']));
  });

  it('triggers on sensitive paths nested under page paths', () => {
    const records = [
      makeRecord({ method: 'HEAD', path: '/blog/page/fckeditor/editor/fckeditor.html', statusCode: 404, timestamp: new Date('2024-01-01T00:00:00Z') }),
      makeRecord({ method: 'HEAD', path: '/blog/page/fckeditor/editor/filemanager/upload.php', statusCode: 404, timestamp: new Date('2024-01-01T00:00:10Z') }),
      makeRecord({ method: 'HEAD', path: '/blog/page/admin/FCKeditor/editor/fckeditor.html', statusCode: 404, timestamp: new Date('2024-01-01T00:00:20Z') }),
    ];
    const findings = detectVulnerabilityPathProbing(records);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('VULNERABILITY_PATH_PROBING');
    expect(findings[0].requestCount).toBe(3);
  });

  it('assigns high severity for many hits across multiple paths', () => {
    const paths = ['/phpmyadmin/', '/.env', '/.git/config', '/wp-login.php', '/phpinfo.php'];
    const records = paths.flatMap(path =>
      Array.from({ length: 2 }, (_, i) =>
        makeRecord({ path, timestamp: new Date(`2024-01-01T00:0${i}:00Z`) }),
      ),
    );
    const findings = detectVulnerabilityPathProbing(records);
    expect(findings[0].severity).toBe('high');
  });
});

// --- REPEATED_FAILED_RESOURCE ---

describe('detectRepeatedFailedResource', () => {
  it('returns empty for empty input', () => {
    expect(detectRepeatedFailedResource([])).toEqual([]);
  });

  it('does not trigger below request count threshold', () => {
    const records = Array.from({ length: FAILED_RESOURCE_MIN_REQUESTS - 1 }, (_, i) =>
      makeRecord({ path: '/missing', statusCode: 404, timestamp: new Date(`2024-01-01T00:0${i}:00Z`) }),
    );
    expect(detectRepeatedFailedResource(records)).toEqual([]);
  });

  it('does not trigger if failure ratio is below threshold', () => {
    const records = [
      ...Array.from({ length: 2 }, () => makeRecord({ path: '/page', statusCode: 404 })),
      ...Array.from({ length: 8 }, () => makeRecord({ path: '/page', statusCode: 200 })),
    ];
    expect(detectRepeatedFailedResource(records)).toEqual([]);
  });

  it('triggers when both thresholds are met', () => {
    const records = Array.from({ length: FAILED_RESOURCE_MIN_REQUESTS }, (_, i) =>
      makeRecord({ path: '/admin/secret', statusCode: 403, timestamp: new Date(`2024-01-01T00:0${i}:00Z`) }),
    );
    const findings = detectRepeatedFailedResource(records);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('REPEATED_FAILED_RESOURCE');
    expect(findings[0].requestCount).toBe(FAILED_RESOURCE_MIN_REQUESTS);
  });

  it('does not conflate different paths from the same IP', () => {
    const records = [
      ...Array.from({ length: 3 }, () => makeRecord({ path: '/a', statusCode: 404 })),
      ...Array.from({ length: 3 }, () => makeRecord({ path: '/b', statusCode: 404 })),
    ];
    expect(detectRepeatedFailedResource(records)).toEqual([]);
  });

  it('normalizes paths case-insensitively and strips query params', () => {
    const records = [
      ...Array.from({ length: 3 }, () => makeRecord({ path: '/Page?v=1', statusCode: 404 })),
      ...Array.from({ length: 2 }, () => makeRecord({ path: '/page?v=2', statusCode: 404 })),
    ];
    const findings = detectRepeatedFailedResource(records);
    expect(findings).toHaveLength(1);
    expect(findings[0].requestCount).toBe(5);
  });

  it('only counts 4xx as failures, not 5xx', () => {
    const records = Array.from({ length: 5 }, () =>
      makeRecord({ path: '/api', statusCode: 500 }),
    );
    expect(detectRepeatedFailedResource(records)).toEqual([]);
  });

  it('produces distinct findings for the same IP with different failing paths', () => {
    const records = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeRecord({ path: '/missing-a', statusCode: 404, timestamp: new Date(`2024-01-01T00:0${i}:00Z`) }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeRecord({ path: '/missing-b', statusCode: 404, timestamp: new Date(`2024-01-01T01:0${i}:00Z`) }),
      ),
    ];
    const findings = detectRepeatedFailedResource(records);
    expect(findings).toHaveLength(2);
    expect(findings[0].ip).toBe(findings[1].ip);
    expect(findings[0].rule).toBe(findings[1].rule);
    expect(findings[0].summary).not.toBe(findings[1].summary);
  });
});

// --- REPEATED_REQUEST_PATTERNS ---

describe('detectRepeatedRequestPatterns', () => {
  it('returns empty for empty input', () => {
    expect(detectRepeatedRequestPatterns([])).toEqual([]);
  });

  it('does not trigger on repeated identical individual requests', () => {
    const records = Array.from({ length: 9 }, (_, i) =>
      makeRecord({ method: 'GET', path: '/', timestamp: new Date(`2024-01-01T00:0${i}:00Z`) }),
    );
    expect(detectRepeatedRequestPatterns(records)).toEqual([]);
  });

  it('triggers on repeated sequence of distinct requests', () => {
    const sequence = [
      { method: 'GET', path: '/a' },
      { method: 'POST', path: '/b' },
      { method: 'GET', path: '/c' },
    ];
    const records: LogRecord[] = [];
    let minute = 0;
    for (let rep = 0; rep < PATTERN_MIN_REPETITIONS; rep++) {
      for (const step of sequence) {
        records.push(makeRecord({
          ...step,
          timestamp: new Date(`2024-01-01T00:${String(minute).padStart(2, '0')}:00Z`),
        }));
        minute++;
      }
    }

    const findings = detectRepeatedRequestPatterns(records);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe('REPEATED_REQUEST_PATTERNS');
    expect(findings[0].requestCount).toBe(PATTERN_MIN_REPETITIONS * sequence.length);
  });

  it('does not trigger with fewer than required repetitions', () => {
    const sequence = [
      { method: 'GET', path: '/a' },
      { method: 'POST', path: '/b' },
      { method: 'GET', path: '/c' },
    ];
    const records: LogRecord[] = [];
    let minute = 0;
    for (let rep = 0; rep < PATTERN_MIN_REPETITIONS - 1; rep++) {
      for (const step of sequence) {
        records.push(makeRecord({
          ...step,
          timestamp: new Date(`2024-01-01T00:${String(minute).padStart(2, '0')}:00Z`),
        }));
        minute++;
      }
    }

    expect(detectRepeatedRequestPatterns(records)).toEqual([]);
  });

  it('analyzes each IP independently', () => {
    const sequence = [
      { method: 'GET', path: '/a' },
      { method: 'POST', path: '/b' },
      { method: 'GET', path: '/c' },
    ];
    const records: LogRecord[] = [];
    let minute = 0;
    for (let rep = 0; rep < PATTERN_MIN_REPETITIONS; rep++) {
      for (const [i, step] of sequence.entries()) {
        records.push(makeRecord({
          ip: i === 0 ? '10.0.0.1' : '10.0.0.2',
          ...step,
          timestamp: new Date(`2024-01-01T00:${String(minute).padStart(2, '0')}:00Z`),
        }));
        minute++;
      }
    }

    expect(detectRepeatedRequestPatterns(records)).toEqual([]);
  });

  it('ignores query parameters when comparing paths', () => {
    const records: LogRecord[] = [];
    let minute = 0;
    for (let rep = 0; rep < 3; rep++) {
      records.push(makeRecord({ method: 'GET', path: `/a?t=${rep}`, timestamp: new Date(`2024-01-01T00:${String(minute++).padStart(2, '0')}:00Z`) }));
      records.push(makeRecord({ method: 'POST', path: `/b?t=${rep}`, timestamp: new Date(`2024-01-01T00:${String(minute++).padStart(2, '0')}:00Z`) }));
      records.push(makeRecord({ method: 'GET', path: `/c?t=${rep}`, timestamp: new Date(`2024-01-01T00:${String(minute++).padStart(2, '0')}:00Z`) }));
    }

    const findings = detectRepeatedRequestPatterns(records);
    expect(findings).toHaveLength(1);
  });

  it('does not detect a pattern when an unrelated request interrupts consecutive repetitions', () => {
    // Sequence: [A, B, C, X, A, B, C, A, B, C]
    // The algorithm requires ≥ 3 *consecutive* repetitions of the same sequence.
    // Here A,B,C appears 3 times but only 2 are consecutive (after X).
    // The first occurrence is separated from the rest by X, so no run of 3.
    const sequence = [
      { method: 'GET', path: '/a' },
      { method: 'POST', path: '/b' },
      { method: 'GET', path: '/c' },
    ];
    const records: LogRecord[] = [];
    let minute = 0;
    const ts = () => new Date(`2024-01-01T00:${String(minute++).padStart(2, '0')}:00Z`);

    // First occurrence of A, B, C
    for (const step of sequence) {
      records.push(makeRecord({ ...step, timestamp: ts() }));
    }
    // Interruption: unrelated request
    records.push(makeRecord({ method: 'DELETE', path: '/unrelated', timestamp: ts() }));
    // Second and third occurrences of A, B, C (only 2 consecutive)
    for (let rep = 0; rep < 2; rep++) {
      for (const step of sequence) {
        records.push(makeRecord({ ...step, timestamp: ts() }));
      }
    }

    expect(detectRepeatedRequestPatterns(records)).toEqual([]);
  });

  it('produces at most one finding per IP even with multiple qualifying patterns', () => {
    const sequenceA = [
      { method: 'GET', path: '/x' },
      { method: 'POST', path: '/y' },
      { method: 'GET', path: '/z' },
    ];
    const sequenceB = [
      { method: 'PUT', path: '/p' },
      { method: 'DELETE', path: '/q' },
      { method: 'GET', path: '/r' },
    ];
    const records: LogRecord[] = [];
    let minute = 0;
    for (let rep = 0; rep < 3; rep++) {
      for (const step of sequenceA) {
        records.push(makeRecord({
          ...step,
          timestamp: new Date(`2024-01-01T00:${String(minute).padStart(2, '0')}:00Z`),
        }));
        minute++;
      }
    }
    for (let rep = 0; rep < 3; rep++) {
      for (const step of sequenceB) {
        records.push(makeRecord({
          ...step,
          timestamp: new Date(`2024-01-01T00:${String(minute).padStart(2, '0')}:00Z`),
        }));
        minute++;
      }
    }

    const findings = detectRepeatedRequestPatterns(records);
    expect(findings).toHaveLength(1);
  });
});

// --- Orchestrator ---

describe('runDetection', () => {
  it('returns empty for empty input', () => {
    expect(runDetection([])).toEqual([]);
  });

  it('combines findings from multiple rules', () => {
    const records = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeRecord({ ip: '10.0.0.1', path: '/phpmyadmin/', timestamp: new Date(`2024-01-01T00:0${i}:00Z`) }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeRecord({ ip: '10.0.0.2', path: '/missing', statusCode: 404, timestamp: new Date(`2024-01-01T01:0${i}:00Z`) }),
      ),
    ];

    const findings = runDetection(records);
    const rules = new Set(findings.map(f => f.rule));
    expect(rules).toEqual(new Set(['VULNERABILITY_PATH_PROBING', 'REPEATED_FAILED_RESOURCE']));
  });

  it('sorts findings by severity then request count descending', () => {
    const records = [
      // IP 1: 3 sensitive-path hits → low severity VULNERABILITY_PATH_PROBING, requestCount 3
      ...Array.from({ length: 3 }, (_, i) =>
        makeRecord({ ip: '10.0.0.1', path: '/.env', timestamp: new Date(`2024-01-01T00:0${i}:00Z`) }),
      ),
      // IP 2: 4 sensitive-path hits → low severity VULNERABILITY_PATH_PROBING, requestCount 4
      ...Array.from({ length: 4 }, (_, i) =>
        makeRecord({ ip: '10.0.0.2', path: '/.env', timestamp: new Date(`2024-01-01T01:0${i}:00Z`) }),
      ),
      // IP 3: 10 sensitive-path hits → high severity VULNERABILITY_PATH_PROBING, requestCount 10
      ...Array.from({ length: 10 }, (_, i) =>
        makeRecord({ ip: '10.0.0.3', path: '/phpmyadmin/', timestamp: new Date(`2024-01-01T02:${String(i).padStart(2, '0')}:00Z`) }),
      ),
    ];

    const findings = runDetection(records);
    expect(findings.length).toBe(3);

    expect(findings[0].severity).toBe('high');
    expect(findings[0].ip).toBe('10.0.0.3');

    expect(findings[1].severity).toBe('low');
    expect(findings[1].requestCount).toBe(4);
    expect(findings[1].ip).toBe('10.0.0.2');

    expect(findings[2].severity).toBe('low');
    expect(findings[2].requestCount).toBe(3);
    expect(findings[2].ip).toBe('10.0.0.1');
  });
});
