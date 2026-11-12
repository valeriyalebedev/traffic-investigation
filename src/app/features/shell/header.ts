import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  standalone: true,
  template: `
    <header class="header">
      <div class="header-left">
        <svg class="header-icon" viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true">
          <path d="M16 2L4 8v8c0 7.18 5.12 13.4 12 14.93C22.88 29.4 28 23.18 28 16V8L16 2z"
                fill="var(--color-accent)" opacity="0.15"/>
          <path d="M16 2L4 8v8c0 7.18 5.12 13.4 12 14.93C22.88 29.4 28 23.18 28 16V8L16 2z"
                stroke="var(--color-accent)" stroke-width="1.5" fill="none"/>
          <path d="M12 16l3 3 5-6" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <div class="header-text">
          <h1 class="header-title">Traffic Investigation</h1>
          <p class="header-subtitle">Analyze Apache access logs · Detect, explore and investigate unusual traffic</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="icon-button" type="button" aria-label="Help" title="Help">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
            <text x="10" y="14" text-anchor="middle" font-size="11" font-weight="600" fill="currentColor">?</text>
          </svg>
        </button>
        <button class="icon-button" type="button" aria-label="Settings" title="Settings">
          <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
            <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M3.4 3.4l1.4 1.4M15.2 15.2l1.4 1.4M3.4 16.6l1.4-1.4M15.2 4.8l1.4-1.4"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </header>
  `,
  styleUrl: './header.scss',
})
export class Header {}
