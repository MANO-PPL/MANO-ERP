import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Edit2, Eye, FileImage, Folder, MoreHorizontal, Plus, Trash2, Upload } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import MobileCard from '../../../components/MobileCard';
import MobileConfirmModal from '../../../components/MobileConfirmModal';
import MobileEmptyState from '../../../components/MobileEmptyState';
import MobileFAB from '../../../components/MobileFAB';
import MobileLoadingState from '../../../components/MobileLoadingState';
import MobileSearchBar from '../../../components/MobileSearchBar';
import MobileDrawingCategoryForm from './MobileDrawingCategoryForm';
import MobileDrawingDetail from './MobileDrawingDetail';
import MobileDrawingUploadSheet from './MobileDrawingUploadSheet';
import mobileDrawingsService from './mobileDrawingsService';
import { createDrawingsRequestGuard, drawingErrorMessage, drawingOrderPayload, drawingUploadFormData, normalizeDrawingsSearch, reorderDrawingDraft, updateDrawingsSearch } from './mobileDrawingsModel';

export default function MobileProjectDrawings({ projectId, canWrite, services = {} }) {
    const service = services.drawings || mobileDrawingsService;
    const [searchParams, setSearchParams] = useSearchParams();
    const categoryGuard = useRef(createDrawingsRequestGuard());
    const drawingGuard = useRef(createDrawingsRequestGuard());
    const activeProjectRef = useRef(String(projectId));
    activeProjectRef.current = String(projectId);
    const [categories, setCategories] = useState([]);
    const [categoriesLoaded, setCategoriesLoaded] = useState(false);
    const [drawings, setDrawings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [categoryEditor, setCategoryEditor] = useState(null);
    const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);
    const [categoryDelete, setCategoryDelete] = useState(null);
    const [categoryConsequence, setCategoryConsequence] = useState(null);
    const [uploadTarget, setUploadTarget] = useState(null);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [selectedDrawing, setSelectedDrawing] = useState(null);
    const [drawingDelete, setDrawingDelete] = useState(null);
    const [pending, setPending] = useState(false);
    const [reorderMode, setReorderMode] = useState(false);
    const [reorderDraft, setReorderDraft] = useState([]);

    const normalized = useMemo(() => normalizeDrawingsSearch(searchParams, categories, categoriesLoaded), [categories, categoriesLoaded, searchParams]);
    const category = normalized.category;

    const clearSensitiveState = useCallback(() => {
        setCategoryEditor(null); setCategoryEditorOpen(false); setCategoryDelete(null); setCategoryConsequence(null);
        setUploadTarget(null); setUploadOpen(false); setSelectedDrawing(null); setDrawingDelete(null);
        setPending(false); setReorderMode(false); setReorderDraft([]); setQuery('');
    }, []);

    const loadCategories = useCallback(async () => {
        const token = categoryGuard.current.begin(projectId);
        setLoading(true); setError(''); setCategoriesLoaded(false);
        try {
            const result = await service.listCategories(projectId);
            if (!categoryGuard.current.isCurrent(token, projectId)) return;
            if (result?.success === false) throw Object.assign(new Error(result.message || 'Drawing categories could not be loaded.'), result);
            setCategories(result?.categories || []);
        } catch (loadError) {
            if (categoryGuard.current.isCurrent(token, projectId)) { setCategories([]); setError(drawingErrorMessage(loadError, 'Drawing categories could not be loaded.')); }
        } finally {
            if (categoryGuard.current.isCurrent(token, projectId)) { setCategoriesLoaded(true); setLoading(false); }
        }
    }, [projectId, service]);

    useEffect(() => {
        clearSensitiveState(); setCategories([]); setDrawings([]); setCategoriesLoaded(false);
        loadCategories();
        return () => { categoryGuard.current.invalidate(''); drawingGuard.current.invalidate(''); };
    }, [clearSensitiveState, loadCategories, projectId]);

    useEffect(() => {
        if (!normalized.changed) return;
        setSearchParams(normalized.params, { replace: true });
    }, [normalized, setSearchParams]);

    const loadDrawings = useCallback(async (categoryId) => {
        if (!categoryId) return;
        const token = drawingGuard.current.begin(projectId, categoryId);
        setLoading(true); setError('');
        try {
            const result = await service.listDrawings(projectId, categoryId);
            if (!drawingGuard.current.isCurrent(token, projectId, categoryId)) return;
            if (result?.success === false) throw Object.assign(new Error(result.message || 'Drawings could not be loaded.'), result);
            setDrawings(result?.drawings || []);
        } catch (loadError) {
            if (drawingGuard.current.isCurrent(token, projectId, categoryId)) { setDrawings([]); setError(drawingErrorMessage(loadError, 'Drawings could not be loaded.')); }
        } finally {
            if (drawingGuard.current.isCurrent(token, projectId, categoryId)) setLoading(false);
        }
    }, [projectId, service]);

    useEffect(() => {
        setDrawings([]); setSelectedDrawing(null); setUploadOpen(false); setDrawingDelete(null); setReorderMode(false);
        if (normalized.view === 'detail' && category?.id) loadDrawings(category.id);
        else drawingGuard.current.invalidate(projectId, '');
    }, [category?.id, loadDrawings, normalized.view, projectId]);

    const isCurrent = (originProjectId) => activeProjectRef.current === String(originProjectId);
    const mutate = async (operation, afterSuccess) => {
        if (!canWrite || pending) return false;
        const originProjectId = projectId;
        setPending(true); setError('');
        try {
            const result = await operation(originProjectId);
            if (!isCurrent(originProjectId)) return false;
            if (result?.success === false && !result?.hasDrawings) throw Object.assign(new Error(result.message || 'The change was rejected.'), result);
            await afterSuccess?.(result, originProjectId);
            return true;
        } catch (mutationError) {
            if (isCurrent(originProjectId)) setError(drawingErrorMessage(mutationError, 'The drawing change could not be completed.'));
            return false;
        } finally {
            if (isCurrent(originProjectId)) setPending(false);
        }
    };

    const saveCategory = (payload) => mutate(
        (origin) => categoryEditor ? service.updateCategory(origin, categoryEditor.id, payload) : service.createCategory(origin, payload),
        async (_, origin) => { if (!isCurrent(origin)) return; setCategoryEditorOpen(false); setCategoryEditor(null); await loadCategories(); },
    );

    const firstDeleteCategory = () => mutate(
        (origin) => service.deleteCategory(origin, categoryDelete.id, false),
        async (result, origin) => {
            if (!isCurrent(origin)) return;
            setCategoryDelete(null);
            if (result?.hasDrawings) setCategoryConsequence({ category: categoryDelete, count: result.count, message: result.message });
            else await loadCategories();
        },
    );

    const confirmDeleteCategory = () => mutate(
        (origin) => service.deleteCategory(origin, categoryConsequence.category.id, true),
        async (_, origin) => { if (!isCurrent(origin)) return; setCategoryConsequence(null); await loadCategories(); },
    );

    const upload = (values) => mutate(
        (origin) => service.uploadDrawing(origin, drawingUploadFormData({ categoryId: category.id, ...values })),
        async (_, origin) => { if (!isCurrent(origin)) return; setUploadOpen(false); setUploadTarget(null); await loadDrawings(category.id); },
    );

    const updateDrawing = (values) => mutate(
        (origin) => service.updateDrawing(origin, category.id, selectedDrawing.id, values),
        async (_, origin) => { if (!isCurrent(origin)) return; setSelectedDrawing((current) => current ? { ...current, title: values.title, latestDescription: values.description } : current); await loadDrawings(category.id); },
    );

    const deleteSelectedDrawing = () => mutate(
        (origin) => service.deleteDrawing(origin, category.id, drawingDelete.id),
        async (_, origin) => { if (!isCurrent(origin)) return; setDrawingDelete(null); setSelectedDrawing(null); await loadDrawings(category.id); },
    );

    const saveOrder = () => mutate(
        (origin) => service.reorderDrawings(origin, category.id, drawingOrderPayload(reorderDraft)),
        async (_, origin) => { if (!isCurrent(origin)) return; setDrawings(reorderDraft); setReorderMode(false); await loadDrawings(category.id); },
    );

    const openCategory = (item) => setSearchParams(updateDrawingsSearch(searchParams, { view: 'detail', cat: item.id }));
    const closeCategory = () => setSearchParams(updateDrawingsSearch(searchParams, { view: 'grid', cat: null }));
    const filteredCategories = categories.filter((item) => String(item.name || '').toLowerCase().includes(query.toLowerCase()));
    const shownDrawings = (reorderMode ? reorderDraft : drawings).filter((item) => String(item.title || '').toLowerCase().includes(query.toLowerCase()));

    if (loading && !categoriesLoaded && normalized.view === 'grid') return <MobileLoadingState label="Loading drawing categories" rows={4} />;

    if (normalized.view === 'detail' && category) return <div data-mobile-project-drawings data-drawings-view="detail" className="min-w-0 space-y-4 px-4 pb-28">
        <div className="flex items-center gap-2"><button type="button" onClick={closeCategory} aria-label="Back to drawing categories" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gh-border dark:bg-gh-subtle"><ArrowLeft size={19} /></button><div className="min-w-0 flex-1"><h2 className="truncate text-base font-bold text-gray-950 dark:text-gh-text">{category.name}</h2><p className="text-xs text-gray-500 dark:text-gh-muted">{drawings.length} drawing record{drawings.length === 1 ? '' : 's'}</p></div>{canWrite && <button type="button" onClick={() => { setReorderDraft(drawings); setReorderMode((value) => !value); }} className="min-h-11 rounded-xl border border-gray-200 px-3 text-xs font-bold dark:border-gh-border">{reorderMode ? 'Cancel order' : 'Reorder'}</button>}</div>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        <MobileSearchBar value={query} onChange={setQuery} placeholder="Search drawings" />
        {reorderMode && <button type="button" disabled={pending} onClick={saveOrder} className="min-h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white disabled:opacity-50">Save drawing order</button>}
        {loading ? <MobileLoadingState label="Loading drawings" rows={3} /> : shownDrawings.length === 0 ? <MobileEmptyState icon={FileImage} title={query ? 'No matching drawings' : 'No drawings in this category'} description={canWrite ? 'Upload a DWG, DXF, or PDF to create the first drawing record.' : 'No drawing records were returned.'} /> : <div className="space-y-3">{shownDrawings.map((drawing) => { const index = reorderDraft.findIndex((item) => item.id === drawing.id); return <MobileCard key={drawing.id} className="p-4"><button type="button" onClick={() => setSelectedDrawing(drawing)} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-bold text-gray-950 dark:text-gh-text">{drawing.title}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gh-muted">R{drawing.latestRevision || 1} · {drawing.latestUploadedAt ? new Date(drawing.latestUploadedAt).toLocaleString() : 'Upload date unavailable'}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600 dark:text-gh-muted">{drawing.latestDescription || 'No remarks'}</p></div><Eye size={18} className="shrink-0 text-blue-600" /></div></button>{reorderMode && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={index <= 0} onClick={() => setReorderDraft((rows) => reorderDrawingDraft(rows, index, index - 1))} className="min-h-11 rounded-xl border border-gray-200 text-xs font-bold disabled:opacity-40 dark:border-gh-border"><ArrowUp size={16} className="mr-1 inline" />Earlier</button><button type="button" disabled={index < 0 || index >= reorderDraft.length - 1} onClick={() => setReorderDraft((rows) => reorderDrawingDraft(rows, index, index + 1))} className="min-h-11 rounded-xl border border-gray-200 text-xs font-bold disabled:opacity-40 dark:border-gh-border"><ArrowDown size={16} className="mr-1 inline" />Later</button></div>}</MobileCard>; })}</div>}
        {canWrite && <MobileFAB label="Upload drawing" icon={Upload} onClick={() => { setUploadTarget(null); setUploadOpen(true); }} />}
        <MobileDrawingDetail open={Boolean(selectedDrawing)} onClose={() => setSelectedDrawing(null)} drawing={selectedDrawing} canWrite={canWrite} pending={pending} onUpdate={updateDrawing} onDelete={() => setDrawingDelete(selectedDrawing)} onUploadRevision={() => { setUploadTarget(selectedDrawing); setSelectedDrawing(null); setUploadOpen(true); }} />
        <MobileDrawingUploadSheet open={uploadOpen} onClose={() => { setUploadOpen(false); setUploadTarget(null); }} drawing={uploadTarget} pending={pending} onSubmit={upload} />
        <MobileConfirmModal open={Boolean(drawingDelete)} onClose={() => setDrawingDelete(null)} onConfirm={deleteSelectedDrawing} title="Delete drawing" message={`Delete “${drawingDelete?.title || 'this drawing'}” and every revision file?`} confirmLabel="Delete" danger pending={pending} />
    </div>;

    return <div data-mobile-project-drawings data-drawings-view="grid" className="min-w-0 space-y-4 px-4 pb-28">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-bold text-gray-950 dark:text-gh-text">Drawings</h2><p className="mt-1 text-xs text-gray-500 dark:text-gh-muted">Categories, blueprints, and revision history.</p></div>{!canWrite && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">VIEW ONLY</span>}</div>
        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
        <MobileSearchBar value={query} onChange={setQuery} placeholder="Search drawing categories" />
        {loading ? <MobileLoadingState label="Loading drawing categories" rows={4} /> : filteredCategories.length === 0 ? <MobileEmptyState icon={Folder} title={query ? 'No matching categories' : 'No drawing categories'} description={canWrite ? 'Create a category to organize project drawings.' : 'No drawing categories were returned.'} /> : <div className="space-y-3">{filteredCategories.map((item) => <MobileCard key={item.id} className="p-4"><button type="button" onClick={() => openCategory(item)} className="w-full text-left"><div className="flex items-start gap-3"><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"><Folder size={20} /></span><div className="min-w-0 flex-1"><h3 className="truncate text-sm font-bold text-gray-950 dark:text-gh-text">{item.name}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gh-muted">{item.drawing_count || 0} drawing{item.drawing_count === 1 ? '' : 's'} · {item.icon_key || 'Folder'}</p></div><MoreHorizontal size={18} className="shrink-0 text-gray-400" /></div></button>{canWrite && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setCategoryEditor(item); setCategoryEditorOpen(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 text-xs font-bold dark:border-gh-border"><Edit2 size={16} />Edit</button><button type="button" onClick={() => setCategoryDelete(item)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 text-xs font-bold text-red-700 dark:border-red-900 dark:text-red-300"><Trash2 size={16} />Delete</button></div>}</MobileCard>)}</div>}
        {canWrite && <MobileFAB label="New category" icon={Plus} onClick={() => { setCategoryEditor(null); setCategoryEditorOpen(true); }} />}
        <MobileDrawingCategoryForm open={categoryEditorOpen} onClose={() => { setCategoryEditorOpen(false); setCategoryEditor(null); }} category={categoryEditor} onSubmit={saveCategory} pending={pending} />
        <MobileConfirmModal open={Boolean(categoryDelete)} onClose={() => setCategoryDelete(null)} onConfirm={firstDeleteCategory} title="Check category deletion" message={`Check whether “${categoryDelete?.name || 'this category'}” contains drawings before deleting it.`} confirmLabel="Check and delete" danger pending={pending} />
        <MobileConfirmModal open={Boolean(categoryConsequence)} onClose={() => setCategoryConsequence(null)} onConfirm={confirmDeleteCategory} title="Delete category and drawings" message={categoryConsequence?.message || `This category contains ${categoryConsequence?.count || 0} drawings. Delete all files permanently?`} confirmLabel="Delete all" danger pending={pending} />
    </div>;
}
