/**
 * knowledgeGraphService.js
 * In-memory, high-performance Knowledge Graph Engine for MANO-ERP.
 * 
 * Organizes ERP knowledge across 5 interconnected layers:
 * 1. Pages & Sub-Tabs (Navigation & UI Contexts)
 * 2. Modules (Functional Domains)
 * 3. Schemas (Database Tables & Foreign Keys across 25+ Tables)
 * 4. Operational Rules & Governance Constraints
 * 5. Live ERP Entities (Real-Time Database Records with Minute-Level Sync)
 */

import { PAGE_DEFINITIONS, SUBPAGE_DEFINITIONS, MODULE_DEFINITIONS, SCHEMA_DEFINITIONS, OPERATIONAL_RULES } from './knowledgeRules.js';
import db from '../../config/database.js';

class KnowledgeGraphService {
  constructor() {
    this.nodes = new Map(); // id -> Node
    this.edges = new Map(); // id -> Edge
    this.adjacency = new Map(); // id -> Set<edgeId>
    this.tableIndex = new Map(); // tableName -> Set<nodeId>
    this.pageIndex = new Map(); // pageId -> Set<nodeId>
    this.subpageIndex = new Map(); // parentPageId -> Set<subpageId>
    this.routeIndex = new Map(); // slug/pattern -> pageId
    this.moduleIndex = new Map(); // moduleName -> Set<nodeId>
    this.lastSyncedAt = null;
    this.initialized = false;
    this.changeHistory = [];
    this.mutationCount = 0;
  }

  /**
   * Bootstraps the Knowledge Graph with pages, modules, schemas, rules, and live database entities.
   */
  async initialize(knexClient = db) {
    if (this.initialized) return;

    // 1. Register Pages (Category: 'page')
    for (const page of PAGE_DEFINITIONS) {
      this.addNode({
        id: page.id,
        label: page.name,
        category: 'page',
        module: page.module,
        slug: page.slug,
        route: page.route,
        description: page.description,
        icon: page.icon,
        primaryTables: page.primaryTables || [],
        weight: 12
      });

      // Index route patterns
      this.routeIndex.set(page.slug, page.id);
      this.routeIndex.set(page.route, page.id);
      if (!this.pageIndex.has(page.id)) {
        this.pageIndex.set(page.id, new Set([page.id]));
      }
    }

    // 1.1 Register Sub-Pages (Category: 'subpage')
    for (const subpage of SUBPAGE_DEFINITIONS) {
      this.addNode({
        id: subpage.id,
        label: subpage.name,
        category: 'subpage',
        parentPageId: subpage.parentPageId,
        module: subpage.module,
        slug: subpage.slug,
        route: subpage.route,
        description: subpage.description,
        primaryTables: subpage.primaryTables || [],
        weight: 9
      });

      // Index route patterns
      this.routeIndex.set(subpage.slug, subpage.id);
      this.routeIndex.set(subpage.route, subpage.id);

      // Subpage's own pageIndex
      if (!this.pageIndex.has(subpage.id)) {
        this.pageIndex.set(subpage.id, new Set([subpage.id]));
      }

      // Link to parent page with dual relationships
      if (this.nodes.has(subpage.parentPageId)) {
        this.addEdge({
          source: subpage.id,
          target: subpage.parentPageId,
          relationship: 'SUBPAGE_OF',
          label: 'subpage of'
        });
        this.addEdge({
          source: subpage.parentPageId,
          target: subpage.id,
          relationship: 'CONTAINS_SUBPAGE',
          label: 'contains subpage'
        });

        // Add subpage to parent page index
        this.pageIndex.get(subpage.parentPageId)?.add(subpage.id);
        // Add parent to subpage index
        this.pageIndex.get(subpage.id)?.add(subpage.parentPageId);

        // Record parent -> children subpages
        if (!this.subpageIndex.has(subpage.parentPageId)) {
          this.subpageIndex.set(subpage.parentPageId, new Set());
        }
        this.subpageIndex.get(subpage.parentPageId).add(subpage.id);
      }
    }

    // 2. Register Modules (Category: 'module')
    for (const mod of MODULE_DEFINITIONS) {
      this.addNode({
        id: mod.id,
        label: mod.name,
        category: 'module',
        module: mod.module,
        icon: mod.icon,
        route: mod.route,
        description: mod.description,
        primaryTable: mod.primaryTable,
        weight: 10
      });

      if (!this.moduleIndex.has(mod.module)) {
        this.moduleIndex.set(mod.module, new Set([mod.id]));
      }
    }

    // Link Pages to Modules (BELONGS_TO_MODULE)
    for (const page of PAGE_DEFINITIONS) {
      const moduleNodeId = `module:${page.module}`;
      if (this.nodes.has(moduleNodeId)) {
        this.addEdge({
          source: page.id,
          target: moduleNodeId,
          relationship: 'BELONGS_TO_MODULE',
          label: 'module'
        });
      }
    }

    // 3. Register Schemas (Category: 'schema') & link to Pages and Modules
    for (const schema of SCHEMA_DEFINITIONS) {
      this.addNode({
        id: schema.id,
        label: schema.label,
        category: 'schema',
        module: schema.module,
        table: schema.table,
        description: schema.description,
        keyColumns: schema.keyColumns,
        weight: 8
      });

      // Link schema to module
      const moduleNodeId = `module:${schema.module}`;
      if (this.nodes.has(moduleNodeId)) {
        this.addEdge({
          source: schema.id,
          target: moduleNodeId,
          relationship: 'BELONGS_TO_MODULE',
          label: 'belongs to'
        });
      }

      // Link schema to relevant pages (POWERS_PAGE)
      for (const page of PAGE_DEFINITIONS) {
        if (page.primaryTables?.includes(schema.table)) {
          this.addEdge({
            source: schema.id,
            target: page.id,
            relationship: 'POWERS_PAGE',
            label: 'powers'
          });
          this.pageIndex.get(page.id)?.add(schema.id);
        }
      }

      // Link schema to relevant sub-pages (POWERS_SUBPAGE)
      for (const subpage of SUBPAGE_DEFINITIONS) {
        if (subpage.primaryTables?.includes(schema.table)) {
          this.addEdge({
            source: schema.id,
            target: subpage.id,
            relationship: 'POWERS_SUBPAGE',
            label: 'powers'
          });
          this.pageIndex.get(subpage.id)?.add(schema.id);
          this.pageIndex.get(subpage.parentPageId)?.add(schema.id);
        }
      }

      // Schema-to-Schema foreign-key relationships
      for (const rel of schema.relationships || []) {
        this.addEdge({
          source: schema.id,
          target: rel.target,
          relationship: rel.type,
          label: rel.type.toLowerCase().replace(/_/g, ' '),
          foreignKey: rel.foreignKey
        });
      }
    }

    // 4. Register Operational Rules (Category: 'rule')
    for (const rule of OPERATIONAL_RULES) {
      this.addNode({
        id: rule.id,
        label: rule.name,
        category: 'rule',
        module: rule.module,
        severity: rule.severity,
        summary: rule.summary,
        enforcement: rule.enforcement,
        targetSchema: rule.targetSchema,
        weight: 6
      });

      if (rule.targetSchema === 'all') {
        for (const schema of SCHEMA_DEFINITIONS) {
          this.addEdge({
            source: schema.id,
            target: rule.id,
            relationship: 'GOVERNED_BY',
            label: 'governed by'
          });
        }
        for (const page of PAGE_DEFINITIONS) {
          this.pageIndex.get(page.id)?.add(rule.id);
        }
      } else {
        const schemaId = `schema:${rule.targetSchema}`;
        if (this.nodes.has(schemaId)) {
          this.addEdge({
            source: schemaId,
            target: rule.id,
            relationship: 'GOVERNED_BY',
            label: 'governed by'
          });

          // Link to pages powered by that schema
          for (const page of PAGE_DEFINITIONS) {
            if (page.primaryTables?.includes(rule.targetSchema)) {
              this.addEdge({
                source: page.id,
                target: rule.id,
                relationship: 'GOVERNED_BY',
                label: 'governed by'
              });
              this.pageIndex.get(page.id)?.add(rule.id);
            }
          }
        }
      }
    }

    // 5. Hydrate Live Database Entities across all key tables
    await this.hydrateLiveEntities(knexClient);

    this.lastSyncedAt = new Date().toISOString();
    this.initialized = true;
    console.log(`[KnowledgeGraph] Initialized with ${this.nodes.size} nodes, ${this.edges.size} edges across ${PAGE_DEFINITIONS.length} pages.`);
  }

