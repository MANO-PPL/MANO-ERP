/**
 * knowledgeGraphStyles.js
 * Design system tokens and styling configs for the Knowledge Graph visualizer.
 */

export const CATEGORY_STYLES = {
  page: {
    label: 'ERP Page',
    plural: 'Pages',
    title: 'Pages & Workflows',
    description: 'Active UI view, navigation routes & user workflows',
    color: '#8b5cf6', // Purple
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/40',
    text: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    glow: 'rgba(139, 92, 246, 0.4)',
    icon: 'LayoutGrid',
    radius: 38
  },
  subpage: {
    label: 'Sub-Page',
    plural: 'Sub-Pages',
    title: 'Internal Sub-Pages',
    description: 'Specialized internal tabs, registers, and sub-views inside pages',
    color: '#a855f7', // Violet
    bg: 'bg-purple-500/10',
    border: 'border-purple-400/40',
    text: 'text-purple-600 dark:text-purple-400',
    badge: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    glow: 'rgba(168, 85, 247, 0.35)',
    icon: 'FolderOpen',
    radius: 32
  },
  module: {
    label: 'Module',
    plural: 'Modules',
    title: 'ERP Modules',
    description: 'Core functional business domains & service boundaries',
    color: '#6366f1', // Indigo
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/40',
    text: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    glow: 'rgba(99, 102, 241, 0.4)',
    icon: 'Briefcase',
    radius: 32
  },
  schema: {
    label: 'Database Table',
    plural: 'Database Tables',
    title: 'Database Schemas',
    description: 'Relational MySQL tables, columns & foreign keys',
    color: '#0284c7', // Sky
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/40',
    text: 'text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    glow: 'rgba(2, 132, 199, 0.4)',
    icon: 'Database',
    radius: 26
  },
  rule: {
    label: 'Business Rule',
    plural: 'Business Rules',
    title: 'Operational Rules',
    description: 'Governance constraints, approval levels & validations',
    color: '#d97706', // Amber
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/40',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    glow: 'rgba(217, 119, 6, 0.4)',
    icon: 'ShieldAlert',
    radius: 22
  },
  entity: {
    label: 'Live Record',
    plural: 'Live Records',
    title: 'Live Entities',
    description: 'Real-time database records synced via minute-level listeners',
    color: '#10b981', // Emerald
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    glow: 'rgba(16, 185, 129, 0.4)',
    icon: 'Layers',
    radius: 18
  }
};

export const CATEGORY_ORDER = ['page', 'subpage', 'module', 'schema', 'rule', 'entity'];

export const MODULE_COLORS = {
  dashboard: '#6366f1',  // Indigo
  projects: '#3b82f6',   // Blue
  vendors: '#10b981',    // Emerald
  clients: '#8b5cf6',    // Purple
  resources: '#f59e0b',  // Amber
  spreadsheets: '#14b8a6',// Teal
  collaboration: '#ec4899', // Pink
  admin: '#64748b',      // Slate
  general: '#64748b'     // Slate
};
