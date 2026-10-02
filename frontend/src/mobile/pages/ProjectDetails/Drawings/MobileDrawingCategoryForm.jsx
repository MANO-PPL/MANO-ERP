import React, { useEffect, useState } from 'react';
import {
    Folder, PenTool, Layers, Droplets, Zap, Flame, Building2, Wrench, Construction, Ruler, Lightbulb, Shield
} from 'lucide-react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';

const ICON_OPTIONS = [
    { key: 'Folder', label: 'General', Icon: Folder },
    { key: 'PenTool', label: 'Drafting', Icon: PenTool },
    { key: 'Layers', label: 'Layers', Icon: Layers },
    { key: 'Droplets', label: 'Plumbing', Icon: Droplets },
    { key: 'Zap', label: 'Electrical', Icon: Zap },
    { key: 'Flame', label: 'Fire Safety', Icon: Flame },
    { key: 'Building2', label: 'Structural', Icon: Building2 },
    { key: 'Wrench', label: 'Mechanical', Icon: Wrench },
    { key: 'Construction', label: 'Civil', Icon: Construction },
    { key: 'Ruler', label: 'Architectural', Icon: Ruler },
    { key: 'Lightbulb', label: 'Lighting', Icon: Lightbulb },
    { key: 'Shield', label: 'Security', Icon: Shield },
];

export default function MobileDrawingCategoryForm({ open, onClose, category, onSubmit, pending = false }) {
    const [name, setName] = useState('');
    const [iconKey, setIconKey] = useState('Folder');
    useEffect(() => {
        if (!open) return;
        setName(category?.name || '');
        setIconKey(category?.icon_key || category?.iconKey || 'Folder');
    }, [category, open]);

    const footer = <div className="flex gap-2"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-gray-200 text-sm font-semibold dark:border-gh-border">Cancel</button><button type="button" disabled={pending || !name.trim()} onClick={() => onSubmit?.({ name: name.trim(), icon_key: iconKey })} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Saving…' : category ? 'Save changes' : 'Create category'}</button></div>;
    return <MobileBottomSheet open={open} onClose={pending ? undefined : onClose} closeDisabled={pending} title={category ? 'Edit drawing category' : 'New drawing category'} footer={footer}>
        <div className="space-y-4">
            <div><label htmlFor="mobile-drawing-category-name" className="mb-1 block text-xs font-bold text-gray-600 dark:text-gh-muted">Category name</label><input id="mobile-drawing-category-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-blue-500 dark:border-gh-border dark:bg-gh-input" /></div>
            <fieldset><legend className="mb-2 text-xs font-bold text-gray-600 dark:text-gh-muted">Category icon</legend><div className="grid grid-cols-3 gap-2">{ICON_OPTIONS.map(({ key, label, Icon }) => <button key={key} type="button" onClick={() => setIconKey(key)} className={`flex min-h-12 flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${iconKey === key ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-500/20 dark:bg-blue-950/40 dark:text-blue-300' : 'border-gray-200 text-gray-700 hover:border-gray-300 dark:border-gh-border dark:text-gh-text'}`}><Icon size={18} className="mb-1 shrink-0" /><span className="text-[10px] font-semibold leading-tight">{label}</span></button>)}</div></fieldset>
        </div>
    </MobileBottomSheet>;
}
