import { Component } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  template: `
    <nav class="sidebar" aria-label="Main navigation">
      <ul class="nav-list" role="list">
        <li>
          <a class="nav-item active" href="#" aria-current="page">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <path d="M10 2l6 3.5v5c0 4.42-2.56 7.5-6 8.5-3.44-1-6-4.08-6-8.5v-5L10 2z"
                    stroke="currentColor" stroke-width="1.5" fill="none"/>
            </svg>
            Investigation
          </a>
        </li>
        <li>
          <a class="nav-item" href="#">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M7 10h6M10 7v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Detection Rules
          </a>
        </li>
        <li>
          <a class="nav-item" href="#">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M10 7v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            About
          </a>
        </li>
      </ul>
    </nav>
  `,
  styleUrl: './sidebar.scss',
})
export class Sidebar {}
