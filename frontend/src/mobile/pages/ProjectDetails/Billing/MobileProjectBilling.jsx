import React, { useState } from 'react';
import {
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    FileSpreadsheet,
    FileText,
    Receipt,
    Wallet,
} from 'lucide-react';
import MobileCard, { MobileEntityCard } from '../../../components/MobileCard';
import MobilePageHeader from '../../../components/MobilePageHeader';
import MobileTabs from '../../../components/MobileTabs';

const BILLING_TABS = [
    { value: 'ra_bills', label: 'Client RA Bills', icon: Receipt },
    { value: 'invoices', label: 'Subcontractor Invoices', icon: FileText },
    { value: 'retention', label: 'Retention Ledger', icon: Wallet },
    { value: 'categories', label: 'Categories', icon: FileSpreadsheet },
];

const MOCK_RA_BILLS = [
    {
        billId: 1,
        billNo: 'RA Bill #03',
        date: '2026-08-25',
        grossAmount: 4850000.0,
        retentionDeducted: 242500.0,
        tdsDeducted: 97000.0,
        netPayable: 4510500.0,
        status: 'Certified',
        certifiedBy: 'Prestige PMC Lead',
    },
    {
        billId: 2,
        billNo: 'RA Bill #02',
        date: '2026-07-28',
        grossAmount: 5200000.0,
        retentionDeducted: 260000.0,
        tdsDeducted: 104000.0,
        netPayable: 4836000.0,
        status: 'Disbursed',
        certifiedBy: 'Prestige PMC Lead',
    },
    {
        billId: 3,
        billNo: 'RA Bill #01',
        date: '2026-06-30',
        grossAmount: 3800000.0,
        retentionDeducted: 190000.0,
        tdsDeducted: 76000.0,
        netPayable: 3534000.0,
        status: 'Disbursed',
        certifiedBy: 'Prestige PMC Lead',
    },
];

const MOCK_INVOICES = [
    {
        invoiceId: 1,
        contractorName: 'Apex Civil Infra',
        trade: 'Civil Shuttering & Casting',
        invoiceNo: 'INV-APX-012',
        date: '2026-08-28',
        claimedAmount: 1250000.0,
        approvedAmount: 1180000.0,
        status: 'Approved',
    },
    {
        invoiceId: 2,
        contractorName: 'Shree Balaji Steel Works',
        trade: 'Rebar Cutting & Bending',
        invoiceNo: 'INV-SBS-008',
        date: '2026-08-26',
        claimedAmount: 680000.0,
        approvedAmount: 680000.0,
        status: 'Paid',
    },
    {
        invoiceId: 3,
        contractorName: 'Voltas Electro-Mechanical',
        trade: 'MEP Conduiting',
        invoiceNo: 'INV-VLT-003',
        date: '2026-08-20',
        claimedAmount: 420000.0,
        approvedAmount: 395000.0,
        status: 'Under Verification',
    },
];

const MOCK_RETENTION = [
    {
        party: 'Prestige Group Holdings (Client Retention on MANO)',
        totalWithheld: 692500.0,
        releaseStage1: '50% on Virtual Completion (₹3,46,250)',
        releaseStage2: '50% on Defect Liability Expiry 12M (₹3,46,250)',
        status: 'Withheld',
    },
    {
        party: 'Apex Civil Infra (Subcontractor Retention)',
        totalWithheld: 120000.0,
        releaseStage1: '50% on RCC Handover (₹60,000)',
        releaseStage2: '50% on Final Bill Settlement (₹60,000)',
        status: 'Withheld',
    },
];

const BILLING_CATEGORIES = [
    { name: 'Invoice – Materials', description: 'Material supply invoices categorized by vendor and date.', type: 'Episodic', icon: FileText },
    { name: 'Invoice – Contractors', description: 'Contractor invoices and progress billing submitted for payment processing.', type: 'Episodic', icon: FileText },
    { name: 'Certified Bills Copy', description: 'Certified and approved bill copies verified by the project authority.', type: 'Episodic', icon: Receipt },
    { name: 'List of Certified Bills (Monthly)', description: 'Monthly consolidated register of certified bills.', type: 'Episodic', icon: FileSpreadsheet },
];

