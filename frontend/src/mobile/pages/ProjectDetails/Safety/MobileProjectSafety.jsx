import React from 'react';
import { ClipboardCheck, FileText, ShieldAlert, ShieldCheck } from 'lucide-react';
import MobileCard from '../../../components/MobileCard';
import MobilePageHeader from '../../../components/MobilePageHeader';

// SafetyIndex is deliberately static in the existing ERP.  Keep that truth on
// mobile: these are informative cards, not routes, records, or API-backed data.
const ITEMS = [
    ['HS Plan', 'Health and safety planning documents for the project.', ShieldCheck, 'Single Instance'],
    ['Safety Guideline', 'Safety guidelines and standard practices.', FileText, 'Single Instance'],
    ['Incident & Near-Miss Reports', 'Existing ERP safety incident reference area.', ShieldAlert, 'Episodic'],
    ['Safety Inspection Checklists', 'Safety inspection checklist reference area.', ClipboardCheck, 'Episodic'],
];

export default function MobileProjectSafety() {
    return <section data-m7-module="Safety" className="min-w-0"><MobilePageHeader eyebrow="PROJECT WORKSPACE" title="Safety" description="Current ERP safety reference areas." /><div className="space-y-3 px-4 pb-28">{ITEMS.map(([title, description, Icon, type]) => <MobileCard key={title} className="min-h-24"><div className="flex items-start gap-4"><span className="rounded-xl bg-amber-50 p-3 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"><Icon size={22} /></span><span><span className="block text-sm font-bold text-gray-950 dark:text-gh-text">{title}</span><span className="mt-1 block text-xs leading-5 text-gray-600 dark:text-gh-muted">{description}</span><span className="mt-2 block text-[10px] font-bold uppercase tracking-wide text-gray-500">{type}</span></span></div></MobileCard>)}</div></section>;
}
