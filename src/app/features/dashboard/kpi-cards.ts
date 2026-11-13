import { DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { aggregateByIp } from '../../analysis/aggregation/traffic-aggregation';
import { runDetection } from '../../analysis/detection/run-detection';
import { DatasetService } from '../../core/services/dataset.service';

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './kpi-cards.html',
  styleUrl: './kpi-cards.scss',
})
export class KpiCards {
  private readonly dataset = inject(DatasetService);

  private readonly summaries = computed(() => {
    const r = this.dataset.result();
    return r ? aggregateByIp(r.records) : [];
  });

  protected readonly totalRequests = computed(() => {
    const r = this.dataset.result();
    return r ? r.stats.validCount : null;
  });

  protected readonly uniqueIps = computed(() => {
    const s = this.summaries();
    return s.length > 0 ? s.length : null;
  });

  protected readonly uniqueUserAgents = computed(() => {
    const r = this.dataset.result();
    if (!r || r.records.length === 0) return null;
    return new Set(r.records.map(rec => rec.userAgent)).size;
  });

  protected readonly findingCount = computed(() => {
    const r = this.dataset.result();
    if (!r) return null;
    return runDetection(r.records).length;
  });
}
