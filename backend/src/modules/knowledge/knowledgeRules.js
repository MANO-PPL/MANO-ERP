/**
 * knowledgeRules.js
 * Structured Page definitions, Schema definitions, and Operational Rules for MANO-ERP.
 * Serves as the canonical structural layer in the ERP Knowledge Graph.
 */

// ─── 1. PAGE DEFINITIONS (All Platform Pages & Project Sub-Tabs) ─────────────
export const PAGE_DEFINITIONS = [
  {
    id: 'page:dashboard',
    name: 'Executive Dashboard',
    slug: 'dashboard',
    module: 'dashboard',
    route: '/',
    description: 'High-level executive KPIs, portfolio health, active project counts, cost tracking, and recent activity streams.',
    icon: 'LayoutDashboard',
    primaryTables: ['proj_projects', 'res_resources', 'crm_contacts', 'txn_transactions']
  },
  {
    id: 'page:projects',
    name: 'Projects Portfolio',
    slug: 'projects',
    module: 'projects',
    route: '/projects',
    description: 'Comprehensive directory of active, on-hold, and completed construction projects across the organization.',
    icon: 'Briefcase',
    primaryTables: ['proj_projects', 'proj_members', 'proj_summary']
  },
  {
    id: 'page:project_details',
    name: 'Project Dashboard',
    slug: 'project_details',
    module: 'projects',
    route: '/projects/:id?tab=Dashboard',
    description: 'Project vitals, site location, timeline dates, budget gauge, and active project members.',
    icon: 'FileText',
    primaryTables: ['proj_projects', 'proj_members', 'proj_summary', 'pdoc_parties']
  },
  {
    id: 'page:project_tasks',
    name: 'Tasks & WBS',
    slug: 'project_tasks',
    module: 'projects',
    route: '/projects/:id?tab=Tasks',
    description: 'Work breakdown structure (WBS), task categories, milestone schedules, dependencies, and assignees.',
    icon: 'CheckSquare',
    primaryTables: ['proj_tasks', 'proj_task_categories', 'proj_task_assignees']
  },
  {
    id: 'page:project_wip',
    name: 'WIP Tracking',
    slug: 'project_wip',
    module: 'projects',
    route: '/projects/:id?tab=WIP',
    description: 'Work in Progress (WIP) tracking, physical progress percentages, and financial milestone completion metrics.',
    icon: 'Activity',
    primaryTables: ['proj_tasks', 'proj_summary']
  },
  {
    id: 'page:project_reports',
    name: 'Reports & DPR',
    slug: 'project_reports',
    module: 'projects',
    route: '/projects/:id?tab=Reports',
    description: 'Daily progress reports (DPR), weekly rollups, monthly archives, team contributions, and DPR template configurations.',
    icon: 'FileText',
    primaryTables: ['proj_projects', 'proj_summary', 'proj_tasks']
  },
  {
    id: 'page:project_general_docs',
    name: 'General Documents & MOM',
    slug: 'project_general_docs',
    module: 'projects',
    route: '/projects/:id?tab=General Documents',
    description: 'Minutes of Meeting (MOM), meeting agendas, participant attendance, stakeholder directory, and site notes.',
    icon: 'Calendar',
    primaryTables: ['proj_meetings', 'proj_meetings_participants', 'proj_directory', 'pdoc_parties']
  },
  {
    id: 'page:project_spreadsheets',
    name: 'Project Spreadsheets',
    slug: 'project_spreadsheets',
    module: 'spreadsheets',
    route: '/projects/:id?tab=Spreadsheets',
    description: 'Project-specific dynamic cost estimation grids, BOQ workbooks, and material quantity sheets.',
    icon: 'Table',
    primaryTables: ['proj_projects', 'res_resources', 'txn_transactions']
  },
  {
    id: 'page:project_drawings',
    name: 'Drawings & Blueprints',
    slug: 'project_drawings',
    module: 'projects',
    route: '/projects/:id?tab=Drawings',
    description: 'Architectural, Structural, and MEP drawings, revision management, CAD/DXF viewer integration, and approval states.',
    icon: 'Compass',
    primaryTables: ['proj_drawings', 'proj_drawing_categories']
  },
  {
    id: 'page:project_planning',
    name: 'Planning & Histograms',
    slug: 'project_planning',
    module: 'projects',
    route: '/projects/:id?tab=Planning',
    description: 'Lifecycle project schedules, milestone timelines, logistics plans, manpower deployment, and material histograms.',
    icon: 'BarChart3',
    primaryTables: ['proj_tasks', 'proj_projects', 'res_resources']
  },
  {
    id: 'page:project_phases',
    name: 'Phases & Gates',
    slug: 'project_phases',
    module: 'projects',
    route: '/projects/:id?tab=Phases',
    description: 'Construction phase gate progression, milestone stage completions, and structural stage sign-offs.',
    icon: 'Activity',
    primaryTables: ['proj_tasks', 'proj_projects', 'proj_summary']
  },
  {
    id: 'page:project_contracts',
    name: 'Contracts & Tenders',
    slug: 'project_contracts',
    module: 'projects',
    route: '/projects/:id?tab=Contracts',
    description: 'Quantity surveys, vendor quotations, tender bidding evaluation documents, and issued work orders.',
    icon: 'Briefcase',
    primaryTables: ['pdoc_parties', 'txn_transactions', 'res_resources']
  },
  {
    id: 'page:project_quality',
    name: 'Quality & QA/QC',
    slug: 'project_quality',
    module: 'projects',
    route: '/projects/:id?tab=Quality',
    description: 'Quality methodologies, field checklists, non-conformance reports (NCR), defect tracking, and 4-eye sign-offs.',
    icon: 'Award',
    primaryTables: ['proj_quality_checklists', 'proj_quality_methodologies', 'proj_qaqc_observations']
  },
  {
    id: 'page:project_safety',
    name: 'Safety & Compliance',
    slug: 'project_safety',
    module: 'projects',
    route: '/projects/:id?tab=Safety',
    description: 'Site safety observations, hazard logs, tool-box talk checklists, PPE enforcement, and incident tracking.',
    icon: 'ShieldAlert',
    primaryTables: ['proj_qaqc_observations', 'proj_quality_checklists']
  },
  {
    id: 'page:project_billing',
    name: 'Billing & Invoicing',
    slug: 'project_billing',
    module: 'projects',
    route: '/projects/:id?tab=Billing',
    description: 'Client running bills (RA bills), measurement sheets, subcontractor work orders, and contract milestones.',
    icon: 'CreditCard',
    primaryTables: ['txn_transactions', 'txn_transaction_lines']
  },
  {
    id: 'page:project_materials',
    name: 'Material Management',
    slug: 'project_materials',
    module: 'projects',
    route: '/projects/:id?tab=Material Management',
    description: 'Site material requests, purchase orders, goods receipt notes (GRN), inventory stock levels, and consumption.',
    icon: 'Box',
    primaryTables: ['res_resources', 'res_rates', 'res_compositions']
  },
  {
    id: 'page:project_transactions',
    name: 'Project Transactions & Ledger',
    slug: 'project_transactions',
    module: 'projects',
    route: '/projects/:id?tab=Transactions',
    description: 'Project-level financial expense vouchers, payment receipts, and category-level transaction lines.',
    icon: 'DollarSign',
    primaryTables: ['txn_transactions', 'txn_transaction_lines']
  },
  {
    id: 'page:project_approvals',
    name: 'Project Approvals',
    slug: 'project_approvals',
    module: 'projects',
    route: '/projects/:id?tab=Approvals',
    description: 'Project-scoped approval requests, stage progression, multi-signature reviews, and audit trails.',
    icon: 'CheckCircle2',
    primaryTables: ['wf_approval_cycles', 'wf_cycle_submissions']
  },
  {
    id: 'page:project_settings',
    name: 'Project Settings',
    slug: 'project_settings',
    module: 'projects',
    route: '/projects/:id?tab=Settings',
    description: 'Project configuration, member role permissions, access levels, and metadata customization.',
    icon: 'Settings',
    primaryTables: ['proj_members', 'iam_users', 'proj_projects']
  },
  {
    id: 'page:vendors',
    name: 'Vendors & Suppliers',
    slug: 'vendors',
    module: 'vendors',
    route: '/vendors',
    description: 'Material suppliers, trade subcontractors, manufacturer directory, GST details, contacts, and performance ratings.',
    icon: 'Truck',
    primaryTables: ['crm_contacts', 'pdoc_parties', 'res_rates']
  },
  {
    id: 'page:clients',
    name: 'Clients & CRM',
    slug: 'clients',
    module: 'clients',
    route: '/clients',
    description: 'Client accounts, developer organizations, key stakeholders, leads, CRM interactions, and communication history.',
    icon: 'Users',
    primaryTables: ['crm_contacts', 'crm_interactions', 'crm_sectors', 'crm_job_nature']
  },
  {
    id: 'page:resources',
    name: 'Resources & Inventory',
    slug: 'resources',
    module: 'resources',
    route: '/resources',
    description: 'Central materials catalog, plant/machinery, labor trades, effective-date rate versioning, and BOM composite recipes.',
    icon: 'Layers',
    primaryTables: ['res_resources', 'res_rates', 'res_compositions', 'res_conversions']
  },
  {
    id: 'page:spreadsheets',
    name: 'Spreadsheets',
    slug: 'spreadsheets',
    module: 'spreadsheets',
    route: '/spreadsheets',
    description: 'Interactive cost modeling, multi-project rate variance matrices, and dynamic spreadsheet grids.',
    icon: 'Table',
    primaryTables: ['proj_projects', 'res_resources', 'txn_transactions']
  },
  {
    id: 'page:collaboration',
    name: 'Workflows & Collaboration',
    slug: 'collaboration',
    module: 'collaboration',
    route: '/collaboration',
    description: 'Document cycle definitions, multi-level sequential/parallel approval chains, version control, and sign-offs.',
    icon: 'GitPullRequest',
    primaryTables: ['wf_documents', 'wf_document_instances', 'wf_approval_cycles', 'wf_approval_levels', 'wf_approval_logs']
  },
  {
    id: 'page:admin',
    name: 'Admin & IAM',
    slug: 'admin',
    module: 'admin',
    route: '/admin',
    description: 'User access management, system roles, department hierarchy, designation catalog, and security governance.',
    icon: 'Shield',
    primaryTables: ['iam_users', 'iam_departments', 'iam_designations', 'iam_permission_templates', 'org_organizations']
  }
];

