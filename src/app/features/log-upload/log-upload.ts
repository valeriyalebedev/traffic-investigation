import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { DatasetService } from '../../core/services/dataset.service';

@Component({
  selector: 'app-log-upload',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './log-upload.html',
  styleUrl: './log-upload.scss',
})
export class LogUpload {
  private readonly dataset = inject(DatasetService);

  protected readonly fileName = this.dataset.fileName;
  protected readonly result = this.dataset.result;
  protected readonly loading = this.dataset.loading;
  protected readonly error = this.dataset.error;

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      this.dataset.loadFile(file);
    }
  }
}
