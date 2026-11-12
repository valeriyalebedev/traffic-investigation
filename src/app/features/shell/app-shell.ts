import { Component } from '@angular/core';
import { Header } from './header';
import { Sidebar } from './sidebar';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [Header, Sidebar],
  template: `
    <app-header></app-header>
    <div class="shell-body">
      <app-sidebar></app-sidebar>
      <main class="shell-main">
        <ng-content />
      </main>
    </div>
  `,
  styleUrl: './app-shell.scss',
})
export class AppShell {}
