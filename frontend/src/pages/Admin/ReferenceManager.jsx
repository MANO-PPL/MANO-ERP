import React, { useEffect, useState } from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import CustomSelect from '../../components/CustomSelect';

const lists = [
    { key: 'departments', label: 'Department', name: 'dept_name', field: 'dept_id' },
    { key: 'designations', label: 'Designation', name: 'desg_name', field: 'desg_id' },
];
const control = 'rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gh-border dark:bg-gh-input';

export function AssignmentFields({ value, onChange }) {
    const [choices, setChoices] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        Promise.all(lists.map(list => adminApi.listReference(list.key))).then(results => {
            if (active) setChoices(results);
        }).catch(() => { if (active) setError('Could not load departments and designations. Reopen the form to retry.'); });
        return () => { active = false; };
    }, []);
    return <div className="grid gap-3 sm:grid-cols-2">
        {lists.map((list, index) => {
            const options = [
                { value: '', label: 'Unassigned' },
                ...(choices?.[index] || []).map(item => ({
                    value: String(item.id),
                    label: item[list.name]
                }))
            ];
            return (
                <div key={list.key} className="grid gap-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {list.label}
                    </label>
                    <CustomSelect
                        value={value[list.field] != null && value[list.field] !== '' ? String(value[list.field]) : ''}
                        disabled={!choices}
                        placeholder={choices ? 'Select ' + list.label : 'Loading…'}
                        options={options}
                        onChange={e => onChange(list.field, e.target.value)}
                        buttonClassName="h-[38px] w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gh-input border border-gray-300 dark:border-gh-border rounded-lg text-sm text-slate-700 dark:text-slate-200 transition-all cursor-pointer text-left"
                    />
                </div>
            );
        })}
        {error && <p role="alert" className="text-xs text-rose-500 sm:col-span-2">{error}</p>}
    </div>;
}

export function ReferenceManager({ onClose, onChanged }) {
    const [list, setList] = useState(lists[0]);
    const [rows, setRows] = useState(null);
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState(null);
    const [removing, setRemoving] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        setRows(null);
        adminApi.listReference(list.key).then(items => { if (active) setRows(items); })
            .catch(() => { if (active) setError('Could not load the list.'); });
        return () => { active = false; };
    }, [list, revision]);
    const reset = () => { setEditing(null); setRemoving(null); setDraft(''); setError(''); };
    const save = async event => {
        event.preventDefault();
        if (busy || !rows || (!removing && !draft.trim())) return;
        setBusy(true);
        setError('');
        try {
            if (removing) {
                await adminApi.deleteReference(list.key, removing.id);
            } else {
                const name = draft.trim();
                if (rows.some(row => row.id !== editing?.id && row[list.name].toLowerCase() === name.toLowerCase())) {
                    throw Error('That name already exists.');
                }
                const data = { [list.name]: name };
                if (editing) await adminApi.renameReference(list.key, editing.id, data);
                else await adminApi.createReference(list.key, data);
            }
            reset();
            setRevision(n => n + 1);
            await onChanged();
        } catch (err) {
            const message = err.response?.data?.message || err.message;
            setError(message);
        } finally { setBusy(false); }
    };
    return <div className="fixed inset-0 z-[5000] flex justify-end bg-black/40" onClick={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
        <section role="dialog" aria-modal="true" aria-label="Departments and designations" className="flex h-full w-full max-w-xl flex-col gap-4 overflow-y-auto border-l border-gray-200 bg-white p-5 shadow-2xl dark:border-gh-border dark:bg-gh-subtle motion-safe:animate-in motion-safe:slide-in-from-right motion-safe:duration-300">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gh-border"><h2 className="font-semibold">Departments &amp; Designations</h2><button disabled={busy} onClick={onClose}>Close</button></div>
            <div className="flex gap-2">{lists.map(item => <button disabled={busy} key={item.key} aria-pressed={list === item} className={control + (list === item ? ' font-bold text-indigo-600' : '')} onClick={() => { reset(); setList(item); }}>{item.label}s</button>)}</div>
            <form onSubmit={save} className={removing ? "grid gap-2 rounded-2xl border border-gray-200 p-4 dark:border-gh-border" : "grid gap-2"}>
                {removing ? <p>Delete {removing[list.name]}?</p> : <label className="grid gap-1 text-sm">{editing ? 'New name for ' + editing[list.name] : list.label + ' name'}
                    <input required disabled={busy} className={control} value={draft} onChange={e => setDraft(e.target.value)} /></label>}
                <div className="flex gap-2"><button disabled={busy || !rows} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{busy ? 'Saving…' : removing ? 'Confirm deletion' : editing ? 'Update' : 'Create'}</button>
                {(editing || removing) && <button type="button" disabled={busy} onClick={reset}>Cancel</button>}</div>
            </form>
            {error && <p role="alert" className="text-sm text-red-600">{error} {!rows && <button onClick={() => { setError(''); setRevision(n => n + 1); }}>Retry</button>}</p>}
            <ul className="overflow-auto divide-y">{rows?.map(row => <li key={row.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="mr-auto">{row[list.name]}</span>
                <button type="button" aria-label={`Edit ${list.label.toLowerCase()} ${row[list.name]}`} title="Edit" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-gh-hover hover:text-indigo-600" disabled={busy} onClick={() => { reset(); setEditing(row); setDraft(row[list.name]); }}><Edit3 size={16} aria-hidden="true" /></button>
                <button type="button" aria-label={`Delete ${list.label.toLowerCase()} ${row[list.name]}`} title="Delete" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-gh-hover hover:text-red-600" disabled={busy} onClick={() => { reset(); setRemoving(row); }}><Trash2 size={16} aria-hidden="true" /></button>
            </li>)}</ul>
        </section>
    </div>;
}
