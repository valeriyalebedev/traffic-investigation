import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LogUpload } from './log-upload';
import { DatasetService } from '../../core/services/dataset.service';

describe('LogUpload', () => {
  let fixture: ComponentFixture<LogUpload>;
  let service: DatasetService;
  let loadFileSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogUpload],
    }).compileComponents();

    service = TestBed.inject(DatasetService);
    loadFileSpy = vi.spyOn(service, 'loadFile').mockResolvedValue();
    fixture = TestBed.createComponent(LogUpload);
    fixture.detectChanges();
  });

  function fireChangeEvent(input: HTMLInputElement, file: File): void {
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: true,
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
  }

  it('calls loadFile when a file is selected', () => {
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'test.log', { type: 'text/plain' });
    fireChangeEvent(input, file);

    expect(loadFileSpy).toHaveBeenCalledTimes(1);
    expect(loadFileSpy.mock.calls[0][0].name).toBe('test.log');
  });

  it('resets input value after selection', () => {
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'value', { value: 'C:\\fakepath\\test.log', writable: true, configurable: true });

    const file = new File(['content'], 'test.log', { type: 'text/plain' });
    fireChangeEvent(input, file);

    expect(input.value).toBe('');
  });

  it('triggers two separate loadFile calls when the same file is selected twice', () => {
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file1 = new File(['content v1'], 'same-file.log', { type: 'text/plain' });
    const file2 = new File(['content v2'], 'same-file.log', { type: 'text/plain' });

    fireChangeEvent(input, file1);
    fireChangeEvent(input, file2);

    expect(loadFileSpy).toHaveBeenCalledTimes(2);
  });
});
