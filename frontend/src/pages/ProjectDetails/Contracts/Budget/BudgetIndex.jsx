import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    TrendingUp, Download, ChevronRight,
    Settings2, FileSpreadsheet, Plus, X, Check, Pencil, Sparkles,
    AlertTriangle, TrendingDown, Info, Lightbulb,
    HardHat, Zap, Droplets, Flame, PenTool, Building2, Trees, Users, Package
} from 'lucide-react';
import { BUDGET_SECTIONS, PROJECT_DEFAULTS } from './budgetData';
import SectionView from './SectionView';
import Summary from './Summary';
import api from '../../../../services/api';

const fmt = (n, dec = 2) =>
    n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const computeSection = (section, slabArea, gstRate) => {
    let basic = 0;
    section.items.forEach(it => {
        const resolved = it.totalRateOverride != null
            ? it.totalRateOverride
            : (Number(it.materialRate) + Number(it.labourRate));
        basic += (resolved * Number(it.quantity)) / 100_000;
    });
    const gst = basic * (1 + gstRate);
    const ratePSft = slabArea > 0 ? (basic * 100_000) / slabArea : 0;
    return { basic, gst, ratePSft };
};

// ─── Icon map (key → Lucide element) ─────────────────────────────────────
const ICON_MAP = {
    HardHat: <HardHat size={18} />,
    Zap: <Zap size={18} />,
    Droplets: <Droplets size={18} />,
    Flame: <Flame size={18} />,
    PenTool: <PenTool size={18} />,
    Building2: <Building2 size={18} />,
    Settings2: <Settings2 size={18} />,
    Trees: <Trees size={18} />,
    Users: <Users size={18} />,
    Package: <Package size={18} />,
    AlertTriangle: <AlertTriangle size={18} />,
    Download: <Download size={18} />,
};

const ICON_OPTIONS = [
    { key: 'HardHat', label: 'Hard Hat' },
    { key: 'Zap', label: 'Electrical' },
    { key: 'Droplets', label: 'Plumbing' },
    { key: 'Flame', label: 'Fire' },
    { key: 'PenTool', label: 'Finishes' },
    { key: 'Building2', label: 'Building' },
    { key: 'Settings2', label: 'Equipment' },
    { key: 'Trees', label: 'Landscape' },
    { key: 'Users', label: 'Consultancy' },
    { key: 'Package', label: 'Package' },
    { key: 'AlertTriangle', label: 'Contingency' },
    { key: 'Download', label: 'Import' },
];

