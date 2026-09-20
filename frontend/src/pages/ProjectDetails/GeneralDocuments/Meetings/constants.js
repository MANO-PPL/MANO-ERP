// ─────────────────────────────────────────────────────────────────────────────
// Meetings / constants.js
// Single source of truth for status configs, dropdown options, print CSS,
// and attendance colour tokens used across the Meetings module.
// ─────────────────────────────────────────────────────────────────────────────

/** Status badge + dot styles for meeting status values */
export const STATUS_CONFIG = {
    scheduled: {
        label: 'Scheduled',
        badge: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50',
        dot: 'bg-blue-500'
    },
    completed: {
        label: 'Completed',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/50',
        dot: 'bg-emerald-500'
    },
    postponed: {
        label: 'Postponed',
        badge: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50',
        dot: 'bg-amber-500'
    },
    cancelled: {
        label: 'Cancelled',
        badge: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/50',
        dot: 'bg-rose-500'
    }
};

/** Dropdown option objects for the status CustomSelect */
export const STATUS_OPTIONS = [
    { label: 'Scheduled',  value: 'scheduled'  },
    { label: 'Completed',  value: 'completed'  },
    { label: 'Postponed',  value: 'postponed'  },
    { label: 'Cancelled',  value: 'cancelled'  }
];

/** Tailwind class strings for attendance pills (edit mode toggle) */
export const ATTENDANCE_PILL = {
    present: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
    absent:  'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800/60'
};

/** Tailwind class strings for attendance badges (read-only / print mode) */
export const ATTENDANCE_BADGE = {
    present: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 print:border-emerald-600 print:text-emerald-800',
    absent:  'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 print:border-rose-600 print:text-rose-800'
};

/** Source badge Tailwind classes for the Add Participant modal */
export const SOURCE_BADGE = {
    project:   'bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40',
    erp:       'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40',
    directory: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
};

export const PRINT_STYLE_CSS = `
@media print {
    @page { size: A4 portrait; margin: 0 !important; }
    html, body {
        background: #ffffff !important; color: #0f172a !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
        width: 100% !important; height: auto !important; min-height: 100% !important;
        margin: 0 !important; padding: 0 !important; overflow: visible !important;
    }
    nav, aside, header, .print\\:hidden, button, input, select, .custom-scrollbar::-webkit-scrollbar { display: none !important; }
    body * { visibility: hidden; }
    #meeting-document-card, #meeting-document-card * { visibility: visible; }
    #meeting-document-card {
        position: absolute !important; left: 0 !important; top: 0 !important;
        width: 100% !important; max-width: 100% !important; min-width: 100% !important;
        margin: 0 !important; padding: 8mm 10mm 12mm 10mm !important;
        box-sizing: border-box !important; background: #ffffff !important;
        color: #0f172a !important; box-shadow: none !important; border: none !important;
    }
    #print-page-footer {
        display: flex !important; position: fixed !important; bottom: 6mm !important;
        right: 10mm !important; font-size: 7.5pt !important; color: #64748b !important;
        visibility: visible !important; z-index: 9999 !important;
    }
    #meeting-document-card .doc-eyebrow { font-size: 8pt !important; margin-bottom: 1px !important; display: block !important; }
    #meeting-document-card h1 { font-size: 11pt !important; font-weight: 700 !important; margin-bottom: 2px !important; line-height: 1.2 !important; }
    #meeting-document-card h2 { font-size: 9.5pt !important; font-weight: 700 !important; margin-bottom: 2px !important; line-height: 1.2 !important; }
    #meeting-document-card .metadata-row { margin-top: 3px !important; margin-bottom: 4px !important; gap: 8px !important; }
    #meeting-document-card .metadata-row span { font-size: 7.5pt !important; }
    #meeting-document-card .metadata-row p { font-size: 8.5pt !important; font-weight: 600 !important; }
    #meeting-document-card h3 { font-size: 8.5pt !important; font-weight: 700 !important; margin-top: 4px !important; margin-bottom: 2px !important; letter-spacing: 0.05em !important; }
    #meeting-document-card table { width: 100% !important; table-layout: auto !important; margin-bottom: 4px !important; }
    #meeting-document-card th { font-size: 7.5pt !important; padding: 2px 4px !important; font-weight: 700 !important; }
    #meeting-document-card td { font-size: 8.5pt !important; padding: 2px 4px !important; line-height: 1.25 !important; }
    .print-avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
}
`;