// ─── 1.1 SUBPAGE DEFINITIONS (Internal Views & Sub-Tabs per Page) ─────────────
export const SUBPAGE_DEFINITIONS = [
  // General Documents Sub-Pages
  {
    id: 'subpage:project_general_summary',
    parentPageId: 'page:project_general_docs',
    name: 'Project Summary & Vitals',
    slug: 'project_general_summary',
    module: 'projects',
    route: '/projects/:id?tab=General Documents&view=project-summary',
    description: 'Executive overview, project timeline milestones, site location, and key contractual specifications.',
    primaryTables: ['proj_projects', 'proj_summary']
  },
  {
    id: 'subpage:project_general_directory',
    parentPageId: 'page:project_general_docs',
    name: 'Site Directory & Contacts',
    slug: 'project_general_directory',
    module: 'projects',
    route: '/projects/:id?tab=General Documents&view=directory',
    description: 'Key project team directory including resident engineers, safety supervisors, client reps, and emergency contacts.',
    primaryTables: ['proj_directory', 'proj_projects']
  },
  {
    id: 'subpage:project_general_parties',
    parentPageId: 'page:project_general_docs',
    name: 'Project Stakeholders & Parties',
    slug: 'project_general_parties',
    module: 'projects',
    route: '/projects/:id?tab=General Documents&view=party-list',
    description: 'Assigned subcontractor firms, material suppliers, engineering consultants, and role associations.',
    primaryTables: ['pdoc_parties', 'crm_contacts', 'proj_projects']
  },
  {
    id: 'subpage:project_general_org_chart',
    parentPageId: 'page:project_general_docs',
    name: 'Organisation Chart',
    slug: 'project_general_org_chart',
    module: 'projects',
    route: '/projects/:id?tab=General Documents&view=org-chart',
    description: 'Site management hierarchy, reporting chains, and escalation channels.',
    primaryTables: ['proj_members', 'iam_users', 'proj_projects']
  },
  {
    id: 'subpage:project_general_meetings',
    parentPageId: 'page:project_general_docs',
    name: 'Meeting Register & MOM',
    slug: 'project_general_meetings',
    module: 'projects',
    route: '/projects/:id?tab=General Documents&view=meeting-list',
    description: 'Minutes of meeting (MOM), meeting agendas, action items, attendee logs, and signed records.',
    primaryTables: ['proj_meetings', 'proj_meetings_participants', 'proj_projects']
  },

  // Quality Sub-Pages
  {
    id: 'subpage:project_quality_control',
    parentPageId: 'page:project_quality',
    name: 'QA/QC Control & Observations',
    slug: 'project_quality_control',
    module: 'projects',
    route: '/projects/:id?tab=Quality&view=control',
    description: 'Live field defect reporting, non-conformance logs, severity ratings, before/after evidence photos, and rectification sign-offs.',
    primaryTables: ['proj_qaqc_observations', 'proj_projects']
  },
  {
    id: 'subpage:project_quality_methodology',
    parentPageId: 'page:project_quality',
    name: 'Quality Methodologies & SOPs',
    slug: 'project_quality_methodology',
    module: 'projects',
    route: '/projects/:id?tab=Quality&view=methodology',
    description: 'Standard operating procedures, quality standards, testing protocols, and execution guidelines.',
    primaryTables: ['proj_quality_methodologies', 'proj_projects']
  },
  {
    id: 'subpage:project_quality_matrix',
    parentPageId: 'page:project_quality',
    name: 'QA/QC Inspectability Matrix',
    slug: 'project_quality_matrix',
    module: 'projects',
    route: '/projects/:id?tab=Quality&view=matrix',
    description: 'Inspectability matrix defining testing parameters, acceptance criteria, test frequencies, and sampling standards.',
    primaryTables: ['proj_quality_checklists', 'proj_projects']
  },
  {
    id: 'subpage:project_quality_assurance_plan',
    parentPageId: 'page:project_quality',
    name: 'QA/QC Assurance Plan',
    slug: 'project_quality_assurance_plan',
    module: 'projects',
    route: '/projects/:id?tab=Quality&view=assurance-plan',
    description: 'Comprehensive project quality assurance plan outlining roles, quality assurance policies, and third-party audit schedules.',
    primaryTables: ['proj_quality_methodologies', 'proj_projects']
  },
  {
    id: 'subpage:project_quality_checklists',
    parentPageId: 'page:project_quality',
    name: 'Checklist & Snaglist',
    slug: 'project_quality_checklists',
    module: 'projects',
    route: '/projects/:id?tab=Quality&view=check-snag',
    description: 'Interactive punch lists, structural inspection checklists, pour cards, and verification logs.',
    primaryTables: ['proj_quality_checklists', 'proj_qaqc_observations', 'proj_projects']
  },

  // Material Management Sub-Pages
  {
    id: 'subpage:project_materials_grid',
    parentPageId: 'page:project_materials',
    name: 'Resource Spreadsheet Grid',
    slug: 'project_materials_grid',
    module: 'resources',
    route: '/projects/:id?tab=Material Management&matTab=grid',
    description: 'Live interactive grid of all resources allocated to this project site with quantities and unit measures.',
    primaryTables: ['res_resources', 'res_rates', 'proj_projects']
  },
  {
    id: 'subpage:project_materials_recipes',
    parentPageId: 'page:project_materials',
    name: 'BOM Recipes & Assembly Compositions',
    slug: 'project_materials_recipes',
    module: 'resources',
    route: '/projects/:id?tab=Material Management&matTab=recipes',
    description: 'Bill of Materials (BOM) item assemblies, composite item breakdown ratios, and historical recipe modifications.',
    primaryTables: ['res_compositions', 'res_resources', 'proj_projects']
  },
  {
    id: 'subpage:project_materials_rates',
    parentPageId: 'page:project_materials',
    name: 'Project Resource Rates',
    slug: 'project_materials_rates',
    module: 'resources',
    route: '/projects/:id?tab=Material Management&matTab=rates',
    description: 'Project-scoped resource rate versioning, effective dates, vendor rate comparisons, and rate change audit histories.',
    primaryTables: ['res_rates', 'res_resources', 'proj_projects']
  },
  {
    id: 'subpage:project_materials_conversions',
    parentPageId: 'page:project_materials',
    name: 'Unit Conversions',
    slug: 'project_materials_conversions',
    module: 'resources',
    route: '/projects/:id?tab=Material Management&matTab=conversions',
    description: 'Resource-specific unit conversion multipliers (e.g. Metric Ton to Bags, Cum to CFT).',
    primaryTables: ['res_conversions', 'res_resources']
  },

  // Transactions Sub-Pages
  {
    id: 'subpage:project_txn_history',
    parentPageId: 'page:project_transactions',
    name: 'Transactions History & Vouchers',
    slug: 'project_txn_history',
    module: 'collaboration',
    route: '/projects/:id?tab=Transactions&subTab=transactions',
    description: 'Financial expense vouchers, payment receipts, debit/credit journal entries, and status workflows.',
    primaryTables: ['txn_transactions', 'txn_transaction_lines', 'proj_projects']
  },
  {
    id: 'subpage:project_txn_grid',
    parentPageId: 'page:project_transactions',
    name: 'Entry Register & Excel Grid',
    slug: 'project_txn_grid',
    module: 'collaboration',
    route: '/projects/:id?tab=Transactions&subTab=excel-grid',
    description: 'High-speed spreadsheet data entry register for bulk ledger posting and category expense tracking.',
    primaryTables: ['txn_transactions', 'txn_transaction_lines', 'proj_projects']
  },
  {
    id: 'subpage:project_txn_party_hub',
    parentPageId: 'page:project_transactions',
    name: 'Party Stock & Statements',
    slug: 'project_txn_party_hub',
    module: 'collaboration',
    route: '/projects/:id?tab=Transactions&subTab=party-hub',
    description: 'Vendor and contractor account statements, outstanding payment balances, and issued material stock reconciliation.',
    primaryTables: ['txn_transactions', 'pdoc_parties', 'crm_contacts', 'proj_projects']
  },

  // Planning Sub-Pages
  {
    id: 'subpage:project_planning_barchart',
    parentPageId: 'page:project_planning',
    name: 'Project Planning & Bar Chart',
    slug: 'project_planning_barchart',
    module: 'projects',
    route: '/projects/:id?tab=Planning&report=project-planning',
    description: 'Interactive Gantt chart and milestone activity schedule for the complete project lifecycle.',
    primaryTables: ['proj_tasks', 'proj_projects']
  },
  {
    id: 'subpage:project_planning_logistic',
    parentPageId: 'page:project_planning',
    name: 'Site Logistic Plan',
    slug: 'project_planning_logistic',
    module: 'projects',
    route: '/projects/:id?tab=Planning&report=logistic-plan',
    description: 'Site logistics layout, material storage locations, tower crane radiuses, and vehicular access routes.',
    primaryTables: ['proj_projects', 'proj_tasks']
  },
  {
    id: 'subpage:project_planning_manpower',
    parentPageId: 'page:project_planning',
    name: 'Manpower Deployment Histogram',
    slug: 'project_planning_manpower',
    module: 'projects',
    route: '/projects/:id?tab=Planning&report=manpower-histogram',
    description: 'Weekly and monthly manpower deployment curves grouped by trade (masons, carpenters, bar benders, operators).',
    primaryTables: ['proj_tasks', 'proj_projects']
  },
  {
    id: 'subpage:project_planning_material',
    parentPageId: 'page:project_planning',
    name: 'Material Consumption Histogram',
    slug: 'project_planning_material',
    module: 'projects',
    route: '/projects/:id?tab=Planning&report=material-histogram',
    description: 'Projected material procurement timeline and bulk consumption curves (cement, structural steel, aggregates).',
    primaryTables: ['res_resources', 'proj_tasks', 'proj_projects']
  },
  {
    id: 'subpage:project_planning_hindrance',
    parentPageId: 'page:project_planning',
    name: 'Events & Hindrance Report',
    slug: 'project_planning_hindrance',
    module: 'projects',
    route: '/projects/:id?tab=Planning&report=hindrance-report',
    description: 'Register of site hindrances, weather stoppages, design changes, and client delay notices.',
    primaryTables: ['proj_tasks', 'proj_projects']
  },
  {
    id: 'subpage:project_planning_budget',
    parentPageId: 'page:project_planning',
    name: 'Project Budget & Cost Baseline',
    slug: 'project_planning_budget',
    module: 'projects',
    route: '/projects/:id?tab=Planning&report=budget',
    description: 'Approved project budget baselines, contingency allocations, and cost variance projections.',
    primaryTables: ['proj_summary', 'proj_projects', 'txn_transactions']
  },

  // Reports Sub-Pages
  {
    id: 'subpage:project_reports_daily',
    parentPageId: 'page:project_reports',
    name: 'Daily Progress Reports (DPR)',
    slug: 'project_reports_daily',
    module: 'projects',
    route: '/projects/:id?tab=Reports&type=daily',
    description: 'Daily construction log of physical progress, labor turnout, machinery deployment, and site conditions.',
    primaryTables: ['proj_projects', 'proj_summary', 'proj_tasks']
  },
  {
    id: 'subpage:project_reports_weekly',
    parentPageId: 'page:project_reports',
    name: 'Weekly Summary Reports',
    slug: 'project_reports_weekly',
    module: 'projects',
    route: '/projects/:id?tab=Reports&type=weekly',
    description: 'Weekly milestone progress rollups, target vs actual performance, and weekly activity schedules.',
    primaryTables: ['proj_projects', 'proj_summary']
  },
  {
    id: 'subpage:project_reports_monthly',
    parentPageId: 'page:project_reports',
    name: 'Monthly Progress Archive',
    slug: 'project_reports_monthly',
    module: 'projects',
    route: '/projects/:id?tab=Reports&type=monthly',
    description: 'Historical archive of monthly progress reports, billing synchronizations, and cumulative executive dashboards.',
    primaryTables: ['proj_projects', 'proj_summary']
  },
  {
    id: 'subpage:project_reports_team',
    parentPageId: 'page:project_reports',
    name: 'Team Contribution & Attendance',
    slug: 'project_reports_team',
    module: 'projects',
    route: '/projects/:id?tab=Reports&type=team',
    description: 'Site engineer report filing attendance, supervisor sign-offs, and department task contributions.',
    primaryTables: ['proj_members', 'iam_users', 'proj_projects']
  },
  {
    id: 'subpage:project_reports_config',
    parentPageId: 'page:project_reports',
    name: 'DPR Configuration & Layout',
    slug: 'project_reports_config',
    module: 'projects',
    route: '/projects/:id?tab=Reports&type=config',
    description: 'Daily progress report format settings, header branding, manday formulas, and required sign-off fields.',
    primaryTables: ['proj_projects']
  },

  // Contracts Sub-Pages
  {
    id: 'subpage:project_contracts_qs',
    parentPageId: 'page:project_contracts',
    name: 'Quantity Survey & Measurement',
    slug: 'project_contracts_qs',
    module: 'projects',
    route: '/projects/:id?tab=Contracts&view=qs',
    description: 'Detailed measurement sheets, work quantification, take-offs, and bill of quantities reconciliation.',
    primaryTables: ['proj_projects', 'res_resources']
  },
  {
    id: 'subpage:project_contracts_quotations',
    parentPageId: 'page:project_contracts',
    name: 'Quotations & Bids',
    slug: 'project_contracts_quotations',
    module: 'projects',
    route: '/projects/:id?tab=Contracts&view=quotations',
    description: 'Price quotations submitted by trade subcontractors and material vendors for project scopes.',
    primaryTables: ['pdoc_parties', 'crm_contacts', 'txn_transactions']
  },
  {
    id: 'subpage:project_contracts_tender',
    parentPageId: 'page:project_contracts',
    name: 'Tender Documents & BOQs',
    slug: 'project_contracts_tender',
    module: 'projects',
    route: '/projects/:id?tab=Contracts&view=tender',
    description: 'Official tender packages, specifications, technical evaluation criteria, and contract agreements.',
    primaryTables: ['proj_projects', 'pdoc_parties']
  },
  {
    id: 'subpage:project_contracts_orders',
    parentPageId: 'page:project_contracts',
    name: 'Work Orders & Purchase Orders',
    slug: 'project_contracts_orders',
    module: 'projects',
    route: '/projects/:id?tab=Contracts&view=orders',
    description: 'Issued subcontractor work orders, service contracts, and material purchase order commitments.',
    primaryTables: ['txn_transactions', 'pdoc_parties', 'proj_projects']
  },

  // Safety Sub-Pages
  {
    id: 'subpage:project_safety_hs_plan',
    parentPageId: 'page:project_safety',
    name: 'Health & Safety Management Plan',
    slug: 'project_safety_hs_plan',
    module: 'projects',
    route: '/projects/:id?tab=Safety&view=hs-plan',
    description: 'Site safety policy, emergency response protocols, evacuation plans, and safety officer responsibilities.',
    primaryTables: ['proj_projects', 'proj_quality_checklists']
  },
  {
    id: 'subpage:project_safety_guideline',
    parentPageId: 'page:project_safety',
    name: 'Safety Guidelines & Standards',
    slug: 'project_safety_guideline',
    module: 'projects',
    route: '/projects/:id?tab=Safety&view=guideline',
    description: 'Mandatory PPE regulations, working-at-height procedures, electrical safety rules, and excavation shoring norms.',
    primaryTables: ['proj_projects', 'proj_quality_methodologies']
  },
  {
    id: 'subpage:project_safety_incidents',
    parentPageId: 'page:project_safety',
    name: 'Incident & Near-Miss Logs',
    slug: 'project_safety_incidents',
    module: 'projects',
    route: '/projects/:id?tab=Safety&view=incidents',
    description: 'Log of site safety accidents, near-miss events, root-cause investigations, and preventive action reports.',
    primaryTables: ['proj_qaqc_observations', 'proj_projects']
  },
  {
    id: 'subpage:project_safety_checklists',
    parentPageId: 'page:project_safety',
    name: 'Safety Inspection Checklists',
    slug: 'project_safety_checklists',
    module: 'projects',
    route: '/projects/:id?tab=Safety&view=checklists',
    description: 'Daily toolbox talk checklists, scaffolding stability inspection cards, and fire safety audits.',
    primaryTables: ['proj_quality_checklists', 'proj_projects']
  },

  // Billing Sub-Pages
  {
    id: 'subpage:project_billing_material_invoices',
    parentPageId: 'page:project_billing',
    name: 'Material Supply Invoices',
    slug: 'project_billing_material_invoices',
    module: 'collaboration',
    route: '/projects/:id?tab=Billing&view=materials',
    description: 'Invoices raised by material suppliers matched against goods receipt notes (GRN) and delivery challans.',
    primaryTables: ['txn_transactions', 'txn_transaction_lines', 'crm_contacts']
  },
  {
    id: 'subpage:project_billing_contractor_invoices',
    parentPageId: 'page:project_billing',
    name: 'Contractor Progress Invoices',
    slug: 'project_billing_contractor_invoices',
    module: 'collaboration',
    route: '/projects/:id?tab=Billing&view=contractors',
    description: 'Running invoices submitted by subcontractors based on certified joint measurement sheets.',
    primaryTables: ['txn_transactions', 'txn_transaction_lines', 'pdoc_parties']
  },
  {
    id: 'subpage:project_billing_certified_bills',
    parentPageId: 'page:project_billing',
    name: 'Certified RA Bills',
    slug: 'project_billing_certified_bills',
    module: 'collaboration',
    route: '/projects/:id?tab=Billing&view=certified',
    description: 'Running account bills (RA bills) verified and certified by the resident engineer with retention and tax deductions.',
    primaryTables: ['txn_transactions', 'txn_transaction_lines', 'proj_projects']
  },
  {
    id: 'subpage:project_billing_monthly_register',
    parentPageId: 'page:project_billing',
    name: 'Monthly Certified Bills Register',
    slug: 'project_billing_monthly_register',
    module: 'collaboration',
    route: '/projects/:id?tab=Billing&view=monthly',
    description: 'Consolidated month-by-month register of certified billing amounts, cumulative disbursements, and outstanding balances.',
    primaryTables: ['txn_transactions', 'proj_projects']
  },

  // Drawings Sub-Pages
  {
    id: 'subpage:project_drawings_categories',
    parentPageId: 'page:project_drawings',
    name: 'Drawing Categories & Disciplines',
    slug: 'project_drawings_categories',
    module: 'projects',
    route: '/projects/:id?tab=Drawings&view=categories',
    description: 'Blueprint folders structured by discipline: Architectural, Structural, MEP, Civil, Landscape, and Interior.',
    primaryTables: ['proj_drawing_categories', 'proj_drawings', 'proj_projects']
  },
  {
    id: 'subpage:project_drawings_revisions',
    parentPageId: 'page:project_drawings',
    name: 'Drawing Sheets & Revisions',
    slug: 'project_drawings_revisions',
    module: 'projects',
    route: '/projects/:id?tab=Drawings&view=sheets',
    description: 'CAD/DXF sheets, revision letter logs (Rev A, B, C), approval statuses, and Good For Construction (GFC) stamps.',
    primaryTables: ['proj_drawings', 'proj_projects']
  },

  // Settings Sub-Pages
  {
    id: 'subpage:project_settings_general',
    parentPageId: 'page:project_settings',
    name: 'Project Identity & Scope',
    slug: 'project_settings_general',
    module: 'projects',
    route: '/projects/:id?tab=Settings&section=general',
    description: 'Project code, formal name, location coordinates, client organization name, and description.',
    primaryTables: ['proj_projects']
  },
  {
    id: 'subpage:project_settings_branding',
    parentPageId: 'page:project_settings',
    name: 'Organisation Logo & Branding',
    slug: 'project_settings_branding',
    module: 'projects',
    route: '/projects/:id?tab=Settings&section=branding',
    description: 'Project and developer logo management for automatic embedding in DPRs, PDF exports, and work orders.',
    primaryTables: ['proj_projects']
  },
  {
    id: 'subpage:project_settings_timeline',
    parentPageId: 'page:project_settings',
    name: 'Timeline & Lifecycle Status',
    slug: 'project_settings_timeline',
    module: 'projects',
    route: '/projects/:id?tab=Settings&section=timeline',
    description: 'Start date, target completion date, lifecycle status (active, completed, on-hold, archived), and duration calculations.',
    primaryTables: ['proj_projects', 'proj_members']
  },

  // Resources Master Sub-Pages
  {
    id: 'subpage:resources_grid',
    parentPageId: 'page:resources',
    name: 'Master Resource Catalog',
    slug: 'resources_grid',
    module: 'resources',
    route: '/resources',
    description: 'Enterprise catalog of construction materials, labor trades, plant equipment, and standard units.',
    primaryTables: ['res_resources']
  },
  {
    id: 'subpage:resources_rates',
    parentPageId: 'page:resources',
    name: 'Effective-Date Rate Master',
    slug: 'resources_rates',
    module: 'resources',
    route: '/resources?tab=rates',
    description: 'Historical and future rate versioning with effective-date validation and supplier quote tracking.',
    primaryTables: ['res_rates', 'res_resources']
  },
  {
    id: 'subpage:resources_recipes',
    parentPageId: 'page:resources',
    name: 'Master BOM Recipes',
    slug: 'resources_recipes',
    module: 'resources',
    route: '/resources?tab=recipes',
    description: 'Central bill of materials composite recipes and assembly decomposition DAGs.',
    primaryTables: ['res_compositions', 'res_resources']
  },
  {
    id: 'subpage:resources_conversions',
    parentPageId: 'page:resources',
    name: 'Standard Unit Conversions',
    slug: 'resources_conversions',
    module: 'resources',
    route: '/resources?tab=conversions',
    description: 'System unit multipliers and packaging conversions across metric and imperial systems.',
    primaryTables: ['res_conversions', 'res_resources']
  }
];

