import React, { useEffect, useMemo, useState } from 'react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileFormSection from '../../components/MobileFormSection';
import { AssignmentFields } from '../../../pages/Admin/ReferenceManager';
import MobileSelect from '../../components/MobileSelect';
import MobilePermissionTree from './MobilePermissionTree';
import { defaultSystemPermissions } from './mobileAdminModel';

const EMPTY = { name: '', email: '', phone_no: '', dept_id: '', desg_id: '', user_type: 'employee', password: '', system_permissions: defaultSystemPermissions() };
export default function MobileEmployeeEditor({ open, onClose, employee, templates = [], onSave, pending }) {
    const [step, setStep] = useState(0); const [form, setForm] = useState(EMPTY); const [error, setError] = useState('');
    useEffect(() => { if (!open) return; setStep(0); setError(''); setForm(employee ? { ...EMPTY, ...employee, phone_no: employee.phone, dept_id: employee.departmentId, desg_id: employee.designationId, user_type: employee.role, system_permissions: employee.systemPermissions } : { ...EMPTY, system_permissions: defaultSystemPermissions() }); }, [employee, open]);
    const steps = ['Account', 'System Access', 'Review'];
    const title = employee ? 'Edit employee access' : 'Create employee';
    const validAccount = useMemo(() => form.name.trim() && form.email.trim() && (employee || (form.password && form.phone_no?.trim())), [employee, form]);
    const submit = async () => { if (!validAccount) { setError(employee ? 'Enter a name and email.' : 'Enter a name, email, mobile number, and password.'); setStep(0); return; } const result = await onSave?.(form); if (result?.success) onClose?.(); };
    const field = (id, label, type = 'text', required = false) => <label className="block text-xs font-medium" htmlFor={id}>{label}<input id={id} type={type} required={required} value={form[id] || ''} onChange={(event) => setForm((state) => ({ ...state, [id]: event.target.value }))} className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-normal outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input" /></label>;
    const footer = <div className="flex gap-2"><button type="button" disabled={pending} onClick={() => step === 0 ? onClose?.() : setStep((value) => value - 1)} className="min-h-9 flex-1 rounded-lg border border-gray-200 px-3 text-xs font-semibold dark:border-gh-border">{step === 0 ? 'Cancel' : 'Back'}</button><button type="button" disabled={pending} onClick={() => step === 2 ? submit() : setStep((value) => value + 1)} className="min-h-9 flex-1 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{step === 2 ? (pending ? 'Saving…' : 'Save Employee') : 'Continue'}</button></div>;
    return <MobileBottomSheet open={open} onClose={onClose} closeDisabled={pending} title={title} description={`Step ${step + 1} of 3 · ${steps[step]}`} footer={footer}>
        <div data-mobile-employee-editor>{error && <p role="alert" className="mb-2.5 rounded-lg bg-red-50 p-2.5 text-xs font-normal text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
            {step === 0 && <MobileFormSection title="Account" description="Direct creation requires an explicit password."><MobileSelect label="Account type" value={form.user_type} onChange={(event) => setForm((state) => ({ ...state, user_type: event.target.value }))} options={[{ value: 'employee', label: 'Employee' }, { value: 'admin', label: 'Admin' }]} />{field('name', 'Name', 'text', true)}{field('email', 'Email Address', 'email', true)}{field('phone_no', employee ? 'Mobile number' : 'Mobile number *', 'tel', !employee)}<AssignmentFields value={form} onChange={(key, value) => setForm(prev => ({ ...prev, [key]: value }))} />{field('password', employee ? 'New password (optional)' : 'Password', 'password', !employee)}</MobileFormSection>}
            {step === 1 && <div className="space-y-2">{templates.length > 0 && <MobileSelect label="Prefill from template" value="" onChange={(event) => { const template = templates.find((item) => String(item.id) === event.target.value); if (template) setForm((state) => ({ ...state, system_permissions: defaultSystemPermissions(template.permissions || template.system_permissions) })); }} options={[{ value: '', label: 'Choose a template (optional)' }, ...templates.map((item) => ({ value: String(item.id), label: item.name }))]} />}<MobilePermissionTree value={form.system_permissions} onChange={(system_permissions) => setForm((state) => ({ ...state, system_permissions }))} /></div>}
            {step === 2 && <MobileFormSection title="Review" description="Confirm account and ERP page access before saving."><p className="text-xs font-normal text-gray-700 dark:text-gh-muted"><strong className="font-semibold text-gray-900 dark:text-gh-text">{form.name}</strong><br />{form.email}<br /><span className="capitalize">{form.user_type}</span></p></MobileFormSection>}
        </div>
    </MobileBottomSheet>;
}
