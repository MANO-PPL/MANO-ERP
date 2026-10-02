import React, { useEffect, useMemo, useState } from 'react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileCard from '../../../components/MobileCard';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileSearchBar from '../../../components/MobileSearchBar';
import { transactionRemarkPoints } from './mobileTransactionModel';

const dateLabel = (value) => {
    if (!value) return 'No date';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'No date' : date.toLocaleDateString();
};

const quantity = (line) => `${Number(line?.signed_qty || 0) > 0 ? '+' : ''}${Number(line?.signed_qty || 0)}`;

function Remarks({ value, preview = false }) {
    const points = transactionRemarkPoints(value);
    if (!points.length) return <p className="text-sm text-gray-500 dark:text-gh-muted">No remarks</p>;
    const shown = preview ? points.slice(0, 3) : points;
    return <div className="space-y-1.5" data-transaction-remarks>
        <ul className="space-y-1 text-[11px] font-medium leading-5 text-gray-600 dark:text-gh-muted">
            {shown.map((point, index) => <li key={`${point}-${index}`} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" /><span>{point}</span></li>)}
        </ul>
        {preview && points.length > shown.length && <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">+ {points.length - shown.length} more details</p>}
    </div>;
}

export default function MobileTransactionHistory({ projectId, transactions = [], loading, error, onRetry, parties = [], resources = [] }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);
    const partyName = (id) => parties.find((party) => String(party.pv_id) === String(id))?.name || `Party #${id}`;
    const resourceName = (id) => resources.find((resource) => String(resource.project_resource_id) === String(id))?.name || `Material #${id}`;
    useEffect(() => { setSelected(null); setQuery(''); }, [projectId]);
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return transactions;
        return transactions.filter((transaction) => [transaction.id, transaction.txn_type, transaction.status, ...transactionRemarkPoints(transaction.remarks), transaction.txn_date, ...(transaction.lines || []).flatMap((line) => [partyName(line.party_id), resourceName(line.project_resource_id), line.role, line.signed_qty])].join(' ').toLowerCase().includes(needle));
    }, [query, resources, parties, transactions]);

    if (loading) return <div className="w-full min-w-0 px-2 sm:px-3 pb-24"><MobileLoadingState rows={4} /></div>;
    if (error && !transactions.length) return <div className="w-full min-w-0 px-2 sm:px-3 pb-24"><MobileEmptyState title="Transaction history unavailable" description={error?.status === 403 || error?.response?.status === 403 ? 'Access denied by the current ERP permission policy.' : error?.message || 'Transaction history could not be loaded.'} action={<button type="button" onClick={onRetry} className="min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700">Try again</button>} /></div>;
    return <div data-m8-view="history" className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
        {error && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-xs font-normal text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">Some transaction data may be unavailable. Existing history is still shown.</p>}
        <MobileSearchBar value={query} onChange={setQuery} placeholder="Search transaction history" />
        {visible.length ? visible.map((transaction) => {
            const lines = transaction.lines || [];
            const first = lines[0];
            const source = lines.find((line) => Number(line.signed_qty) < 0);
            const destination = lines.find((line) => Number(line.signed_qty) > 0);
            return <button key={transaction.id} type="button" onClick={() => setSelected(transaction)} className="w-full text-left"><MobileCard><div className="flex items-start justify-between gap-2.5"><div className="min-w-0"><p className="text-[10px] font-normal uppercase tracking-wider text-blue-600 dark:text-blue-300">{transaction.txn_type || 'Transaction'} · #{transaction.id}</p><p className="mt-0.5 text-xs font-semibold leading-5 text-gray-950 dark:text-gh-text">{first ? `${resourceName(first.project_resource_id)}${lines.length > 1 ? ` + ${lines.length - 1} more` : ''}` : 'No ledger lines'}</p></div><span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-700 dark:bg-gh-hover dark:text-gh-text">{transaction.status || 'CONFIRMED'}</span></div><p className="mt-1 text-xs font-normal leading-4 text-gray-600 dark:text-gh-muted">{source ? partyName(source.party_id) : '—'} → {destination ? partyName(destination.party_id) : '—'} · {dateLabel(transaction.txn_date)}</p><div className="mt-2 border-t border-gray-100 pt-2 dark:border-gh-border"><p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-500 dark:text-gh-muted">Remarks</p><Remarks value={transaction.remarks} preview /></div></MobileCard></button>;
        }) : <MobileEmptyState title={query ? 'No matching transactions' : 'No transactions yet'} description={query ? 'Try another search.' : 'Confirmed project transactions will appear here.'} />}
        <MobileBottomSheet open={Boolean(selected)} onClose={() => setSelected(null)} title={`Transaction #${selected?.id || ''}`} description="Read-only transaction detail">
            <dl className="space-y-2 text-xs"><div><dt className="text-xs font-medium text-gray-500">Date</dt><dd className="mt-0.5 font-normal">{dateLabel(selected?.txn_date)}</dd></div><div><dt className="text-xs font-medium text-gray-500">Type</dt><dd className="mt-0.5 font-normal">{selected?.txn_type || '—'}</dd></div><div><dt className="text-xs font-medium text-gray-500">Status</dt><dd className="mt-0.5 font-normal">{selected?.status || '—'}</dd></div><div className="rounded-lg border border-gray-200 p-2.5 dark:border-gh-border"><dt className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Remarks</dt><dd><Remarks value={selected?.remarks} /></dd></div></dl><div className="mt-4 space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Ledger lines</p>{(selected?.lines || []).map((line, index) => <div key={`${line.id || index}-${line.party_id}-${line.project_resource_id}`} className="rounded-lg border border-gray-200 p-2.5 text-xs dark:border-gh-border"><p className={`font-semibold ${Number(line.signed_qty) < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{quantity(line)} {line.uom_code || line.unit_code || line.uom || ''}</p><p className="mt-0.5 text-xs font-medium">{resourceName(line.project_resource_id)}</p><p className="mt-0.5 text-[11px] font-normal text-gray-600 dark:text-gh-muted">{partyName(line.party_id)} · {line.role || 'No role'}</p></div>)}</div>
        </MobileBottomSheet>
    </div>;
}
