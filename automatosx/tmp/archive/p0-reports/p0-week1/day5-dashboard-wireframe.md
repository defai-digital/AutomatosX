# P0 Telemetry Dashboard Wireframe

> Specification for AutomatosX migration telemetry dashboards delivered in Week 2.

## Global UX Principles
- **Single Landing Page** with persona selector; remember last view by user.
- **Data Freshness Banner** showing last ingest timestamp and latency.
- **Responsive Layout** optimized for desktop (3-column grid), tablet (2-column), and mobile (single column).
- **Filter Bar** (top) with controls for priority (P0/P1/P2), module action, squad, and timeframe (24h, 7d, sprint, custom).
- **Drill-Down Pattern**: Clicking any panel opens modal with trend detail, export options, and link to source system.
- **Accessibility**: WCAG 2.1 AA color contrast, keyboard navigation, alt-text for charts.

## Role-Based Views

### Engineering View
- **Audience**: Feature squads, tech leads, Avery.
- **Layout**:
  - Row 1: Migration Progress Gauge (P0 completion %), Migration Velocity line chart.
  - Row 2: Module Action Status heatmap (action type vs completion), Remaining Modules burndown.
  - Row 3: CI/CD pipeline success donut, Build Time trend (line), Deployment frequency histogram.
  - Row 4: Parser performance P95 latency (line with threshold band), Resource utilization stacked area.
- **Drill-Downs**:
  - Module list table with filters (priority, owner squad, blockers).
  - CI pipeline log snapshot for failing runs.
- **Update Strategy**: Near real-time via streaming (≤5 min) for CI/performance panels; hourly batch for inventory snapshots.

### QA View
- **Audience**: Queenie, QA engineers.
- **Layout**:
  - Row 1: Regression coverage progress bar vs target; Pass rate trend chart.
  - Row 2: Defect density heatmap (module vs severity), Escaped defect log table.
  - Row 3: Test environment health (status cards for environments), MTTR trend line.
- **Drill-Downs**:
  - Detailed defect table with links to ticketing system.
  - Coverage explorer per module with instrumentation gaps highlighted.
- **Update Strategy**: Per build ingestion for coverage & pass rate; real-time for escaped defects via webhook.

### Leadership View
- **Audience**: Program PM, Stakeholder liaison, exec sponsors.
- **Layout**:
  - Row 1: Executive summary cards (P0 completion %, risk burn-down, stakeholder satisfaction).
  - Row 2: Migration burndown vs plan (area chart), Feature delivery rate per sprint (column chart).
  - Row 3: Alert status overview (count by severity), Capacity utilization stacked bar.
  - Row 4: Upcoming milestones timeline (gantt strip).
- **Drill-Downs**:
  - Risk register popover with owners, due dates.
  - View of weekly report history with download.
- **Update Strategy**: Hourly refresh for metrics; timeline auto-syncs with roadmap weekly.

### Stakeholder View
- **Audience**: Non-technical stakeholders requiring read-only visibility.
- **Layout**:
  - Row 1: Migration completion summary, Feature delivery rate.
  - Row 2: Service health status lights (parser performance, incidents, alert status).
  - Row 3: Key wins / notable callouts (auto-filled from report feed), Upcoming decision blockers.
- **Drill-Downs**:
  - Simplified module status table (aggregate by domain).
  - Link to compliance reports / communications archive.
- **Update Strategy**: Daily snapshots with manual refresh option; highlight data recency.

## Visualization Recommendations
- **Gauges & Progress Bars** for completion metrics and coverage vs target.
- **Line & Area Charts** for trends (velocity, performance, burndown).
- **Heatmaps** for action mix completion and defect density.
- **Stacked Area / Bar Charts** for capacity and resource utilization.
- **Status Cards** for categorical indicators (environment health, alert counts).
- **Tables with Conditional Formatting** for callouts (module backlog, incidents).

## Navigation Flow
1. User lands on persona selection page or is routed to default view.
2. Filter global time range or persona-specific filters.
3. Interact with panels; modal drill-down provides detailed charts, list views, and export (CSV, PNG).
4. "Alert Center" button opens sidebar listing active alerts with acknowledgement actions (for authorized personas).
5. "Reports" tab provides access to weekly summaries, scheduled exports.

## Real-Time vs Batch Strategy
- **Streaming (≤5 min latency)**: CI pipeline status, parser performance metrics, incidents, alerts.
- **Hourly Batches**: Module inventory snapshots, velocity calculations, risk register sync.
- **Daily Batches**: Capacity utilization, stakeholder satisfaction surveys, roadmap alignment.
- **Manual Ingestion**: None; all metrics must flow via automated pipelines with health checks.

## Responsive & Mobile Considerations
- Collapse multi-column rows into stacked cards on screens < 1024px.
- Provide simplified tables with search and sort; avoid horizontal scrolling on mobile.
- Ensure modals are full-screen on mobile with easy back navigation.
- Use concise text labels and iconography with tooltips to preserve clarity on small screens.

## Technical Implementation Notes
- Build dashboards in Grafana or equivalent platform supporting role-based access (RBAC) and SSO.
- Configure folders per persona to simplify permissions.
- Use templating variables for filters; pre-configure saved queries for top drill-down paths.
- Implement data quality indicators (green/amber/red icon) per panel to detect stale or missing data.
- Capture dashboard version history within configuration repository; changes require architecture review sign-off.
