# Maintenance Office CMMS: MVP Spec

## Persona
Maintenance manager at a plant/client site, plus technicians who log faults and update work orders.

## Objective
A web app to track equipment, work orders, preventive maintenance schedules, and spare parts, with low-stock alerts.

## Subtasks
1. Equipment register (ID, name, location, criticality, QR/SKU code)
2. Work orders (create, assign, status: Open / In Progress / Done, priority, notes)
3. Preventive maintenance schedule (recurring tasks, due dates, overdue flag)
4. Spare parts inventory (stock, minimum threshold, low-stock alert, link parts to work orders)
5. Roles: `admin` and `technician` (technicians cannot delete records or edit stock thresholds)
6. Audit log of every create/update/delete (who, what, when)
7. CSV export of work orders and inventory

## Scope
**In:** items above, responsive UI, loading/empty/error states.
**Out (later phases):** payments, RCA/SOP generator, power quality analyzer, email/calendar integration, auto-sent purchase orders.

## Tech Preference
Plain web app (HTML/JS or React). No Python required to run it. Must work in a browser and be deployable by drag-and-drop (e.g. Netlify) and pushable to GitHub.

## Data Model
- Equipment(id, name, location, criticality, qr_code)
- WorkOrder(id, equipment_id, title, description, priority, status, assigned_to, created_at, closed_at)
- Part(id, sku, name, stock, min_stock, supplier)
- WorkOrderPart(work_order_id, part_id, qty)
- PMTask(id, equipment_id, interval_days, last_done, next_due)
- AuditLog(id, user, action, entity, entity_id, timestamp)

## Definition of Done
- Admin and technician can log in; role restrictions verified in the browser
- Creating a work order that uses a part reduces stock; low-stock flag appears below threshold
- Overdue PM tasks are highlighted
- CSV export opens correctly in Excel
- No API keys in source files

## Phases
1. Local prototype (SQLite or mock JSON), then initialize Git
2. UI polish pass
3. Backend/auth pass (Supabase or Firebase)
4. Pre-ship safety audit
