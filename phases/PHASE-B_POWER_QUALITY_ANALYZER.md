# Phase B: Power Quality & Utility Log Analyzer

## Persona
Electrical/maintenance engineer reviewing meter logs for a plant.

## Objective
Upload a CSV meter log in the browser, flag voltage sag/swell and harmonic anomalies, and produce a visual health report. Runs fully in the browser (JavaScript), no Python needed.

## Subtasks
1. CSV upload with column mapping (timestamp, voltage L1/L2/L3, current, power, THD voltage %, THD current %)
2. Configurable thresholds with defaults (nominal voltage, sag below 90% of nominal, swell above 110%, THD voltage limit 5%, THD current limit configurable)
3. Anomaly detection: list of events with start time, duration, phase, min/max value
4. Charts: voltage over time with threshold bands, THD over time, event count per day
5. Health summary: percentage of time within limits, worst event, simple status (Good / Watch / Action needed)
6. Link an anomaly to a new work order or RCA with one click
7. Export the report as printable page and the events as CSV

## Scope
**In:** items above, files up to a few MB, sample CSV generator button for testing.
**Out:** live meter connections, automatic alarms, cloud storage of raw logs.

## Definition of Done
- A sample CSV with injected sags and high THD is detected correctly
- Thresholds can be changed and results update without reloading
- Report prints cleanly with charts
- Bad or missing columns show a clear error message, not a blank page