// ─── 2. MODULE DEFINITIONS ───────────────────────────────────────────────────
export const MODULE_DEFINITIONS = [
  {
    id: 'module:dashboard',
    name: 'Executive Dashboard',
    module: 'dashboard',
    route: '/',
    description: 'Organization-wide executive metrics, cost status, portfolio distribution, and cross-module intelligence.',
    icon: 'LayoutDashboard',
    primaryTable: 'proj_projects'
  },
  {
    id: 'module:projects',
    name: 'Projects',
    module: 'projects',
    route: '/projects',
    description: 'Project lifecycle, site operations, tasks, milestones, drawings, quality, safety, and member permissions.',
    icon: 'Briefcase',
    primaryTable: 'proj_projects'
  },
  {
    id: 'module:vendors',
    name: 'Vendors',
    module: 'vendors',
    route: '/vendors',
    description: 'Vendor directories, material suppliers, trade contractors, contact profiles, performance ratings, and project associations.',
    icon: 'Truck',
    primaryTable: 'crm_contacts'
  },
  {
    id: 'module:clients',
    name: 'Clients & CRM',
    module: 'clients',
    route: '/clients',
    description: 'Client accounts, developer organizations, CRM interactions, job natures, sectors, and client project stakeholders.',
    icon: 'Users',
    primaryTable: 'crm_contacts'
  },
  {
    id: 'module:resources',
    name: 'Resources & Inventory',
    module: 'resources',
    route: '/resources',
    description: 'Materials, plant, labor, equipment catalog, unit registry, historical and effective-date rate versioning, BOM, and composite assemblies.',
    icon: 'Layers',
    primaryTable: 'res_resources'
  },
  {
    id: 'module:spreadsheets',
    name: 'Spreadsheets',
    module: 'spreadsheets',
    route: '/spreadsheets',
    description: 'Dynamic calculation grids, rate comparisons, and scenario cost matrices.',
    icon: 'Table',
    primaryTable: 'res_resources'
  },
  {
    id: 'module:collaboration',
    name: 'Finance & Approvals',
    module: 'collaboration',
    route: '/collaboration',
    description: 'Multi-level workflow approvals, document cycle states, sign-off hierarchies, purchase requisitions, and audit logs.',
    icon: 'CheckSquare',
    primaryTable: 'wf_documents'
  },
  {
    id: 'module:admin',
    name: 'Administration & IAM',
    module: 'admin',
    route: '/admin',
    description: 'User access controls, role permissions, department structures, designations, and system-wide security settings.',
    icon: 'Shield',
    primaryTable: 'iam_users'
  }
];