  /**
   * Loads initial real-time entity records from MySQL across all operational platform tables.
   */
  async hydrateLiveEntities(knexClient = db) {
    try {
      // 1. Projects
      try {
        const projects = await knexClient('proj_projects')
          .select('id', 'name', 'status', 'org_id', 'location', 'start_date', 'end_date')
          .limit(30);

        for (const p of projects) {
          this.registerEntity('proj_projects', p.id, {
            name: p.name,
            status: p.status || 'active',
            org_id: p.org_id,
            location: p.location,
            start_date: p.start_date,
            end_date: p.end_date
          }, 'projects', ['page:projects', 'page:project_details', 'subpage:project_general_summary', 'subpage:project_settings_general', 'page:dashboard']);
        }
      } catch {}

      // 2. Tasks & Milestones
      try {
        const tasks = await knexClient('proj_tasks')
          .select('id', 'title', 'project_id', 'status', 'start_date', 'due_date', 'progress')
          .limit(30);

        for (const t of tasks) {
          const taskNodeId = this.registerEntity('proj_tasks', t.id, {
            name: t.title,
            project_id: t.project_id,
            status: t.status || 'pending',
            progress: t.progress || 0,
            start_date: t.start_date,
            due_date: t.due_date
          }, 'projects', ['page:project_tasks', 'page:project_wip', 'page:project_planning', 'subpage:project_planning_barchart', 'page:project_phases', 'page:project_reports', 'subpage:project_reports_daily']);

          if (t.project_id && this.nodes.has(`entity:proj_projects:${t.project_id}`)) {
            this.addEdge({
              source: taskNodeId,
              target: `entity:proj_projects:${t.project_id}`,
              relationship: 'TASK_OF_PROJECT',
              label: 'task of'
            });
          }
        }
      } catch {}

      // 3. Drawings
      try {
        const drawings = await knexClient('proj_drawings')
          .select('id', 'drawing_number', 'title', 'project_id', 'revision', 'status')
          .limit(25);

        for (const d of drawings) {
          const drawNodeId = this.registerEntity('proj_drawings', d.id, {
            name: `${d.drawing_number} - ${d.title}`,
            project_id: d.project_id,
            revision: d.revision || 'A',
            status: d.status || 'active'
          }, 'projects', ['page:project_drawings', 'subpage:project_drawings_revisions', 'subpage:project_drawings_categories']);

          if (d.project_id && this.nodes.has(`entity:proj_projects:${d.project_id}`)) {
            this.addEdge({
              source: drawNodeId,
              target: `entity:proj_projects:${d.project_id}`,
              relationship: 'DRAWING_OF_PROJECT',
              label: 'drawing of'
            });
          }
        }
      } catch {}

      // 4. Quality Checklists & Observations
      try {
        const checklists = await knexClient('proj_quality_checklists')
          .select('id', 'title', 'project_id', 'status', 'inspection_date')
          .limit(25);

        for (const c of checklists) {
          const chkNodeId = this.registerEntity('proj_quality_checklists', c.id, {
            name: c.title,
            project_id: c.project_id,
            status: c.status || 'open',
            inspection_date: c.inspection_date
          }, 'projects', ['page:project_quality', 'subpage:project_quality_checklists', 'page:project_safety', 'subpage:project_safety_checklists']);

          if (c.project_id && this.nodes.has(`entity:proj_projects:${c.project_id}`)) {
            this.addEdge({
              source: chkNodeId,
              target: `entity:proj_projects:${c.project_id}`,
              relationship: 'CHECKLIST_FOR_PROJECT',
              label: 'inspection on'
            });
          }
        }
      } catch {}

      try {
        const observations = await knexClient('proj_qaqc_observations')
          .select('id', 'title', 'project_id', 'category', 'severity', 'status')
          .limit(25);

        for (const o of observations) {
          const obsNodeId = this.registerEntity('proj_qaqc_observations', o.id, {
            name: o.title,
            project_id: o.project_id,
            category: o.category || 'Quality',
            severity: o.severity || 'Medium',
            status: o.status || 'open'
          }, 'projects', ['page:project_quality', 'subpage:project_quality_control', 'page:project_safety', 'subpage:project_safety_incidents']);

          if (o.project_id && this.nodes.has(`entity:proj_projects:${o.project_id}`)) {
            this.addEdge({
              source: obsNodeId,
              target: `entity:proj_projects:${o.project_id}`,
              relationship: 'OBSERVED_ON_PROJECT',
              label: 'observation on'
            });
          }
        }
      } catch {}

      // 5. Meetings (MOM)
      try {
        const meetings = await knexClient('proj_meetings')
          .select('id', 'title', 'project_id', 'meeting_date', 'status')
          .limit(20);

        for (const m of meetings) {
          const mNodeId = this.registerEntity('proj_meetings', m.id, {
            name: m.title,
            project_id: m.project_id,
            meeting_date: m.meeting_date,
            status: m.status || 'recorded'
          }, 'projects', ['page:project_general_docs', 'subpage:project_general_meetings']);

          if (m.project_id && this.nodes.has(`entity:proj_projects:${m.project_id}`)) {
            this.addEdge({
              source: mNodeId,
              target: `entity:proj_projects:${m.project_id}`,
              relationship: 'MEETING_FOR_PROJECT',
              label: 'meeting on'
            });
          }
        }
      } catch {}

      // 6. Contacts (Vendors & Clients)
      try {
        const contacts = await knexClient('crm_contacts')
          .select('id', 'name', 'category', 'email', 'mobile', 'location')
          .limit(40);

        for (const c of contacts) {
          const isClient = String(c.category || '').toLowerCase() === 'client';
          const module = isClient ? 'clients' : 'vendors';
          const pages = isClient ? ['page:clients'] : ['page:vendors', 'page:project_general_docs', 'subpage:project_general_parties'];

          this.registerEntity('crm_contacts', c.id, {
            name: c.name,
            category: c.category || (isClient ? 'Client' : 'Supplier'),
            email: c.email,
            phone: c.mobile,
            location: c.location
          }, module, pages);
        }
      } catch {}

      // 7. Resources & BOM
      try {
        const resources = await knexClient('res_resources')
          .select('id', 'name', 'type', 'base_unit_code', 'project_id', 'code')
          .limit(30);

        for (const r of resources) {
          const entityNodeId = this.registerEntity('res_resources', r.id, {
            name: r.name,
            type: r.type,
            base_unit_code: r.base_unit_code,
            code: r.code,
            project_id: r.project_id
          }, 'resources', ['page:resources', 'subpage:resources_grid', 'page:project_materials', 'subpage:project_materials_grid', 'page:spreadsheets', 'page:project_spreadsheets']);

          if (r.project_id && this.nodes.has(`entity:proj_projects:${r.project_id}`)) {
            this.addEdge({
              source: entityNodeId,
              target: `entity:proj_projects:${r.project_id}`,
              relationship: 'ALLOCATED_TO_PROJECT',
              label: 'allocated to'
            });
          }
        }
      } catch {}

      // 8. Project-Party Association Bridge
      try {
        const parties = await knexClient('pdoc_parties')
          .select('id', 'project_id', 'contact_id', 'role_name')
          .limit(40);

        for (const party of parties) {
          const projNodeId = `entity:proj_projects:${party.project_id}`;
          const contactNodeId = `entity:crm_contacts:${party.contact_id}`;
          if (this.nodes.has(projNodeId) && this.nodes.has(contactNodeId)) {
            this.addEdge({
              source: projNodeId,
              target: contactNodeId,
              relationship: 'HAS_ASSIGNED_PARTY',
              label: party.role_name || 'party',
              partyId: party.id
            });
          }
        }
      } catch {}

      // 9. Transactions & Expense Vouchers
      try {
        const txns = await knexClient('txn_transactions')
          .select('id', 'voucher_number', 'project_id', 'txn_type', 'total_amount', 'status')
          .limit(25);

        for (const t of txns) {
          const tNodeId = this.registerEntity('txn_transactions', t.id, {
            name: `${t.voucher_number || 'Voucher'} (${t.txn_type || 'Expense'})`,
            project_id: t.project_id,
            total_amount: t.total_amount,
            status: t.status || 'posted'
          }, 'collaboration', ['page:project_transactions', 'subpage:project_txn_history', 'subpage:project_txn_grid', 'page:project_billing', 'subpage:project_billing_certified_bills', 'page:project_contracts', 'subpage:project_contracts_orders']);

          if (t.project_id && this.nodes.has(`entity:proj_projects:${t.project_id}`)) {
            this.addEdge({
              source: tNodeId,
              target: `entity:proj_projects:${t.project_id}`,
              relationship: 'TRANSACTION_ON_PROJECT',
              label: 'expense on'
            });
          }
        }
      } catch {}

      // 10. Users & IAM Staff
      try {
        const users = await knexClient('iam_users')
          .select('id', 'user_name', 'email', 'user_type', 'dept_id')
          .limit(25);

        for (const u of users) {
          this.registerEntity('iam_users', u.id, {
            name: u.user_name,
            email: u.email,
            user_type: u.user_type || 'employee'
          }, 'admin', ['page:admin', 'page:project_settings', 'subpage:project_settings_timeline', 'subpage:project_general_org_chart']);
        }
      } catch {}
    } catch (err) {
      console.warn('[KnowledgeGraph] Live entity hydration warning:', err.message);
    }
  }

