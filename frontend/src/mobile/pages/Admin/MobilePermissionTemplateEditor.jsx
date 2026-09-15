import React, { useEffect, useState } from 'react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobilePermissionTree from './MobilePermissionTree';
import { defaultSystemPermissions } from './mobileAdminModel';

export default function MobilePermissionTemplateEditor({ open, onClose, template, onSave, pending }) {
    const [name, setName] = useState(''); const [permissions, setPermissions] = useState(defaultSystemPermissions());
    useEffect(() => { if (open) { setName(template?.name || ''); setPermissions(defaultSystemPermissions(template?.permissions || template?.system_permissions)); } }, [open, template]);
    const preset = (level) => setPermissions(Object.fromEntries(Object.keys(defaultSystemPermissions()).map((key) => [key, level])));
    const save = async () => { if (!name.trim()) return; const result = await onSave?.({ id: template?.id, name, permissions }); if (result?.success) onClose?.(); };
    return <MobileBottomSheet open={open} onClose={onClose} closeDisabled={pending} title={template ? 'Edit permission template' : 'Create permission template'} description="System template using the current ERP permission keys" footer={<div className="flex gap-2"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-gray-200 font-bold dark:border-gh-border">Cancel</button><button type="button" disabled={pending || !name.trim()} onClick={save} className="min-h-11 flex-1 rounded-xl bg-blue-600 font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save Template'}</button></div>}>
        <div className="space-y-4" data-mobile-template-editor><label htmlFor="mobile-template-name" className="block text-xs font-semibold">Template name<input id="mobile-template-name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-gh-border dark:bg-gh-input" /></label><div className="grid grid-cols-3 gap-1"><button type="button" onClick={() => preset(2)} className="min-h-11 rounded-xl bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Grant All Write</button><button type="button" onClick={() => preset(1)} className="min-h-11 rounded-xl bg-gray-100 text-xs font-bold dark:bg-gh-hover">Grant All Read</button><button type="button" onClick={() => preset(0)} className="min-h-11 rounded-xl bg-gray-100 text-xs font-bold dark:bg-gh-hover">Clear All</button></div><MobilePermissionTree value={permissions} onChange={setPermissions} /></div>
    </MobileBottomSheet>;
}
