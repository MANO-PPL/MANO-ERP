import React, { useMemo, useState } from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileCard from '../../components/MobileCard';
import MobileDatePicker from '../../components/MobileDatePicker';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileSelect from '../../components/MobileSelect';
import { buildInteractionPayload, CLIENT_INTERACTION_TYPES } from './clientModel.js';

const today = () => new Date().toISOString().slice(0, 10);

export default function MobileClientDetail({ client, open, onClose, canWrite, onEdit, onDelete, onAddInteraction, pending = false }) {
    const [typeFilter, setTypeFilter] = useState('All'); const [logging, setLogging] = useState(false); const [error, setError] = useState('');
    const [form, setForm] = useState({ type: 'Call', interaction_date: today(), follow_up_date: '', remarks: '' });
    const history = useMemo(() => (client?.interactions || []).filter((item) => typeFilter === 'All' || String(item.type).toLowerCase() === typeFilter.toLowerCase()), [client, typeFilter]);
    if (!client) return null;
    const submit = async (event) => { event.preventDefault(); setError(''); const success = await onAddInteraction(buildInteractionPayload(form)); if (success) { setLogging(false); setForm({ type: 'Call', interaction_date: today(), follow_up_date: '', remarks: '' }); } else setError('The interaction was not saved.'); };
    return <MobileBottomSheet open={open} onClose={onClose} title={client.name} description={client.sector || 'Client'} footer={canWrite && <div className="flex gap-2"><button onClick={() => onDelete(client)} className="min-h-11 flex-1 rounded-xl border border-red-200 text-sm font-bold text-red-600">Delete</button><button onClick={() => onEdit(client)} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white">Edit</button></div>}>
        <div className="space-y-3" data-mobile-detail="client">
            <MobileCard className="space-y-2 p-3">{client.contactNumber && <a className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-600" href={`tel:${client.contactNumber}`}><Phone size={17} />{client.contactNumber}</a>}{client.email && <a className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-600" href={`mailto:${client.email}`}><Mail size={17} />{client.email}</a>}{client.location && <p className="flex items-center gap-2 text-sm"><MapPin size={17} />{client.location}</p>}</MobileCard>
            <MobileCard className="grid grid-cols-2 gap-3 p-3">{[['Job nature', client.jobNature], ['Sector', client.sector], ['Contact', client.contact_person], ['Designation', client.designation], ['Responsibility', client.responsibility], ['Reference', client.reference]].map(([label, value]) => <div key={label}><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className="mt-1 break-words text-sm">{value || '-'}</p></div>)}</MobileCard>
            <MobileCard><div className="flex items-center gap-2"><h3 className="min-w-0 flex-1 text-sm font-black">Interactions</h3>{canWrite && <button onClick={() => setLogging((value) => !value)} className="min-h-11 px-2 text-xs font-bold text-blue-600">{logging ? 'Cancel' : 'Log interaction'}</button>}</div>
                {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
                {logging && canWrite && <form onSubmit={submit} className="mt-3 space-y-3 rounded-xl bg-gray-50 p-3 dark:bg-gh-bg"><MobileSelect label="Type" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} options={CLIENT_INTERACTION_TYPES.map((item) => ({ value: item, label: item }))} /><MobileDatePicker label="Interaction date" required value={form.interaction_date} onChange={(event) => setForm((current) => ({ ...current, interaction_date: event.target.value }))} /><MobileDatePicker label="Follow-up date" value={form.follow_up_date} onChange={(event) => setForm((current) => ({ ...current, follow_up_date: event.target.value }))} /><label className="block text-xs font-semibold">Remarks<textarea value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} className="mt-1 min-h-20 w-full rounded-xl border border-gray-200 bg-white p-3 dark:border-gh-border dark:bg-gh-input" /></label><button disabled={pending} className="min-h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save interaction'}</button></form>}
                <div className="mt-3"><MobileSelect label="History type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} options={['All', ...CLIENT_INTERACTION_TYPES].map((item) => ({ value: item, label: item }))} /></div>
                <div className="mt-3 space-y-2">{history.length === 0 ? <MobileEmptyState title="No interactions found" /> : history.map((item, index) => <div key={item.id || index} className="rounded-xl border border-gray-100 p-3 dark:border-gh-border"><div className="flex justify-between gap-2"><span className="text-xs font-black text-blue-600">{item.type}</span><span className="text-xs text-gray-500">{item.interaction_date ? new Date(item.interaction_date).toLocaleDateString() : '-'}</span></div><p className="mt-2 text-sm">{item.remarks || 'No remarks recorded.'}</p>{item.follow_up_date && <p className="mt-2 text-xs text-gray-500">Follow up: {new Date(item.follow_up_date).toLocaleDateString()}</p>}</div>)}</div>
            </MobileCard>
        </div>
    </MobileBottomSheet>;
}