  /**
   * Helper to register an individual entity node, link to its schema, and index to associated pages.
   */
  registerEntity(table, id, properties, module, pageIds = []) {
    const nodeId = `entity:${table}:${id}`;
    const label = properties.name || properties.title || `${table} #${id}`;

    this.addNode({
      id: nodeId,
      label,
      category: 'entity',
      module,
      table,
      recordId: id,
      properties,
      weight: 4,
      lastUpdated: Date.now()
    });

    // Link entity to its schema
    const schemaId = `schema:${table}`;
    if (this.nodes.has(schemaId)) {
      this.addEdge({
        source: nodeId,
        target: schemaId,
        relationship: 'INSTANCE_OF',
        label: 'instance of'
      });
    }

    // Index by table
    if (!this.tableIndex.has(table)) {
      this.tableIndex.set(table, new Set());
    }
    this.tableIndex.get(table).add(nodeId);

    // Index by pages
    for (const pageId of pageIds) {
      if (!this.pageIndex.has(pageId)) {
        this.pageIndex.set(pageId, new Set());
      }
      this.pageIndex.get(pageId).add(nodeId);

      // Add direct edge from entity to page for sub-graph discovery
      if (this.nodes.has(pageId)) {
        this.addEdge({
          source: nodeId,
          target: pageId,
          relationship: 'BELONGS_TO_PAGE',
          label: 'displayed on'
        });
      }
    }

    return nodeId;
  }

