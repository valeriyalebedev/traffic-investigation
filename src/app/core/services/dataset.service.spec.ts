import { TestBed } from '@angular/core/testing';
import { DatasetService } from './dataset.service';

const VALID_LINE =
  '10.0.0.1 - - [01/Jan/2025:00:00:00 +0000] "GET /a HTTP/1.1" 200 100 "-" "-"';

function makeFile(content: string, name = 'test.log'): File {
  return new File([content], name, { type: 'text/plain' });
}

function mockFetchOk(content: string): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => Promise.resolve(new Response(content, { status: 200 })),
  );
}

function mockFetchError(status: number): void {
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => Promise.resolve(new Response('', { status })),
  );
}

function mockFetchReject(message: string): void {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError(message));
}

describe('DatasetService', () => {
  let service: DatasetService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DatasetService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with empty state', () => {
    expect(service.fileName()).toBeNull();
    expect(service.result()).toBeNull();
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.isSampleData()).toBe(false);
  });

  it('loads and parses a valid file', async () => {
    const content = `${VALID_LINE}\n${VALID_LINE}\n`;
    await service.loadFile(makeFile(content, 'access.log'));

    expect(service.fileName()).toBe('access.log');
    expect(service.loading()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.isSampleData()).toBe(false);

    const result = service.result();
    expect(result).not.toBeNull();
    expect(result!.stats.totalLines).toBe(2);
    expect(result!.stats.validCount).toBe(2);
    expect(result!.stats.invalidCount).toBe(0);
  });

  it('handles an empty file', async () => {
    await service.loadFile(makeFile(''));

    expect(service.error()).toBeNull();
    const result = service.result();
    expect(result).not.toBeNull();
    expect(result!.stats.totalLines).toBe(0);
    expect(result!.stats.validCount).toBe(0);
  });

  it('handles mixed valid and invalid lines', async () => {
    const content = `${VALID_LINE}\nbad line\n${VALID_LINE}\n`;
    await service.loadFile(makeFile(content));

    const result = service.result();
    expect(result).not.toBeNull();
    expect(result!.stats.validCount).toBe(2);
    expect(result!.stats.invalidCount).toBe(1);
    expect(result!.stats.totalLines).toBe(3);
  });

  it('replaces previous result when loading a new file', async () => {
    await service.loadFile(makeFile(VALID_LINE, 'first.log'));
    expect(service.fileName()).toBe('first.log');
    expect(service.result()!.stats.validCount).toBe(1);

    const secondContent = `${VALID_LINE}\n${VALID_LINE}\n${VALID_LINE}\n`;
    await service.loadFile(makeFile(secondContent, 'second.log'));
    expect(service.fileName()).toBe('second.log');
    expect(service.result()!.stats.validCount).toBe(3);
  });

  it('clears stale result when loading starts', async () => {
    await service.loadFile(makeFile(VALID_LINE, 'first.log'));
    expect(service.result()).not.toBeNull();

    const loadPromise = service.loadFile(makeFile(VALID_LINE, 'second.log'));
    expect(service.result()).toBeNull();
    expect(service.fileName()).toBeNull();
    expect(service.loading()).toBe(true);

    await loadPromise;
    expect(service.result()).not.toBeNull();
    expect(service.fileName()).toBe('second.log');
  });

  it('clears all state on clear()', async () => {
    await service.loadFile(makeFile(VALID_LINE, 'test.log'));
    expect(service.result()).not.toBeNull();

    service.clear();
    expect(service.fileName()).toBeNull();
    expect(service.result()).toBeNull();
    expect(service.error()).toBeNull();
    expect(service.loading()).toBe(false);
    expect(service.isSampleData()).toBe(false);
  });

  describe('loadSampleData', () => {
    it('loads and parses sample data on success', async () => {
      const content = `${VALID_LINE}\n${VALID_LINE}\n`;
      mockFetchOk(content);

      await service.loadSampleData();

      expect(service.fileName()).toBe(DatasetService.SAMPLE_FILE_NAME);
      expect(service.isSampleData()).toBe(true);
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
      expect(service.result()!.stats.validCount).toBe(2);
      expect(globalThis.fetch).toHaveBeenCalledWith(DatasetService.SAMPLE_DATA_URL);
    });

    it('sets error on HTTP 404 and does not mark as sample data', async () => {
      mockFetchError(404);

      await service.loadSampleData();

      expect(service.error()).toBe('Failed to load sample dataset (HTTP 404)');
      expect(service.isSampleData()).toBe(false);
      expect(service.result()).toBeNull();
      expect(service.fileName()).toBeNull();
      expect(service.loading()).toBe(false);
    });

    it('sets error on network failure and does not mark as sample data', async () => {
      mockFetchReject('Failed to fetch');

      await service.loadSampleData();

      expect(service.error()).toBe('Failed to fetch');
      expect(service.isSampleData()).toBe(false);
      expect(service.result()).toBeNull();
      expect(service.loading()).toBe(false);
    });

    it('resets isSampleData when a user file is loaded after sample', async () => {
      mockFetchOk(VALID_LINE);
      await service.loadSampleData();
      expect(service.isSampleData()).toBe(true);

      await service.loadFile(makeFile(VALID_LINE, 'user.log'));
      expect(service.isSampleData()).toBe(false);
      expect(service.fileName()).toBe('user.log');
    });

    it('resets isSampleData on clear and allows reloading sample', async () => {
      mockFetchOk(`${VALID_LINE}\n`);
      await service.loadSampleData();
      expect(service.isSampleData()).toBe(true);

      service.clear();
      expect(service.isSampleData()).toBe(false);
      expect(service.result()).toBeNull();

      await service.loadSampleData();
      expect(service.isSampleData()).toBe(true);
      expect(service.result()).not.toBeNull();
    });
  });
});
