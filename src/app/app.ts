import { Component } from '@angular/core';
import { LogUpload } from './features/log-upload/log-upload';

@Component({
  imports: [LogUpload],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}
