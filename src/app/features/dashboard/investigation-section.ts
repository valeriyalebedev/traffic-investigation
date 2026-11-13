import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { findingAssessment } from '../../analysis/assessment/finding-assessment';
import { Finding, DetectionRule } from '../../analysis/detection/detection-models';
import { runDetection } from '../../analysis/detection/run-detection';
import { aggregateByIp } from '../../analysis/aggregation/traffic-aggregation';
import { getRequestsByIp } from '../../analysis/investigation/request-timeline';
import { DatasetService } from '../../core/services/dataset.service';
import { SourceSummary } from '../../analysis/models/source-summary';
import { LogRecord } from '../../core/models/log-record';

export type InvestigationTab = 'overview' | 'requests' | 'timeline';

export interface MetricCard {
  label: string;
  value: string;
  tooltip?: string;
  icon: 'requests' | 'clock' | 'status' | 'agent';
}

export interface TimelineEvent {
  record: LogRecord;
  gapSeconds: number | null;
  isEvidence: boolean;
}

@Component({
  selector: 'app-investigation-section',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './investigation-section.html',
  styleUrl: './investigation-section.scss',
})
export class InvestigationSection {
  private readonly dataset = inject(DatasetService);

  readonly findings = computed(() => {
    const r = this.dataset.result();
    return r ? runDetection(r.records) : [];
  });

  readonly findingCount = computed(() => this.findings().length);

  readonly selectedIp = signal<string | null>(null);
  readonly activeTab = signal<InvestigationTab>('overview');
  protected readonly showRulesInfo = signal(false);
  protected readonly expandedFindingId = signal<string | null>(null);
  protected readonly selectedFinding = signal<Finding | null>(null);
  protected readonly requestsFilter = signal<'all' | 'matched'>('all');

  constructor() {
    effect(() => {
      this.selectedIp();
      this.activeTab.set('overview');
    });

    effect(() => {
      this.dataset.result();
      this.selectedIp.set(null);
      this.selectedFinding.set(null);
      this.expandedFindingId.set(null);
      this.requestsFilter.set('all');
    });
  }

  private readonly summaries = computed(() => {
    const r = this.dataset.result();
    return r ? aggregateByIp(r.records) : [];
  });

  protected readonly sourceSummary = computed((): SourceSummary | null => {
    const ip = this.selectedIp();
    if (!ip) return null;
    return this.summaries().find(s => s.ip === ip) ?? null;
  });

  protected readonly sourceTimeline = computed((): LogRecord[] => {
    const ip = this.selectedIp();
    const r = this.dataset.result();
    if (!ip || !r) return [];
    return getRequestsByIp(r.records, ip);
  });

  protected readonly sourceFindings = computed((): Finding[] => {
    const ip = this.selectedIp();
    if (!ip) return [];
    return this.findings().filter(f => f.ip === ip);
  });

  protected readonly highestSeverity = computed(() => {
    const findings = this.sourceFindings();
    if (findings.some(f => f.severity === 'high')) return 'high';
    if (findings.some(f => f.severity === 'medium')) return 'medium';
    if (findings.length > 0) return 'low';
    return null;
  });

  protected readonly priorityLabel = computed(() => {
    const s = this.highestSeverity();
    if (s === 'high') return 'High priority';
    if (s === 'medium') return 'Medium priority';
    if (s === 'low') return 'Low priority';
    return null;
  });

  protected readonly metricCards = computed((): MetricCard[] => {
    const summary = this.sourceSummary();
    if (!summary) return [];

    const span = summary.lastSeen.getTime() - summary.firstSeen.getTime();
    const spanLabel = formatDuration(span);

    const statusEntries = Object.entries(summary.statusCounts)
      .sort(([, a], [, b]) => b - a);
    const topStatus = statusEntries.length > 0
      ? `HTTP ${statusEntries[0][0]}`
      : 'None';
    const topStatusCount = statusEntries.length > 0
      ? statusEntries[0][1]
      : 0;

    const timeline = this.sourceTimeline();
    const agents = new Set(timeline.map(r => r.userAgent));
    let agentLabel: string;
    let agentTooltip: string;
    if (agents.size === 0) {
      agentLabel = 'No data';
      agentTooltip = agentLabel;
    } else if (agents.size === 1) {
      const val = [...agents][0];
      if (val === '-' || val === '') {
        agentLabel = 'Missing';
        agentTooltip = 'No User-Agent header provided';
      } else {
        agentLabel = truncate(val, 28);
        agentTooltip = val;
      }
    } else {
      agentLabel = 'Multiple';
      agentTooltip = [...agents]
        .map(a => a === '-' || a === '' ? '(missing)' : a)
        .join('\n');
    }

    return [
      { label: 'Total requests', value: String(summary.requestCount), tooltip: 'Total requests from this source IP across the loaded dataset', icon: 'requests' },
      { label: 'Observed span', value: spanLabel, icon: 'clock' },
      { label: topStatus, value: String(topStatusCount), icon: 'status' },
      { label: 'User-Agent', value: agentLabel, tooltip: agentTooltip, icon: 'agent' },
    ];
  });

