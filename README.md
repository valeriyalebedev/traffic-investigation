# Traffic Investigation

A lightweight Angular application for security engineers to investigate Apache access logs, understand unusual traffic patterns, and assess whether a source's behavior suggests automation.

Built as part of the DataDome Senior Frontend Engineer take-home assignment.

## Approach

I treated this assignment as a time-boxed engineering exercise with an approximately four-hour budget. I divided the work into small, focused stages and update this README after each stage to document implementation progress, technical decisions, validation results, and remaining work.

My priority is to build one coherent investigation workflow rather than a generic dashboard with many incomplete features. The main goal is to let an engineer select a source IP, inspect its request history, and understand why its behavior may be suspicious.

## Tech Stack

- Angular 22.2 (standalone components, signals)
- TypeScript 6.0 (strict mode)
- Vitest 5.0
- SCSS

## Getting Started

```bash
npm install
npm start
npm test
npm run build
```

The development server runs at `http://localhost:4200`.

## Technical Decisions

### Client-side parsing

I chose client-side parsing because the supplied dataset contains around 10,000 lines. This keeps the application self-contained and avoids introducing unnecessary backend infrastructure. Performance with larger files has not been benchmarked.

### Parser design

The parser supports the Apache Combined Log Format used in the supplied dataset. I implemented it as pure functions, independent of Angular, so parsing can be tested separately from the UI.

Key decisions:

- **Strict validation:** malformed records are rejected rather than partially parsed.
- **Timestamp validation:** includes calendar dates and timezone offsets.
- **Request target preservation:** both the full request target and the extracted path are stored.
- **Traceability:** invalid lines retain their original line numbers and content.

This is not intended to be a universal parser for every possible Apache log configuration.

I deliberately avoided adding NgRx, Web Workers, or streaming parsing at this stage. They would introduce additional complexity without a demonstrated need for the supplied dataset.

## Validation

I tested the parser with 41 unit tests and validated it against the supplied dataset: 10,000 lines, 9,999 valid records, and one malformed record (an unclosed User-Agent field).

One important limitation: timestamps in the dataset are concentrated around minute :05 of each hour between May 17 and May 20, 2015. These are sparse observations, not continuous traffic data, so I cannot reliably infer real traffic spikes.

The tests cover parser behavior but do not establish large-file performance or validate the complete upload and investigation workflow.

## Implementation Steps

- [x] Set up the Angular project and development environment.
- [x] Implement the Apache Combined Log Format parser with validation.
- [x] Add parser unit tests and validate against the supplied dataset.
- [ ] Add file upload and connect it to the parser.
- [ ] Aggregate traffic by source IP, including request counts, status codes, methods, and time ranges.
- [ ] Build a chronological investigation view for a selected source.
- [ ] Implement explainable detection rules for vulnerability path probing, repeated failed resources, and repeated request patterns.
- [ ] Bring the investigation workflow together in one accessible, responsive screen.

## AI Usage

I used Claude Code to assist with implementation and test creation, and ChatGPT to discuss architecture and review technical decisions. I made the scope and technical decisions, reviewed the generated code, and validated the test and dataset results.