export default function MobileProjectBilling() {
    const [activeTab, setActiveTab] = useState('ra_bills');

    return (
        <section data-m9-module="Billing" className="w-full min-w-0">
            <MobilePageHeader
                eyebrow="PROJECT WORKSPACE"
                title="Billing"
                subtitle="Client RA bills, subcontractor invoices, and retention ledger"
            />

            <div className="px-2 sm:px-3 pt-1">
                <MobileTabs
                    label="Billing sections"
                    value={activeTab}
                    onChange={setActiveTab}
                    items={BILLING_TABS}
                />
            </div>

            <div className="w-full min-w-0 space-y-2.5 px-2 sm:px-3 pb-24 pt-2">
                {activeTab === 'ra_bills' && (
                    <div className="space-y-2.5">
                        {MOCK_RA_BILLS.map((b) => {
                            const isDisbursed = b.status === 'Disbursed';
                            return (
                                <div
                                    key={b.billId}
                                    className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <h3 className="text-xs font-bold text-gray-900 dark:text-gh-text">
                                                {b.billNo}
                                            </h3>
                                            <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-gray-500 dark:text-gh-muted">
                                                <Calendar size={11} /> {b.date} • {b.certifiedBy}
                                            </p>
                                        </div>
                                        <span
                                            className={`shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${
                                                isDisbursed
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                            }`}
                                        >
                                            {b.status}
                                        </span>
                                    </div>

                                    <div className="my-2.5 border-t border-gray-100 dark:border-gh-border" />

                                    <div className="grid grid-cols-4 gap-1 text-center">
                                        <div className="rounded-lg bg-gray-50 p-1.5 dark:bg-gh-bg">
                                            <p className="text-[10px] text-gray-500 dark:text-gh-muted">Gross Claim</p>
                                            <p className="mt-0.5 font-mono text-xs font-bold text-gray-900 dark:text-gh-text">
                                                ₹{(b.grossAmount / 100000).toFixed(2)} L
                                            </p>
                                        </div>
                                        <div className="rounded-lg bg-amber-50/70 p-1.5 dark:bg-amber-950/20">
                                            <p className="text-[10px] text-amber-700 dark:text-amber-300">5% Retention</p>
                                            <p className="mt-0.5 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                                                -₹{(b.retentionDeducted / 100000).toFixed(2)} L
                                            </p>
                                        </div>
                                        <div className="rounded-lg bg-red-50/70 p-1.5 dark:bg-red-950/20">
                                            <p className="text-[10px] text-red-600 dark:text-red-300">2% TDS</p>
                                            <p className="mt-0.5 font-mono text-xs font-bold text-red-600 dark:text-red-300">
                                                -₹{(b.tdsDeducted / 100000).toFixed(2)} L
                                            </p>
                                        </div>
                                        <div className="rounded-lg bg-emerald-50/80 p-1.5 dark:bg-emerald-950/30">
                                            <p className="text-[10px] text-emerald-700 dark:text-emerald-300">Net Certified</p>
                                            <p className="mt-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                ₹{(b.netPayable / 100000).toFixed(2)} L
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'invoices' && (
                    <div className="space-y-2.5">
                        {MOCK_INVOICES.map((inv) => (
                            <div
                                key={inv.invoiceId}
                                className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-xs font-bold text-gray-900 dark:text-gh-text">
                                            {inv.contractorName}
                                        </h3>
                                        <p className="text-[11px] text-gray-500 dark:text-gh-muted">
                                            {inv.trade}
                                        </p>
                                    </div>
                                    <span
                                        className={`shrink-0 rounded-md px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${
                                            inv.status === 'Paid'
                                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                : inv.status === 'Approved'
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                        }`}
                                    >
                                        {inv.status}
                                    </span>
                                </div>

                                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gh-muted">
                                    <span className="font-mono">{inv.invoiceNo}</span>
                                    <span>Date: {inv.date}</span>
                                </div>

                                <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 p-2 dark:bg-gh-bg">
                                    <span className="text-xs text-gray-600 dark:text-gh-muted">
                                        Claimed: <span className="font-mono font-semibold">₹{(inv.claimedAmount / 100000).toFixed(2)} L</span>
                                    </span>
                                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                        Approved: <span className="font-mono">₹{(inv.approvedAmount / 100000).toFixed(2)} L</span>
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'retention' && (
                    <div className="space-y-2.5">
                        {MOCK_RETENTION.map((r, i) => (
                            <div
                                key={i}
                                className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-xs font-bold text-gray-900 dark:text-gh-text">
                                        {r.party}
                                    </h3>
                                    <span className="shrink-0 font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400">
                                        ₹{r.totalWithheld.toLocaleString('en-IN')}
                                    </span>
                                </div>

                                <div className="my-2 border-t border-gray-100 dark:border-gh-border" />

                                <div className="space-y-1 text-[11.5px] text-gray-600 dark:text-gh-muted">
                                    <p>• Release Tranche 1: {r.releaseStage1}</p>
                                    <p>• Release Tranche 2: {r.releaseStage2}</p>
                                </div>

                                <div className="mt-2 inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                    <Clock size={11} /> {r.status}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'categories' && (
                    <div className="space-y-2">
                        {BILLING_CATEGORIES.map((item) => (
                            <MobileEntityCard
                                key={item.name}
                                title={item.name}
                                subtitle={item.description}
                                meta={item.type}
                                icon={item.icon}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
