/* ==========================================================================
   Maintenance Office CMMS — Application Controller (js/app.js)
   Handles hydration loading state, auth view, navigation, modals, forms,
   validation/error states, copy-only Draft Purchase Requests, and toasts.
   ========================================================================== */

(function (global) {
  'use strict';

  const CMMS = (global.CMMS = global.CMMS || {});

  const VIEW_TITLES = {
    overview: 'Overview',
    equipment: 'Equipment Register',
    workorders: 'Work Orders',
    pm: 'Preventive Maintenance Schedule',
    parts: 'Spare Parts Inventory',
    audit: 'Audit Log'
  };

  let activeView = 'overview';
  const viewFilters = {
    equipment: { search: '', criticality: 'all' },
    workorders: { search: '', status: 'all', priority: 'all' },
    pm: { search: '', pmStatus: 'all' },
    parts: { search: '', stockStatus: 'all' },
    audit: { search: '', entity: 'all', action: 'all' }
  };

  /* ---- DOM References ---- */
  const els = {};

  function cacheDom() {
    els.loadingOverlay = document.getElementById('loading-overlay');
    els.loginView = document.getElementById('login-view');
    els.loginError = document.getElementById('login-error');
    els.adminNameInput = document.getElementById('admin-name-input');
    els.techNameInput = document.getElementById('tech-name-input');
    els.loginAdminBtn = document.getElementById('login-admin-btn');
    els.loginTechBtn = document.getElementById('login-tech-btn');

    els.appShell = document.getElementById('app-shell');
    els.sidebar = document.getElementById('sidebar');
    els.sidebarBackdrop = document.getElementById('sidebar-backdrop');
    els.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    els.topbarTitle = document.getElementById('topbar-title');
    els.topbarRolePill = document.getElementById('topbar-role-pill');
    els.topbarActions = document.getElementById('topbar-actions');
    els.viewContainer = document.getElementById('view-container');

    els.sidebarUserName = document.getElementById('sidebar-user-name');
    els.sidebarUserRole = document.getElementById('sidebar-user-role');
    els.resetDemoBtn = document.getElementById('reset-demo-btn');
    els.logoutBtn = document.getElementById('logout-btn');

    els.badgeEquipment = document.getElementById('badge-equipment');
    els.badgeWorkOrders = document.getElementById('badge-workorders');
    els.badgePM = document.getElementById('badge-pm');
    els.badgeParts = document.getElementById('badge-parts');
    els.badgeAudit = document.getElementById('badge-audit');

    els.modalBackdrop = document.getElementById('modal-backdrop');
    els.modalTitle = document.getElementById('modal-title');
    els.modalBody = document.getElementById('modal-body');
    els.modalFooter = document.getElementById('modal-footer');
    els.modalCloseBtn = document.getElementById('modal-close-btn');

    els.toastRegion = document.getElementById('toast-region');
  }

  /* ---- Toast Notifications ---- */

  function showToast(message, type) {
    while (els.toastRegion.children.length >= 2) {
      els.toastRegion.removeChild(els.toastRegion.firstChild);
    }
    const toast = document.createElement('div');
    toast.className = 'toast ' + (type || '');
    toast.innerHTML = `
      <span>${CMMS.ui.escapeHtml(message)}</span>
      <button type="button" class="toast-close" aria-label="Dismiss">&times;</button>
    `;
    const closeBtn = toast.querySelector('.toast-close');
    const remove = function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    };
    closeBtn.addEventListener('click', remove);
    els.toastRegion.appendChild(toast);
    setTimeout(remove, 4200);
  }

  /* ---- Modal Controller ---- */

  function openModal(title, bodyHtml, footerHtml) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = bodyHtml;
    els.modalFooter.innerHTML = footerHtml;
    els.modalBackdrop.classList.remove('hidden');
    const firstInput = els.modalBody.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    if (firstInput) {
      setTimeout(function () {
        firstInput.focus();
      }, 30);
    }
  }

  function closeModal() {
    els.modalBackdrop.classList.add('hidden');
    els.modalBody.innerHTML = '';
    els.modalFooter.innerHTML = '';
  }

  function setModalError(message) {
    let box = els.modalBody.querySelector('#modal-form-error');
    if (!box) {
      box = document.createElement('div');
      box.id = 'modal-form-error';
      box.className = 'form-error-box';
      box.setAttribute('role', 'alert');
      els.modalBody.insertBefore(box, els.modalBody.firstChild);
    }
    box.textContent = message;
    box.classList.remove('hidden');
  }

  function clearModalError() {
    const box = els.modalBody.querySelector('#modal-form-error');
    if (box) box.classList.add('hidden');
  }

  function openConfirmModal(title, message, confirmLabel, onConfirm) {
    openModal(
      title,
      `<p style="margin: 0; color: var(--text-secondary);">${CMMS.ui.escapeHtml(message)}</p>`,
      `
        <button id="modal-cancel-btn" type="button" class="btn btn-secondary">Cancel</button>
        <button id="modal-confirm-btn" type="button" class="btn btn-danger">${CMMS.ui.escapeHtml(confirmLabel)}</button>
      `
    );
    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('modal-confirm-btn').addEventListener('click', function () {
      try {
        onConfirm();
        closeModal();
      } catch (err) {
        setModalError(err.message);
      }
    });
  }

  /* ---- Sidebar & Navigation ---- */

  function closeMobileDrawer() {
    els.sidebar.classList.remove('open');
    els.sidebarBackdrop.classList.remove('open');
  }

  function setView(viewName) {
    if (!VIEW_TITLES[viewName]) return;
    activeView = viewName;
    closeMobileDrawer();
    render();
  }

  function updateSidebarBadges(state) {
    const openWO = state.workOrders.filter(function (w) {
      return w.status !== 'Done';
    }).length;
    const overduePM = state.pmTasks.filter(function (t) {
      return CMMS.store.getPMStatus(t).code === 'overdue';
    }).length;
    const lowParts = state.parts.filter(function (p) {
      return CMMS.store.getStockStatus(p) === 'low';
    }).length;

    els.badgeEquipment.textContent = String(state.equipment.length);
    els.badgeWorkOrders.textContent = String(openWO);

    els.badgePM.textContent = overduePM > 0 ? `${overduePM} due` : String(state.pmTasks.length);
    els.badgePM.classList.toggle('alert', overduePM > 0);

    els.badgeParts.textContent = lowParts > 0 ? `${lowParts} low` : String(state.parts.length);
    els.badgeParts.classList.toggle('alert', lowParts > 0);

    els.badgeAudit.textContent = String(state.auditLog.length);
  }

  /* ---- Main Render Loop ---- */

  function render() {
    const user = CMMS.store.getCurrentUser();
    const state = CMMS.store.getState();

    if (!user) {
      els.appShell.classList.add('hidden');
      els.loginView.classList.remove('hidden');
      return;
    }

    els.loginView.classList.add('hidden');
    els.appShell.classList.remove('hidden');

    // Update user & role chrome
    els.sidebarUserName.textContent = user.name;
    els.sidebarUserRole.textContent = user.role;
    els.sidebarUserRole.className = 'user-chip-role ' + user.role;
    els.resetDemoBtn.classList.toggle('hidden', !CMMS.store.canResetDemoData(user));

    els.topbarTitle.textContent = VIEW_TITLES[activeView];
    els.topbarRolePill.textContent =
      user.role === 'admin'
        ? `Admin · ${user.name} (Full Access)`
        : `Technician · ${user.name} (No Deletes / Thresholds Locked)`;

    // Update active nav item
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === activeView);
    });

    updateSidebarBadges(state);

    // Quick topbar button for Overview
    els.topbarActions.innerHTML =
      activeView === 'overview'
        ? `<button id="quick-new-wo-btn" type="button" class="btn btn-primary btn-sm" data-action="new-wo">+ Log Work Order</button>`
        : '';

    // Preserve focused search input cursor when filtering
    const activeEl = document.activeElement;
    const focusedId = activeEl && els.viewContainer.contains(activeEl) ? activeEl.id : null;
    const selStart = focusedId && typeof activeEl.selectionStart === 'number' ? activeEl.selectionStart : null;

    // Render active view
    let html = '';
    if (activeView === 'overview') {
      html = CMMS.ui.renderOverview(state, user);
    } else if (activeView === 'equipment') {
      html = CMMS.ui.renderEquipment(state, user, viewFilters.equipment);
    } else if (activeView === 'workorders') {
      html = CMMS.ui.renderWorkOrders(state, user, viewFilters.workorders);
    } else if (activeView === 'pm') {
      html = CMMS.ui.renderPM(state, user, viewFilters.pm);
    } else if (activeView === 'parts') {
      html = CMMS.ui.renderParts(state, user, viewFilters.parts);
    } else if (activeView === 'audit') {
      html = CMMS.ui.renderAudit(state, user, viewFilters.audit);
    }

    els.viewContainer.innerHTML = html;

    if (focusedId) {
      const restored = document.getElementById(focusedId);
      if (restored) {
        restored.focus();
        if (selStart !== null && typeof restored.setSelectionRange === 'function') {
          try {
            restored.setSelectionRange(selStart, selStart);
          } catch (_e) {
            // ignore on non-text inputs
          }
        }
      }
    }
  }

  /* ==========================================================================
     CRUD Modals
     ========================================================================== */

  /* ---- Equipment Modal ---- */

  function openEquipmentModal(existing) {
    const isEdit = Boolean(existing);
    const e = existing || { name: '', location: '', criticality: 'Medium', qr_code: '' };
    const esc = CMMS.ui.escapeHtml;

    openModal(
      isEdit ? `Edit Equipment · ${e.id}` : 'Add Equipment',
      `
        <form id="equipment-form" class="form-grid" novalidate>
          <div class="form-field full">
            <label class="form-label" for="eq-name">Equipment Name *</label>
            <input id="eq-name" class="form-input" type="text" required value="${esc(e.name)}" placeholder="e.g. Hydraulic Press #2" />
          </div>
          <div class="form-field">
            <label class="form-label" for="eq-location">Location *</label>
            <input id="eq-location" class="form-input" type="text" required value="${esc(e.location)}" placeholder="e.g. Assembly Bay B" />
          </div>
          <div class="form-field">
            <label class="form-label" for="eq-criticality">Criticality *</label>
            <select id="eq-criticality" class="form-select">
              ${['Critical', 'High', 'Medium', 'Low']
                .map(function (lvl) {
                  return `<option value="${lvl}" ${e.criticality === lvl ? 'selected' : ''}>${lvl}</option>`;
                })
                .join('')}
            </select>
          </div>
          <div class="form-field full">
            <label class="form-label" for="eq-qr">QR / SKU Asset Code *</label>
            <input id="eq-qr" class="form-input mono" type="text" required value="${esc(e.qr_code)}" placeholder="e.g. QR-ASM-PRS02" />
          </div>
        </form>
      `,
      `
        <button id="modal-cancel-btn" type="button" class="btn btn-secondary">Cancel</button>
        <button id="eq-save-btn" type="button" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Create Equipment'}</button>
      `
    );

    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('eq-save-btn').addEventListener('click', function () {
      clearModalError();
      const payload = {
        name: document.getElementById('eq-name').value,
        location: document.getElementById('eq-location').value,
        criticality: document.getElementById('eq-criticality').value,
        qr_code: document.getElementById('eq-qr').value
      };
      try {
        if (isEdit) {
          CMMS.store.updateEquipment(e.id, payload);
          showToast(`Updated equipment ${e.id}.`, 'success');
        } else {
          const created = CMMS.store.createEquipment(payload);
          showToast(`Registered equipment ${created.id}.`, 'success');
        }
        closeModal();
      } catch (err) {
        setModalError(err.message);
      }
    });
  }

  /* ---- Work Order Modal (with Spare Parts Repeater) ---- */

  function openWorkOrderModal(existing) {
    const state = CMMS.store.getState();
    const user = CMMS.store.getCurrentUser();
    const isEdit = Boolean(existing);
    const esc = CMMS.ui.escapeHtml;

    if (!state.equipment.length) {
      showToast('Please register at least one equipment asset before creating a work order.', 'error');
      return;
    }

    const wo = existing || {
      equipment_id: state.equipment[0].id,
      title: '',
      description: '',
      priority: 'Medium',
      status: 'Open',
      assigned_to: user.name
    };

    const existingParts = isEdit
      ? state.workOrderParts
          .filter(function (wop) {
            return wop.work_order_id === wo.id;
          })
          .map(function (wop) {
            return { part_id: wop.part_id, qty: wop.qty };
          })
      : [];

    function partOptionsHtml(selectedPartId) {
      return state.parts
        .map(function (p) {
          const sel = p.id === selectedPartId ? 'selected' : '';
          return `<option value="${esc(p.id)}" ${sel}>${esc(p.sku)} — ${esc(p.name)} (Avail: ${p.stock})</option>`;
        })
        .join('');
    }

    function renderPartRow(line) {
      const div = document.createElement('div');
      div.className = 'parts-repeater-row';
      div.innerHTML = `
        <select class="form-select wo-part-select" aria-label="Spare part">
          ${partOptionsHtml(line ? line.part_id : '')}
        </select>
        <input type="number" min="1" step="1" class="form-input wo-part-qty" value="${line ? line.qty : 1}" aria-label="Quantity" />
        <button type="button" class="btn btn-danger-ghost btn-xs wo-part-remove" title="Remove part line">&times;</button>
      `;
      div.querySelector('.wo-part-remove').addEventListener('click', function () {
        div.remove();
      });
      return div;
    }

    openModal(
      isEdit ? `Edit Work Order · ${wo.id}` : 'New Work Order',
      `
        <form id="wo-form" class="form-grid" novalidate>
          <div class="form-field full">
            <label class="form-label" for="wo-title">Work Order Title *</label>
            <input id="wo-title" class="form-input" type="text" required value="${esc(wo.title)}" placeholder="e.g. Replace worn intake filter" />
          </div>
          <div class="form-field">
            <label class="form-label" for="wo-equipment">Equipment *</label>
            <select id="wo-equipment" class="form-select">
              ${state.equipment
                .map(function (eq) {
                  return `<option value="${esc(eq.id)}" ${eq.id === wo.equipment_id ? 'selected' : ''}>${esc(eq.id)} — ${esc(eq.name)}</option>`;
                })
                .join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="wo-assigned">Assigned To</label>
            <input id="wo-assigned" class="form-input" type="text" value="${esc(wo.assigned_to)}" placeholder="Technician or manager name" />
          </div>
          <div class="form-field">
            <label class="form-label" for="wo-priority">Priority</label>
            <select id="wo-priority" class="form-select">
              ${['Critical', 'High', 'Medium', 'Low']
                .map(function (p) {
                  return `<option value="${p}" ${wo.priority === p ? 'selected' : ''}>${p}</option>`;
                })
                .join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="wo-status">Status</label>
            <select id="wo-status" class="form-select">
              ${['Open', 'In Progress', 'Done']
                .map(function (s) {
                  return `<option value="${s}" ${wo.status === s ? 'selected' : ''}>${s}</option>`;
                })
                .join('')}
            </select>
          </div>
          <div class="form-field full">
            <label class="form-label" for="wo-description">Fault Notes / Procedure Reminders</label>
            <textarea id="wo-description" class="form-textarea" placeholder="Describe fault symptoms, findings, and LOTO/PPE precautions...">${esc(wo.description)}</textarea>
          </div>

          <div class="form-field full">
            <div class="parts-repeater">
              <div class="parts-repeater-head">
                <span class="form-label" style="margin: 0;">Spare Parts Consumed (auto-deducts stock)</span>
                <button id="wo-add-part-row-btn" type="button" class="btn btn-secondary btn-xs" ${state.parts.length === 0 ? 'disabled' : ''}>
                  + Add Part
                </button>
              </div>
              <div id="wo-parts-rows" style="display: flex; flex-direction: column; gap: 8px;"></div>
              <span class="form-hint">Parts linked here immediately reduce inventory stock and trigger Low Stock alerts if stock drops below threshold.</span>
            </div>
          </div>
        </form>
      `,
      `
        <button id="modal-cancel-btn" type="button" class="btn btn-secondary">Cancel</button>
        <button id="wo-save-btn" type="button" class="btn btn-primary">${isEdit ? 'Save Work Order' : 'Create Work Order'}</button>
      `
    );

    const rowsContainer = document.getElementById('wo-parts-rows');
    existingParts.forEach(function (line) {
      rowsContainer.appendChild(renderPartRow(line));
    });

    document.getElementById('wo-add-part-row-btn').addEventListener('click', function () {
      if (!state.parts.length) return;
      rowsContainer.appendChild(renderPartRow({ part_id: state.parts[0].id, qty: 1 }));
    });

    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('wo-save-btn').addEventListener('click', function () {
      clearModalError();
      const partLines = [];
      rowsContainer.querySelectorAll('.parts-repeater-row').forEach(function (row) {
        const partId = row.querySelector('.wo-part-select').value;
        const qtyVal = Number(row.querySelector('.wo-part-qty').value);
        partLines.push({ part_id: partId, qty: qtyVal });
      });

      const payload = {
        equipment_id: document.getElementById('wo-equipment').value,
        title: document.getElementById('wo-title').value,
        description: document.getElementById('wo-description').value,
        priority: document.getElementById('wo-priority').value,
        status: document.getElementById('wo-status').value,
        assigned_to: document.getElementById('wo-assigned').value,
        parts: partLines
      };

      try {
        if (isEdit) {
          CMMS.store.updateWorkOrder(wo.id, payload);
          showToast(`Updated work order ${wo.id}.`, 'success');
        } else {
          const created = CMMS.store.createWorkOrder(payload);
          showToast(`Created work order ${created.id}.`, 'success');
        }
        closeModal();
      } catch (err) {
        setModalError(err.message);
      }
    });
  }

  /* ---- PM Task Modal ---- */

  function openPMModal(existing) {
    const state = CMMS.store.getState();
    const isEdit = Boolean(existing);
    const esc = CMMS.ui.escapeHtml;

    if (!state.equipment.length) {
      showToast('Please register at least one equipment asset first.', 'error');
      return;
    }

    const today = CMMS.dateUtils.todayYMD();
    const task = existing || {
      equipment_id: state.equipment[0].id,
      title: '',
      interval_days: 30,
      last_done: today,
      next_due: CMMS.dateUtils.addDaysYMD(today, 30)
    };

    openModal(
      isEdit ? `Edit PM Task · ${task.id}` : 'Add Preventive Maintenance Task',
      `
        <form id="pm-form" class="form-grid" novalidate>
          <div class="form-field full">
            <label class="form-label" for="pm-title">Task Title / Inspection Scope *</label>
            <input id="pm-title" class="form-input" type="text" required value="${esc(task.title)}" placeholder="e.g. Grease motor bearings & check belt tension" />
          </div>
          <div class="form-field full">
            <label class="form-label" for="pm-equipment">Equipment *</label>
            <select id="pm-equipment" class="form-select">
              ${state.equipment
                .map(function (eq) {
                  return `<option value="${esc(eq.id)}" ${eq.id === task.equipment_id ? 'selected' : ''}>${esc(eq.id)} — ${esc(eq.name)}</option>`;
                })
                .join('')}
            </select>
          </div>
          <div class="form-field">
            <label class="form-label" for="pm-interval">Interval (Days) *</label>
            <input id="pm-interval" class="form-input" type="number" min="1" step="1" required value="${task.interval_days}" />
          </div>
          <div class="form-field">
            <label class="form-label" for="pm-last-done">Last Done Date</label>
            <input id="pm-last-done" class="form-input" type="date" value="${esc(task.last_done || '')}" />
          </div>
          <div class="form-field full">
            <label class="form-label" for="pm-next-due">Next Due Date *</label>
            <input id="pm-next-due" class="form-input" type="date" required value="${esc(task.next_due || '')}" />
            <span class="form-hint">Dates before today are automatically highlighted as Overdue.</span>
          </div>
        </form>
      `,
      `
        <button id="modal-cancel-btn" type="button" class="btn btn-secondary">Cancel</button>
        <button id="pm-save-btn" type="button" class="btn btn-primary">${isEdit ? 'Save PM Task' : 'Create PM Task'}</button>
      `
    );

    // Auto-update next_due when interval or last_done changes on new tasks
    if (!isEdit) {
      const recalc = function () {
        const lastVal = document.getElementById('pm-last-done').value;
        const intervalVal = parseInt(document.getElementById('pm-interval').value, 10);
        if (lastVal && intervalVal > 0) {
          document.getElementById('pm-next-due').value = CMMS.dateUtils.addDaysYMD(lastVal, intervalVal);
        }
      };
      document.getElementById('pm-interval').addEventListener('change', recalc);
      document.getElementById('pm-last-done').addEventListener('change', recalc);
    }

    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('pm-save-btn').addEventListener('click', function () {
      clearModalError();
      const payload = {
        equipment_id: document.getElementById('pm-equipment').value,
        title: document.getElementById('pm-title').value,
        interval_days: Number(document.getElementById('pm-interval').value),
        last_done: document.getElementById('pm-last-done').value,
        next_due: document.getElementById('pm-next-due').value
      };
      try {
        if (isEdit) {
          CMMS.store.updatePMTask(task.id, payload);
          showToast(`Updated PM task ${task.id}.`, 'success');
        } else {
          const created = CMMS.store.createPMTask(payload);
          showToast(`Scheduled PM task ${created.id}.`, 'success');
        }
        closeModal();
      } catch (err) {
        setModalError(err.message);
      }
    });
  }

  /* ---- Spare Part Modal (RBAC-enforced min_stock) ---- */

  function openPartModal(existing) {
    const user = CMMS.store.getCurrentUser();
    const canEditThresh = CMMS.store.canEditStockThreshold(user);
    const isEdit = Boolean(existing);
    const esc = CMMS.ui.escapeHtml;

    if (!isEdit && !canEditThresh) {
      showToast('Permission denied: Only Admins can create new spare part thresholds.', 'error');
      return;
    }

    const p = existing || { sku: '', name: '', stock: 0, min_stock: 2, supplier: '' };

    openModal(
      isEdit ? `Edit Spare Part · ${p.id}` : 'Add Spare Part',
      `
        <form id="part-form" class="form-grid" novalidate>
          <div class="form-field">
            <label class="form-label" for="part-sku">SKU *</label>
            <input id="part-sku" class="form-input mono" type="text" required value="${esc(p.sku)}" placeholder="e.g. BRG-6308" />
          </div>
          <div class="form-field">
            <label class="form-label" for="part-supplier">Supplier</label>
            <input id="part-supplier" class="form-input" type="text" value="${esc(p.supplier)}" placeholder="e.g. SKF Distributors" />
          </div>
          <div class="form-field full">
            <label class="form-label" for="part-name">Part Name *</label>
            <input id="part-name" class="form-input" type="text" required value="${esc(p.name)}" placeholder="e.g. Deep Groove Ball Bearing 6308" />
          </div>
          <div class="form-field">
            <label class="form-label" for="part-stock">Current Stock *</label>
            <input id="part-stock" class="form-input mono" type="number" min="0" step="1" required value="${p.stock}" />
          </div>
          <div class="form-field">
            <label class="form-label" for="part-min-stock">
              Min Stock Threshold *
              ${!canEditThresh ? '<span class="badge badge-warning">Admin Only</span>' : ''}
            </label>
            <input
              id="part-min-stock"
              class="form-input mono"
              type="number"
              min="0"
              step="1"
              required
              value="${p.min_stock}"
              ${!canEditThresh ? 'disabled' : ''}
            />
            <span class="form-hint ${!canEditThresh ? 'locked' : ''}">
              ${
                canEditThresh
                  ? 'Low Stock alert appears when Stock < Min Threshold.'
                  : 'Locked: Technicians cannot edit minimum stock thresholds.'
              }
            </span>
          </div>
        </form>
      `,
      `
        <button id="modal-cancel-btn" type="button" class="btn btn-secondary">Cancel</button>
        <button id="part-save-btn" type="button" class="btn btn-primary">${isEdit ? 'Save Part' : 'Add Part'}</button>
      `
    );

    document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
    document.getElementById('part-save-btn').addEventListener('click', function () {
      clearModalError();
      const payload = {
        sku: document.getElementById('part-sku').value,
        name: document.getElementById('part-name').value,
        supplier: document.getElementById('part-supplier').value,
        stock: Number(document.getElementById('part-stock').value)
      };
      if (canEditThresh) {
        payload.min_stock = Number(document.getElementById('part-min-stock').value);
      }

      try {
        if (isEdit) {
          CMMS.store.updatePart(p.id, payload);
          showToast(`Updated spare part ${p.sku}.`, 'success');
        } else {
          const created = CMMS.store.createPart(payload);
          showToast(`Added spare part ${created.sku}.`, 'success');
        }
        closeModal();
      } catch (err) {
        setModalError(err.message);
      }
    });
  }

  /* ---- Copy-Only Draft Purchase Request Modal (SAFETY.md: Never Auto-Send) ---- */

  function openDraftPurchaseRequestModal(partsList) {
    if (!partsList || !partsList.length) {
      showToast('No low-stock parts selected for a draft purchase request.', 'warning');
      return;
    }

    const user = CMMS.store.getCurrentUser();
    const today = CMMS.dateUtils.todayYMD();

    const lines = partsList.map(function (p, i) {
      const suggestedQty = Math.max(p.min_stock * 2 - p.stock, p.min_stock - p.stock + 1, 1);
      const statusLabel = p.stock < p.min_stock ? 'LOW STOCK' : 'AT THRESHOLD';
      return [
        `${i + 1}. ${p.name} (SKU: ${p.sku})`,
        `   Supplier: ${p.supplier}`,
        `   Current Stock: ${p.stock} | Min Threshold: ${p.min_stock} [${statusLabel}]`,
        `   Suggested Order Qty: ${suggestedQty}`
      ].join('\n');
    });

    const draftText = [
      'PURCHASE REQUEST — DRAFT ONLY (HUMAN REVIEW REQUIRED)',
      '======================================================',
      `Date:          ${today}`,
      `Prepared By:   ${user.name} (${user.role})`,
      `Status:        DRAFT — NOT SENT`,
      '',
      'Requested Spare Parts:',
      '------------------------------------------------------',
      lines.join('\n\n'),
      '',
      'Notes:',
      '- Please verify vendor lead time, unit pricing, and budget approval',
      '  before issuing an official purchase order.'
    ].join('\n');

    openModal(
      'Draft Purchase Request (Copy Only)',
      `
        <div class="alert-banner warning" role="note">
          <div>
            <strong>DRAFT ONLY — External Sending Disabled:</strong> Review and copy this draft into your procurement workflow. No order is sent automatically.
          </div>
        </div>
        <div class="form-field">
          <label class="form-label" for="draft-po-textarea">Editable Draft Text</label>
          <textarea id="draft-po-textarea" class="form-textarea draft-po-box">${CMMS.ui.escapeHtml(draftText)}</textarea>
        </div>
      `,
      `
        <button id="draft-po-close-btn" type="button" class="btn btn-secondary">Close</button>
        <button id="draft-po-copy-btn" type="button" class="btn btn-primary">Copy Draft to Clipboard</button>
      `
    );

    document.getElementById('draft-po-close-btn').addEventListener('click', closeModal);
    document.getElementById('draft-po-copy-btn').addEventListener('click', function () {
      const textarea = document.getElementById('draft-po-textarea');
      const text = textarea.value;

      function onCopied() {
        showToast('Draft purchase request copied to clipboard (not sent).', 'success');
      }

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard
          .writeText(text)
          .then(onCopied)
          .catch(function () {
            textarea.select();
            document.execCommand('copy');
            onCopied();
          });
      } else {
        textarea.select();
        document.execCommand('copy');
        onCopied();
      }
    });
  }

  /* ==========================================================================
     Event Delegation & Wiring
     ========================================================================== */

  function handleActionClick(action, id) {
    const state = CMMS.store.getState();

    if (action === 'clear-filters') {
      if (activeView === 'equipment') viewFilters.equipment = { search: '', criticality: 'all' };
      if (activeView === 'workorders') viewFilters.workorders = { search: '', status: 'all', priority: 'all' };
      if (activeView === 'pm') viewFilters.pm = { search: '', pmStatus: 'all' };
      if (activeView === 'parts') viewFilters.parts = { search: '', stockStatus: 'all' };
      if (activeView === 'audit') viewFilters.audit = { search: '', entity: 'all', action: 'all' };
      render();
      return;
    }

    if (action === 'new-equipment') return openEquipmentModal(null);
    if (action === 'edit-equipment') {
      const eq = state.equipment.find(function (e) {
        return e.id === id;
      });
      if (eq) openEquipmentModal(eq);
      return;
    }
    if (action === 'delete-equipment') {
      const eq = state.equipment.find(function (e) {
        return e.id === id;
      });
      if (!eq) return;
      openConfirmModal(
        `Delete Equipment ${eq.id}?`,
        `This permanently removes "${eq.name}" from the equipment register and logs the deletion in the audit log.`,
        'Delete Equipment',
        function () {
          CMMS.store.deleteEquipment(eq.id);
          showToast(`Deleted equipment ${eq.id}.`, 'success');
        }
      );
      return;
    }

    if (action === 'new-wo') return openWorkOrderModal(null);
    if (action === 'edit-wo') {
      const wo = state.workOrders.find(function (w) {
        return w.id === id;
      });
      if (wo) openWorkOrderModal(wo);
      return;
    }
    if (action === 'delete-wo') {
      const wo = state.workOrders.find(function (w) {
        return w.id === id;
      });
      if (!wo) return;
      openConfirmModal(
        `Delete Work Order ${wo.id}?`,
        `This removes work order "${wo.title}" and logs the deletion in the audit log.`,
        'Delete Work Order',
        function () {
          CMMS.store.deleteWorkOrder(wo.id);
          showToast(`Deleted work order ${wo.id}.`, 'success');
        }
      );
      return;
    }

    if (action === 'export-wo-csv') {
      try {
        CMMS.csv.exportWorkOrders(state);
        showToast(`Exported ${state.workOrders.length} work orders to CSV.`, 'success');
      } catch (err) {
        showToast('CSV export failed: ' + err.message, 'error');
      }
      return;
    }

    if (action === 'new-pm') return openPMModal(null);
    if (action === 'edit-pm') {
      const task = state.pmTasks.find(function (t) {
        return t.id === id;
      });
      if (task) openPMModal(task);
      return;
    }
    if (action === 'complete-pm') {
      try {
        const updated = CMMS.store.completePMTask(id);
        showToast(`Marked ${updated.id} done. Next due: ${updated.next_due}.`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }
    if (action === 'delete-pm') {
      const task = state.pmTasks.find(function (t) {
        return t.id === id;
      });
      if (!task) return;
      openConfirmModal(
        `Delete PM Task ${task.id}?`,
        `This removes recurring PM task "${task.title}" and logs the deletion in the audit log.`,
        'Delete PM Task',
        function () {
          CMMS.store.deletePMTask(task.id);
          showToast(`Deleted PM task ${task.id}.`, 'success');
        }
      );
      return;
    }

    if (action === 'new-part') return openPartModal(null);
    if (action === 'edit-part') {
      const part = state.parts.find(function (p) {
        return p.id === id;
      });
      if (part) openPartModal(part);
      return;
    }
    if (action === 'delete-part') {
      const part = state.parts.find(function (p) {
        return p.id === id;
      });
      if (!part) return;
      openConfirmModal(
        `Delete Spare Part ${part.id}?`,
        `This removes "${part.name}" (${part.sku}) from inventory and logs the deletion in the audit log.`,
        'Delete Part',
        function () {
          CMMS.store.deletePart(part.id);
          showToast(`Deleted spare part ${part.sku}.`, 'success');
        }
      );
      return;
    }

    if (action === 'export-parts-csv') {
      try {
        CMMS.csv.exportInventory(state);
        showToast(`Exported ${state.parts.length} spare parts to CSV.`, 'success');
      } catch (err) {
        showToast('CSV export failed: ' + err.message, 'error');
      }
      return;
    }

    if (action === 'draft-po-single') {
      const part = state.parts.find(function (p) {
        return p.id === id;
      });
      if (part) openDraftPurchaseRequestModal([part]);
      return;
    }

    if (action === 'draft-po-all') {
      const lowParts = state.parts.filter(function (p) {
        return CMMS.store.getStockStatus(p) === 'low';
      });
      openDraftPurchaseRequestModal(lowParts);
      return;
    }
  }

  function wireEvents() {
    // Login buttons
    els.loginAdminBtn.addEventListener('click', function () {
      els.loginError.classList.add('hidden');
      try {
        CMMS.store.login(els.adminNameInput.value, 'admin');
        activeView = 'overview';
        showToast('Signed in as Admin.', 'success');
      } catch (err) {
        els.loginError.textContent = err.message;
        els.loginError.classList.remove('hidden');
      }
    });

    els.loginTechBtn.addEventListener('click', function () {
      els.loginError.classList.add('hidden');
      try {
        CMMS.store.login(els.techNameInput.value, 'technician');
        activeView = 'overview';
        showToast('Signed in as Technician.', 'success');
      } catch (err) {
        els.loginError.textContent = err.message;
        els.loginError.classList.remove('hidden');
      }
    });

    // Sidebar navigation
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setView(btn.dataset.view);
      });
    });

    // Mobile drawer
    els.mobileMenuBtn.addEventListener('click', function () {
      els.sidebar.classList.toggle('open');
      els.sidebarBackdrop.classList.toggle('open');
    });
    els.sidebarBackdrop.addEventListener('click', closeMobileDrawer);

    // Logout & Demo Reset
    els.logoutBtn.addEventListener('click', function () {
      CMMS.store.logout();
      closeMobileDrawer();
    });

    els.resetDemoBtn.addEventListener('click', function () {
      openConfirmModal(
        'Reset Demo Data?',
        'This restores the default sample plant equipment, work orders, PM tasks, and spare parts.',
        'Reset Data',
        function () {
          CMMS.store.resetDemoData();
          showToast('Demo data restored.', 'success');
        }
      );
    });

    // Modal close events & Enter-key form submit prevention
    els.modalCloseBtn.addEventListener('click', closeModal);
    els.modalBackdrop.addEventListener('click', function (ev) {
      if (ev.target === els.modalBackdrop) closeModal();
    });
    els.modalBody.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const primaryBtn = els.modalFooter.querySelector('.btn-primary');
      if (primaryBtn && !primaryBtn.disabled) primaryBtn.click();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !els.modalBackdrop.classList.contains('hidden')) {
        closeModal();
      }
    });

    // Delegated clicks inside main content and topbar actions
    function onDelegatedClick(ev) {
      const navTarget = ev.target.closest('[data-nav-target]');
      if (navTarget) {
        setView(navTarget.dataset.navTarget);
        return;
      }
      const actionBtn = ev.target.closest('[data-action]');
      if (actionBtn) {
        handleActionClick(actionBtn.dataset.action, actionBtn.dataset.id);
      }
    }

    els.viewContainer.addEventListener('click', onDelegatedClick);
    els.topbarActions.addEventListener('click', onDelegatedClick);

    // Delegated search/filter inputs inside view container
    els.viewContainer.addEventListener('input', function (ev) {
      const key = ev.target.dataset && ev.target.dataset.filterKey;
      if (!key || !viewFilters[activeView]) return;
      viewFilters[activeView][key] = ev.target.value;
      render();
    });

    els.viewContainer.addEventListener('change', function (ev) {
      const key = ev.target.dataset && ev.target.dataset.filterKey;
      if (!key || !viewFilters[activeView]) return;
      viewFilters[activeView][key] = ev.target.value;
      render();
    });
  }

  /* ---- Bootstrap ---- */

  function boot() {
    cacheDom();
    wireEvents();

    // Brief hydration loading state to verify loading UX cleanly
    setTimeout(function () {
      try {
        CMMS.store.init();
        CMMS.store.subscribe(render);
        render();
      } catch (err) {
        els.viewContainer.innerHTML = `
          <div class="alert-banner danger" role="alert">
            <strong>Failed to load workspace:</strong> ${CMMS.ui.escapeHtml(err.message)}
          </div>
        `;
      } finally {
        els.loadingOverlay.classList.add('hidden');
      }
    }, 180);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
