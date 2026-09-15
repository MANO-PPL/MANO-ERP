import React, { useMemo, useState } from 'react';
import MobileFormSection from '../../components/MobileFormSection';
import MobileSelect from '../../components/MobileSelect';
import MobileStickyActions from '../../components/MobileStickyActions';
import { buildVendorPayload, vendorFormValues, VENDOR_CATEGORIES } from './vendorModel.js';

const Field = ({ label, required, as: Component = 'input', ...props }) => <label className="block text-xs font-semibold text-gray-700 dark:text-gh-text">{label}{required && <span className="text-red-500"> *</span>}<Component required={required} className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input dark:text-gh-text" {...props} /></label>;

export default function MobileVendorForm({ vendor, jobNatures = [], onSave, onCancel, pending = false }) {
    const [form, setForm] = useState(() => vendorFormValues(vendor));
    const [error, setError] = useState('');
    const jobOptions = useMemo(() => [{ value: '', label: 'Select job nature' }, ...jobNatures.map((item) => ({ value: item.job_name || item.name || item, label: item.job_name || item.name || item }))], [jobNatures]);
    const change = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
    const submit = async (event) => {
        event.preventDefault(); setError('');
        if (!form.name.trim() || !form.email.trim() || !form.contact_no.trim() || !form.address.trim()) { setError('Company name, email, contact number, and address are required.'); return; }
        await onSave(buildVendorPayload(form));
    };
    return <form onSubmit={submit} className="space-y-4" data-mobile-form="vendor">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        <MobileFormSection title="Company"><Field label="Company name" required value={form.name} onChange={change('name')} /><MobileSelect label="Category" value={form.category} onChange={change('category')} options={[{ value: '', label: 'Select category' }, ...VENDOR_CATEGORIES.map((item) => ({ value: item, label: item }))]} /><MobileSelect label="Nature of job" value={form.job_nature} onChange={change('job_nature')} options={jobOptions} /><Field label="Location" value={form.location} onChange={change('location')} /><Field label="Address" required as="textarea" rows={3} value={form.address} onChange={change('address')} /></MobileFormSection>
        <MobileFormSection title="Contact"><Field label="Contact person" value={form.contact_person} onChange={change('contact_person')} /><Field label="Designation" value={form.designation} onChange={change('designation')} /><Field label="Email" required type="email" value={form.email} onChange={change('email')} /><Field label="Contact number" required value={form.contact_no} onChange={change('contact_no')} /><Field label="Mobile" value={form.mobile} onChange={change('mobile')} /><Field label="Website" value={form.website} onChange={change('website')} /></MobileFormSection>
        <MobileFormSection title="Commercial details"><Field label="GST number" value={form.gst_no} onChange={change('gst_no')} /><Field label="Responsibility" value={form.responsibility} onChange={change('responsibility')} /><Field label="Reference" value={form.reference} onChange={change('reference')} /><Field label="Remarks" as="textarea" rows={3} value={form.remarks} onChange={change('remarks')} /></MobileFormSection>
        <MobileStickyActions><button type="button" disabled={pending} onClick={onCancel} className="min-h-11 flex-1 rounded-xl border border-gray-200 text-sm font-bold dark:border-gh-border">Cancel</button><button type="submit" disabled={pending} className="min-h-11 flex-[1.3] rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : vendor ? 'Save vendor' : 'Create vendor'}</button></MobileStickyActions>
    </form>;
}
