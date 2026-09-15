import React from 'react';
import { FileSpreadsheet, FileText, Receipt } from 'lucide-react';
import { MobileEntityCard } from '../../../components/MobileCard';
import MobilePageHeader from '../../../components/MobilePageHeader';

const BILLING_CATEGORIES = [
    { name: 'Invoice – Materials', description: 'Material supply invoices categorized by vendor and date.', type: 'Episodic', icon: FileText },
    { name: 'Invoice – Contractors', description: 'Contractor invoices and progress billing submitted for payment processing.', type: 'Episodic', icon: FileText },
    { name: 'Certified Bills Copy', description: 'Certified and approved bill copies verified by the project authority.', type: 'Episodic', icon: Receipt },
    { name: 'List of Certified Bills (Monthly)', description: 'Monthly consolidated register of certified bills.', type: 'Episodic', icon: FileSpreadsheet },
];

export default function MobileProjectBilling() {
    return <div data-m9-view="billing-hub" className="space-y-3 px-4 pb-28"><MobilePageHeader title="Billing" subtitle="Current ERP document categories"/><p className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">These categories are informational in the current ERP source. No reachable invoice, payment, attachment, tax, ledger, or approval workflow is available here.</p>{BILLING_CATEGORIES.map((item)=><MobileEntityCard key={item.name} title={item.name} subtitle={item.description} meta={`${item.type} · Unavailable in current source`} icon={item.icon}/>)}</div>;
}
