export interface SourceSummary {
  ip: string;
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
  statusCounts: Record<string, number>;
  methodCounts: Record<string, number>;
}