  protected readonly evidenceIndicators = computed((): string[] => {
    const findings = this.sourceFindings();
    const summary = this.sourceSummary();
    if (findings.length === 0 || !summary) return [];

    const indicators: string[] = [];

    const methods = Object.keys(summary.methodCounts);
    if (methods.length === 1) {
      indicators.push(`${methods[0]} method exclusively`);
    } else if (methods.length > 1) {
      indicators.push(`Methods: ${methods.join(', ')}`);
    }

    for (const f of findings) {
      if (f.rule === 'VULNERABILITY_PATH_PROBING') {
        const paths = new Set(f.evidenceRecords.map(r => r.path.toLowerCase()));
        indicators.push(`${paths.size} distinct sensitive path${paths.size !== 1 ? 's' : ''} requested`);
      }
      if (f.rule === 'REPEATED_FAILED_RESOURCE') {
        const failedCount = f.evidenceRecords.filter(r => r.statusCode >= 400 && r.statusCode < 500).length;
        const ratio = f.evidenceRecords.length > 0
          ? Math.round((failedCount / f.evidenceRecords.length) * 100)
          : 0;
        indicators.push(`${ratio}% HTTP 4xx responses on targeted resource`);
      }
      if (f.rule === 'REPEATED_REQUEST_PATTERNS') {
        indicators.push(f.summary.charAt(0).toUpperCase() + f.summary.slice(1));
      }
    }

    const timeline = this.sourceTimeline();
    const agents = new Set(timeline.map(r => r.userAgent));
    if (agents.size === 1 && (agents.has('-') || agents.has(''))) {
      indicators.push('No User-Agent provided');
    }

    return indicators;
  });

  protected readonly analystAssessment = computed((): string => {
    const findings = this.sourceFindings();
    if (findings.length === 0) return '';

    const parts: string[] = [];
    for (const f of findings) {
      parts.push(findingAssessment(f));
    }
    parts.push('This is not proof of successful exploitation or malicious intent.');
    return parts.join(' ');
  });

