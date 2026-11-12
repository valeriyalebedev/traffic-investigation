import { Component } from '@angular/core';
import { Dashboard } from './features/dashboard/dashboard';
import { AppShell } from './features/shell/app-shell';

@Component({
  imports: [AppShell, Dashboard],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