  addNode(node) {
    this.nodes.set(node.id, {
      ...node,
      updatedAt: node.updatedAt || new Date().toISOString()
    });
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, new Set());
    }
  }

  addEdge(edge) {
    const edgeId = `${edge.source}->${edge.target}:${edge.relationship}`;
    if (this.edges.has(edgeId)) return;

    this.edges.set(edgeId, { id: edgeId, ...edge });
    if (!this.adjacency.has(edge.source)) this.adjacency.set(edge.source, new Set());
    if (!this.adjacency.has(edge.target)) this.adjacency.set(edge.target, new Set());
    this.adjacency.get(edge.source).add(edgeId);
    this.adjacency.get(edge.target).add(edgeId);
  }

  removeNode(id) {
    if (!this.nodes.has(id)) return;
    const connectedEdges = this.adjacency.get(id) || new Set();
    for (const edgeId of connectedEdges) {
      const edge = this.edges.get(edgeId);
      if (edge) {
        const otherId = edge.source === id ? edge.target : edge.source;
        this.adjacency.get(otherId)?.delete(edgeId);
        this.edges.delete(edgeId);
      }
    }
    this.adjacency.delete(id);

    const node = this.nodes.get(id);
    if (node?.table && this.tableIndex.has(node.table)) {
      this.tableIndex.get(node.table).delete(id);
    }
    for (const [_, set] of this.pageIndex) {
      set.delete(id);
    }
    this.nodes.delete(id);
  }

  /**
   * Maps a database table to its associated ERP pages and module.
   */
  resolvePagesForTable(table, record = {}) {
    const pages = [];
    let module = 'projects';

    if (table.startsWith('proj_tasks') || table === 'proj_task_categories' || table === 'proj_task_assignees') {
      pages.push('page:project_tasks', 'page:project_wip', 'page:project_planning', 'subpage:project_planning_barchart', 'page:project_phases', 'page:project_reports', 'subpage:project_reports_daily');
      module = 'projects';
    } else if (table === 'proj_drawing_categories') {
      pages.push('page:project_drawings', 'subpage:project_drawings_categories');
      module = 'projects';
    } else if (table.startsWith('proj_drawing')) {
      pages.push('page:project_drawings', 'subpage:project_drawings_revisions', 'subpage:project_drawings_categories');
      module = 'projects';
    } else if (table === 'proj_quality_methodologies') {
      pages.push('page:project_quality', 'subpage:project_quality_methodology', 'subpage:project_quality_assurance_plan');
      module = 'projects';
    } else if (table === 'proj_quality_checklists') {
      pages.push('page:project_quality', 'subpage:project_quality_checklists', 'subpage:project_quality_matrix', 'page:project_safety', 'subpage:project_safety_checklists', 'subpage:project_safety_hs_plan');
      module = 'projects';
    } else if (table === 'proj_qaqc_observations') {
      pages.push('page:project_quality', 'subpage:project_quality_control', 'page:project_safety', 'subpage:project_safety_incidents');
      module = 'projects';
    } else if (table.startsWith('proj_meeting')) {
      pages.push('page:project_general_docs', 'subpage:project_general_meetings');
      module = 'projects';
    } else if (table === 'proj_directory') {
      pages.push('page:project_general_docs', 'subpage:project_general_directory', 'page:project_details');
      module = 'projects';
    } else if (table === 'proj_summary') {
      pages.push('page:project_details', 'page:project_wip', 'page:project_reports', 'subpage:project_reports_daily', 'subpage:project_reports_weekly', 'page:project_planning', 'subpage:project_planning_budget', 'page:project_phases');
      module = 'projects';
    } else if (table === 'proj_projects') {
      pages.push('page:projects', 'page:project_details', 'page:project_settings', 'subpage:project_settings_general', 'subpage:project_settings_branding', 'subpage:project_settings_timeline', 'page:dashboard', 'page:project_spreadsheets');
      module = 'projects';
    } else if (table === 'proj_members') {
      pages.push('page:project_details', 'page:project_settings', 'subpage:project_settings_timeline', 'page:project_general_docs', 'subpage:project_general_org_chart', 'page:project_reports', 'subpage:project_reports_team');
      module = 'projects';
    } else if (table === 'crm_contacts') {
      const isClient = String(record.category || '').toLowerCase() === 'client';
      if (isClient) {
        pages.push('page:clients');
        module = 'clients';
      } else {
        pages.push('page:vendors', 'page:project_general_docs', 'subpage:project_general_parties');
        module = 'vendors';
      }
    } else if (table.startsWith('crm_')) {
      pages.push('page:clients');
      module = 'clients';
    } else if (table === 'res_compositions') {
      pages.push('page:resources', 'subpage:resources_recipes', 'page:project_materials', 'subpage:project_materials_recipes');
      module = 'resources';
    } else if (table === 'res_rates') {
      pages.push('page:resources', 'subpage:resources_rates', 'page:project_materials', 'subpage:project_materials_rates', 'page:vendors');
      module = 'resources';
    } else if (table === 'res_conversions') {
      pages.push('page:resources', 'subpage:resources_conversions', 'page:project_materials', 'subpage:project_materials_conversions');
      module = 'resources';
    } else if (table.startsWith('res_')) {
      pages.push('page:resources', 'subpage:resources_grid', 'page:project_materials', 'subpage:project_materials_grid', 'page:spreadsheets', 'page:project_spreadsheets', 'page:project_contracts', 'subpage:project_contracts_qs');
      module = 'resources';
    } else if (table === 'txn_transaction_lines') {
      pages.push('page:project_transactions', 'subpage:project_txn_history', 'subpage:project_txn_grid', 'page:project_billing', 'subpage:project_billing_material_invoices', 'subpage:project_billing_contractor_invoices');
      module = 'collaboration';
    } else if (table.startsWith('txn_')) {
      pages.push('page:project_transactions', 'subpage:project_txn_history', 'subpage:project_txn_grid', 'subpage:project_txn_party_hub', 'page:project_billing', 'subpage:project_billing_certified_bills', 'subpage:project_billing_monthly_register', 'page:project_contracts', 'subpage:project_contracts_orders');
      module = 'collaboration';
    } else if (table.startsWith('wf_')) {
      pages.push('page:collaboration', 'page:project_approvals');
      module = 'collaboration';
    } else if (table.startsWith('iam_') || table.startsWith('org_')) {
      pages.push('page:admin', 'page:project_settings', 'subpage:project_general_org_chart');
      module = 'admin';
    } else if (table === 'pdoc_parties') {
      pages.push('page:project_details', 'page:vendors', 'page:project_general_docs', 'subpage:project_general_parties', 'page:project_contracts', 'subpage:project_contracts_quotations', 'page:project_transactions', 'subpage:project_txn_party_hub');
      module = 'projects';
    }

    return { pages, module };
  }

  /**
   * Real-Time Synchronizer: Handles minute database mutations (INSERT, UPDATE, DELETE).
   */
  syncEntityMutation(table, id, operation = 'UPDATE', record = {}) {
    const op = String(operation || 'UPDATE').toUpperCase();
    const nodeId = `entity:${table}:${id}`;
    const timestamp = Date.now();
    this.mutationCount++;

    const { pages, module } = this.resolvePagesForTable(table, record);
    let changeSummary = '';

    if (op === 'DELETE') {
      const existing = this.nodes.get(nodeId);
      changeSummary = `Deleted ${table} #${id} (${existing?.label || 'Record'})`;
      this.removeNode(nodeId);
    } else {
      // INSERT or UPDATE
      const label = record.title || record.name || record.drawing_number || record.voucher_number || record.user_name || record.subject || `${table} #${id}`;
      const isInsert = !this.nodes.has(nodeId);

      this.addNode({
        id: nodeId,
        label,
        category: 'entity',
        module,
        table,
        recordId: id,
        properties: { ...(this.nodes.get(nodeId)?.properties || {}), ...record },
        weight: 4,
        pulse: true,
        lastUpdated: timestamp
      });

      // Link to schema
      const schemaId = `schema:${table}`;
      if (this.nodes.has(schemaId)) {
        this.addEdge({
          source: nodeId,
          target: schemaId,
          relationship: 'INSTANCE_OF',
          label: 'instance of'
        });
      }

      // Index and link to pages
      for (const pageId of pages) {
        if (!this.pageIndex.has(pageId)) this.pageIndex.set(pageId, new Set());
        this.pageIndex.get(pageId).add(nodeId);

        if (this.nodes.has(pageId)) {
          this.addEdge({
            source: nodeId,
            target: pageId,
            relationship: 'BELONGS_TO_PAGE',
            label: 'displayed on'
          });
        }
      }

      // Foreign Key linkages on update/insert
      if (record.project_id && this.nodes.has(`entity:proj_projects:${record.project_id}`)) {
        this.addEdge({
          source: nodeId,
          target: `entity:proj_projects:${record.project_id}`,
          relationship: 'LINKED_TO_PROJECT',
          label: 'project'
        });
      }
      if (record.contact_id && this.nodes.has(`entity:crm_contacts:${record.contact_id}`)) {
        this.addEdge({
          source: nodeId,
          target: `entity:crm_contacts:${record.contact_id}`,
          relationship: 'LINKED_TO_CONTACT',
          label: 'contact'
        });
      }
      if (record.resource_id && this.nodes.has(`entity:res_resources:${record.resource_id}`)) {
        this.addEdge({
          source: nodeId,
          target: `entity:res_resources:${record.resource_id}`,
          relationship: 'RATES_RESOURCE',
          label: 'rates'
        });
      }
      if (record.transaction_id && this.nodes.has(`entity:txn_transactions:${record.transaction_id}`)) {
        this.addEdge({
          source: nodeId,
          target: `entity:txn_transactions:${record.transaction_id}`,
          relationship: 'LINE_OF_TRANSACTION',
          label: 'line item'
        });
      }

      changeSummary = `${isInsert ? 'Created' : 'Updated'} ${table} #${id}: "${label}"`;
    }

    const primaryPage = pages[0] || 'page:dashboard';
    const primaryPageNode = this.nodes.get(primaryPage);

    const changeEvent = {
      id: `change_${timestamp}_${id}`,
      type: operation,
      table,
      recordId: id,
      nodeId,
      pageId: primaryPage,
      pageName: primaryPageNode?.label || 'Platform',
      timestamp,
      summary: changeSummary
    };

    this.changeHistory.unshift(changeEvent);
    if (this.changeHistory.length > 50) this.changeHistory.pop();
    this.lastSyncedAt = new Date().toISOString();

    return changeEvent;
  }

  /**
   * Information Tracing Engine:
   * Traverses the graph to trace the exact knowledge path & evidence for a given user query,
   * prioritizing the user's active page and context.
   */
  traceQuery(queryText, context = {}) {
    const text = String(queryText || '').toLowerCase();
    const route = String(context.route || '').toLowerCase();
    const activeModule = (context.module || '').toLowerCase();

    // 1. Identify Target Page & Module
    let targetPageId = 'page:dashboard';
    let targetModule = 'projects';

    if (route.includes('quality') || activeModule === 'quality' || text.includes('quality') || text.includes('inspection') || text.includes('defect') || text.includes('ncr')) {
      targetPageId = 'page:project_quality';
      targetModule = 'projects';
    } else if (route.includes('drawing') || activeModule === 'drawings' || text.includes('drawing') || text.includes('blueprint') || text.includes('cad')) {
      targetPageId = 'page:project_drawings';
      targetModule = 'projects';
    } else if (route.includes('task') || route.includes('wip') || activeModule === 'tasks' || text.includes('task') || text.includes('schedule') || text.includes('milestone')) {
      targetPageId = 'page:project_tasks';
      targetModule = 'projects';
    } else if (route.includes('vendor') || activeModule === 'vendors' || text.includes('vendor') || text.includes('supplier')) {
      targetPageId = 'page:vendors';
      targetModule = 'vendors';
    } else if (route.includes('client') || activeModule === 'clients' || text.includes('client') || text.includes('customer')) {
      targetPageId = 'page:clients';
      targetModule = 'clients';
    } else if (route.includes('resource') || activeModule.includes('resource') || text.includes('material') || text.includes('rate') || text.includes('composition')) {
      targetPageId = 'page:resources';
      targetModule = 'resources';
    } else if (route.includes('general') || route.includes('meeting') || text.includes('mom') || text.includes('agenda')) {
      targetPageId = 'page:project_general_docs';
      targetModule = 'projects';
    } else if (route.includes('billing') || route.includes('transaction') || text.includes('bill') || text.includes('invoice') || text.includes('payment')) {
      targetPageId = 'page:project_billing';
      targetModule = 'collaboration';
    } else if (route.includes('approval') || text.includes('approval') || text.includes('workflow')) {
      targetPageId = 'page:collaboration';
      targetModule = 'collaboration';
    } else if (route.includes('admin') || text.includes('user') || text.includes('role') || text.includes('permission')) {
      targetPageId = 'page:admin';
      targetModule = 'admin';
    } else if (route.includes('project') || activeModule === 'projects' || text.includes('project')) {
      targetPageId = 'page:projects';
      targetModule = 'projects';
    }

    const pageNode = this.nodes.get(targetPageId);
    const moduleNode = this.nodes.get(`module:${targetModule}`);
    const traceNodes = [];
    const traceEdges = [];
    const evidence = [];

    if (pageNode) {
      traceNodes.push(pageNode);
      evidence.push(`Anchored in ${pageNode.label} (${pageNode.route}): ${pageNode.description}`);
    }
    if (moduleNode && !traceNodes.some(n => n.id === moduleNode.id)) {
      traceNodes.push(moduleNode);
    }

    // 2. Find Associated Schemas
    const schemas = Array.from(this.nodes.values()).filter(n =>
      n.category === 'schema' && (pageNode?.primaryTables?.includes(n.table) || n.module === targetModule)
    );
    for (const s of schemas.slice(0, 3)) {
      traceNodes.push(s);
      const edge = Array.from(this.edges.values()).find(e => e.source === s.id && (e.target === targetPageId || e.target === moduleNode?.id));
      if (edge) traceEdges.push(edge);
      evidence.push(`Schema \`${s.table}\`: stores ${s.label} [keys: ${(s.keyColumns || []).slice(0, 4).join(', ')}].`);
    }

    // 3. Find Governing Rules
    const rules = Array.from(this.nodes.values()).filter(n =>
      n.category === 'rule' && (n.module === targetModule || n.module === 'general' || schemas.some(s => s.table === n.targetSchema))
    );
    for (const r of rules.slice(0, 2)) {
      traceNodes.push(r);
      evidence.push(`Governed by Rule [${r.label}]: ${r.summary}`);
    }

    // 4. Trace Live Relevant Entities
    const pageEntityIds = this.pageIndex.get(targetPageId) || new Set();
    const liveEntities = Array.from(this.nodes.values()).filter(n =>
      n.category === 'entity' && (pageEntityIds.has(n.id) || n.module === targetModule)
    );

    if (liveEntities.length > 0) {
      let matched = liveEntities.filter(e => text.includes(e.label.toLowerCase()));
      if (!matched.length) matched = liveEntities.slice(0, 3);

      for (const ent of matched) {
        traceNodes.push(ent);
        const instEdge = Array.from(this.edges.values()).find(e => e.source === ent.id);
        if (instEdge) traceEdges.push(instEdge);
        evidence.push(`Verified Live Record: ${ent.label} (ID #${ent.recordId}, status: ${ent.properties?.status || 'active'}).`);

        const relEdges = Array.from(this.edges.values()).filter(e => e.source === ent.id || e.target === ent.id);
        for (const rel of relEdges.slice(0, 2)) {
          const otherId = rel.source === ent.id ? rel.target : rel.source;
          const otherNode = this.nodes.get(otherId);
          if (otherNode && !traceNodes.some(n => n.id === otherNode.id)) {
            traceNodes.push(otherNode);
            traceEdges.push(rel);
            evidence.push(`Relation [${rel.label}]: ${ent.label} &rarr; ${otherNode.label}`);
          }
        }
      }
    }

    return {
      traceId: `trace_${Date.now()}`,
      query: queryText,
      targetPage: pageNode?.label || 'Executive Dashboard',
      targetModule,
      nodes: traceNodes.map(n => ({ id: n.id, label: n.label, category: n.category, module: n.module, summary: n.description || n.summary || n.properties?.status })),
      edges: traceEdges.map(e => ({ id: e.id, source: e.source, target: e.target, relationship: e.relationship, label: e.label })),
      evidence,
      summary: `Traced through ${traceNodes.length} Knowledge Graph nodes across ${pageNode?.label || targetModule.toUpperCase()}, validating schemas, operational rules, and real-time ERP records.`
    };
  }

  /**
   * Returns graph data filtered by page, module, category, or search term.
   */
  getGraph({ page, module, category, search, limit = 150 } = {}) {
    let allowedNodeIds = null;

    // Page-scoped or Sub-page-scoped sub-graph filtering
    if (page && page !== 'all') {
      const pageId = page.startsWith('page:') || page.startsWith('subpage:') ? page : `page:${page}`;
      if (this.pageIndex.has(pageId)) {
        allowedNodeIds = new Set(this.pageIndex.get(pageId));
      } else {
        // Find by slug in PAGE_DEFINITIONS or SUBPAGE_DEFINITIONS
        const matchedPage = PAGE_DEFINITIONS.find(p => p.slug === page || p.id === page)
          || SUBPAGE_DEFINITIONS.find(sp => sp.slug === page || sp.id === page);
        if (matchedPage && this.pageIndex.has(matchedPage.id)) {
          allowedNodeIds = new Set(this.pageIndex.get(matchedPage.id));
        }
      }

      // If it is a parent page, also include all its subpages and their indexed nodes
      if (allowedNodeIds && this.subpageIndex.has(pageId)) {
        for (const spId of this.subpageIndex.get(pageId)) {
          allowedNodeIds.add(spId);
          const subNodes = this.pageIndex.get(spId);
          if (subNodes) {
            for (const nid of subNodes) allowedNodeIds.add(nid);
          }
        }
      }
    }

    let nodeList = Array.from(this.nodes.values());

    if (allowedNodeIds) {
      nodeList = nodeList.filter(n => allowedNodeIds.has(n.id));
    }
    if (module && module !== 'all') {
      nodeList = nodeList.filter(n => n.module === module || n.module === 'general');
    }
    if (category && category !== 'all') {
      nodeList = nodeList.filter(n => n.category === category);
    }
    if (search && search.trim()) {
      const q = search.toLowerCase();
      nodeList = nodeList.filter(n =>
        n.label.toLowerCase().includes(q) ||
        (n.table && n.table.toLowerCase().includes(q)) ||
        (n.description && n.description.toLowerCase().includes(q)) ||
        (n.summary && n.summary.toLowerCase().includes(q))
      );
    }

    const nodeIds = new Set(nodeList.slice(0, limit).map(n => n.id));
    const edgeList = Array.from(this.edges.values()).filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    const stats = {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      pages: Array.from(this.nodes.values()).filter(n => n.category === 'page').length,
      subpages: Array.from(this.nodes.values()).filter(n => n.category === 'subpage').length,
      modules: Array.from(this.nodes.values()).filter(n => n.category === 'module').length,
      schemas: Array.from(this.nodes.values()).filter(n => n.category === 'schema').length,
      rules: Array.from(this.nodes.values()).filter(n => n.category === 'rule').length,
      entities: Array.from(this.nodes.values()).filter(n => n.category === 'entity').length,
      liveMutationsCount: this.mutationCount,
      lastSyncedAt: this.lastSyncedAt
    };

    return {
      nodes: nodeList.slice(0, limit),
      edges: edgeList,
      stats,
      changeHistory: this.changeHistory.slice(0, 15)
    };
  }

  /**
   * Returns list of all registered pages with nested subpages for frontend filtering.
   */
  getPages() {
    return PAGE_DEFINITIONS.map(p => {
      const subpages = SUBPAGE_DEFINITIONS.filter(sp => sp.parentPageId === p.id).map(sp => ({
        id: sp.id,
        name: sp.name,
        slug: sp.slug,
        route: sp.route,
        parentPageId: sp.parentPageId,
        module: sp.module,
        description: sp.description,
        primaryTables: sp.primaryTables,
        nodeCount: this.pageIndex.get(sp.id)?.size || 0
      }));

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        route: p.route,
        icon: p.icon,
        module: p.module,
        description: p.description,
        subpages,
        nodeCount: this.pageIndex.get(p.id)?.size || 0
      };
    });
  }

  getNodeDetails(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    const connectedEdges = Array.from(this.edges.values()).filter(
      e => e.source === nodeId || e.target === nodeId
    );

    const neighbors = connectedEdges.map(e => {
      const isOutbound = e.source === nodeId;
      const neighborId = isOutbound ? e.target : e.source;
      const neighbor = this.nodes.get(neighborId);
      return {
        edgeId: e.id,
        relationship: e.relationship,
        label: e.label,
        direction: isOutbound ? 'outgoing' : 'incoming',
        neighbor: neighbor ? { id: neighbor.id, label: neighbor.label, category: neighbor.category, module: neighbor.module } : null
      };
    }).filter(n => n.neighbor !== null);

    return {
      ...node,
      edges: connectedEdges,
      neighbors
    };
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
export default knowledgeGraphService;
