# Phase A: RCA & SOP Generator

## Persona
Technician or reliability engineer investigating an equipment fault.

## Objective
Turn a fault entry into a guided root cause analysis and a formatted maintenance checklist.

## Subtasks
1. Fault intake form (equipment from the register, symptom, date/time, operating conditions, attachments as text notes)
2. Guided 5-Whys wizard (one question at a time, user types each answer, final root cause field)
3. Simple Fishbone view (categories: Man, Machine, Method, Material, Measurement, Environment; user adds causes per category)
4. SOP / inspection checklist generator from the RCA result: purpose, scope, tools, PPE, LOTO steps, procedure steps, verification, sign-off
5. Save RCA and SOP to the equipment record, linked to the originating work order
6. Export SOP as printable page (browser print to PDF) and as Markdown

## Scope
**In:** items above, works without AI (template-based). Optional: a button to "suggest next why" only if an AI API is configured through environment variables.
**Out:** automatic sending of SOPs, integration with email/calendar.

## Data Model
- RCA(id, work_order_id, equipment_id, problem, why_1..why_5, root_cause, created_by, created_at)
- FishboneCause(id, rca_id, category, text)
- SOP(id, rca_id, title, version, status: Draft / Approved, content, approved_by, approved_at)

## Definition of Done
- A technician can complete a 5-Whys from a work order in under 5 minutes
- Every generated SOP contains PPE and LOTO sections; SOP cannot be set to Approved if either is empty
- Only admin can approve an SOP
- SOP prints cleanly on one or two pages
