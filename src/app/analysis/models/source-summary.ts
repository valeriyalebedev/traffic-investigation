/** Aggregated traffic summary for a single source IP across the loaded dataset. */
export interface SourceSummary {
  ip: string;
  requestCount: number;
  firstSeen: Date;
  lastSeen: Date;
  /** Request count per HTTP status code (keys are status code strings, e.g. "200", "404"). */
  statusCounts: Record<string, number>;
  /** Request count per HTTP method (keys are method strings, e.g. "GET", "POST"). */
  methodCounts: Record<string, number>;
}
