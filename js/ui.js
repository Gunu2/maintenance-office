/* ==========================================================================
   Maintenance Office CMMS — View Renderers (js/ui.js)
   Pure HTML string renderers for Overview, Equipment, Work Orders, PM
   Schedule, Spare Parts, and Read-Only Audit Log.
   ========================================================================== */

(function (global) {
  'use strict';

  const CMMS = (global.CMMS = global.CMMS || {});

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return escapeHtml(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function criticalityBadge(level) {
    const map = {
      Critical: 'badge-danger',
      High: 'badge-warning',
      Medium: 'badge-info',
      Low: 'badge-neutral'
    };
    return `<span class="badge ${map[level] || 'badge-neutral'}">${escapeHtml(level)}</span>`;
  }

  function priorityBadge(level) {
    return criticalityBadge(level);
  }

  function woStatusBadge(status) {
    const map = {
      Open: 'badge-info',
      'In Progress': 'badge-warning',
      Done: 'badge-success'
    };
    return `<span class="badge ${map[status] || 'badge-neutral'}">${escapeHtml(status)}</span>`;
  }

  function stockBadge(part) {
    const status = CMMS.store.getStockStatus(part);
    if (status === 'low') {
      return '<span class="badge badge-danger">Low Stock</span>';
    }
    if (status === 'threshold') {
      return '<span class="badge badge-warning">At Threshold</span>';
    }
    return '<span class="badge badge-success">In Stock</span>';
  }

  function pmStatusBadge(task) {
    const info = CMMS.store.getPMStatus(task);
    if (info.code === 'overdue') {
      const days = Math.abs(info.diffDays);
      return `<span class="badge badge-danger">Overdue (${days}d)</span>`;
    }
    if (info.code === 'due-soon') {
      const label = info.diffDays === 0 ? 'Due Today' : `Due in ${info.diffDays}d`;
      return `<span class="badge badge-warning">${label}</span>`;
    }
    return `<span class="badge badge-success">In ${info.diffDays}d</span>`;
  }

  function auditActionBadge(action) {
    const map = {
      CREATE: 'badge-success',
      UPDATE: 'badge-info',
      DELETE: 'badge-danger'
    };
    return `<span class="badge ${map[action] || 'badge-neutral'}">${escapeHtml(action)}</span>`;
  }

  function mapById(list) {
    const map = {};
    list.forEach(function (item) {
      map[item.id] = item;
    });
    return map;
  }

  function emptyStateHtml(title, description, buttonId, buttonLabel, buttonAction) {
    const cta = buttonLabel
      ? `<button ${buttonId ? `id="${buttonId}"` : ''} type="button" class="btn btn-secondary btn-sm" data-action="${escapeHtml(buttonAction)}">${escapeHtml(buttonLabel)}</button>`
      : '';
    return `
      <div class="empty-state">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        ${cta}
      </div>
    `;
  }

  /* ---- Overview ---- */

  function renderOverview(state, user) {
    const eqMap = mapById(state.equipment);
    const openWOs = state.workOrders.filter(function (w) {
      return w.status !== 'Done';
    });
    const criticalOpenWOs = openWOs.filter(function (w) {
      return w.priority === 'Critical' || w.priority === 'High';
    });
    const overduePMs = state.pmTasks.filter(function (t) {
      return CMMS.store.getPMStatus(t).code === 'overdue';
    });
    const lowStockParts = state.parts.filter(function (p) {
      return CMMS.store.getStockStatus(p) === 'low';
    });
    const thresholdParts = state.parts.filter(function (p) {
      return CMMS.store.getStockStatus(p) === 'threshold';
    });

    const overdueListHtml = overduePMs.length
      ? overduePMs
          .map(function (t) {
            const eq = eqMap[t.equipment_id];
            return `
              <div class="compact-item">
                <div class="compact-item-main">
                  <div class="compact-item-title">${escapeHtml(t.title)}</div>
                  <div class="compact-item-meta">
                    <span class="mono">${escapeHtml(t.id)}</span> · ${escapeHtml(eq ? eq.name : t.equipment_id)} · Due ${escapeHtml(t.next_due)}
                  </div>
                </div>
                <div class="cell-actions">
                  ${pmStatusBadge(t)}
                  <button type="button" class="btn btn-success btn-xs" data-action="complete-pm" data-id="${escapeHtml(t.id)}">
                    Mark Done
                  </button>
                </div>
              </div>
            `;
          })
          .join('')
      : emptyStateHtml('No Overdue PM Tasks', 'All preventive maintenance schedules are up to date.', '', '', '');

    const alertParts = lowStockParts.concat(thresholdParts);
    const partsAlertHtml = alertParts.length
      ? alertParts
          .map(function (p) {
            return `
              <div class="compact-item">
                <div class="compact-item-main">
                  <div class="compact-item-title">${escapeHtml(p.name)}</div>
                  <div class="compact-item-meta">
                    <span class="mono">${escapeHtml(p.sku)}</span> · Stock: <strong>${p.stock}</strong> / Min: ${p.min_stock} · ${escapeHtml(p.supplier)}
                  </div>
                </div>
                <div class="cell-actions">
                  ${stockBadge(p)}
                  <button type="button" class="btn btn-secondary btn-xs" data-action="draft-po-single" data-id="${escapeHtml(p.id)}">
                    Draft PR
                  </button>
                </div>
              </div>
            `;
          })
          .join('')
      : emptyStateHtml('Inventory Healthy', 'Every spare part is currently above its minimum threshold.', '', '', '');

    const recentAudit = state.auditLog.slice(0, 6);
    const recentAuditHtml = recentAudit.length
      ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              ${recentAudit
                .map(function (entry) {
                  return `
                    <tr>
                      <td class="mono">${escapeHtml(formatDateTime(entry.timestamp))}</td>
                      <td>${escapeHtml(entry.user)}</td>
                      <td>${auditActionBadge(entry.action)}</td>
                      <td><span class="mono">${escapeHtml(entry.entity)} · ${escapeHtml(entry.entity_id)}</span></td>
                      <td>${escapeHtml(entry.details)}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : emptyStateHtml('No Activity Recorded', 'Mutations will appear here automatically.', '', '', '');

    return `
      <section class="kpi-grid" aria-label="Key operational metrics">
        <button type="button" class="kpi-card" data-nav-target="workorders">
          <span class="kpi-label">Active Work Orders</span>
          <span class="kpi-value">${openWOs.length}</span>
          <span class="kpi-sub">${criticalOpenWOs.length} High / Critical · ${state.workOrders.length} total</span>
        </button>

        <button type="button" class="kpi-card" data-nav-target="pm">
          <span class="kpi-label">Overdue PM Tasks</span>
          <span class="kpi-value ${overduePMs.length > 0 ? 'danger' : ''}">${overduePMs.length}</span>
          <span class="kpi-sub">${state.pmTasks.length} recurring schedules tracked</span>
        </button>

        <button type="button" class="kpi-card" data-nav-target="parts">
          <span class="kpi-label">Low-Stock Parts</span>
          <span class="kpi-value ${lowStockParts.length > 0 ? 'danger' : thresholdParts.length > 0 ? 'warning' : ''}">${lowStockParts.length}</span>
          <span class="kpi-sub">${thresholdParts.length} at exact threshold · ${state.parts.length} SKUs</span>
        </button>

        <button type="button" class="kpi-card" data-nav-target="equipment">
          <span class="kpi-label">Registered Equipment</span>
          <span class="kpi-value">${state.equipment.length}</span>
          <span class="kpi-sub">Signed in as ${escapeHtml(user.role)}</span>
        </button>
      </section>

      <div class="overview-grid">
        <section class="panel" aria-labelledby="ov-pm-heading">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <h2 id="ov-pm-heading" class="panel-title">Overdue Preventive Maintenance</h2>
              <p class="panel-subtitle">Tasks past their scheduled due date</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-nav-target="pm">View All</button>
          </div>
          <div class="compact-list">${overdueListHtml}</div>
        </section>

        <section class="panel" aria-labelledby="ov-parts-heading">
          <div class="panel-header">
            <div class="panel-title-wrap">
              <h2 id="ov-parts-heading" class="panel-title">Inventory Alerts</h2>
              <p class="panel-subtitle">Parts below (&lt;) or equal to (=) minimum threshold</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" data-nav-target="parts">View All</button>
          </div>
          <div class="compact-list">${partsAlertHtml}</div>
        </section>
      </div>

      <section class="panel" aria-labelledby="ov-audit-heading">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h2 id="ov-audit-heading" class="panel-title">Recent Audit Activity</h2>
            <p class="panel-subtitle">Read-only chronological record of workspace changes</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-nav-target="audit">Open Audit Log</button>
        </div>
        ${recentAuditHtml}
      </section>
    `;
  }

  /* ---- Equipment Register ---- */

  function renderEquipment(state, user, filters) {
    const canDel = CMMS.store.canDelete(user);
    const q = (filters.search || '').trim().toLowerCase();
    const crit = filters.criticality || 'all';

    const filtered = state.equipment.filter(function (eq) {
      if (crit !== 'all' && eq.criticality !== crit) return false;
      if (!q) return true;
      return (
        eq.id.toLowerCase().includes(q) ||
        eq.name.toLowerCase().includes(q) ||
        eq.location.toLowerCase().includes(q) ||
        eq.qr_code.toLowerCase().includes(q)
      );
    });

    const hasFilters = Boolean(q || crit !== 'all');
    const bodyHtml = filtered.length
      ? `
        <div class="table-wrap">
          <table class="data-table" id="equipment-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Equipment Name</th>
                <th>Location</th>
                <th>Criticality</th>
                <th>QR / SKU Code</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(function (eq) {
                  return `
                    <tr data-row-id="${escapeHtml(eq.id)}">
                      <td class="mono">${escapeHtml(eq.id)}</td>
                      <td class="cell-primary">${escapeHtml(eq.name)}</td>
                      <td>${escapeHtml(eq.location)}</td>
                      <td>${criticalityBadge(eq.criticality)}</td>
                      <td><span class="code-pill">${escapeHtml(eq.qr_code)}</span></td>
                      <td>
                        <div class="cell-actions">
                          <button type="button" class="btn btn-secondary btn-xs" data-action="edit-equipment" data-id="${escapeHtml(eq.id)}">
                            Edit
                          </button>
                          ${
                            canDel
                              ? `<button type="button" class="btn btn-danger-ghost btn-xs" data-action="delete-equipment" data-id="${escapeHtml(eq.id)}">Delete</button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : hasFilters
        ? emptyStateHtml(
            'No matching equipment found',
            'Try adjusting your search query or criticality filter.',
            'clear-equipment-filters-btn',
            'Clear Filters',
            'clear-filters'
          )
        : emptyStateHtml(
            'No equipment registered yet',
            'Add your first plant asset to begin linking work orders and preventive maintenance schedules.',
            'empty-new-equipment-btn',
            'Add Equipment',
            'new-equipment'
          );

    return `
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h2 class="panel-title">Equipment Register</h2>
            <p class="panel-subtitle">${filtered.length} of ${state.equipment.length} assets shown</p>
          </div>
          <div class="panel-actions">
            <button id="new-equipment-btn" type="button" class="btn btn-primary btn-sm" data-action="new-equipment">
              + Add Equipment
            </button>
          </div>
        </div>
        <div class="toolbar">
          <input
            id="equipment-search"
            type="search"
            class="search-input"
            placeholder="Search ID, name, location, or QR code..."
            value="${escapeHtml(filters.search || '')}"
            data-filter-key="search"
          />
          <select id="equipment-crit-filter" class="filter-select" data-filter-key="criticality" aria-label="Filter by criticality">
            <option value="all" ${crit === 'all' ? 'selected' : ''}>All Criticality</option>
            <option value="Critical" ${crit === 'Critical' ? 'selected' : ''}>Critical</option>
            <option value="High" ${crit === 'High' ? 'selected' : ''}>High</option>
            <option value="Medium" ${crit === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="Low" ${crit === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </div>
        ${bodyHtml}
      </section>
    `;
  }

  /* ---- Work Orders ---- */

  function renderWorkOrders(state, user, filters) {
    const canDel = CMMS.store.canDelete(user);
    const eqMap = mapById(state.equipment);
    const partMap = mapById(state.parts);
    const q = (filters.search || '').trim().toLowerCase();
    const statusFilter = filters.status || 'all';
    const priorityFilter = filters.priority || 'all';

    const filtered = state.workOrders.filter(function (wo) {
      if (statusFilter !== 'all' && wo.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && wo.priority !== priorityFilter) return false;
      if (!q) return true;
      const eq = eqMap[wo.equipment_id];
      return (
        wo.id.toLowerCase().includes(q) ||
        wo.title.toLowerCase().includes(q) ||
        (wo.description || '').toLowerCase().includes(q) ||
        (wo.assigned_to || '').toLowerCase().includes(q) ||
        (eq && eq.name.toLowerCase().includes(q))
      );
    });

    const hasFilters = Boolean(q || statusFilter !== 'all' || priorityFilter !== 'all');
    const bodyHtml = filtered.length
      ? `
        <div class="table-wrap">
          <table class="data-table" id="workorders-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Work Order &amp; Equipment</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Parts Consumed</th>
                <th>Created / Closed</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(function (wo) {
                  const eq = eqMap[wo.equipment_id];
                  const partsUsed = state.workOrderParts.filter(function (wop) {
                    return wop.work_order_id === wo.id;
                  });
                  const partsHtml = partsUsed.length
                    ? partsUsed
                        .map(function (wop) {
                          const p = partMap[wop.part_id];
                          const label = p ? `${p.sku} ×${wop.qty}` : `${wop.part_id} ×${wop.qty}`;
                          return `<span class="code-pill" style="margin: 2px 4px 2px 0;">${escapeHtml(label)}</span>`;
                        })
                        .join('')
                    : '<span class="cell-sub">None</span>';

                  return `
                    <tr data-row-id="${escapeHtml(wo.id)}">
                      <td class="mono">${escapeHtml(wo.id)}</td>
                      <td>
                        <div class="cell-primary">${escapeHtml(wo.title)}</div>
                        <div class="cell-sub">
                          <span class="mono">${escapeHtml(wo.equipment_id)}</span> · ${escapeHtml(eq ? eq.name : '(Removed Equipment)')}
                        </div>
                        ${wo.description ? `<div class="cell-sub">${escapeHtml(wo.description)}</div>` : ''}
                      </td>
                      <td>${priorityBadge(wo.priority)}</td>
                      <td>${woStatusBadge(wo.status)}</td>
                      <td>${escapeHtml(wo.assigned_to || 'Unassigned')}</td>
                      <td>${partsHtml}</td>
                      <td>
                        <div class="mono">${escapeHtml(formatDateTime(wo.created_at))}</div>
                        ${wo.closed_at ? `<div class="cell-sub mono">Closed: ${escapeHtml(formatDateTime(wo.closed_at))}</div>` : ''}
                      </td>
                      <td>
                        <div class="cell-actions">
                          <button type="button" class="btn btn-secondary btn-xs" data-action="edit-wo" data-id="${escapeHtml(wo.id)}">
                            Edit
                          </button>
                          ${
                            canDel
                              ? `<button type="button" class="btn btn-danger-ghost btn-xs" data-action="delete-wo" data-id="${escapeHtml(wo.id)}">Delete</button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : hasFilters
        ? emptyStateHtml(
            'No matching work orders',
            'Try clearing your search or status/priority filters.',
            'clear-wo-filters-btn',
            'Clear Filters',
            'clear-filters'
          )
        : emptyStateHtml(
            'No work orders yet',
            'Create a work order to track faults, assign technicians, and deduct spare parts automatically.',
            'empty-new-wo-btn',
            'Create Work Order',
            'new-wo'
          );

    return `
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h2 class="panel-title">Work Orders</h2>
            <p class="panel-subtitle">${filtered.length} of ${state.workOrders.length} work orders shown</p>
          </div>
          <div class="panel-actions">
            <button id="export-wo-csv-btn" type="button" class="btn btn-secondary btn-sm" data-action="export-wo-csv">
              Export CSV
            </button>
            <button id="new-wo-btn" type="button" class="btn btn-primary btn-sm" data-action="new-wo">
              + New Work Order
            </button>
          </div>
        </div>
        <div class="toolbar">
          <input
            id="wo-search"
            type="search"
            class="search-input"
            placeholder="Search ID, title, notes, equipment, or assignee..."
            value="${escapeHtml(filters.search || '')}"
            data-filter-key="search"
          />
          <select id="wo-status-filter" class="filter-select" data-filter-key="status" aria-label="Filter by status">
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Statuses</option>
            <option value="Open" ${statusFilter === 'Open' ? 'selected' : ''}>Open</option>
            <option value="In Progress" ${statusFilter === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Done" ${statusFilter === 'Done' ? 'selected' : ''}>Done</option>
          </select>
          <select id="wo-priority-filter" class="filter-select" data-filter-key="priority" aria-label="Filter by priority">
            <option value="all" ${priorityFilter === 'all' ? 'selected' : ''}>All Priorities</option>
            <option value="Critical" ${priorityFilter === 'Critical' ? 'selected' : ''}>Critical</option>
            <option value="High" ${priorityFilter === 'High' ? 'selected' : ''}>High</option>
            <option value="Medium" ${priorityFilter === 'Medium' ? 'selected' : ''}>Medium</option>
            <option value="Low" ${priorityFilter === 'Low' ? 'selected' : ''}>Low</option>
          </select>
        </div>
        ${bodyHtml}
      </section>
    `;
  }

  /* ---- Preventive Maintenance Schedule ---- */

  function renderPM(state, user, filters) {
    const canDel = CMMS.store.canDelete(user);
    const eqMap = mapById(state.equipment);
    const q = (filters.search || '').trim().toLowerCase();
    const pmFilter = filters.pmStatus || 'all';

    const enriched = state.pmTasks
      .map(function (task) {
        return { task: task, status: CMMS.store.getPMStatus(task) };
      })
      .sort(function (a, b) {
        return a.status.diffDays - b.status.diffDays;
      });

    const overdueCount = enriched.filter(function (x) {
      return x.status.code === 'overdue';
    }).length;

    const filtered = enriched.filter(function (entry) {
      const t = entry.task;
      if (pmFilter !== 'all' && entry.status.code !== pmFilter) return false;
      if (!q) return true;
      const eq = eqMap[t.equipment_id];
      return (
        t.id.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.equipment_id.toLowerCase().includes(q) ||
        (eq && eq.name.toLowerCase().includes(q))
      );
    });

    const hasFilters = Boolean(q || pmFilter !== 'all');
    const overdueBanner =
      overdueCount > 0
        ? `
          <div id="pm-overdue-banner" class="alert-banner danger" role="status">
            <div>
              <strong>${overdueCount} Overdue Preventive Maintenance ${overdueCount === 1 ? 'Task' : 'Tasks'}</strong> —
              Highlighted in red below. Mark complete after verifying LOTO &amp; PPE steps to recalculate the next due date.
            </div>
          </div>
        `
        : '';

    const bodyHtml = filtered.length
      ? `
        <div class="table-wrap">
          <table class="data-table" id="pm-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Task &amp; Equipment</th>
                <th>Interval</th>
                <th>Last Done</th>
                <th>Next Due</th>
                <th>Schedule Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(function (entry) {
                  const t = entry.task;
                  const eq = eqMap[t.equipment_id];
                  const rowClass =
                    entry.status.code === 'overdue'
                      ? 'row-danger'
                      : entry.status.code === 'due-soon'
                        ? 'row-warning'
                        : '';
                  return `
                    <tr class="${rowClass}" data-row-id="${escapeHtml(t.id)}" data-pm-status="${escapeHtml(entry.status.code)}">
                      <td class="mono">${escapeHtml(t.id)}</td>
                      <td>
                        <div class="cell-primary">${escapeHtml(t.title)}</div>
                        <div class="cell-sub">
                          <span class="mono">${escapeHtml(t.equipment_id)}</span> · ${escapeHtml(eq ? eq.name : '(Removed Equipment)')}
                        </div>
                      </td>
                      <td>Every ${t.interval_days} days</td>
                      <td class="mono">${escapeHtml(t.last_done || 'Never')}</td>
                      <td class="mono"><strong>${escapeHtml(t.next_due)}</strong></td>
                      <td>${pmStatusBadge(t)}</td>
                      <td>
                        <div class="cell-actions">
                          <button type="button" class="btn btn-success btn-xs" data-action="complete-pm" data-id="${escapeHtml(t.id)}">
                            Mark Done
                          </button>
                          <button type="button" class="btn btn-secondary btn-xs" data-action="edit-pm" data-id="${escapeHtml(t.id)}">
                            Edit
                          </button>
                          ${
                            canDel
                              ? `<button type="button" class="btn btn-danger-ghost btn-xs" data-action="delete-pm" data-id="${escapeHtml(t.id)}">Delete</button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : hasFilters
        ? emptyStateHtml(
            'No matching PM tasks',
            'Adjust your search or status filter to see scheduled tasks.',
            'clear-pm-filters-btn',
            'Clear Filters',
            'clear-filters'
          )
        : emptyStateHtml(
            'No preventive maintenance schedules',
            'Create a recurring PM task to automatically track due dates and flag overdue work.',
            'empty-new-pm-btn',
            'Add PM Task',
            'new-pm'
          );

    return `
      ${overdueBanner}
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h2 class="panel-title">Preventive Maintenance Schedule</h2>
            <p class="panel-subtitle">${filtered.length} of ${state.pmTasks.length} recurring tasks shown</p>
          </div>
          <div class="panel-actions">
            <button id="new-pm-btn" type="button" class="btn btn-primary btn-sm" data-action="new-pm">
              + Add PM Task
            </button>
          </div>
        </div>
        <div class="toolbar">
          <input
            id="pm-search"
            type="search"
            class="search-input"
            placeholder="Search PM ID, task, or equipment..."
            value="${escapeHtml(filters.search || '')}"
            data-filter-key="search"
          />
          <select id="pm-status-filter" class="filter-select" data-filter-key="pmStatus" aria-label="Filter by PM status">
            <option value="all" ${pmFilter === 'all' ? 'selected' : ''}>All Schedules</option>
            <option value="overdue" ${pmFilter === 'overdue' ? 'selected' : ''}>Overdue Only</option>
            <option value="due-soon" ${pmFilter === 'due-soon' ? 'selected' : ''}>Due Soon (≤7d)</option>
            <option value="scheduled" ${pmFilter === 'scheduled' ? 'selected' : ''}>Scheduled (&gt;7d)</option>
          </select>
        </div>
        ${bodyHtml}
      </section>
    `;
  }

  /* ---- Spare Parts Inventory ---- */

  function renderParts(state, user, filters) {
    const canDel = CMMS.store.canDelete(user);
    const canEditThresh = CMMS.store.canEditStockThreshold(user);
    const q = (filters.search || '').trim().toLowerCase();
    const stockFilter = filters.stockStatus || 'all';

    const lowCount = state.parts.filter(function (p) {
      return CMMS.store.getStockStatus(p) === 'low';
    }).length;
    const thresholdCount = state.parts.filter(function (p) {
      return CMMS.store.getStockStatus(p) === 'threshold';
    }).length;

    const filtered = state.parts.filter(function (p) {
      const st = CMMS.store.getStockStatus(p);
      if (stockFilter !== 'all' && st !== stockFilter) return false;
      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.supplier || '').toLowerCase().includes(q)
      );
    });

    const roleNotice = !canEditThresh
      ? `
        <div id="tech-parts-notice" class="alert-banner info" role="note">
          <div>
            <strong>Technician Role Active:</strong> You can update current stock counts and copy draft purchase requests.
            Editing <strong>Min Stock thresholds</strong> and <strong>deleting records</strong> require Admin access.
          </div>
        </div>
      `
      : '';

    const lowBanner =
      lowCount > 0
        ? `
          <div id="parts-low-banner" class="alert-banner danger" role="status">
            <div>
              <strong>${lowCount} ${lowCount === 1 ? 'Part' : 'Parts'} Below Minimum Stock</strong>${
                thresholdCount > 0 ? ` (${thresholdCount} at exact threshold)` : ''
              } — Draft a copy-only purchase request for review.
            </div>
            <button id="draft-all-low-po-banner-btn" type="button" class="btn btn-secondary btn-xs" data-action="draft-po-all">
              Draft PR (All Low-Stock)
            </button>
          </div>
        `
        : '';

    const hasFilters = Boolean(q || stockFilter !== 'all');
    const bodyHtml = filtered.length
      ? `
        <div class="table-wrap">
          <table class="data-table" id="parts-table">
            <thead>
              <tr>
                <th>ID &amp; SKU</th>
                <th>Part Name</th>
                <th>Stock</th>
                <th>Min Threshold</th>
                <th>Status</th>
                <th>Supplier</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(function (p) {
                  const st = CMMS.store.getStockStatus(p);
                  const rowClass = st === 'low' ? 'row-danger' : st === 'threshold' ? 'row-warning' : '';
                  const showDraftBtn = st === 'low' || st === 'threshold';
                  return `
                    <tr class="${rowClass}" data-row-id="${escapeHtml(p.id)}" data-stock-status="${escapeHtml(st)}">
                      <td>
                        <div class="mono">${escapeHtml(p.id)}</div>
                        <span class="code-pill" style="margin-top: 3px;">${escapeHtml(p.sku)}</span>
                      </td>
                      <td class="cell-primary">${escapeHtml(p.name)}</td>
                      <td class="mono"><strong>${p.stock}</strong></td>
                      <td class="mono">${p.min_stock}</td>
                      <td>${stockBadge(p)}</td>
                      <td>${escapeHtml(p.supplier)}</td>
                      <td>
                        <div class="cell-actions">
                          ${
                            showDraftBtn
                              ? `<button type="button" class="btn btn-secondary btn-xs" data-action="draft-po-single" data-id="${escapeHtml(p.id)}">Draft PR</button>`
                              : ''
                          }
                          <button type="button" class="btn btn-secondary btn-xs" data-action="edit-part" data-id="${escapeHtml(p.id)}">
                            Edit
                          </button>
                          ${
                            canDel
                              ? `<button type="button" class="btn btn-danger-ghost btn-xs" data-action="delete-part" data-id="${escapeHtml(p.id)}">Delete</button>`
                              : ''
                          }
                        </div>
                      </td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : hasFilters
        ? emptyStateHtml(
            'No matching spare parts',
            'Clear your search query or stock status filter to view inventory.',
            'clear-parts-filters-btn',
            'Clear Filters',
            'clear-filters'
          )
        : emptyStateHtml(
            'No spare parts in inventory',
            canEditThresh
              ? 'Add spare parts with minimum stock thresholds to enable automatic low-stock alerts.'
              : 'Ask an Admin to add spare parts and configure minimum stock thresholds.',
            canEditThresh ? 'empty-new-part-btn' : '',
            canEditThresh ? 'Add Part' : '',
            'new-part'
          );

    return `
      ${roleNotice}
      ${lowBanner}
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h2 class="panel-title">Spare Parts Inventory</h2>
            <p class="panel-subtitle">Low Stock triggers when Stock &lt; Min Threshold; subtle warning when equal</p>
          </div>
          <div class="panel-actions">
            <button id="export-parts-csv-btn" type="button" class="btn btn-secondary btn-sm" data-action="export-parts-csv">
              Export CSV
            </button>
            <button
              id="draft-all-low-po-btn"
              type="button"
              class="btn btn-secondary btn-sm"
              data-action="draft-po-all"
              ${lowCount === 0 ? 'disabled' : ''}
            >
              Draft PR (${lowCount} Low)
            </button>
            ${
              canEditThresh
                ? `<button id="new-part-btn" type="button" class="btn btn-primary btn-sm" data-action="new-part">+ Add Part</button>`
                : ''
            }
          </div>
        </div>
        <div class="toolbar">
          <input
            id="parts-search"
            type="search"
            class="search-input"
            placeholder="Search ID, SKU, part name, or supplier..."
            value="${escapeHtml(filters.search || '')}"
            data-filter-key="search"
          />
          <select id="parts-status-filter" class="filter-select" data-filter-key="stockStatus" aria-label="Filter by stock status">
            <option value="all" ${stockFilter === 'all' ? 'selected' : ''}>All Stock Levels</option>
            <option value="low" ${stockFilter === 'low' ? 'selected' : ''}>Low Stock (&lt; Min)</option>
            <option value="threshold" ${stockFilter === 'threshold' ? 'selected' : ''}>At Threshold (= Min)</option>
            <option value="ok" ${stockFilter === 'ok' ? 'selected' : ''}>In Stock (&gt; Min)</option>
          </select>
        </div>
        ${bodyHtml}
      </section>
    `;
  }

  /* ---- Audit Log (Strictly Read-Only) ---- */

  function renderAudit(state, _user, filters) {
    const q = (filters.search || '').trim().toLowerCase();
    const entityFilter = filters.entity || 'all';
    const actionFilter = filters.action || 'all';

    const filtered = state.auditLog.filter(function (entry) {
      if (entityFilter !== 'all' && entry.entity !== entityFilter) return false;
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
      if (!q) return true;
      return (
        entry.id.toLowerCase().includes(q) ||
        entry.user.toLowerCase().includes(q) ||
        entry.entity.toLowerCase().includes(q) ||
        entry.entity_id.toLowerCase().includes(q) ||
        (entry.details || '').toLowerCase().includes(q)
      );
    });

    const hasFilters = Boolean(q || entityFilter !== 'all' || actionFilter !== 'all');
    const bodyHtml = filtered.length
      ? `
        <div class="table-wrap">
          <table class="data-table" id="audit-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${filtered
                .map(function (entry) {
                  return `
                    <tr>
                      <td class="mono">${escapeHtml(entry.id)}</td>
                      <td class="mono">${escapeHtml(formatDateTime(entry.timestamp))}</td>
                      <td>${escapeHtml(entry.user)}</td>
                      <td>${auditActionBadge(entry.action)}</td>
                      <td>${escapeHtml(entry.entity)}</td>
                      <td class="mono">${escapeHtml(entry.entity_id)}</td>
                      <td>${escapeHtml(entry.details || '—')}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `
      : emptyStateHtml(
          hasFilters ? 'No matching audit entries' : 'Audit log is empty',
          hasFilters
            ? 'Clear filters to view all recorded workspace events.'
            : 'Every create, update, and delete operation is logged here automatically.',
          hasFilters ? 'clear-audit-filters-btn' : '',
          hasFilters ? 'Clear Filters' : '',
          'clear-filters'
        );

    return `
      <div class="alert-banner info" role="note">
        <div>
          <strong>Read-Only Governance Log:</strong> Historical audit entries are append-only and cannot be edited or deleted by any role.
        </div>
      </div>
      <section class="panel">
        <div class="panel-header">
          <div class="panel-title-wrap">
            <h2 class="panel-title">Audit Log</h2>
            <p class="panel-subtitle">${filtered.length} of ${state.auditLog.length} events recorded</p>
          </div>
          <span class="badge badge-neutral">Read-Only</span>
        </div>
        <div class="toolbar">
          <input
            id="audit-search"
            type="search"
            class="search-input"
            placeholder="Search user, entity ID, or details..."
            value="${escapeHtml(filters.search || '')}"
            data-filter-key="search"
          />
          <select id="audit-entity-filter" class="filter-select" data-filter-key="entity" aria-label="Filter by entity">
            <option value="all" ${entityFilter === 'all' ? 'selected' : ''}>All Entities</option>
            <option value="Equipment" ${entityFilter === 'Equipment' ? 'selected' : ''}>Equipment</option>
            <option value="WorkOrder" ${entityFilter === 'WorkOrder' ? 'selected' : ''}>WorkOrder</option>
            <option value="Part" ${entityFilter === 'Part' ? 'selected' : ''}>Part</option>
            <option value="PMTask" ${entityFilter === 'PMTask' ? 'selected' : ''}>PMTask</option>
            <option value="System" ${entityFilter === 'System' ? 'selected' : ''}>System</option>
          </select>
          <select id="audit-action-filter" class="filter-select" data-filter-key="action" aria-label="Filter by action">
            <option value="all" ${actionFilter === 'all' ? 'selected' : ''}>All Actions</option>
            <option value="CREATE" ${actionFilter === 'CREATE' ? 'selected' : ''}>CREATE</option>
            <option value="UPDATE" ${actionFilter === 'UPDATE' ? 'selected' : ''}>UPDATE</option>
            <option value="DELETE" ${actionFilter === 'DELETE' ? 'selected' : ''}>DELETE</option>
          </select>
        </div>
        ${bodyHtml}
      </section>
    `;
  }

  CMMS.ui = {
    escapeHtml: escapeHtml,
    formatDateTime: formatDateTime,
    renderOverview: renderOverview,
    renderEquipment: renderEquipment,
    renderWorkOrders: renderWorkOrders,
    renderPM: renderPM,
    renderParts: renderParts,
    renderAudit: renderAudit
  };
})(window);
