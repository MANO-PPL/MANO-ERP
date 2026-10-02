import React, { useMemo, useState } from 'react';
import { Building2, MoreVertical, Plus, SlidersHorizontal, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import vendorApi from '../../../services/vendorApi.js';
import { customToast } from '../../../utils/toast';
import MobileBottomSheet, { MobileActionSheet } from '../../components/MobileBottomSheet';
import MobileCard from '../../components/MobileCard';
import MobileConfirmModal from '../../components/MobileConfirmModal';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileFAB from '../../components/MobileFAB';
import MobileFilterSheet from '../../components/MobileFilterSheet';
import MobileLoadingState from '../../components/MobileLoadingState';
import MobileMetadataManager from '../../components/MobileMetadataManager';
import MobilePageHeader from '../../components/MobilePageHeader';
import MobileSearchBar from '../../components/MobileSearchBar';
import useMobileVendors from '../../hooks/useMobileVendors.js';
import MobileVendorDetail from './MobileVendorDetail';
import MobileVendorForm from './MobileVendorForm';
import { filterVendors, normalizeVendor, VENDOR_CATEGORIES } from './vendorModel.js';

const Choices = ({ values, selected, onChange }) => <div className="flex flex-wrap gap-2">{values.map((value) => <button key={value} type="button" aria-pressed={selected.includes(value)} onClick={() => onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value])} className={`min-h-11 rounded-xl border px-3 text-xs font-bold ${selected.includes(value) ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40' : 'border-gray-200 dark:border-gh-border'}`}>{value}</button>)}</div>;

