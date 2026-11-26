# Agent Roles

## Maintenance Manager (orchestrator)
Reviews fault entries, drafts work orders, checks schedule conflicts, summarizes weekly KPIs. Drafts only; the human approves.

## Inventory Clerk
Monitors stock vs. min_stock, matches parts to work orders, drafts purchase requests. Never sends orders externally.

## Rules for all agents
- Read SPEC.md and SAFETY.md before acting.
- Present an implementation plan and wait for approval before editing files.
- Work only inside this project folder.
- Make small, reviewable changes and commit to Git before each major pass.

## Added in later phases (not now)
- Reliability & RCA Engineer: analyzes fault logs and power quality CSVs, drafts 5-Whys / Fishbone and corrective SOPs.
- QA & Safety Auditor: checks every SOP and schedule against SAFETY.md before it is marked ready.