// ─── New / Edit Phase Slide-Out Drawer ────────────────────────────────────
const NewPhaseDrawer = ({ open, onClose, onSubmit, nextSrNo, initialData = null }) => {
    const isEdit = !!initialData;
    const [name, setName] = useState('');
    const [srNo, setSrNo] = useState(String(nextSrNo));
    const [iconKey, setIconKey] = useState('HardHat');
    const [desc, setDesc] = useState('');

    useEffect(() => {
        if (open) {
            setName(initialData?.name ?? '');
            setSrNo(initialData?.srNo ?? String(nextSrNo));
            setIconKey(initialData?.iconKey ?? 'HardHat');
            setDesc(initialData?.desc ?? '');
        }
    }, [open, nextSrNo, initialData]);

    const handleSubmit = () => {
        if (!name.trim()) return;
        onSubmit({ name: name.trim(), srNo: srNo.trim() || String(nextSrNo), iconKey, desc });
        onClose();
    };

    return (
        <>
            {/* Backdrop */}
            {open && <div className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm" onClick={onClose} />}

            {/* Drawer */}
            <div className={`fixed top-0 right-0 h-full w-[400px] z-[201] bg-white dark:bg-[#161b22] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isEdit ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-blue-50 dark:bg-blue-500/10'}`}>
                            {isEdit ? <Pencil size={15} className="text-amber-500" /> : <Plus size={16} className="text-blue-500" />}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{isEdit ? 'Edit Phase' : 'New Phase'}</h3>
                            <p className="text-xs text-gray-400">{isEdit ? 'Update phase details' : 'Define a new budget phase/section'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Form body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Phase name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Phase Name *</label>
                        <input
                            autoFocus
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Structural Works, Finishing Phase…"
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-white outline-none focus:ring-2 ring-blue-400 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        />
                    </div>

                    {/* Sr No */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Section No.</label>
                        <input
                            value={srNo}
                            onChange={e => setSrNo(e.target.value)}
                            placeholder={String(nextSrNo)}
                            className="w-24 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-white outline-none focus:ring-2 ring-blue-400 transition-all"
                        />
                    </div>

                    {/* Icon picker */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Icon</label>
                        <div className="grid grid-cols-6 gap-1.5">
                            {ICON_OPTIONS.map(opt => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => setIconKey(opt.key)}
                                    title={opt.label}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border-2 text-gray-500 dark:text-gray-400 ${iconKey === opt.key
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-110 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent bg-gray-100 dark:bg-white/5 hover:border-gray-300'
                                        }`}
                                >
                                    {ICON_MAP[opt.key]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview card */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">Preview</label>
                        <div className="bg-gray-50 dark:bg-[#0d1117] rounded-2xl border border-gray-100 dark:border-white/5 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                    {ICON_MAP[iconKey]}
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Section {srNo || nextSrNo}</p>
                                    <p className="text-sm font-bold text-gray-800 dark:text-white">{name || 'Phase Name…'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">Notes <span className="font-normal text-gray-400 normal-case">(optional)</span></label>
                        <textarea
                            value={desc}
                            onChange={e => setDesc(e.target.value)}
                            rows={3}
                            placeholder="Any notes about this phase…"
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-white outline-none focus:ring-2 ring-blue-400 transition-all resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex items-center gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim()}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all ${isEdit ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        <Check size={15} /> {isEdit ? 'Update Phase' : 'Create Phase'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-sm font-semibold text-gray-600 dark:text-gray-300 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </>
    );
};

// ─── Dynamic AI Suggestions Panel ─────────────────────────────────────────
const METADATA_MAP = {
    warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    saving: { icon: TrendingDown, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    suggestion: { icon: Lightbulb, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
};

const AISuggestionsPanel = ({ sectionId, sections, slabArea, gstRate, onClose }) => {
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const open = !!sectionId;
    const sec = sectionId && sectionId !== 'all' ? sections.find(s => s.id === sectionId) : null;

    useEffect(() => {
        if (!open) return;
        
        const fetchInsights = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.post('/ai/analyze-budget', {
                    budgetData: sectionId === 'all' ? sections : sections.filter(s => s.id === sectionId),
                    slabArea,
                    gstRate,
                    sectionId
                });
                setInsights(res.data.data.insights || []);
            } catch (err) {
                console.error(err);
                setError('Could not fetch AI Suggestions. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchInsights();
    }, [open, sectionId, sections, slabArea, gstRate]);

    return (
        <>
            {open && <div className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm" onClick={onClose} />}
            <div className={`fixed top-0 right-0 h-full w-[460px] z-[201] bg-white dark:bg-[#161b22] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-900/20 dark:to-blue-900/20">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center shadow-lg">
                            {sec ? <span className="text-lg text-white">{ICON_MAP[sec.iconKey]}</span> : <Sparkles size={16} className="text-white" />}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {sec ? `AI Insights — ${sec.name}` : 'AI Budget Insights (All Phases)'}
                            </h3>
                            {!loading && !error && <p className="text-xs text-gray-500 dark:text-gray-400">{insights.length} suggestion{insights.length !== 1 ? 's' : ''} found</p>}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 dark:hover:bg-white/10 text-gray-400 transition-colors">
                        <X size={16} />
                    </button>
                </div>
                {/* Disclaimer */}
                <div className="px-5 py-2.5 bg-violet-50/60 dark:bg-violet-900/10 border-b border-violet-100 dark:border-violet-500/10">
                    <p className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">✦ AI suggestions are based on industry benchmarks. Always verify with domain experts before acting.</p>
                </div>
                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-60">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse" />
                                <Sparkles size={32} className="text-blue-500 animate-pulse relative z-10" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium animate-pulse">Running architectural cost analysis...</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                            <AlertTriangle size={32} className="text-red-400" />
                            <p className="text-sm text-gray-500">{error}</p>
                            <button onClick={() => { setInsights([]); setError(null); setAiSectionId(null); setTimeout(() => setAiSectionId(sectionId), 0); }} className="mt-2 px-4 py-2 bg-gray-100 dark:bg-white/10 rounded-lg text-xs font-semibold hover:bg-gray-200 dark:hover:bg-white/20 transition-all">Retry</button>
                        </div>
                    ) : insights.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-50">
                            <Sparkles size={32} className="text-gray-300" />
                            <p className="text-sm text-gray-400">No specific insights found for this phase.</p>
                        </div>
                    ) : insights.map((s, i) => {
                        const meta = METADATA_MAP[s.type] || METADATA_MAP.info;
                        const IconComponent = meta.icon;
                        return (
                            <div key={i} className={`rounded-2xl border border-gray-100 dark:border-white/5 p-4 ${meta.bg}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 shrink-0 ${meta.color}`}><IconComponent size={16} /></div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-xs font-bold mb-1 ${meta.color}`}>{s.title}</p>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                                            <span className="text-[10px] font-semibold bg-gray-50 dark:bg-black/20 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md whitespace-nowrap">Total Cost: {s.totalCost}</span>
                                            <span className="text-[10px] font-semibold bg-gray-50 dark:bg-black/20 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md whitespace-nowrap">Occupied: {s.occupiedCost}</span>
                                        </div>
                                        <p className="text-[11.5px] text-gray-600 dark:text-gray-400 leading-relaxed"><strong className="font-semibold text-gray-800 dark:text-gray-200">AI Suggestion:</strong> {s.body}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 flex justify-end">
                    <button onClick={onClose} className="px-5 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Close</button>
                </div>
            </div>
        </>
    );
};

// ─── Budget Module (state container + view router) ────────────────────────
const BudgetIndex = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [sections, setSections] = useState(BUDGET_SECTIONS);
    const [slabArea, setSlabArea] = useState(PROJECT_DEFAULTS.slabArea);
    const [gstRate, setGstRate] = useState(PROJECT_DEFAULTS.gstRate);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);   // section being edited
    const [aiSectionId, setAiSectionId] = useState(null); // null=closed, 'all'=all, sectionId=filtered

    // Derive view from URL: ?section=<id> or ?section=summary
    const sectionParam = searchParams.get('section');
    const view = !sectionParam ? 'landing' : sectionParam === 'summary' ? 'summary' : 'section';
    const activeSectionId = view === 'section' ? sectionParam : null;

    const setSection = (id) => {
        const next = new URLSearchParams(searchParams);
        next.set('section', id);
        setSearchParams(next, { replace: false });
    };

    const clearSection = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('section');
        setSearchParams(next, { replace: false });
    };

    const updateSectionItems = (sectionId, newItems) => {
        setSections(prev => prev.map(s => s.id === sectionId ? { ...s, items: newItems } : s));
    };

    // ── Sync breadcrumbs whenever the URL param changes (fixes browser back) ──
    useEffect(() => {
        if (view === 'landing') {
            setExtraBreadcrumbs([
                { label: 'Contracts', onClick: onBack },
                { label: 'Budget' },
            ]);
        } else if (view === 'summary') {
            setExtraBreadcrumbs([
                { label: 'Contracts', onClick: onBack },
                { label: 'Budget', onClick: () => clearSection() },
                { label: 'Summary' },
            ]);
        } else if (view === 'section') {
            const sec = sections.find(s => s.id === activeSectionId);
            if (sec) {
                setExtraBreadcrumbs([
                    { label: 'Contracts', onClick: onBack },
                    { label: 'Budget', onClick: () => clearSection() },
                    { label: sec.name },
                ]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sectionParam]);

    // ── Add new phase (called from drawer on submit) ────────────────────────
    const addPhase = ({ name, srNo, icon, color }) => {
        if (editTarget) {
            // Edit existing phase
            setSections(prev => prev.map(s => s.id === editTarget ? { ...s, name, srNo, icon, color } : s));
            setEditTarget(null);
        } else {
            const newSec = { id: `phase_${Date.now()}`, srNo, name, color, icon, items: [] };
            setSections(prev => [...prev, newSec]);
        }
    };

    const openEditDrawer = (e, sec) => {
        e.stopPropagation();
        setEditTarget(sec.id);
        setDrawerOpen(true);
    };

    const openSection = (id) => {
        const sec = sections.find(s => s.id === id);
        if (!sec) return;
        setSection(id);
        setExtraBreadcrumbs([
            { label: 'Contracts', onClick: onBack },
            { label: 'Budget', onClick: () => clearSection() },
            { label: sec.name },
        ]);
    };

    const goToSummary = () => {
        setSection('summary');
        setExtraBreadcrumbs([
            { label: 'Contracts', onClick: onBack },
            { label: 'Budget', onClick: () => clearSection() },
            { label: 'Summary' },
        ]);
    };

    const backToLanding = () => {
        clearSection();
        setExtraBreadcrumbs([
            { label: 'Contracts', onClick: onBack },
            { label: 'Budget' },
        ]);
    };

    // Export all sections to one CSV
    const exportAllCSV = () => {
        const lines = ['Sr No,Section,Description,Unit,Quantity,Material Rate,Labour Rate,Total Rate,Basic (Lacs),Rate/Sqft,Amt incl. GST (Lacs),Remarks'];
        sections.forEach(sec => {
            sec.items.forEach(it => {
                const resolved = it.totalRateOverride != null ? it.totalRateOverride : (Number(it.materialRate) + Number(it.labourRate));
                const basic = (resolved * Number(it.quantity)) / 100_000;
                const gst = basic * (1 + gstRate);
                const rps = slabArea > 0 ? (basic * 100_000) / slabArea : 0;
                lines.push([
                    it.srNo, `"${sec.name}"`, `"${it.description}"`, it.unit,
                    it.quantity, it.materialRate, it.labourRate, resolved,
                    basic.toFixed(2), rps.toFixed(2), gst.toFixed(2), `"${it.remarks}"`
                ].join(','));
            });
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'Full_Project_Budget.csv'; a.click();
    };

    // Grand totals for header chips
    const grand = sections.reduce((acc, s) => {
        const c = computeSection(s, slabArea, gstRate);
        acc.basic += c.basic; acc.gst += c.gst;
        return acc;
    }, { basic: 0, gst: 0 });

    // ── Section view ──────────────────────────────────────────────────────
    if (view === 'section') {
        const sec = sections.find(s => s.id === activeSectionId);
        return (
            <SectionView
                section={sec}
                slabArea={slabArea}
                gstRate={gstRate}
                onItemsChange={items => updateSectionItems(activeSectionId, items)}
                onBack={backToLanding}
                canWrite={canWrite}
            />
        );
    }

    // ── Summary view ──────────────────────────────────────────────────────
    if (view === 'summary') {
        return (
            <Summary
                sections={sections}
                slabArea={slabArea}
                gstRate={gstRate}
                onBack={backToLanding}
                onGoToSection={(id) => openSection(id)}
            />
        );
    }

    // ── Landing view ──────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-[#0d1117]">
            <NewPhaseDrawer
                open={drawerOpen}
                onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
                onSubmit={addPhase}
                nextSrNo={sections.length + 1}
                initialData={editTarget ? sections.find(s => s.id === editTarget) : null}
            />
            <AISuggestionsPanel
                sectionId={aiSectionId}
                sections={sections}
                slabArea={slabArea}
                gstRate={gstRate}
                onClose={() => setAiSectionId(null)}
            />

            {/* Page header */}
            <div className="px-6 py-3 flex items-center justify-between bg-white dark:bg-[#0d1117] border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-3">
                    <FileSpreadsheet size={18} className="text-blue-500" />
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 dark:text-white">Project Budget</h2>
                        <p className="text-xs text-gray-400">{sections.length} cost sections · Phase-wise budgeting</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">
                            Basic: ₹{fmt(grand.basic)} Lacs
                        </span>
                        <span className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-xs font-bold">
                            incl. GST: ₹{fmt(grand.gst)} Lacs
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setAiSectionId('all')} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-md shadow-violet-500/20">
                        <Sparkles size={13} /> AI Suggestions
                    </button>
                    {canWrite && (
                        <button onClick={() => { setEditTarget(null); setDrawerOpen(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                            <Plus size={13} /> New Phase
                        </button>
                    )}
                    <button onClick={goToSummary} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
                        <TrendingUp size={13} /> Summary & Charts
                    </button>
                    <button onClick={exportAllCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-semibold rounded-lg transition-colors">
                        <Download size={13} /> Export All
                    </button>
                </div>
            </div>

            {/* Project params */}
            <div className="px-6 py-3 flex items-center gap-6 bg-white dark:bg-[#0d1117] border-b border-gray-100 dark:border-white/[0.03] shrink-0">
                <div className="flex items-center gap-2">
                    <Settings2 size={13} className="text-gray-400" />
                    <span className="text-xs text-gray-500 font-semibold">Slab Area:</span>
                    <input
                        type="number"
                        disabled={!canWrite}
                        value={slabArea}
                        onChange={e => setSlabArea(Number(e.target.value))}
                        className="w-28 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 outline-none focus:ring-1 ring-blue-400 disabled:opacity-70"
                    />
                    <span className="text-xs text-gray-400">Sqft</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-semibold">GST Rate:</span>
                    <input
                        type="number"
                        disabled={!canWrite}
                        value={gstRate * 100}
                        onChange={e => setGstRate(Number(e.target.value) / 100)}
                        className="w-16 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 outline-none focus:ring-1 ring-blue-400 disabled:opacity-70"
                    />
                    <span className="text-xs text-gray-400">%</span>
                </div>
            </div>

            {/* Section cards grid */}
            <div className="p-6">
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                    {sections.map((sec) => {
                        const { basic, gst, ratePSft } = computeSection(sec, slabArea, gstRate);
                        const pct = grand.basic > 0 ? ((basic / grand.basic) * 100) : 0;
                        return (
                            <div
                                key={sec.id}
                                onClick={() => openSection(sec.id)}
                                className="group relative bg-white dark:bg-[#161b22] rounded-2xl border border-gray-100 dark:border-white/5 p-5 text-left hover:shadow-xl hover:border-blue-400/40 dark:hover:border-blue-500/40 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                            >
                                {/* Card header — icon-only action buttons absolute top-right */}
                                <div className="absolute top-3 right-3 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    {canWrite && (
                                        <button
                                            onClick={(e) => openEditDrawer(e, sec)}
                                            title="Edit phase"
                                            className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300 transition-all shadow-sm"
                                        >
                                            <Pencil size={11} />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setAiSectionId(sec.id)}
                                        title="AI Insights for this phase"
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-300 transition-all shadow-sm"
                                    >
                                        <Sparkles size={11} />
                                    </button>
                                </div>

                                {/* Card header */}
                                <div className="flex items-start justify-between mb-4 pr-16">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                            {ICON_MAP[sec.iconKey] ?? <Package size={18} />}
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Section {sec.srNo}</p>
                                            <h3 className="text-sm font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{sec.name}</h3>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress bar (cost share) */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                        <span>Cost share</span>
                                        <span className="font-semibold">{pct.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${pct <= 30 ? 'bg-green-500'
                                                : pct <= 80 ? 'bg-yellow-400'
                                                    : 'bg-red-500'
                                                }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Amounts */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-2">
                                        <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Basic</p>
                                        <p className="text-xs font-black text-gray-800 dark:text-gray-200">₹{fmt(basic, 1)}L</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-2">
                                        <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">GST incl.</p>
                                        <p className="text-xs font-black text-green-600 dark:text-green-400">₹{fmt(gst, 1)}L</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-2">
                                        <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Rate/Sqft</p>
                                        <p className="text-xs font-black text-purple-600 dark:text-purple-400">₹{fmt(ratePSft, 0)}</p>
                                    </div>
                                </div>

                                <p className="text-[10px] text-gray-400 mt-3">{sec.items.length} line items · Click to open</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BudgetIndex;
