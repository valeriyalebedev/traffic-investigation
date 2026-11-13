import { describe, it, expect } from 'vitest';
import { LogRecord } from '../../core/models/log-record';
import { Finding } from '../detection/detection-models';
import { identifyAutomationTool, findingAssessment } from './finding-assessment';

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

function makeFinding(overrides: Partial<Finding>): Finding {
  return {
    rule: 'REPEATED_FAILED_RESOURCE',
    ip: '10.0.0.1',
    summary: 'test',
    description: 'test',
    severity: 'low',
    requestCount: 5,
    firstSeen: new Date('2024-01-01T00:00:00Z'),
    lastSeen: new Date('2024-01-01T00:05:00Z'),
    evidenceRecords: [],
    ...overrides,
  };
}

describe('identifyAutomationTool', () => {
  it('identifies Chef Client', () => {
    expect(identifyAutomationTool('Chef Client/10.18.2 (ruby-1.9.3-p448; ohai-6.20.0; x86_64-linux; +http://opscode.com)'))
      .toBe('Chef Client');
  });

  it('identifies curl', () => {
    expect(identifyAutomationTool('curl/7.68.0')).toBe('curl');
  });

  it('identifies wget', () => {
    expect(identifyAutomationTool('Wget/1.21')).toBe('wget');
  });

  it('identifies Python requests', () => {
    expect(identifyAutomationTool('python-requests/2.28.1')).toBe('Python requests');
  });

  it('identifies Go HTTP client', () => {
    expect(identifyAutomationTool('Go-http-client/1.1')).toBe('Go HTTP client');
  });

  it('identifies Jenkins', () => {
    expect(identifyAutomationTool('Jenkins/2.375')).toBe('Jenkins');
  });

  it('returns null for standard browser agents', () => {
    expect(identifyAutomationTool('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'))
      .toBeNull();
  });

  it('returns null for missing agent', () => {
    expect(identifyAutomationTool('-')).toBeNull();
  });

  it('returns null for empty agent', () => {
    expect(identifyAutomationTool('')).toBeNull();
  });
});

describe('findingAssessment', () => {
  it('adds Chef Client context to REPEATED_FAILED_RESOURCE', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({
        lineNumber: i + 1,
        path: '/repo/artifact.jar',
        statusCode: 404,
        userAgent: 'Chef Client/10.18.2 (ruby-1.9.3-p448)',
      }),
    );
    const finding = makeFinding({
      rule: 'REPEATED_FAILED_RESOURCE',
      evidenceRecords: records,
    });
    const text = findingAssessment(finding);
    expect(text).toContain('Chef Client');
    expect(text).toContain('automated retrieval or client misconfiguration');
    expect(text).toContain('rather than malicious intent');
  });

  it('uses generic context for automation tool in VULNERABILITY_PATH_PROBING', () => {
    const records = Array.from({ length: 3 }, (_, i) =>
      makeRecord({
        lineNumber: i + 1,
        path: '/phpmyadmin/',
        userAgent: 'python-requests/2.28.1',
      }),
    );
    const finding = makeFinding({
      rule: 'VULNERABILITY_PATH_PROBING',
      evidenceRecords: records,
    });
    const text = findingAssessment(finding);
    expect(text).toContain('Python requests');
    expect(text).toContain('automated or programmatic access');
  });

  it('returns base assessment when no automation tool is detected', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({
        lineNumber: i + 1,
        path: '/missing',
        statusCode: 404,
        userAgent: 'Mozilla/5.0 (compatible; MSIE 10.0)',
      }),
    );
    const finding = makeFinding({
      rule: 'REPEATED_FAILED_RESOURCE',
      evidenceRecords: records,
    });
    const text = findingAssessment(finding);
    expect(text).toContain('automated retrieval attempts or a misconfigured client');
    expect(text).not.toContain('User-Agent identifies');
  });

  it('returns base assessment when all agents are missing', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({ lineNumber: i + 1, userAgent: '-', statusCode: 404, path: '/x' }),
    );
    const finding = makeFinding({
      rule: 'REPEATED_FAILED_RESOURCE',
      evidenceRecords: records,
    });
    const text = findingAssessment(finding);
    expect(text).not.toContain('User-Agent identifies');
  });

  it('handles multiple distinct automation tools', () => {
    const records = [
      makeRecord({ lineNumber: 1, userAgent: 'curl/7.68.0', statusCode: 404, path: '/x' }),
      makeRecord({ lineNumber: 2, userAgent: 'Wget/1.21', statusCode: 404, path: '/x' }),
      makeRecord({ lineNumber: 3, userAgent: 'curl/7.68.0', statusCode: 404, path: '/x' }),
      makeRecord({ lineNumber: 4, userAgent: 'Wget/1.21', statusCode: 404, path: '/x' }),
      makeRecord({ lineNumber: 5, userAgent: 'curl/7.68.0', statusCode: 404, path: '/x' }),
    ];
    const finding = makeFinding({
      rule: 'REPEATED_FAILED_RESOURCE',
      evidenceRecords: records,
    });
    const text = findingAssessment(finding);
    expect(text).toContain('curl');
    expect(text).toContain('wget');
  });

  it('handles mixed automation and browser agents', () => {
    const records = [
      makeRecord({ lineNumber: 1, userAgent: 'Chef Client/10.18.2', statusCode: 404, path: '/x' }),
      makeRecord({ lineNumber: 2, userAgent: 'Mozilla/5.0', statusCode: 404, path: '/x' }),
      makeRecord({ lineNumber: 3, userAgent: 'Chef Client/10.18.2', statusCode: 404, path: '/x' }),
      makeRecord({ lineNumber: 4, userAgent: 'Mozilla/5.0', statusCode: 404, path: '/x' }),
      makeRecord({ lineNumber: 5, userAgent: 'Chef Client/10.18.2', statusCode: 404, path: '/x' }),
    ];
    const finding = makeFinding({
      rule: 'REPEATED_FAILED_RESOURCE',
      evidenceRecords: records,
    });
    const text = findingAssessment(finding);
    expect(text).toContain('Chef Client');
  });

  it('skips empty user agent strings', () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      makeRecord({ lineNumber: i + 1, userAgent: '', statusCode: 404, path: '/x' }),
    );
    const finding = makeFinding({
      rule: 'REPEATED_FAILED_RESOURCE',
      evidenceRecords: records,
    });
    const text = findingAssessment(finding);
    expect(text).not.toContain('User-Agent identifies');
  });
});
