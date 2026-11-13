import { Component } from '@angular/core';
import { Header } from './header';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [Header],
  template: `
    <app-header></app-header>
    <main class="shell-main">
      <ng-content />
    </main>
  `,
  styleUrl: './app-shell.scss',
})
export class AppShell {}
