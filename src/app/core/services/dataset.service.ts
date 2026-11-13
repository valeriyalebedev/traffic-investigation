import { Injectable, signal } from '@angular/core';
import type { ParseResult } from '../models/log-record';
import { parseLogContent } from '../parser/log-parser';

@Injectable({ providedIn: 'root' })
export class DatasetService {
  static readonly SAMPLE_DATA_URL = '/sample-data/apache_logs.txt';
  static readonly SAMPLE_FILE_NAME = 'apache_logs.txt';

  private readonly _fileName = signal<string | null>(null);
  private readonly _result = signal<ParseResult | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _isSampleData = signal(false);

  readonly fileName = this._fileName.asReadonly();
  readonly result = this._result.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isSampleData = this._isSampleData.asReadonly();

  async loadFile(file: File): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    this._result.set(null);
    this._fileName.set(null);
    this._isSampleData.set(false);

    try {
      const content = await this.readFileAsText(file);
      const parseResult = parseLogContent(content);
      this._fileName.set(file.name);
      this._result.set(parseResult);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Failed to read file');
    } finally {
      this._loading.set(false);
    }
  }

  async loadSampleData(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    this._result.set(null);
    this._fileName.set(null);
    this._isSampleData.set(false);

    try {
      const response = await fetch(DatasetService.SAMPLE_DATA_URL);
      if (!response.ok) {
        throw new Error(`Failed to load sample dataset (HTTP ${response.status})`);
      }
      const content = await response.text();
      const parseResult = parseLogContent(content);
      this._fileName.set(DatasetService.SAMPLE_FILE_NAME);
      this._result.set(parseResult);
      this._isSampleData.set(true);
    } catch (e) {
      this._error.set(e instanceof Error ? e.message : 'Failed to load sample dataset');
    } finally {
      this._loading.set(false);
    }
  }

  clear(): void {
    this._fileName.set(null);
    this._result.set(null);
    this._error.set(null);
    this._loading.set(false);
    this._isSampleData.set(false);
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onabort = () => reject(new Error('File reading was cancelled'));
      reader.readAsText(file);
    });
  }
}