  protected readonly timelineEvents = computed((): TimelineEvent[] => {
    const records = this.sourceTimeline();
    const evidenceSet = this.selectedEvidenceLines();
    if (records.length === 0) return [];

    const events: TimelineEvent[] = [];
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      let gapSeconds: number | null = null;
      if (i > 0) {
        const diff = (record.timestamp.getTime() - records[i - 1].timestamp.getTime()) / 1000;
        if (diff >= 60) {
          gapSeconds = diff;
        }
      }
      events.push({
        record,
        gapSeconds,
        isEvidence: evidenceSet.has(record.lineNumber),
      });
    }
    return events;
  });

  protected readonly statusEntries = computed(() => {
    const summary = this.sourceSummary();
    if (!summary) return [];
    return Object.entries(summary.statusCounts)
      .sort(([, a], [, b]) => b - a);
  });

  protected readonly methodEntries = computed(() => {
    const summary = this.sourceSummary();
    if (!summary) return [];
    return Object.entries(summary.methodCounts)
      .sort(([, a], [, b]) => b - a);
  });

  protected selectFinding(finding: Finding): void {
    this.selectedIp.set(finding.ip);
    this.selectedFinding.set(finding);
    this.requestsFilter.set('all');
  }

  protected clearSelection(): void {
    this.selectedIp.set(null);
    this.selectedFinding.set(null);
    this.requestsFilter.set('all');
  }

  protected selectTab(tab: InvestigationTab): void {
    this.activeTab.set(tab);
  }

  protected toggleRulesInfo(): void {
    this.showRulesInfo.update(v => !v);
  }

  protected findingId(finding: Finding): string {
    return finding.ip + ':' + finding.rule + ':' + finding.summary;
  }

  protected toggleExpansion(finding: Finding, event: Event): void {
    event.stopPropagation();
    const id = this.findingId(finding);
    this.expandedFindingId.update(v => v === id ? null : id);
  }

  protected ruleCondition(rule: DetectionRule): string {
    switch (rule) {
      case 'VULNERABILITY_PATH_PROBING':
        return 'Triggers when ≥ 3 requests target known sensitive or vulnerable paths from the same source.';
      case 'REPEATED_FAILED_RESOURCE':
        return 'Triggers when ≥ 5 requests to the same resource return ≥ 80% HTTP 4xx responses.';
      case 'REPEATED_REQUEST_PATTERNS':
        return 'Triggers when the same ordered sequence of ≥ 3 requests repeats ≥ 3 consecutive times.';
    }
  }

  protected findingDetailRows(finding: Finding): { label: string; value: string }[] {
    const rows: { label: string; value: string }[] = [];
    switch (finding.rule) {
      case 'VULNERABILITY_PATH_PROBING': {
        const paths = [...new Set(finding.evidenceRecords.map(r => r.path))];
        rows.push({ label: 'Matched requests', value: String(finding.requestCount) });
        rows.push({ label: 'Sensitive paths', value: paths.join(', ') });
        const methods = [...new Set(finding.evidenceRecords.map(r => r.method))];
        rows.push({ label: 'Methods', value: methods.join(', ') });
        rows.push({ label: 'Response codes', value: statusBreakdown(finding.evidenceRecords) });
        rows.push({ label: 'Time range', value: formatTimeRange(finding.firstSeen, finding.lastSeen) });
        break;
      }
      case 'REPEATED_FAILED_RESOURCE': {
        const failed = finding.evidenceRecords.filter(r => r.statusCode >= 400 && r.statusCode < 500).length;
        const total = finding.evidenceRecords.length;
        const pct = total > 0 ? Math.round((failed / total) * 100) : 0;
        rows.push({ label: 'Target resource', value: finding.evidenceRecords[0]?.path ?? '—' });
        rows.push({ label: 'Matched requests', value: String(total) });
        rows.push({ label: 'Failure rate', value: `${pct}% (${failed} of ${total} requests)` });
        rows.push({ label: 'Response codes', value: statusBreakdown(finding.evidenceRecords) });
        rows.push({ label: 'Time range', value: formatTimeRange(finding.firstSeen, finding.lastSeen) });
        break;
      }
      case 'REPEATED_REQUEST_PATTERNS': {
        const sm = finding.summary.match(/(\d+) repetitions? of a (\d+)-request/);
        if (sm) {
          rows.push({ label: 'Repetitions', value: sm[1] });
          rows.push({ label: 'Sequence length', value: `${sm[2]} steps` });
        }
        const dm = finding.description.match(/\(([^)]+)\)/);
        if (dm) {
          rows.push({ label: 'Pattern', value: dm[1] });
        }
        rows.push({ label: 'Matched requests', value: String(finding.requestCount) });
        rows.push({ label: 'Time range', value: formatTimeRange(finding.firstSeen, finding.lastSeen) });
        break;
      }
    }
    return rows;
  }

  protected behaviorTag(rule: DetectionRule): string {
    return behaviorTagLabel(rule);
  }

  protected readonly sourceBehaviorTags = computed((): string[] => {
    return [...new Set(this.sourceFindings().map(f => behaviorTagLabel(f.rule)))];
  });

  protected severityClass(severity: string): string {
    return `severity--${severity}`;
  }

  private readonly selectedEvidenceLines = computed(() => {
    const finding = this.selectedFinding();
    if (!finding) return new Set<number>();
    return new Set(finding.evidenceRecords.map(r => r.lineNumber));
  });

  protected readonly matchedRequestCount = computed((): number => {
    const finding = this.selectedFinding();
    return finding ? finding.evidenceRecords.length : 0;
  });

  protected readonly filteredTimeline = computed((): LogRecord[] => {
    const records = this.sourceTimeline();
    if (this.requestsFilter() === 'all') return records;
    const lines = this.selectedEvidenceLines();
    return records.filter(r => lines.has(r.lineNumber));
  });

  protected isEvidence(record: LogRecord): boolean {
    return this.selectedEvidenceLines().has(record.lineNumber);
  }

  protected ruleLabel(rule: string): string {
    switch (rule) {
      case 'VULNERABILITY_PATH_PROBING': return 'Vulnerability Path Probing';
      case 'REPEATED_FAILED_RESOURCE': return 'Repeated Failed Resource';
      case 'REPEATED_REQUEST_PATTERNS': return 'Repeated Request Pattern';
      default: return rule;
    }
  }

  protected ruleDescription(rule: string): string {
    switch (rule) {
      case 'VULNERABILITY_PATH_PROBING':
        return 'Requests to known vulnerable or admin paths.';
      case 'REPEATED_FAILED_RESOURCE':
        return 'Multiple requests to the same missing resource.';
      case 'REPEATED_REQUEST_PATTERNS':
        return 'Repeated identical request sequences.';
      default:
        return '';
    }
  }

  protected formatGap(seconds: number): string {
    return formatDuration(seconds * 1000);
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} sec`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes} min ${seconds} sec` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  if (hours < 24) {
    return remainMinutes > 0 ? `${hours} hr ${remainMinutes} min` : `${hours} hr`;
  }
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days} d ${remainHours} hr` : `${days} d`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function formatTimeRange(first: Date, last: Date): string {
  const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
  return `${fmt(first)} – ${fmt(last)}`;
}

function statusBreakdown(records: readonly LogRecord[]): string {
  const counts = new Map<number, number>();
  for (const r of records) {
    counts.set(r.statusCode, (counts.get(r.statusCode) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([code, n]) => `${code} × ${n}`)
    .join(', ');
}

function behaviorTagLabel(rule: DetectionRule): string {
  switch (rule) {
    case 'VULNERABILITY_PATH_PROBING': return 'Possible scanning';
    case 'REPEATED_FAILED_RESOURCE': return 'Unusual traffic';
    case 'REPEATED_REQUEST_PATTERNS': return 'Potential automation';
  }
}
