import React, { useEffect, useState } from 'react';
import MobileBottomSheet from '../../../components/MobileBottomSheet';

export default function MobileDrawingUploadSheet({ open, onClose, drawing, onSubmit, pending = false }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    useEffect(() => {
        if (!open) return;
        setTitle(drawing?.title || '');
        setDescription('');
        setFile(null);
    }, [drawing, open]);
    const valid = Boolean((drawing || title.trim()) && file);
    const footer = <div className="flex gap-2"><button type="button" disabled={pending} onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-gray-200 text-sm font-semibold dark:border-gh-border">Cancel</button><button type="button" disabled={pending || !valid} onClick={() => onSubmit?.({ title: drawing?.title || title.trim(), description: description.trim(), drawingGroupId: drawing?.id, file })} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">{pending ? 'Uploading…' : drawing ? 'Upload revision' : 'Create drawing'}</button></div>;
    return <MobileBottomSheet open={open} onClose={pending ? undefined : onClose} closeDisabled={pending} title={drawing ? `Upload revision · ${drawing.title}` : 'New drawing'} description="DWG, DXF, and PDF use the existing drawing upload contract." footer={footer}>
        <div className="space-y-4">
            {!drawing && <div><label htmlFor="mobile-drawing-title" className="mb-1 block text-xs font-bold">Drawing title</label><input id="mobile-drawing-title" value={title} onChange={(event) => setTitle(event.target.value)} className="min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm dark:border-gh-border dark:bg-gh-input" /></div>}
            <div><label htmlFor="mobile-drawing-description" className="mb-1 block text-xs font-bold">Remarks</label><textarea id="mobile-drawing-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gh-border dark:bg-gh-input" /></div>
            <div><label htmlFor="mobile-drawing-file" className="mb-1 block text-xs font-bold">Drawing file</label><input id="mobile-drawing-file" type="file" accept=".dwg,.dxf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} className="min-h-11 w-full rounded-xl border border-gray-200 p-2 text-xs dark:border-gh-border dark:bg-gh-input" />{file && <p className="mt-1 text-xs text-gray-500">Selected: {file.name}</p>}</div>
        </div>
    </MobileBottomSheet>;
}