// ─── 3. SCHEMA DEFINITIONS (Covering all 25 operational database tables) ─────
export const SCHEMA_DEFINITIONS = [
  // Projects Core
  {
    id: 'schema:proj_projects',
    table: 'proj_projects',
    module: 'projects',
    label: 'proj_projects',
    description: 'Stores organization-scoped construction projects with dates, statuses, locations, and metadata.',
    keyColumns: ['id', 'org_id', 'name', 'location', 'status', 'project_code', 'start_date', 'end_date'],
    relationships: [
      { target: 'schema:proj_members', type: 'HAS_MEMBERS', foreignKey: 'project_id' },
      { target: 'schema:proj_tasks', type: 'HAS_TASKS', foreignKey: 'project_id' },
      { target: 'schema:proj_drawings', type: 'HAS_DRAWINGS', foreignKey: 'project_id' },
      { target: 'schema:proj_quality_checklists', type: 'HAS_CHECKLISTS', foreignKey: 'project_id' },
      { target: 'schema:proj_meetings', type: 'HAS_MEETINGS', foreignKey: 'project_id' },
      { target: 'schema:pdoc_parties', type: 'HAS_PARTIES', foreignKey: 'project_id' },
      { target: 'schema:res_resources', type: 'PROJECT_RESOURCES', foreignKey: 'project_id' }
    ]
  },
  {
    id: 'schema:proj_members',
    table: 'proj_members',
    module: 'projects',
    label: 'proj_members',
    description: 'User access controls and role memberships mapped to specific projects.',
    keyColumns: ['id', 'org_id', 'project_id', 'user_id', 'permission_level', 'project_permissions'],
    relationships: [
      { target: 'schema:proj_projects', type: 'BELONGS_TO_PROJECT', foreignKey: 'project_id' },
      { target: 'schema:iam_users', type: 'USER_MEMBER', foreignKey: 'user_id' }
    ]
  },
  {
    id: 'schema:proj_summary',
    table: 'proj_summary',
    module: 'projects',
    label: 'proj_summary',
    description: 'Cached operational metrics, milestone counts, cost rollups, and progress indicators per project.',
    keyColumns: ['id', 'org_id', 'project_id', 'wip_percent', 'budget_spent', 'active_issues'],
    relationships: [
      { target: 'schema:proj_projects', type: 'SUMMARIZES_PROJECT', foreignKey: 'project_id' }
    ]
  },
  {
    id: 'schema:proj_directory',
    table: 'proj_directory',
    module: 'projects',
    label: 'proj_directory',
    description: 'Site contact directory including engineers, site supervisors, subcontractors, and authorities.',
    keyColumns: ['id', 'org_id', 'project_id', 'name', 'role', 'phone', 'email'],
    relationships: [
      { target: 'schema:proj_projects', type: 'DIRECTORY_FOR_PROJECT', foreignKey: 'project_id' }
    ]
  },

  // Tasks & Schedule
  {
    id: 'schema:proj_tasks',
    table: 'proj_tasks',
    module: 'projects',
    label: 'proj_tasks',
    description: 'Work breakdown structure activities, milestone tasks, progress percentages, and deadlines.',
    keyColumns: ['id', 'org_id', 'project_id', 'category_id', 'title', 'status', 'start_date', 'due_date', 'progress'],
    relationships: [
      { target: 'schema:proj_projects', type: 'TASK_OF_PROJECT', foreignKey: 'project_id' },
      { target: 'schema:proj_task_categories', type: 'IN_CATEGORY', foreignKey: 'category_id' },
      { target: 'schema:proj_task_assignees', type: 'HAS_ASSIGNEES', foreignKey: 'task_id' }
    ]
  },
  {
    id: 'schema:proj_task_categories',
    table: 'proj_task_categories',
    module: 'projects',
    label: 'proj_task_categories',
    description: 'WBS groupings (e.g. Substructure, Superstructure, MEP, Finishes, Landscaping).',
    keyColumns: ['id', 'org_id', 'project_id', 'name', 'color_code'],
    relationships: [
      { target: 'schema:proj_projects', type: 'CATEGORY_FOR_PROJECT', foreignKey: 'project_id' }
    ]
  },
  {
    id: 'schema:proj_task_assignees',
    table: 'proj_task_assignees',
    module: 'projects',
    label: 'proj_task_assignees',
    description: 'Team members and contractors assigned to specific execution tasks.',
    keyColumns: ['id', 'task_id', 'user_id'],
    relationships: [
      { target: 'schema:proj_tasks', type: 'ASSIGNEE_ON_TASK', foreignKey: 'task_id' },
      { target: 'schema:iam_users', type: 'ASSIGNED_USER', foreignKey: 'user_id' }
    ]
  },

  // Drawings
  {
    id: 'schema:proj_drawings',
    table: 'proj_drawings',
    module: 'projects',
    label: 'proj_drawings',
    description: 'Architectural, structural, civil, and MEP drawing sheets with revisions and file attachments.',
    keyColumns: ['id', 'org_id', 'project_id', 'category_id', 'drawing_number', 'title', 'revision', 'status'],
    relationships: [
      { target: 'schema:proj_projects', type: 'DRAWING_OF_PROJECT', foreignKey: 'project_id' },
      { target: 'schema:proj_drawing_categories', type: 'IN_DRAWING_CATEGORY', foreignKey: 'category_id' }
    ]
  },
  {
    id: 'schema:proj_drawing_categories',
    table: 'proj_drawing_categories',
    module: 'projects',
    label: 'proj_drawing_categories',
    description: 'Disciplines for construction drawings (Architectural, Structural, MEP, Landscape, As-Built).',
    keyColumns: ['id', 'org_id', 'project_id', 'name', 'code'],
    relationships: [
      { target: 'schema:proj_projects', type: 'DRAWING_DISCIPLINE_OF', foreignKey: 'project_id' }
    ]
  },

  // Quality & QA/QC
  {
    id: 'schema:proj_quality_checklists',
    table: 'proj_quality_checklists',
    module: 'projects',
    label: 'proj_quality_checklists',
    description: 'Standardized quality inspection checklists (Concrete pour, rebar checking, waterproofing, masonry).',
    keyColumns: ['id', 'org_id', 'project_id', 'methodology_id', 'title', 'status', 'inspected_by', 'inspection_date'],
    relationships: [
      { target: 'schema:proj_projects', type: 'CHECKLIST_OF_PROJECT', foreignKey: 'project_id' },
      { target: 'schema:proj_quality_methodologies', type: 'USES_METHODOLOGY', foreignKey: 'methodology_id' }
    ]
  },
  {
    id: 'schema:proj_quality_methodologies',
    table: 'proj_quality_methodologies',
    module: 'projects',
    label: 'proj_quality_methodologies',
    description: 'Technical quality specifications, testing criteria, tolerances, and standard operating procedures.',
    keyColumns: ['id', 'org_id', 'title', 'discipline', 'description'],
    relationships: []
  },
  {
    id: 'schema:proj_qaqc_observations',
    table: 'proj_qaqc_observations',
    module: 'projects',
    label: 'proj_qaqc_observations',
    description: 'Defect snags, safety hazard logs, non-conformance reports (NCR), severity levels, and closeout status.',
    keyColumns: ['id', 'org_id', 'project_id', 'title', 'category', 'severity', 'status', 'reported_by', 'assigned_to'],
    relationships: [
      { target: 'schema:proj_projects', type: 'OBSERVATION_OF_PROJECT', foreignKey: 'project_id' },
      { target: 'schema:iam_users', type: 'REPORTED_BY_USER', foreignKey: 'reported_by' }
    ]
  },

  // Meetings & General Documents
  {
    id: 'schema:proj_meetings',
    table: 'proj_meetings',
    module: 'projects',
    label: 'proj_meetings',
    description: 'Minutes of Meeting (MOM), site progress reviews, coordination meetings, and action items.',
    keyColumns: ['id', 'org_id', 'project_id', 'title', 'meeting_date', 'location', 'agenda', 'status'],
    relationships: [
      { target: 'schema:proj_projects', type: 'MEETING_OF_PROJECT', foreignKey: 'project_id' },
      { target: 'schema:proj_meetings_participants', type: 'HAS_PARTICIPANTS', foreignKey: 'meeting_id' }
    ]
  },
  {
    id: 'schema:proj_meetings_participants',
    table: 'proj_meetings_participants',
    module: 'projects',
    label: 'proj_meetings_participants',
    description: 'Stakeholders attending site review meetings and their attendance status.',
    keyColumns: ['id', 'meeting_id', 'user_id', 'name', 'attendance_status'],
    relationships: [
      { target: 'schema:proj_meetings', type: 'ATTENDED_MEETING', foreignKey: 'meeting_id' }
    ]
  },

  // CRM Contacts & Interactions
  {
    id: 'schema:crm_contacts',
    table: 'crm_contacts',
    module: 'vendors',
    label: 'crm_contacts',
    description: 'Master CRM directory storing vendors, material suppliers, trade contractors, clients, and developers.',
    keyColumns: ['id', 'org_id', 'name', 'category', 'email', 'mobile', 'location', 'sector_id', 'job_nature_id'],
    relationships: [
      { target: 'schema:pdoc_parties', type: 'LINKED_IN_PROJECTS', foreignKey: 'contact_id' },
      { target: 'schema:crm_interactions', type: 'HAS_INTERACTIONS', foreignKey: 'contact_id' }
    ]
  },
  {
    id: 'schema:crm_interactions',
    table: 'crm_interactions',
    module: 'clients',
    label: 'crm_interactions',
    description: 'Activity logs, negotiation records, site visit notes, and correspondence timelines.',
    keyColumns: ['id', 'org_id', 'contact_id', 'type', 'subject', 'notes', 'interaction_date'],
    relationships: [
      { target: 'schema:crm_contacts', type: 'LOGGED_FOR_CONTACT', foreignKey: 'contact_id' }
    ]
  },
  {
    id: 'schema:pdoc_parties',
    table: 'pdoc_parties',
    module: 'projects',
    label: 'pdoc_parties',
    description: 'Project-party bridge linking vendors, contractors, and clients to active project sites.',
    keyColumns: ['id', 'org_id', 'project_id', 'contact_id', 'role_name', 'party_type'],
    relationships: [
      { target: 'schema:proj_projects', type: 'ASSOCIATED_PROJECT', foreignKey: 'project_id' },
      { target: 'schema:crm_contacts', type: 'ASSOCIATED_CONTACT', foreignKey: 'contact_id' }
    ]
  },

  // Resources & Inventory
  {
    id: 'schema:res_resources',
    table: 'res_resources',
    module: 'resources',
    label: 'res_resources',
    description: 'Master construction catalog for materials, plant/machinery, labor categories, and project-scoped items.',
    keyColumns: ['id', 'org_id', 'project_id', 'parent_id', 'name', 'code', 'type', 'base_unit_code'],
    relationships: [
      { target: 'schema:res_rates', type: 'HAS_RATES', foreignKey: 'resource_id' },
      { target: 'schema:res_compositions', type: 'COMPOSED_OF_ITEMS', foreignKey: 'parent_resource_id' },
      { target: 'schema:proj_projects', type: 'SCOPED_TO_PROJECT', foreignKey: 'project_id' }
    ]
  },
  {
    id: 'schema:res_rates',
    table: 'res_rates',
    module: 'resources',
    label: 'res_rates',
    description: 'Effective-dated pricing records maintaining historical unit costs for cost estimation.',
    keyColumns: ['id', 'org_id', 'resource_id', 'effective_date', 'rate', 'currency', 'created_by'],
    relationships: [
      { target: 'schema:res_resources', type: 'RATES_FOR_RESOURCE', foreignKey: 'resource_id' }
    ]
  },
  {
    id: 'schema:res_compositions',
    table: 'res_compositions',
    module: 'resources',
    label: 'res_compositions',
    description: 'Bill of Materials (BOM) multi-level recipes linking parent assemblies to child components.',
    keyColumns: ['id', 'org_id', 'parent_resource_id', 'child_resource_id', 'quantity', 'unit_code'],
    relationships: [
      { target: 'schema:res_resources', type: 'PARENT_ASSEMBLY', foreignKey: 'parent_resource_id' },
      { target: 'schema:res_resources', type: 'CHILD_COMPONENT', foreignKey: 'child_resource_id' }
    ]
  },
  {
    id: 'schema:res_conversions',
    table: 'res_conversions',
    module: 'resources',
    label: 'res_conversions',
    description: 'Unit of measurement conversion factors (e.g. Metric Ton to Kg, Bag to Kg, SqFt to SqMt).',
    keyColumns: ['id', 'from_unit_code', 'to_unit_code', 'factor'],
    relationships: []
  },

  // Finance & Transactions
  {
    id: 'schema:txn_transactions',
    table: 'txn_transactions',
    module: 'collaboration',
    label: 'txn_transactions',
    description: 'Financial transactions, expense vouchers, vendor payments, client billing receipts, and petty cash.',
    keyColumns: ['id', 'org_id', 'project_id', 'voucher_number', 'txn_type', 'txn_date', 'total_amount', 'status'],
    relationships: [
      { target: 'schema:proj_projects', type: 'TXN_FOR_PROJECT', foreignKey: 'project_id' },
      { target: 'schema:txn_transaction_lines', type: 'HAS_LINES', foreignKey: 'transaction_id' }
    ]
  },
  {
    id: 'schema:txn_transaction_lines',
    table: 'txn_transaction_lines',
    module: 'collaboration',
    label: 'txn_transaction_lines',
    description: 'Double-entry / cost-center itemized lines associated with a financial transaction voucher.',
    keyColumns: ['id', 'transaction_id', 'account_id', 'amount', 'entry_type', 'description'],
    relationships: [
      { target: 'schema:txn_transactions', type: 'LINE_OF_TXN', foreignKey: 'transaction_id' }
    ]
  },

  // Workflows & Approvals
  {
    id: 'schema:wf_documents',
    table: 'wf_documents',
    module: 'collaboration',
    label: 'wf_documents',
    description: 'Controlled document definitions subject to governance (e.g. Purchase Order, RA Bill, Work Order).',
    keyColumns: ['id', 'org_id', 'title', 'code', 'category', 'status'],
    relationships: [
      { target: 'schema:wf_document_instances', type: 'HAS_INSTANCES', foreignKey: 'document_id' },
      { target: 'schema:wf_approval_cycles', type: 'HAS_CYCLES', foreignKey: 'document_id' }
    ]
  },
  {
    id: 'schema:wf_approval_cycles',
    table: 'wf_approval_cycles',
    module: 'collaboration',
    label: 'wf_approval_cycles',
    description: 'Multi-stage approval workflow configurations with defined sequence of authorizers.',
    keyColumns: ['id', 'org_id', 'document_id', 'title', 'cycle_type', 'status'],
    relationships: [
      { target: 'schema:wf_documents', type: 'CYCLE_FOR_DOC', foreignKey: 'document_id' },
      { target: 'schema:wf_approval_levels', type: 'HAS_LEVELS', foreignKey: 'cycle_id' }
    ]
  },
  {
    id: 'schema:wf_approval_logs',
    table: 'wf_approval_logs',
    module: 'collaboration',
    label: 'wf_approval_logs',
    description: 'Immutable audit logs recording human approval decisions, rejections, comments, and timestamps.',
    keyColumns: ['id', 'submission_id', 'approver_id', 'decision', 'comment', 'decided_at'],
    relationships: [
      { target: 'schema:iam_users', type: 'DECIDED_BY', foreignKey: 'approver_id' }
    ]
  },

  // Administration & IAM
  {
    id: 'schema:iam_users',
    table: 'iam_users',
    module: 'admin',
    label: 'iam_users',
    description: 'User identity accounts, credentials, organizational memberships, and assigned system privileges.',
    keyColumns: ['id', 'org_id', 'dept_id', 'desg_id', 'user_name', 'email', 'user_type', 'system_permissions'],
    relationships: [
      { target: 'schema:iam_departments', type: 'BELONGS_TO_DEPT', foreignKey: 'dept_id' },
      { target: 'schema:iam_designations', type: 'HOLDS_DESIGNATION', foreignKey: 'desg_id' },
      { target: 'schema:proj_members', type: 'PROJECT_ASSIGNMENTS', foreignKey: 'user_id' }
    ]
  },
  {
    id: 'schema:iam_departments',
    table: 'iam_departments',
    module: 'admin',
    label: 'iam_departments',
    description: 'Corporate and operational departments (e.g. Civil, MEP, Procurement, QA/QC, Accounts, HR).',
    keyColumns: ['id', 'org_id', 'dept_name', 'dept_code'],
    relationships: [
      { target: 'schema:iam_users', type: 'STAFF_IN_DEPT', foreignKey: 'dept_id' }
    ]
  },
  {
    id: 'schema:iam_designations',
    table: 'iam_designations',
    module: 'admin',
    label: 'iam_designations',
    description: 'Job titles and organizational hierarchy designations (e.g. Project Manager, Site Engineer, Surveyor).',
    keyColumns: ['id', 'org_id', 'desg_name'],
    relationships: [
      { target: 'schema:iam_users', type: 'STAFF_DESIGNATION', foreignKey: 'desg_id' }
    ]
  }
];

