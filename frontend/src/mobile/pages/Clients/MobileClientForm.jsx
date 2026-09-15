import React, { useMemo, useState } from 'react';
import MobileFormSection from '../../components/MobileFormSection';
import MobileSelect from '../../components/MobileSelect';
import MobileStickyActions from '../../components/MobileStickyActions';
import { buildClientPayload, clientFormValues } from './clientModel.js';

const Field = ({ label, required, as: Component = 'input', ...props }) => <label className="block text-xs font-semibold text-gray-700 dark:text-gh-text">{label}{required && <span className="text-red-500"> *</span>}<Component required={required} className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input dark:text-gh-text" {...props} /></label>;

export default function MobileClientForm({ client, jobNatures = [], sectors = [], onSave, onCancel, pending = false }) {
    const [form, setForm] = useState(() => clientFormValues(client)); const [error, setError] = useState('');
    const options = (items, key, placeholder) => [{ value: '', label: placeholder }, ...items.map((item) => ({ value: item[key] || item.name || item, label: item[key] || item.name || item }))];
    const jobOptions = useMemo(() => options(jobNatures, 'job_name', 'Select job nature'), [jobNatures]);
    const sectorOptions = useMemo(() => options(sectors, 'sector_name', 'Select sector'), [sectors]);
    const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
    const submit = async (event) => { event.preventDefault(); setError(''); if (!form.name.trim() || !form.contact_person.trim() || !form.email.trim() || !form.contact_no.trim() || !form.address.trim()) { setError('Company name, contact person, email, contact number, and address are required.'); return; } await onSave(buildClientPayload(form)); };
    return <form onSubmit={submit} className="space-y-4" data-mobile-form="client">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <MobileFormSection title="Company"><Field label="Company name" required value={form.name} onChange={change('name')} /><MobileSelect label="Nature of job" value={form.job_nature} onChange={change('job_nature')} options={jobOptions} /><MobileSelect label="Sector" value={form.sector} onChange={change('sector')} options={sectorOptions} /><Field label="Location" value={form.location} onChange={change('location')} /><Field label="Address" required as="textarea" rows={3} value={form.address} onChange={change('address')} /></MobileFormSection>
        <MobileFormSection title="Contact"><Field label="Contact person" required value={form.contact_person} onChange={change('contact_person')} /><Field label="Designation" value={form.designation} onChange={change('designation')} /><Field label="Email" required type="email" value={form.email} onChange={change('email')} /><Field label="Contact number" required value={form.contact_no} onChange={change('contact_no')} /><Field label="Website" value={form.website} onChange={change('website')} /></MobileFormSection>
        <MobileFormSection title="Relationship"><Field label="Responsibility" value={form.responsibility} onChange={change('responsibility')} /><Field label="Reference" value={form.reference} onChange={change('reference')} /><Field label="Remarks" as="textarea" rows={3} value={form.remarks} onChange={change('remarks')} /></MobileFormSection>
        <MobileStickyActions><button type="button" disabled={pending} onClick={onCancel} className="min-h-11 flex-1 rounded-xl border border-gray-200 text-sm font-bold dark:border-gh-border">Cancel</button><button disabled={pending} className="min-h-11 flex-[1.3] rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : client ? 'Save client' : 'Create client'}</button></MobileStickyActions>
    </form>;
}
