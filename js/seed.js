/* ==========================================================================
   Maintenance Office CMMS — Seed Data (Phase 1 Local Prototype)
   Provides realistic initial plant maintenance data using relative dates so
   overdue PM tasks, low-stock parts, and at-threshold alerts are immediately
   verifiable regardless of when the prototype is opened.
   ========================================================================== */

(function (global) {
  'use strict';

  const CMMS = (global.CMMS = global.CMMS || {});

  function formatDateYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function daysOffsetYMD(daysOffset) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + daysOffset);
    return formatDateYMD(d);
  }

  function daysOffsetISO(daysOffset, hourOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    if (typeof hourOffset === 'number') {
      d.setHours(d.getHours() + hourOffset);
    }
    return d.toISOString();
  }

  CMMS.dateUtils = {
    todayYMD: function () {
      return daysOffsetYMD(0);
    },
    addDaysYMD: function (ymd, days) {
      const parts = String(ymd).split('-').map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
      d.setDate(d.getDate() + Number(days));
      return formatDateYMD(d);
    },
    diffDaysFromToday: function (ymd) {
      if (!ymd) return 0;
      const parts = String(ymd).split('-').map(Number);
      const target = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
      return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }
  };

  CMMS.DEMO_USERS = [
    {
      id: 'usr-admin',
      name: 'Elena Vance',
      role: 'admin',
      title: 'Maintenance Manager',
      summary: 'Full access: manage equipment, work orders, PM schedules, stock thresholds, and record deletion.'
    },
    {
      id: 'usr-tech',
      name: 'Marcus Cole',
      role: 'technician',
      title: 'Field Technician',
      summary: 'Shop-floor access: log faults, update work orders, consume parts, complete PMs. Cannot delete records or edit min-stock thresholds.'
    }
  ];

  CMMS.createSeedData = function createSeedData() {
    return {
      version: 1,
      equipment: [
        {
          id: 'EQ-101',
          name: 'Main Air Compressor #1',
          location: 'Utility Bay A',
          criticality: 'Critical',
          qr_code: 'QR-UTL-CMP01'
        },
        {
          id: 'EQ-102',
          name: 'Packaging Line Conveyor 2',
          location: 'Packaging Hall',
          criticality: 'High',
          qr_code: 'QR-PKG-CNV02'
        },
        {
          id: 'EQ-103',
          name: 'Chilled Water Pump B',
          location: 'Mechanical Room',
          criticality: 'High',
          qr_code: 'QR-MCH-PMP02'
        },
        {
          id: 'EQ-104',
          name: 'HVAC Rooftop Unit 4',
          location: 'Building B Roof',
          criticality: 'Medium',
          qr_code: 'QR-HVC-RTU04'
        },
        {
          id: 'EQ-105',
          name: 'CNC Milling Station 3',
          location: 'Machine Shop',
          criticality: 'Critical',
          qr_code: 'QR-SHP-CNC03'
        }
      ],
      parts: [
        {
          id: 'PRT-201',
          sku: 'FLT-AIR-40',
          name: 'Intake Air Filter Element',
          stock: 6,
          min_stock: 5,
          supplier: 'Atlas Industrial Supply'
        },
        {
          id: 'PRT-202',
          sku: 'BRG-6205-2RS',
          name: 'Sealed Ball Bearing 6205',
          stock: 2,
          min_stock: 6,
          supplier: 'SKF Distributors'
        },
        {
          id: 'PRT-203',
          sku: 'BLT-V52',
          name: 'Heavy-Duty V-Belt 52"',
          stock: 4,
          min_stock: 4,
          supplier: 'Gates Motion Parts'
        },
        {
          id: 'PRT-204',
          sku: 'SL-MECH-38',
          name: 'Mechanical Shaft Seal 38mm',
          stock: 1,
          min_stock: 3,
          supplier: 'FlowServe Parts Co.'
        },
        {
          id: 'PRT-205',
          sku: 'OIL-SYN-ISO68',
          name: 'Synthetic Compressor Oil (5L)',
          stock: 12,
          min_stock: 4,
          supplier: 'Mobil Industrial'
        },
        {
          id: 'PRT-206',
          sku: 'SNS-PROX-24V',
          name: 'Inductive Proximity Sensor 24V',
          stock: 5,
          min_stock: 3,
          supplier: 'Omron Automation'
        }
      ],
      workOrders: [
        {
          id: 'WO-1001',
          equipment_id: 'EQ-102',
          title: 'Replace noisy drive-end bearing',
          description: 'Abnormal vibration detected on drive pulley during morning walkdown. Apply LOTO before removing guard.',
          priority: 'High',
          status: 'In Progress',
          assigned_to: 'Marcus Cole',
          created_at: daysOffsetISO(-3, -2),
          closed_at: null
        },
        {
          id: 'WO-1002',
          equipment_id: 'EQ-101',
          title: 'Inspect oil separator pressure drop',
          description: 'Differential pressure gauge reading 0.9 bar above baseline. Check intake filter and separator element.',
          priority: 'Critical',
          status: 'Open',
          assigned_to: 'Elena Vance',
          created_at: daysOffsetISO(-1, -4),
          closed_at: null
        },
        {
          id: 'WO-1003',
          equipment_id: 'EQ-103',
          title: 'Mechanical shaft seal minor weep',
          description: 'Small drip noted beneath pump casing during shift check. Isolate suction/discharge valves before seal swap.',
          priority: 'Medium',
          status: 'Open',
          assigned_to: 'Marcus Cole',
          created_at: daysOffsetISO(-2, -1),
          closed_at: null
        },
        {
          id: 'WO-1004',
          equipment_id: 'EQ-104',
          title: 'Belt tension alignment and sensor check',
          description: 'Completed scheduled belt swap, verified sheave alignment, and tested airflow switch.',
          priority: 'Low',
          status: 'Done',
          assigned_to: 'Marcus Cole',
          created_at: daysOffsetISO(-9, -3),
          closed_at: daysOffsetISO(-7, -1)
        }
      ],
      workOrderParts: [
        {
          work_order_id: 'WO-1001',
          part_id: 'PRT-202',
          qty: 2
        },
        {
          work_order_id: 'WO-1004',
          part_id: 'PRT-203',
          qty: 1
        }
      ],
      pmTasks: [
        {
          id: 'PM-301',
          equipment_id: 'EQ-101',
          title: 'Oil level & intake air filter inspection',
          interval_days: 30,
          last_done: daysOffsetYMD(-36),
          next_due: daysOffsetYMD(-6)
        },
        {
          id: 'PM-302',
          equipment_id: 'EQ-105',
          title: 'Spindle coolant concentration & axis lubrication',
          interval_days: 14,
          last_done: daysOffsetYMD(-17),
          next_due: daysOffsetYMD(-3)
        },
        {
          id: 'PM-303',
          equipment_id: 'EQ-102',
          title: 'Conveyor belt tracking & idler roller check',
          interval_days: 30,
          last_done: daysOffsetYMD(-26),
          next_due: daysOffsetYMD(4)
        },
        {
          id: 'PM-304',
          equipment_id: 'EQ-103',
          title: 'Pump bearing vibration & seal pressure test',
          interval_days: 60,
          last_done: daysOffsetYMD(-20),
          next_due: daysOffsetYMD(40)
        }
      ],
      auditLog: [
        {
          id: 'AUD-5001',
          user: 'Elena Vance (admin)',
          action: 'CREATE',
          entity: 'Equipment',
          entity_id: 'EQ-101',
          details: 'Registered Main Air Compressor #1 (Utility Bay A)',
          timestamp: daysOffsetISO(-14, -2)
        },
        {
          id: 'AUD-5002',
          user: 'Marcus Cole (technician)',
          action: 'UPDATE',
          entity: 'WorkOrder',
          entity_id: 'WO-1004',
          details: 'Closed work order: Belt tension alignment and sensor check',
          timestamp: daysOffsetISO(-7, -1)
        },
        {
          id: 'AUD-5003',
          user: 'Marcus Cole (technician)',
          action: 'CREATE',
          entity: 'WorkOrder',
          entity_id: 'WO-1001',
          details: 'Logged fault & consumed 2x Sealed Ball Bearing 6205',
          timestamp: daysOffsetISO(-3, -2)
        },
        {
          id: 'AUD-5004',
          user: 'Elena Vance (admin)',
          action: 'CREATE',
          entity: 'WorkOrder',
          entity_id: 'WO-1002',
          details: 'Created critical work order on EQ-101',
          timestamp: daysOffsetISO(-1, -4)
        }
      ]
    };
  };
})(window);
