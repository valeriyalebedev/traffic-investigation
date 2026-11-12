import { Component } from '@angular/core';
import { AnalyticsSection } from './analytics-section';
import { DatasetStatus } from './dataset-status';
import { InvestigationSection } from './investigation-section';
import { KpiCards } from './kpi-cards';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DatasetStatus, KpiCards, AnalyticsSection, InvestigationSection],
  template: `
    <div class="dashboard">
      <app-dataset-status></app-dataset-status>
      <app-kpi-cards></app-kpi-cards>
      <app-analytics-section></app-analytics-section>
      <app-investigation-section></app-investigation-section>
    </div>
  `,
  styleUrl: './dashboard.scss',
})
export class Dashboard {}
