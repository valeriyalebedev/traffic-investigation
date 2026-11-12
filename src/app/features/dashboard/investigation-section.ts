import { Component } from '@angular/core';

@Component({
  selector: 'app-investigation-section',
  standalone: true,
  template: `
    <section class="investigation-row" aria-label="Investigation">
      <div class="panel panel--findings">
        <div class="panel-header">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="7" stroke="var(--color-accent)" stroke-width="1.5"/>
            <path d="M10 6v4l2.5 2.5" stroke="var(--color-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3 class="panel-title">Investigation findings</h3>
        </div>
        <div class="panel-empty">
          <p>No findings yet. Load a log file and run detection rules.</p>
        </div>
      </div>
      <div class="panel panel--source">
        <div class="panel-header">
          <h3 class="panel-title">Source investigation</h3>
        </div>
        <div class="panel-empty">
          <p>Select a finding to investigate the source</p>
        </div>
      </div>
    </section>
  `,
  styleUrl: './investigation-section.scss',
})
export class InvestigationSection {}
