/* ==========================================================================
   Maintenance Office CMMS — Excel-Compatible CSV Exporter
   Produces RFC-4180 compliant CSV files with UTF-8 BOM (\uFEFF) and CRLF line
   endings so Microsoft Excel opens special characters and commas cleanly.
   ========================================================================== */

(function (global) {
  'use strict';

  const CMMS = (global.CMMS = global.CMMS || {});

  function escapeCsvCell(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\r\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  function toCsvString(headers, rows) {
    const lines = [];
    lines.push(headers.map(escapeCsvCell).join(','));
    rows.forEach(function (row) {
      lines.push(row.map(escapeCsvCell).join(','));
    });
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
  }

  function downloadCsv(filename, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(function () {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function buildWorkOrdersCsv(state) {
    const headers = [
      'ID',
      'Equipment ID',
      'Equipment Name',
      'Title',
      'Description',
      'Priority',
      'Status',
      'Assigned To',
      'Parts Used',
      'Created At',
      'Closed At'
    ];

    const eqById = {};
    state.equipment.forEach(function (e) {
      eqById[e.id] = e;
    });

    const partById = {};
    state.parts.forEach(function (p) {
      partById[p.id] = p;
    });

    const rows = state.workOrders.map(function (wo) {
      const eq = eqById[wo.equipment_id];
      const linked = state.workOrderParts
        .filter(function (wop) {
          return wop.work_order_id === wo.id;
        })
        .map(function (wop) {
          const p = partById[wop.part_id];
          return p ? `${p.sku} (${p.name}) x${wop.qty}` : `${wop.part_id} x${wop.qty}`;
        })
        .join('; ');

      return [
        wo.id,
        wo.equipment_id,
        eq ? eq.name : '(Removed Equipment)',
        wo.title,
        wo.description || '',
        wo.priority,
        wo.status,
        wo.assigned_to || 'Unassigned',
        linked,
        wo.created_at || '',
        wo.closed_at || ''
      ];
    });

    return toCsvString(headers, rows);
  }

  function buildInventoryCsv(state) {
    const headers = [
      'ID',
      'SKU',
      'Name',
      'Stock',
      'Min Stock',
      'Stock Status',
      'Supplier'
    ];

    const rows = state.parts.map(function (part) {
      const status =
        part.stock < part.min_stock
          ? 'Low Stock'
          : part.stock === part.min_stock
            ? 'At Threshold'
            : 'In Stock';

      return [
        part.id,
        part.sku,
        part.name,
        part.stock,
        part.min_stock,
        status,
        part.supplier || ''
      ];
    });

    return toCsvString(headers, rows);
  }

  CMMS.csv = {
    escapeCsvCell: escapeCsvCell,
    toCsvString: toCsvString,
    buildWorkOrdersCsv: buildWorkOrdersCsv,
    buildInventoryCsv: buildInventoryCsv,
    exportWorkOrders: function (state) {
      const today = CMMS.dateUtils.todayYMD();
      const content = buildWorkOrdersCsv(state);
      downloadCsv(`work-orders-${today}.csv`, content);
      return content;
    },
    exportInventory: function (state) {
      const today = CMMS.dateUtils.todayYMD();
      const content = buildInventoryCsv(state);
      downloadCsv(`spare-parts-inventory-${today}.csv`, content);
      return content;
    }
  };
})(window);
