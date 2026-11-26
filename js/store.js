/* ==========================================================================
   Maintenance Office CMMS — State Store, Persistence, RBAC & Audit Log
   Enforces role restrictions (admin vs technician), atomic spare-part stock
   deduction, overdue PM calculations, and strictly append-only audit logging.
   ========================================================================== */

(function (global) {
  'use strict';

  const CMMS = (global.CMMS = global.CMMS || {});

  const STORAGE_KEY = 'maintenance_office_cmms_v1';
  const SESSION_KEY = 'maintenance_office_cmms_session_v1';

  let state = null;
  let currentUser = null;
  const listeners = [];

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function notify() {
    const snapshot = getState();
    listeners.forEach(function (fn) {
      try {
        fn(snapshot, getCurrentUser());
      } catch (err) {
        console.error('Store subscriber error:', err);
      }
    });
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      throw new Error('Failed to save data to localStorage: ' + err.message);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          Array.isArray(parsed.equipment) &&
          Array.isArray(parsed.workOrders) &&
          Array.isArray(parsed.parts) &&
          Array.isArray(parsed.workOrderParts) &&
          Array.isArray(parsed.pmTasks) &&
          Array.isArray(parsed.auditLog)
        ) {
          state = parsed;
        } else {
          state = CMMS.createSeedData();
          persist();
        }
      } else {
        state = CMMS.createSeedData();
        persist();
      }
    } catch (err) {
      console.warn('Corrupt localStorage state detected; reseeding.', err);
      state = CMMS.createSeedData();
      persist();
    }

    try {
      const rawSession = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (rawSession) {
        const parsedUser = JSON.parse(rawSession);
        if (parsedUser && parsedUser.name && (parsedUser.role === 'admin' || parsedUser.role === 'technician')) {
          currentUser = parsedUser;
        }
      }
    } catch (err) {
      currentUser = null;
    }
  }

  function nextId(prefix, list) {
    let maxNum = 100;
    if (prefix === 'WO') maxNum = 1000;
    if (prefix === 'PRT') maxNum = 200;
    if (prefix === 'PM') maxNum = 300;
    if (prefix === 'AUD') maxNum = 5000;

    list.forEach(function (item) {
      if (item && typeof item.id === 'string' && item.id.indexOf(prefix + '-') === 0) {
        const n = parseInt(item.id.slice(prefix.length + 1), 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }
    });
    return `${prefix}-${maxNum + 1}`;
  }

  function requireAuth() {
    if (!currentUser) {
      throw new Error('Authentication required. Please sign in first.');
    }
    return currentUser;
  }

  function actorLabel(user) {
    return `${user.name} (${user.role})`;
  }

  function appendAudit(action, entity, entityId, details) {
    const user = requireAuth();
    const entry = {
      id: nextId('AUD', state.auditLog),
      user: actorLabel(user),
      action: action,
      entity: entity,
      entity_id: entityId,
      details: details || '',
      timestamp: new Date().toISOString()
    };
    state.auditLog.unshift(entry);
    return entry;
  }

  /* ---- Role & Permission Helpers ---- */

  function canDelete(user) {
    const u = user || currentUser;
    return Boolean(u && u.role === 'admin');
  }

  function canEditStockThreshold(user) {
    const u = user || currentUser;
    return Boolean(u && u.role === 'admin');
  }

  function canResetDemoData(user) {
    const u = user || currentUser;
    return Boolean(u && u.role === 'admin');
  }

  function assertAdminDelete(entityName) {
    const user = requireAuth();
    if (!canDelete(user)) {
      throw new Error(`Permission denied: Technicians cannot delete ${entityName} records.`);
    }
  }

  /* ---- Domain Status Helpers ---- */

  function getStockStatus(part) {
    if (part.stock < part.min_stock) return 'low';
    if (part.stock === part.min_stock) return 'threshold';
    return 'ok';
  }

  function getPMStatus(task) {
    const diff = CMMS.dateUtils.diffDaysFromToday(task.next_due);
    if (diff < 0) return { code: 'overdue', diffDays: diff };
    if (diff <= 7) return { code: 'due-soon', diffDays: diff };
    return { code: 'scheduled', diffDays: diff };
  }

  /* ---- Auth ---- */

  function login(name, role) {
    const cleanName = String(name || '').trim();
    if (!cleanName) {
      throw new Error('Please enter your name before signing in.');
    }
    if (role !== 'admin' && role !== 'technician') {
      throw new Error('Invalid role. Expected admin or technician.');
    }
    currentUser = {
      name: cleanName,
      role: role,
      signedInAt: new Date().toISOString()
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
    } catch (err) {
      // ignore storage errors for session
    }
    notify();
    return getCurrentUser();
  }

  function logout() {
    currentUser = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    } catch (err) {
      // ignore
    }
    notify();
  }

  function getCurrentUser() {
    return currentUser ? clone(currentUser) : null;
  }

  function getState() {
    return state ? clone(state) : null;
  }

  /* ---- Equipment CRUD ---- */

  function createEquipment(input) {
    requireAuth();
    const name = String(input.name || '').trim();
    const location = String(input.location || '').trim();
    const criticality = String(input.criticality || 'Medium').trim();
    const qr_code = String(input.qr_code || '').trim();

    if (!name) throw new Error('Equipment name is required.');
    if (!location) throw new Error('Equipment location is required.');
    if (!qr_code) throw new Error('QR / SKU code is required.');

    const duplicateQr = state.equipment.find(function (e) {
      return e.qr_code.toLowerCase() === qr_code.toLowerCase();
    });
    if (duplicateQr) {
      throw new Error(`QR/SKU code "${qr_code}" is already assigned to ${duplicateQr.id}.`);
    }

    const record = {
      id: nextId('EQ', state.equipment),
      name: name,
      location: location,
      criticality: criticality,
      qr_code: qr_code
    };

    state.equipment.unshift(record);
    appendAudit('CREATE', 'Equipment', record.id, `Added ${record.name} (${record.location}, ${record.criticality})`);
    persist();
    notify();
    return clone(record);
  }

  function updateEquipment(id, input) {
    requireAuth();
    const idx = state.equipment.findIndex(function (e) {
      return e.id === id;
    });
    if (idx === -1) throw new Error(`Equipment ${id} not found.`);

    const existing = state.equipment[idx];
    const name = String(input.name !== undefined ? input.name : existing.name).trim();
    const location = String(input.location !== undefined ? input.location : existing.location).trim();
    const criticality = String(input.criticality !== undefined ? input.criticality : existing.criticality).trim();
    const qr_code = String(input.qr_code !== undefined ? input.qr_code : existing.qr_code).trim();

    if (!name) throw new Error('Equipment name is required.');
    if (!location) throw new Error('Equipment location is required.');
    if (!qr_code) throw new Error('QR / SKU code is required.');

    const duplicateQr = state.equipment.find(function (e) {
      return e.id !== id && e.qr_code.toLowerCase() === qr_code.toLowerCase();
    });
    if (duplicateQr) {
      throw new Error(`QR/SKU code "${qr_code}" is already assigned to ${duplicateQr.id}.`);
    }

    state.equipment[idx] = {
      id: existing.id,
      name: name,
      location: location,
      criticality: criticality,
      qr_code: qr_code
    };

    appendAudit('UPDATE', 'Equipment', existing.id, `Updated ${name} (${location}, ${criticality})`);
    persist();
    notify();
    return clone(state.equipment[idx]);
  }

  function deleteEquipment(id) {
    assertAdminDelete('Equipment');
    const idx = state.equipment.findIndex(function (e) {
      return e.id === id;
    });
    if (idx === -1) throw new Error(`Equipment ${id} not found.`);

    const removed = state.equipment[idx];
    state.equipment.splice(idx, 1);
    appendAudit('DELETE', 'Equipment', removed.id, `Deleted equipment ${removed.name}`);
    persist();
    notify();
    return clone(removed);
  }

  /* ---- Spare Parts CRUD ---- */

  function createPart(input) {
    const user = requireAuth();
    const sku = String(input.sku || '').trim();
    const name = String(input.name || '').trim();
    const supplier = String(input.supplier || '').trim();
    const stock = Number(input.stock);
    const min_stock = Number(input.min_stock);

    if (!sku) throw new Error('Part SKU is required.');
    if (!name) throw new Error('Part name is required.');
    if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number (0 or greater).');
    if (!Number.isInteger(min_stock) || min_stock < 0) {
      throw new Error('Minimum stock threshold must be a whole number (0 or greater).');
    }

    if (!canEditStockThreshold(user) && min_stock > 0) {
      throw new Error('Permission denied: Only Admins can set stock thresholds for new parts.');
    }

    const dupSku = state.parts.find(function (p) {
      return p.sku.toLowerCase() === sku.toLowerCase();
    });
    if (dupSku) {
      throw new Error(`SKU "${sku}" already exists on ${dupSku.id}.`);
    }

    const record = {
      id: nextId('PRT', state.parts),
      sku: sku,
      name: name,
      stock: stock,
      min_stock: min_stock,
      supplier: supplier || 'Unspecified Supplier'
    };

    state.parts.unshift(record);
    appendAudit('CREATE', 'Part', record.id, `Added ${record.sku} — ${record.name} (stock: ${record.stock}, min: ${record.min_stock})`);
    persist();
    notify();
    return clone(record);
  }

  function updatePart(id, input) {
    const user = requireAuth();
    const idx = state.parts.findIndex(function (p) {
      return p.id === id;
    });
    if (idx === -1) throw new Error(`Part ${id} not found.`);

    const existing = state.parts[idx];
    const sku = String(input.sku !== undefined ? input.sku : existing.sku).trim();
    const name = String(input.name !== undefined ? input.name : existing.name).trim();
    const supplier = String(input.supplier !== undefined ? input.supplier : existing.supplier).trim();
    const stock = input.stock !== undefined ? Number(input.stock) : existing.stock;
    const min_stock = input.min_stock !== undefined ? Number(input.min_stock) : existing.min_stock;

    if (!sku) throw new Error('Part SKU is required.');
    if (!name) throw new Error('Part name is required.');
    if (!Number.isInteger(stock) || stock < 0) throw new Error('Stock must be a whole number (0 or greater).');
    if (!Number.isInteger(min_stock) || min_stock < 0) {
      throw new Error('Minimum stock threshold must be a whole number (0 or greater).');
    }

    // Strict RBAC check in data layer: technicians cannot change min_stock
    if (min_stock !== existing.min_stock && !canEditStockThreshold(user)) {
      throw new Error('Permission denied: Technicians cannot edit minimum stock thresholds.');
    }

    const dupSku = state.parts.find(function (p) {
      return p.id !== id && p.sku.toLowerCase() === sku.toLowerCase();
    });
    if (dupSku) {
      throw new Error(`SKU "${sku}" already exists on ${dupSku.id}.`);
    }

    state.parts[idx] = {
      id: existing.id,
      sku: sku,
      name: name,
      stock: stock,
      min_stock: min_stock,
      supplier: supplier || 'Unspecified Supplier'
    };

    const changes = [];
    if (stock !== existing.stock) changes.push(`stock ${existing.stock} -> ${stock}`);
    if (min_stock !== existing.min_stock) changes.push(`min_stock ${existing.min_stock} -> ${min_stock}`);
    if (name !== existing.name) changes.push(`name updated`);
    if (supplier !== existing.supplier) changes.push(`supplier updated`);

    appendAudit('UPDATE', 'Part', existing.id, `Updated ${sku}${changes.length ? ' (' + changes.join(', ') + ')' : ''}`);
    persist();
    notify();
    return clone(state.parts[idx]);
  }

  function deletePart(id) {
    assertAdminDelete('Part');
    const idx = state.parts.findIndex(function (p) {
      return p.id === id;
    });
    if (idx === -1) throw new Error(`Part ${id} not found.`);

    const removed = state.parts[idx];
    state.parts.splice(idx, 1);
    appendAudit('DELETE', 'Part', removed.id, `Deleted part ${removed.sku} — ${removed.name}`);
    persist();
    notify();
    return clone(removed);
  }

  /* ---- Work Orders CRUD + Atomic Part Stock Deduction ---- */

  function normalizePartLines(partLines) {
    const map = {};
    (partLines || []).forEach(function (line) {
      if (!line || !line.part_id) return;
      const qty = Number(line.qty);
      if (!Number.isInteger(qty) || qty <= 0) {
        throw new Error('Part quantity must be a positive whole number.');
      }
      map[line.part_id] = (map[line.part_id] || 0) + qty;
    });
    return map;
  }

  function createWorkOrder(input) {
    requireAuth();
    const equipment_id = String(input.equipment_id || '').trim();
    const title = String(input.title || '').trim();
    const description = String(input.description || '').trim();
    const priority = String(input.priority || 'Medium').trim();
    const status = String(input.status || 'Open').trim();
    const assigned_to = String(input.assigned_to || '').trim();

    if (!equipment_id) throw new Error('Please select an equipment asset.');
    if (!title) throw new Error('Work order title is required.');

    const requestedMap = normalizePartLines(input.parts);

    // Pre-validate all part deductions atomically before mutating state
    Object.keys(requestedMap).forEach(function (partId) {
      const qty = requestedMap[partId];
      const part = state.parts.find(function (p) {
        return p.id === partId;
      });
      if (!part) throw new Error(`Selected spare part (${partId}) was not found.`);
      if (qty > part.stock) {
        throw new Error(
          `Insufficient stock for ${part.name} (${part.sku}): requested ${qty}, available ${part.stock}.`
        );
      }
    });

    const nowISO = new Date().toISOString();
    const record = {
      id: nextId('WO', state.workOrders),
      equipment_id: equipment_id,
      title: title,
      description: description,
      priority: priority,
      status: status,
      assigned_to: assigned_to || 'Unassigned',
      created_at: nowISO,
      closed_at: status === 'Done' ? nowISO : null
    };

    state.workOrders.unshift(record);

    const deductedSummaries = [];
    Object.keys(requestedMap).forEach(function (partId) {
      const qty = requestedMap[partId];
      const part = state.parts.find(function (p) {
        return p.id === partId;
      });
      const prevStock = part.stock;
      part.stock = prevStock - qty;

      state.workOrderParts.push({
        work_order_id: record.id,
        part_id: partId,
        qty: qty
      });

      const lowFlag = part.stock < part.min_stock ? ' [LOW STOCK]' : '';
      deductedSummaries.push(`${qty}x ${part.sku}`);
      appendAudit(
        'UPDATE',
        'Part',
        part.id,
        `Consumed ${qty}x on ${record.id} (stock ${prevStock} -> ${part.stock})${lowFlag}`
      );
    });

    const partsText = deductedSummaries.length ? `; parts: ${deductedSummaries.join(', ')}` : '';
    appendAudit(
      'CREATE',
      'WorkOrder',
      record.id,
      `Created "${record.title}" [${record.priority} / ${record.status}] on ${record.equipment_id}${partsText}`
    );

    persist();
    notify();
    return clone(record);
  }

  function updateWorkOrder(id, input) {
    requireAuth();
    const idx = state.workOrders.findIndex(function (wo) {
      return wo.id === id;
    });
    if (idx === -1) throw new Error(`Work order ${id} not found.`);

    const existing = state.workOrders[idx];
    const equipment_id = String(input.equipment_id !== undefined ? input.equipment_id : existing.equipment_id).trim();
    const title = String(input.title !== undefined ? input.title : existing.title).trim();
    const description = String(input.description !== undefined ? input.description : existing.description).trim();
    const priority = String(input.priority !== undefined ? input.priority : existing.priority).trim();
    const status = String(input.status !== undefined ? input.status : existing.status).trim();
    const assigned_to = String(input.assigned_to !== undefined ? input.assigned_to : existing.assigned_to).trim();

    if (!equipment_id) throw new Error('Please select an equipment asset.');
    if (!title) throw new Error('Work order title is required.');

    // If parts array is provided, compute deltas and validate stock atomically
    let partsChanged = false;
    let newMap = null;
    const oldMap = {};
    state.workOrderParts
      .filter(function (wop) {
        return wop.work_order_id === id;
      })
      .forEach(function (wop) {
        oldMap[wop.part_id] = (oldMap[wop.part_id] || 0) + wop.qty;
      });

    if (Array.isArray(input.parts)) {
      newMap = normalizePartLines(input.parts);
      const allPartIds = Object.keys(Object.assign({}, oldMap, newMap));
      allPartIds.forEach(function (partId) {
        const delta = (newMap[partId] || 0) - (oldMap[partId] || 0);
        if (delta !== 0) partsChanged = true;
        if (delta > 0) {
          const part = state.parts.find(function (p) {
            return p.id === partId;
          });
          if (!part) throw new Error(`Selected spare part (${partId}) was not found.`);
          if (delta > part.stock) {
            throw new Error(
              `Insufficient stock for ${part.name} (${part.sku}): need ${delta} more, available ${part.stock}.`
            );
          }
        }
      });
    }

    let closed_at = existing.closed_at;
    if (status === 'Done' && existing.status !== 'Done') {
      closed_at = new Date().toISOString();
    } else if (status !== 'Done' && existing.status === 'Done') {
      closed_at = null;
    }

    state.workOrders[idx] = {
      id: existing.id,
      equipment_id: equipment_id,
      title: title,
      description: description,
      priority: priority,
      status: status,
      assigned_to: assigned_to || 'Unassigned',
      created_at: existing.created_at,
      closed_at: closed_at
    };

    if (partsChanged && newMap) {
      const allPartIds = Object.keys(Object.assign({}, oldMap, newMap));
      allPartIds.forEach(function (partId) {
        const delta = (newMap[partId] || 0) - (oldMap[partId] || 0);
        if (delta !== 0) {
          const part = state.parts.find(function (p) {
            return p.id === partId;
          });
          if (part) {
            const prev = part.stock;
            part.stock = prev - delta;
            const lowFlag = part.stock < part.min_stock ? ' [LOW STOCK]' : '';
            const verb = delta > 0 ? `Consumed +${delta}x` : `Returned ${Math.abs(delta)}x`;
            appendAudit('UPDATE', 'Part', part.id, `${verb} on ${existing.id} (stock ${prev} -> ${part.stock})${lowFlag}`);
          }
        }
      });

      state.workOrderParts = state.workOrderParts.filter(function (wop) {
        return wop.work_order_id !== id;
      });
      Object.keys(newMap).forEach(function (partId) {
        state.workOrderParts.push({
          work_order_id: id,
          part_id: partId,
          qty: newMap[partId]
        });
      });
    }

    appendAudit(
      'UPDATE',
      'WorkOrder',
      existing.id,
      `Updated "${title}" [${priority} / ${status}] (assigned: ${assigned_to || 'Unassigned'})`
    );

    persist();
    notify();
    return clone(state.workOrders[idx]);
  }

  function deleteWorkOrder(id) {
    assertAdminDelete('WorkOrder');
    const idx = state.workOrders.findIndex(function (wo) {
      return wo.id === id;
    });
    if (idx === -1) throw new Error(`Work order ${id} not found.`);

    const removed = state.workOrders[idx];
    state.workOrders.splice(idx, 1);
    state.workOrderParts = state.workOrderParts.filter(function (wop) {
      return wop.work_order_id !== id;
    });
    appendAudit('DELETE', 'WorkOrder', removed.id, `Deleted work order "${removed.title}"`);
    persist();
    notify();
    return clone(removed);
  }

  /* ---- PM Tasks CRUD ---- */

  function createPMTask(input) {
    requireAuth();
    const equipment_id = String(input.equipment_id || '').trim();
    const title = String(input.title || '').trim();
    const interval_days = Number(input.interval_days);
    const last_done = String(input.last_done || '').trim();
    let next_due = String(input.next_due || '').trim();

    if (!equipment_id) throw new Error('Please select an equipment asset.');
    if (!title) throw new Error('PM task description is required.');
    if (!Number.isInteger(interval_days) || interval_days < 1) {
      throw new Error('Interval must be at least 1 day.');
    }
    if (!next_due) {
      next_due = last_done
        ? CMMS.dateUtils.addDaysYMD(last_done, interval_days)
        : CMMS.dateUtils.addDaysYMD(CMMS.dateUtils.todayYMD(), interval_days);
    }

    const record = {
      id: nextId('PM', state.pmTasks),
      equipment_id: equipment_id,
      title: title,
      interval_days: interval_days,
      last_done: last_done || null,
      next_due: next_due
    };

    state.pmTasks.unshift(record);
    appendAudit('CREATE', 'PMTask', record.id, `Scheduled "${record.title}" on ${record.equipment_id} (every ${interval_days}d, due ${next_due})`);
    persist();
    notify();
    return clone(record);
  }

  function updatePMTask(id, input) {
    requireAuth();
    const idx = state.pmTasks.findIndex(function (t) {
      return t.id === id;
    });
    if (idx === -1) throw new Error(`PM task ${id} not found.`);

    const existing = state.pmTasks[idx];
    const equipment_id = String(input.equipment_id !== undefined ? input.equipment_id : existing.equipment_id).trim();
    const title = String(input.title !== undefined ? input.title : existing.title).trim();
    const interval_days = input.interval_days !== undefined ? Number(input.interval_days) : existing.interval_days;
    const last_done = input.last_done !== undefined ? String(input.last_done || '').trim() || null : existing.last_done;
    const next_due = String(input.next_due !== undefined ? input.next_due : existing.next_due).trim();

    if (!equipment_id) throw new Error('Please select an equipment asset.');
    if (!title) throw new Error('PM task description is required.');
    if (!Number.isInteger(interval_days) || interval_days < 1) {
      throw new Error('Interval must be at least 1 day.');
    }
    if (!next_due) throw new Error('Next due date is required.');

    state.pmTasks[idx] = {
      id: existing.id,
      equipment_id: equipment_id,
      title: title,
      interval_days: interval_days,
      last_done: last_done,
      next_due: next_due
    };

    appendAudit('UPDATE', 'PMTask', existing.id, `Updated "${title}" (interval ${interval_days}d, due ${next_due})`);
    persist();
    notify();
    return clone(state.pmTasks[idx]);
  }

  function completePMTask(id) {
    requireAuth();
    const idx = state.pmTasks.findIndex(function (t) {
      return t.id === id;
    });
    if (idx === -1) throw new Error(`PM task ${id} not found.`);

    const task = state.pmTasks[idx];
    const today = CMMS.dateUtils.todayYMD();
    const nextDue = CMMS.dateUtils.addDaysYMD(today, task.interval_days);

    task.last_done = today;
    task.next_due = nextDue;

    appendAudit('UPDATE', 'PMTask', task.id, `Completed PM "${task.title}"; next due ${nextDue}`);
    persist();
    notify();
    return clone(task);
  }

  function deletePMTask(id) {
    assertAdminDelete('PMTask');
    const idx = state.pmTasks.findIndex(function (t) {
      return t.id === id;
    });
    if (idx === -1) throw new Error(`PM task ${id} not found.`);

    const removed = state.pmTasks[idx];
    state.pmTasks.splice(idx, 1);
    appendAudit('DELETE', 'PMTask', removed.id, `Deleted PM task "${removed.title}"`);
    persist();
    notify();
    return clone(removed);
  }

  /* ---- Demo Reset (Admin only) ---- */

  function resetDemoData() {
    const user = requireAuth();
    if (!canResetDemoData(user)) {
      throw new Error('Permission denied: Only Admins can reset demo data.');
    }
    state = CMMS.createSeedData();
    appendAudit('UPDATE', 'System', 'DEMO-RESET', 'Reset workspace to default sample plant data');
    persist();
    notify();
    return getState();
  }

  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      const i = listeners.indexOf(fn);
      if (i > -1) listeners.splice(i, 1);
    };
  }

  CMMS.store = {
    init: load,
    subscribe: subscribe,
    getState: getState,
    getCurrentUser: getCurrentUser,
    login: login,
    logout: logout,
    canDelete: canDelete,
    canEditStockThreshold: canEditStockThreshold,
    canResetDemoData: canResetDemoData,
    getStockStatus: getStockStatus,
    getPMStatus: getPMStatus,
    createEquipment: createEquipment,
    updateEquipment: updateEquipment,
    deleteEquipment: deleteEquipment,
    createPart: createPart,
    updatePart: updatePart,
    deletePart: deletePart,
    createWorkOrder: createWorkOrder,
    updateWorkOrder: updateWorkOrder,
    deleteWorkOrder: deleteWorkOrder,
    createPMTask: createPMTask,
    updatePMTask: updatePMTask,
    completePMTask: completePMTask,
    deletePMTask: deletePMTask,
    resetDemoData: resetDemoData
  };
})(window);