export default function MobileVendors({ authOverride, service = vendorApi, loadVendors, loadJobNatures, metadataService, onNavigate }) {
    const auth = useAuth(); const activeAuth = authOverride || auth; const navigate = useNavigate();
    const { vendors: raw, jobNatures, loading, error, refresh } = useMobileVendors({ loadVendors, loadJobNatures });
    const [query, setQuery] = useState(''); const [filters, setFilters] = useState({ categories: [], jobs: [] }); const [draft, setDraft] = useState(filters);
    const [filtersOpen, setFiltersOpen] = useState(false); const [selected, setSelected] = useState(null); const [actions, setActions] = useState(null); const [editing, setEditing] = useState(undefined); const [remove, setRemove] = useState(null); const [pending, setPending] = useState(false); const [metadataOpen, setMetadataOpen] = useState(false);
    const canWrite = activeAuth.hasPermission('vendors', 2); const isAdmin = Boolean(activeAuth.isAdmin); const vendors = useMemo(() => raw.map(normalizeVendor), [raw]);
    const filtered = useMemo(() => filterVendors(vendors, { query, ...filters }), [filters, query, vendors]);
    const jobs = useMemo(() => {
        const set = new Set();
        (jobNatures || []).forEach((j) => {
            const name = typeof j === 'object' ? j?.job_name || j?.name : String(j || '');
            if (name && name.trim()) set.add(name.trim());
        });
        (raw || []).forEach((v) => {
            const name = v?.job_name || v?.job_nature;
            if (name && String(name).trim()) set.add(String(name).trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [jobNatures, raw]);
    const go = (path) => onNavigate ? onNavigate(path) : navigate(path);
    const save = async (payload) => { setPending(true); try { const result = editing ? await service.updateVendor(editing.id, payload) : await service.createVendor(payload); if (result?.success === false) throw new Error(result.message); customToast.success(editing ? 'Vendor updated' : 'Vendor created'); setEditing(undefined); await refresh(); } catch (nextError) { customToast.error(nextError?.response?.data?.message || nextError.message || 'Vendor save failed'); } finally { setPending(false); } };
    const destroy = async () => { if (!canWrite || !remove) return; setPending(true); try { await service.deleteVendor(remove.id); setRemove(null); setSelected(null); customToast.success('Vendor deleted'); await refresh(); } catch (nextError) { customToast.error(nextError?.response?.data?.message || nextError.message || 'Vendor delete failed'); } finally { setPending(false); } };

    return <div data-mobile-page="vendors" className="w-full min-w-0 space-y-2 px-2 sm:px-3 pb-24">
        <MobilePageHeader eyebrow="Directory" title="Vendors" subtitle={`${vendors.length} vendor${vendors.length === 1 ? '' : 's'}`} actions={<>{isAdmin && <button aria-label="Manage job natures" onClick={() => setMetadataOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 dark:border-gh-border dark:text-gh-muted"><SlidersHorizontal size={17} /></button>}{canWrite && <button aria-label="Vendor bulk upload" onClick={() => go('/vendors/bulk-upload')} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 dark:border-gh-border dark:text-gh-muted"><Upload size={17} /></button>}</>} />
        <div className="flex gap-2"><div className="min-w-0 flex-1"><MobileSearchBar value={query} onChange={setQuery} placeholder="Search vendors" /></div><button onClick={() => { setDraft(filters); setFiltersOpen(true); }} className="h-9 shrink-0 rounded-lg border border-gray-200 px-2.5 text-xs font-medium text-gray-700 dark:border-gh-border dark:text-gh-text">Filters</button></div>
        {loading ? <MobileLoadingState label="Loading vendors" rows={5} /> : error ? <MobileEmptyState title="Vendors unavailable" description="The vendor list could not be loaded." action={<button onClick={refresh} className="min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white">Try again</button>} /> : filtered.length === 0 ? <MobileEmptyState title="No vendors found" description="Try another search or filter." /> : <div className="space-y-2">{filtered.map((vendor) => <MobileCard key={vendor.id} className="p-0"><div className="flex items-start gap-2.5 p-2.5 sm:p-3"><button onClick={() => setSelected(vendor)} className="flex min-w-0 flex-1 items-start gap-2.5 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/50"><Building2 size={18} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-900 dark:text-gh-text">{vendor.name}</span><span className="block truncate text-xs font-normal text-gray-500 dark:text-gh-muted">{vendor.category} · {vendor.jobNature || 'No job nature'}</span><span className="mt-0.5 block truncate text-xs font-normal text-gray-400 dark:text-gh-muted">{vendor.contactNumber || vendor.email || vendor.location || 'No contact details'}</span></span></button><button aria-label={`Actions for ${vendor.name}`} onClick={() => setActions(vendor)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gh-muted dark:hover:bg-gh-hover"><MoreVertical size={18} /></button></div></MobileCard>)}</div>}
        <MobileFilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} onReset={() => setDraft({ categories: [], jobs: [] })} onApply={() => { setFilters(draft); setFiltersOpen(false); }}><div><p className="mb-2 text-xs font-semibold uppercase text-gray-500">Categories</p><Choices values={VENDOR_CATEGORIES} selected={draft.categories} onChange={(categories) => setDraft((current) => ({ ...current, categories }))} /></div><div><p className="mb-2 text-xs font-semibold uppercase text-gray-500">Job natures</p><Choices values={jobs} selected={draft.jobs} onChange={(nextJobs) => setDraft((current) => ({ ...current, jobs: nextJobs }))} /></div></MobileFilterSheet>
        <MobileActionSheet open={Boolean(actions)} onClose={() => setActions(null)} title={actions?.name} actions={actions ? [{ label: 'View details', onSelect: () => setSelected(actions) }, ...(canWrite ? [{ label: 'Edit vendor', onSelect: () => setEditing(actions) }, { label: 'Delete vendor', danger: true, onSelect: () => setRemove(actions) }] : [])] : []} />
        <MobileVendorDetail vendor={selected} open={Boolean(selected)} onClose={() => setSelected(null)} canWrite={canWrite} onEdit={(item) => { setSelected(null); setEditing(item); }} onDelete={(item) => setRemove(item)} />
        <MobileBottomSheet open={editing !== undefined} onClose={() => setEditing(undefined)} title={editing ? 'Edit vendor' : 'Create vendor'}>{editing !== undefined && <MobileVendorForm vendor={editing || null} jobNatures={jobNatures} pending={pending} onCancel={() => setEditing(undefined)} onSave={save} />}</MobileBottomSheet>
        <MobileConfirmModal open={Boolean(remove)} onClose={() => setRemove(null)} onConfirm={destroy} pending={pending} danger title={`Delete ${remove?.name || 'vendor'}?`} message="This also removes related vendor interactions according to the existing ERP contract." confirmLabel="Delete vendor" />
        <MobileMetadataManager open={metadataOpen} onClose={() => setMetadataOpen(false)} type="job_natures" isAdmin={isAdmin} service={metadataService} onChanged={refresh} />
        {canWrite && <MobileFAB label="Create vendor" icon={Plus} onClick={() => setEditing(null)} />}
    </div>;
}