// ─── 4. OPERATIONAL RULES & CONSTRAINTS ─────────────────────────────────────
export const OPERATIONAL_RULES = [
  {
    id: 'rule:org_boundary_enforcement',
    module: 'general',
    name: 'Organization Boundary Scoping',
    category: 'rule',
    targetSchema: 'all',
    severity: 'STRICT',
    summary: 'All database queries and mutations must strictly enforce org_id boundaries to prevent cross-tenant data leakage.',
    enforcement: 'Automated query tenancy scoping in Knex repositories and authorization middleware.'
  },
  {
    id: 'rule:proj_status_conventions',
    module: 'projects',
    name: 'Project Status Convention',
    category: 'rule',
    targetSchema: 'proj_projects',
    severity: 'CONVENTION',
    summary: 'createProject() defaults to "active". Statuses are application-controlled conventions ("active", "completed", "on_hold") rather than database enums.',
    enforcement: 'Application services validate transitions; agent must not assume non-active projects are invalid.'
  },
  {
    id: 'rule:proj_membership_access',
    module: 'projects',
    name: 'Project Member Authorization',
    category: 'rule',
    targetSchema: 'proj_members',
    severity: 'STRICT',
    summary: 'Non-admin users can only view and edit projects to which they are explicitly mapped in proj_members with appropriate permission level.',
    enforcement: 'Checked on project access route middleware and agent tool authorization policies.'
  },
  {
    id: 'rule:task_wbs_hierarchy',
    module: 'projects',
    name: 'Task Milestone & WBS Precedence',
    category: 'rule',
    targetSchema: 'proj_tasks',
    severity: 'STRICT',
    summary: 'Tasks within a project cannot be closed if blocking predecessor tasks remain pending; milestones require supervisor signoff.',
    enforcement: 'projTaskService validates task dependency DAG before marking completion.'
  },
  {
    id: 'rule:drawing_revision_immutability',
    module: 'projects',
    name: 'Drawing Revision Immutability',
    category: 'rule',
    targetSchema: 'proj_drawings',
    severity: 'STRICT',
    summary: 'Approved drawing sheets cannot be modified in-place. Changes require publishing a new revision letter (Rev A -> Rev B).',
    enforcement: 'Drawing service disallows destructive overwrites of approved CAD/PDF drawing sheets.'
  },
  {
    id: 'rule:qaqc_4eye_signoff',
    module: 'projects',
    name: 'Quality 4-Eye Inspection Sign-off',
    category: 'rule',
    targetSchema: 'proj_quality_checklists',
    severity: 'STRICT',
    summary: 'Quality checklists and concrete pour cards require dual signature (Site Engineer + QA/QC Inspector) before subsequent stage work proceeds.',
    enforcement: 'Inspection workflow blocks checklist closeout until verified by authorized QA/QC personnel.'
  },
  {
    id: 'rule:safety_incident_escalation',
    module: 'projects',
    name: 'Safety Observation Severity Escalation',
    category: 'rule',
    targetSchema: 'proj_qaqc_observations',
    severity: 'CRITICAL',
    summary: 'Safety hazards classified as CRITICAL or HIGH require immediate email notifications and mandatory work-stop tags until resolved.',
    enforcement: 'Automated event triggers send emergency alerts to safety officers upon high-severity log entry.'
  },
  {
    id: 'rule:vendor_client_category_segregation',
    module: 'vendors',
    name: 'CRM Category Partitioning',
    category: 'rule',
    targetSchema: 'crm_contacts',
    severity: 'CONVENTION',
    summary: 'Vendors and Clients share the crm_contacts table. Vendors are categorized as Supplier/Contractor/Manufacturer; Clients are categorized as Client/Owner.',
    enforcement: 'Service queries filter on category IN ("Supplier", "Contractor", "Manufacturer") vs category = "Client".'
  },
  {
    id: 'rule:res_rate_effective_dating',
    module: 'resources',
    name: 'Resource Rate Effective-Date Versioning',
    category: 'rule',
    targetSchema: 'res_rates',
    severity: 'STRICT',
    summary: 'Rates are never overwritten in-place; new rates must be inserted with an effective_date to maintain historical audit trails and cost recalculation accuracy.',
    enforcement: 'resources.createRateVersion enforces append-only rate rows with validated date boundaries.'
  },
  {
    id: 'rule:res_composition_dag',
    module: 'resources',
    name: 'Composition Cycle Prevention (DAG)',
    category: 'rule',
    targetSchema: 'res_compositions',
    severity: 'STRICT',
    summary: 'Bill of Materials assemblies must form a Directed Acyclic Graph. An item cannot contain itself directly or transitively.',
    enforcement: 'compositionResolver.js traverses upstream/downstream paths before allowing composition writes.'
  },
  {
    id: 'rule:project_scoped_resources',
    module: 'resources',
    name: 'Project Resource Isolation',
    category: 'rule',
    targetSchema: 'res_resources',
    severity: 'CONVENTION',
    summary: 'Master catalog resources (project_id IS NULL) are copied to project-scoped rows (project_id NOT NULL) when assigned to a specific project site.',
    enforcement: 'Ensures custom rates and site-specific BOM adjustments do not corrupt global catalog definitions.'
  },
  {
    id: 'rule:double_entry_transaction_balance',
    module: 'collaboration',
    name: 'Transaction Balanced Entry Requirement',
    category: 'rule',
    targetSchema: 'txn_transactions',
    severity: 'STRICT',
    summary: 'All financial transaction vouchers must have matching debit and credit lines totaling to zero variance before posting.',
    enforcement: 'Transaction service validates balance equality across txn_transaction_lines within atomic transaction.'
  },
  {
    id: 'rule:approval_hierarchy_gating',
    module: 'collaboration',
    name: 'Sequential Stage Approval Gating',
    category: 'rule',
    targetSchema: 'wf_approval_cycles',
    severity: 'STRICT',
    summary: 'Approval levels must be cleared in ascending order; lower level rejection terminates the workflow immediately.',
    enforcement: 'wf_approval_levels enforces step progression and emits audit log upon each decision.'
  },
  {
    id: 'rule:destructive_write_confirmation',
    module: 'general',
    name: 'Two-Phase Destructive Write Confirmation',
    category: 'rule',
    targetSchema: 'all',
    severity: 'CRITICAL',
    summary: 'Any agent tool action classified as WRITE, BULK_WRITE, or DESTRUCTIVE requires an explicit human confirmation step before execution.',
    enforcement: 'agentService.js enforces proposal -> confirmation_required -> human decision flow with lease expiration.'
  },
  {
    id: 'rule:planning_schedule_baseline',
    module: 'projects',
    name: 'Schedule Baseline Locking',
    category: 'rule',
    targetSchema: 'proj_tasks',
    severity: 'STRICT',
    summary: 'Once a baseline schedule is approved by the project director, target completion dates can only be updated via formal change orders.',
    enforcement: 'projTaskService prevents baseline date shifts without attached approval cycle ID.'
  },
  {
    id: 'rule:dpr_daily_attendance_log',
    module: 'projects',
    name: 'Daily Progress Report (DPR) Submission Protocol',
    category: 'rule',
    targetSchema: 'proj_summary',
    severity: 'STRICT',
    summary: 'DPR records must be submitted before 23:59 each working day with labor counts, weather notes, and physical milestone progress.',
    enforcement: 'DPR service validates timestamp sequence and blocks retrospective modifications once locked.'
  },
  {
    id: 'rule:billing_joint_measurement',
    module: 'collaboration',
    name: 'Joint Measurement Sign-Off Precedence',
    category: 'rule',
    targetSchema: 'txn_transactions',
    severity: 'STRICT',
    summary: 'Contractor and client running bills must reference verified joint measurement sheets (JMS) signed by both site surveyor and contractor representative.',
    enforcement: 'Billing pipeline requires attached measurement verification sheet before status can transition to certified.'
  },
  {
    id: 'rule:contract_milestone_retention',
    module: 'projects',
    name: 'Contractual Retention Withholding',
    category: 'rule',
    targetSchema: 'txn_transaction_lines',
    severity: 'CONVENTION',
    summary: 'Subcontractor interim progress payments automatically deduct 5% retention money until defect liability period expiration.',
    enforcement: 'Transaction line calculator enforces default retention percentage unless explicit contractual waiver exists.'
  }
];

