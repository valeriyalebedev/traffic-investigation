import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { aggregateByStatusClass, StatusClassGroup } from '../../analysis/aggregation/status-code-breakdown';
import { aggregateByTimeBucket, TimeBucket } from '../../analysis/aggregation/time-buckets';
import { DatasetService } from '../../core/services/dataset.service';

interface ChartPoint {
  x: number;
  y: number;
  bucket: TimeBucket;
}

@Component({
  selector: 'app-analytics-section',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './analytics-section.html',
  styleUrl: './analytics-section.scss',
})
export class AnalyticsSection {
  private readonly dataset = inject(DatasetService);

  private readonly bucketResult = computed(() => {
    const r = this.dataset.result();
    return r ? aggregateByTimeBucket(r.records) : null;
  });

  protected readonly buckets = computed(() => this.bucketResult()?.buckets ?? []);
  protected readonly intervalLabel = computed(() => this.bucketResult()?.interval.label ?? 'hour');
  protected readonly hasData = computed(() => this.buckets().length > 0);

  protected readonly activePoint = signal<ChartPoint | null>(null);

  protected readonly chartWidth = 700;
  protected readonly chartHeight = 180;
  protected readonly paddingLeft = 56;
  protected readonly paddingRight = 16;
  protected readonly paddingTop = 12;
  protected readonly paddingBottom = 36;

  protected readonly maxCount = computed(() => {
    const b = this.buckets();
    if (b.length === 0) return 0;
    return Math.max(...b.map(bucket => bucket.count));
  });

  protected readonly yTicks = computed(() => {
    const max = this.maxCount();
    if (max === 0) return [];
    const step = niceStep(max, 4);
    const ticks: number[] = [];
    for (let v = 0; v <= max; v += step) {
      ticks.push(v);
    }
    if (ticks[ticks.length - 1] < max) {
      ticks.push(ticks[ticks.length - 1] + step);
    }
    return ticks;
  });

  protected readonly yMax = computed(() => {
    const ticks = this.yTicks();
    return ticks.length > 0 ? ticks[ticks.length - 1] : 0;
  });

  protected readonly points = computed((): ChartPoint[] => {
    const b = this.buckets();
    if (b.length === 0) return [];

    const yMax = this.yMax();
    const plotLeft = this.paddingLeft;
    const plotRight = this.chartWidth - this.paddingRight;
    const plotTop = this.paddingTop;
    const plotBottom = this.chartHeight - this.paddingBottom;
    const plotW = plotRight - plotLeft;
    const plotH = plotBottom - plotTop;

    const minT = b[0].start.getTime();
    const maxT = b[b.length - 1].start.getTime();
    const rangeT = maxT - minT || 1;

    return b.map(bucket => ({
      x: plotLeft + ((bucket.start.getTime() - minT) / rangeT) * plotW,
      y: plotBottom - (yMax > 0 ? (bucket.count / yMax) * plotH : 0),
      bucket,
    }));
  });

  protected readonly linePath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  });

  protected readonly areaPath = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return '';
    const plotBottom = this.chartHeight - this.paddingBottom;
    const start = `M${pts[0].x},${plotBottom}`;
    const lines = pts.map(p => `L${p.x},${p.y}`).join(' ');
    const end = `L${pts[pts.length - 1].x},${plotBottom} Z`;
    return `${start} ${lines} ${end}`;
  });

  protected readonly xLabels = computed(() => {
    const pts = this.points();
    if (pts.length === 0) return [];

    const maxLabels = 8;
    const step = Math.max(1, Math.ceil(pts.length / maxLabels));
    const labels: { x: number; date: Date }[] = [];

    for (let i = 0; i < pts.length; i += step) {
      labels.push({ x: pts[i].x, date: pts[i].bucket.start });
    }
    return labels;
  });

  protected readonly xLabelFormat = computed(() => {
    const interval = this.bucketResult()?.interval;
    if (!interval) return 'd MMM, HH:mm';
    if (interval.ms >= 86_400_000) return 'd MMM';
    return 'd MMM, HH:mm';
  });

  protected yTickY(value: number): number {
    const yMax = this.yMax();
    const plotTop = this.paddingTop;
    const plotBottom = this.chartHeight - this.paddingBottom;
    const plotH = plotBottom - plotTop;
    return yMax > 0 ? plotBottom - (value / yMax) * plotH : plotBottom;
  }

  protected onPointEnter(pt: ChartPoint): void {
    this.activePoint.set(pt);
  }

  protected onPointLeave(): void {
    this.activePoint.set(null);
  }

  protected readonly tooltipX = computed(() => {
    const pt = this.activePoint();
    if (!pt) return 0;
    const halfW = 80;
    return Math.max(this.paddingLeft + halfW, Math.min(pt.x, this.chartWidth - this.paddingRight - halfW));
  });

  protected readonly tooltipY = computed(() => {
    const pt = this.activePoint();
    if (!pt) return 0;
    const spaceAbove = pt.y - this.paddingTop;
    return spaceAbove >= 42 ? pt.y - 10 : pt.y + 40;
  });

  protected readonly tooltipAbove = computed(() => {
    const pt = this.activePoint();
    if (!pt) return true;
    return (pt.y - this.paddingTop) >= 42;
  });

  // --- Status code donut ---

  protected readonly statusGroups = computed(() => {
    const r = this.dataset.result();
    return r ? aggregateByStatusClass(r.records) : [];
  });

  protected readonly hasStatusData = computed(() => this.statusGroups().length > 0);

  protected readonly donutRadius = 54;
  protected readonly donutStroke = 18;
  protected readonly donutCircumference = 2 * Math.PI * this.donutRadius;

  private static readonly CLASS_COLORS: Record<string, string> = {
    '2xx': '#16A34A',
    '3xx': '#3B82F6',
    '4xx': '#D97706',
    '5xx': '#DC2626',
    'other': '#A1A1AA',
  };

  protected classColor(group: StatusClassGroup): string {
    return AnalyticsSection.CLASS_COLORS[group.classRange] ?? '#A1A1AA';
  }

  protected readonly donutSegments = computed(() => {
    const groups = this.statusGroups();
    const C = this.donutCircumference;
    const segments: { group: StatusClassGroup; dashArray: string; dashOffset: number; color: string }[] = [];
    let offset = C * 0.25;

    for (const group of groups) {
      const len = (group.percentage / 100) * C;
      segments.push({
        group,
        dashArray: `${len} ${C - len}`,
        dashOffset: -offset,
        color: this.classColor(group),
      });
      offset += len;
    }
    return segments;
  });

  protected readonly totalRequests = computed(() => {
    const groups = this.statusGroups();
    return groups.reduce((sum, g) => sum + g.count, 0);
  });

  protected readonly activeSegment = signal<StatusClassGroup | null>(null);

  protected onSegmentEnter(group: StatusClassGroup): void {
    this.activeSegment.set(group);
  }

  protected onSegmentLeave(): void {
    this.activeSegment.set(null);
  }
}

function niceStep(max: number, targetTicks: number): number {
  const rough = max / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;

  if (residual <= 1.5) return magnitude;
  if (residual <= 3) return 2 * magnitude;
  if (residual <= 7) return 5 * magnitude;
  return 10 * magnitude;
}
