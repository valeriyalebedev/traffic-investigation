import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { DatasetService } from '../../core/services/dataset.service';
import { LogUpload } from '../log-upload/log-upload';

@Component({
  selector: 'app-dataset-status',
  standalone: true,
  imports: [LogUpload, DecimalPipe, PercentPipe],
  templateUrl: './dataset-status.html',
  styleUrl: './dataset-status.scss',
})
export class DatasetStatus {
  private readonly dataset = inject(DatasetService);

  protected readonly result = this.dataset.result;
  protected readonly fileName = this.dataset.fileName;
  protected readonly loading = this.dataset.loading;
  protected readonly error = this.dataset.error;

  protected readonly parsedRatio = computed(() => {
    const r = this.result();
    if (!r || r.stats.totalLines === 0) return 0;
    return r.stats.validCount / (r.stats.validCount + r.stats.invalidCount);
  });

  protected readonly hasData = computed(() => !!this.result());

  protected reset(): void {
    this.dataset.clear();
  }
}
