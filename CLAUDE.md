# Traffic Investigation — Project Instructions

## 1. Project Context

Build a lightweight web application that helps security engineers investigate Apache access logs and understand unusual traffic patterns.

The application should help answer four questions:
- Who generated the traffic?
- When did it happen?
- How did the source behave?
- Does the behavior suggest human or automated activity?

The goal is to provide an explainable investigation workflow, not a generic log viewer or admin dashboard.

## 2. Technology

- Angular (use the version installed in this project)
- TypeScript with strict typing
- Standalone components
- Angular Signals where appropriate
- SCSS
- Client-side log parsing and analysis

Do not introduce dependencies without a clear technical reason.

## 3. Product Principles

- Focus on one polished investigation experience.
- Make traffic patterns understandable, not just display generic tables.
- Every finding must be explainable and supported by actual log records.
- Distinguish suspicious behavior from confirmed malicious activity.
- Never invent metrics, findings, scores, or evidence.
- Handle malformed log lines without rejecting the entire dataset.
- Preserve source line numbers so findings can be traced back to original records.
- All metrics and findings must be recalculated when a new dataset is loaded.

## 4. Architecture

Keep parsing, analysis, and detection logic independent of Angular components.

Separate responsibilities into:
- Data models
- Apache log parser
- Traffic aggregation and analysis
- Detection rules and findings
- Dataset management
- Presentation components

Prefer small, focused modules and pure functions.

Avoid unnecessary abstractions, NgRx, excessive services, and premature generalization.

## 5. Log Parsing

Support Apache Combined Log Format.

The parser should:
- Parse individual log lines.
- Normalize parsed values into typed records.
- Preserve original line numbers.
- Handle malformed lines gracefully.
- Report parsing statistics and useful error reasons.
- Never silently discard invalid records.

The parser must not depend on the uploaded file's extension or name.

## 6. Detection Rules

Core detection rules:

- `VULNERABILITY_PATH_PROBING`: repeated requests to predefined sensitive or vulnerable resource paths.
- `REPEATED_FAILED_RESOURCE`: repeated requests to the same resource with a high proportion of failed responses.
- `REPEATED_REQUEST_PATTERN`: repeated similar sequences of methods and paths.

`REQUEST_BURST` is optional if time permits.

Important:
- Missing User-Agent alone is not a finding.
- High request volume alone does not prove malicious activity.
- HTTP 404 responses do not automatically indicate an attack.
- Findings must include evidence and explain why the rule matched.
- Thresholds must be explicit and documented.
- Do not claim successful exploitation based only on access logs.

## 7. Data and Evidence

A finding should reference the actual log records that support it.

Keep these concepts distinct:
- Detection rule: the logic used to identify a pattern.
- Finding: a specific match produced by a rule.
- Source IP: the observed request source.
- Evidence: the records and facts supporting a finding.

Do not treat an IP address as a real-world identity.

Severity and confidence are different concepts. Do not present confidence as a calibrated probability.

## 8. UI and Accessibility

- Build one coherent investigation screen.
- Use a clean, light interface with clear visual hierarchy.
- Prioritize readability and useful information density.
- Use semantic HTML.
- Support keyboard navigation and visible focus states.
- Do not rely on color alone to communicate severity or status.
- Provide meaningful loading, empty, success, and error states.
- Make charts understandable and provide accessible alternatives where appropriate.

## 9. Code Quality and Testing

- Use strict TypeScript typing.
- Keep components focused on presentation and user interaction.
- Prefer pure functions for parsing, aggregation, and detection.
- Add tests for parsing, analysis, and detection logic.
- Test malformed input and edge cases.
- Verify dataset replacement does not leave stale metrics or findings.
- Do not claim tests pass unless they have actually been run.
- Do not change unrelated files.

## 10. Collaboration Rules

Before implementing a significant change:

1. Explain the proposed approach briefly.
2. Identify the affected files.
3. Mention important trade-offs.
4. Implement only the agreed scope.
5. Report changed files and verification results.

Do not introduce extra features or dependencies without approval.

Do not rewrite working code unnecessarily.

The developer owns product decisions and reviews all changes.
