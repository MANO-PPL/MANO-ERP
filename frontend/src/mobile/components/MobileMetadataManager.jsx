import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api.js';
import MobileBottomSheet from './MobileBottomSheet';
import MobileConfirmModal from './MobileConfirmModal';
import MobileEmptyState from './MobileEmptyState';
import MobileSearchBar from './MobileSearchBar';

const CONFIG = {
    job_natures: { endpoint: '/admin/job-natures', listKey: 'job_natures', nameKey: 'job_name', title: 'Job natures' },
    sectors: { endpoint: '/admin/sectors', listKey: 'sectors', nameKey: 'sector_name', title: 'Sectors' },
};

export default function MobileMetadataManager({ open, onClose, type, isAdmin, service = api, onChanged }) {
    const config = CONFIG[type];
    const [items, setItems] = useState([]);
    const [query, setQuery] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [removeItem, setRemoveItem] = useState(null);
    const filtered = useMemo(() => items.filter((item) => String(item[config?.nameKey] || '').toLowerCase().includes(query.toLowerCase())), [config, items, query]);

    const load = async () => {
        if (!config) return;
        setPending(true); setError('');
        try {
            const response = await service.get(config.endpoint);
            const data = response?.data || response;
            setItems(Array.isArray(data?.[config.listKey]) ? data[config.listKey] : []);
        } catch (nextError) { setError(nextError?.response?.data?.message || 'Metadata could not be loaded.'); }
        finally { setPending(false); }
    };
    useEffect(() => { if (open) load(); }, [open, type]);

    const add = async (event) => {
        event.preventDefault();
        if (!isAdmin || !name.trim()) return;
        setPending(true); setError('');
        try { await service.post(config.endpoint, { [config.nameKey]: name.trim() }); setName(''); await load(); onChanged?.(); }
        catch (nextError) { setError(nextError?.response?.data?.message || 'Metadata could not be added.'); setPending(false); }
    };
    const remove = async () => {
        if (!isAdmin || !removeItem) return;
        setPending(true); setError('');
        try { await service.delete(`${config.endpoint}/${removeItem.id}`); setRemoveItem(null); await load(); onChanged?.(); }
        catch (nextError) { setError(nextError?.response?.data?.message || 'Metadata could not be deleted.'); setPending(false); setRemoveItem(null); }
    };

    return (
        <>
            <MobileBottomSheet open={open} onClose={onClose} title={config?.title || 'Metadata'} description={isAdmin ? 'Organization reference data' : 'Reference data is managed by administrators'}>
                <div className="space-y-3">
                    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
                    {isAdmin && <form onSubmit={add} className="flex gap-2"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={`Add ${config?.title.toLowerCase()}`} className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-gh-border dark:bg-gh-bg" /><button disabled={pending} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50">Add</button></form>}
                    <MobileSearchBar value={query} onChange={setQuery} placeholder={`Search ${config?.title.toLowerCase()}`} />
                    {pending && items.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Loading…</p> : filtered.length === 0 ? <MobileEmptyState title={`No ${config?.title.toLowerCase()} found`} /> : <div className="divide-y divide-gray-100 dark:divide-gh-border">{filtered.map((item) => <div key={item.id} className="flex min-h-12 items-center gap-2"><span className="min-w-0 flex-1 truncate text-sm font-semibold">{item[config.nameKey]}</span>{isAdmin && <button type="button" onClick={() => setRemoveItem(item)} className="min-h-11 px-3 text-xs font-bold text-red-600">Delete</button>}</div>)}</div>}
                </div>
            </MobileBottomSheet>
            <MobileConfirmModal open={Boolean(removeItem)} onClose={() => setRemoveItem(null)} onConfirm={remove} pending={pending} danger title={`Delete ${removeItem?.[config?.nameKey] || 'item'}?`} message="Existing records may still refer to this metadata. The ERP server will reject deletion when it is not allowed." confirmLabel="Delete" />
        </>
    );
}
