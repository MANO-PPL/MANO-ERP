import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Calculator,
    Sparkles,
    Check,
    Copy,
    Play,
    RotateCcw,
    HardHat,
    Layers,
    BookOpen,
    Info,
    HelpCircle,
    ArrowRight,
    CornerDownLeft,
    CheckCircle2,
    AlertCircle,
    Zap,
    Code,
    Sliders,
    X
} from 'lucide-react';
import {
    EXCEL_FORMULAS_CATALOG,
    FORMULA_CATEGORIES
} from '../../../utils/excelFormulasCatalog.js';
import {
    evaluateFormula,
    formatFormulaResult,
    buildFormulaString,
    searchFormulas
} from '../../../utils/excelFormulaEngine.js';
import { ExcelFormulaCard } from './ExcelFormulaCard';
import { customToast } from '../../../utils/toast';

export const ExcelFormulaExplorer = ({
    initialFormulaName = 'SUM',
    onInsertFormula = null,
    className = ''
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedFormula, setSelectedFormula] = useState(() => {
        return EXCEL_FORMULAS_CATALOG.find(f => f.name === initialFormulaName) || EXCEL_FORMULAS_CATALOG[0];
    });

    const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'playground' | 'construction' | 'guide'

    // ─── Function Builder State ───────────────────────────────────────────────
    const [builderArgs, setBuilderArgs] = useState({});
    const [copiedFormula, setCopiedFormula] = useState(false);

    // Sync builder arguments when selected formula changes
    useEffect(() => {
        if (!selectedFormula) return;
        const initialArgs = {};
        if (selectedFormula.args) {
            selectedFormula.args.forEach((arg, idx) => {
                initialArgs[arg.name || `arg_${idx}`] = arg.example || '';
            });
        }
        setBuilderArgs(initialArgs);
    }, [selectedFormula]);

    // Construct live formula string from builder inputs
    const liveBuilderFormula = useMemo(() => {
        if (!selectedFormula) return '';
        if (selectedFormula.category === 'construction' && selectedFormula.syntax?.startsWith('=')) {
            // For custom civil formulas with inline algebraic syntax
            let expr = selectedFormula.example || selectedFormula.syntax;
            return expr;
        }

        const argsList = (selectedFormula.args || []).map((arg, idx) => {
            const key = arg.name || `arg_${idx}`;
            const val = builderArgs[key];
            if (val === undefined || val === null || String(val).trim() === '') {
                return arg.required ? '0' : '';
            }
            return String(val).trim();
        }).filter(a => a !== '');

        return buildFormulaString(selectedFormula.name, argsList);
    }, [selectedFormula, builderArgs]);

    // Live evaluation result for builder
    const builderEvalResult = useMemo(() => {
        if (!liveBuilderFormula) return { success: false, result: null, formattedResult: '', error: null, durationMs: 0 };
        return evaluateFormula(liveBuilderFormula);
    }, [liveBuilderFormula]);

    // ─── Freeform Playground State ────────────────────────────────────────────
    const [playgroundInput, setPlaygroundInput] = useState('=IF(SUM(120, 250, 430) > 500, "High Volume", "Normal")');
    const [customVariables, setCustomVariables] = useState({
        A1: '1500',
        B1: '250',
        C1: '0.18'
    });

    const playgroundEvalResult = useMemo(() => {
        if (!playgroundInput) return { success: false, result: null, formattedResult: '', error: null, durationMs: 0 };
        return evaluateFormula(playgroundInput, customVariables);
    }, [playgroundInput, customVariables]);

    // ─── Filtered Formula List ────────────────────────────────────────────────
    const filteredFormulas = useMemo(() => {
        return searchFormulas(searchQuery, selectedCategory);
    }, [searchQuery, selectedCategory]);

    const handleCopyString = (text, label = 'Formula') => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedFormula(true);
        customToast.success(`Copied ${label} to clipboard`, 'Copied');
        setTimeout(() => setCopiedFormula(false), 2000);
    };

    const handleInsert = (formulaStr) => {
        if (onInsertFormula && formulaStr) {
            onInsertFormula(formulaStr);
            customToast.success(`Inserted ${formulaStr} into cell`, 'Formula Inserted');
        } else {
            handleCopyString(formulaStr, 'Formula');
        }
    };

    const handleArgChange = (argKey, value) => {
        setBuilderArgs(prev => ({
            ...prev,
            [argKey]: value
        }));
    };

    const handleResetBuilder = () => {
        if (!selectedFormula) return;
        const initialArgs = {};
        if (selectedFormula.args) {
            selectedFormula.args.forEach((arg, idx) => {
                initialArgs[arg.name || `arg_${idx}`] = arg.example || '';
            });
        }
        setBuilderArgs(initialArgs);
    };

    return (
        <div className={`flex flex-col h-full w-full bg-slate-50 dark:bg-[#0d1117] text-gray-900 dark:text-gray-100 overflow-hidden ${className}`}>
            {/* ─── Top Header & Tabs Bar ──────────────────────────────────────── */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-2xs">
                <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                        <Calculator size={18} className="stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center space-x-2">
                            <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">
                                Excel Formula Assistant & Calculator
                            </h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50">
                                450+ Formulas
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Open-source formula evaluation engine with real-time computation & construction presets
                        </p>
                    </div>
                </div>

                {/* Main Workspace Mode Tabs */}
                <div className="flex items-center bg-gray-100 dark:bg-[#0d1117] p-0.5 rounded-lg border border-gray-200 dark:border-white/5 text-xs font-semibold self-start md:self-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('builder')}
                        className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                            activeTab === 'builder'
                                ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Sliders size={13} />
                        <span>Function Builder</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('playground')}
                        className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                            activeTab === 'playground'
                                ? 'bg-white dark:bg-[#21262d] text-blue-600 dark:text-blue-400 shadow-xs'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <Zap size={13} />
                        <span>Live Playground</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('construction')}
                        className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                            activeTab === 'construction'
                                ? 'bg-white dark:bg-[#21262d] text-orange-600 dark:text-orange-400 shadow-xs'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <HardHat size={13} />
                        <span>Civil Presets</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('guide')}
                        className={`px-3 py-1.5 rounded-md transition-all flex items-center space-x-1.5 cursor-pointer ${
                            activeTab === 'guide'
                                ? 'bg-white dark:bg-[#21262d] text-purple-600 dark:text-purple-400 shadow-xs'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        <BookOpen size={13} />
                        <span>Cheatsheet</span>
                    </button>
                </div>
            </div>

            {/* ─── Main Content Split Layout ──────────────────────────────────── */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* ── LEFT PANE: Catalog Browser & Search (Hidden in full guide view) ── */}
                <div className="w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] flex flex-col shrink-0 overflow-hidden">
                    {/* Search Bar */}
                    <div className="p-3 border-b border-gray-200 dark:border-white/10 space-y-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search formula name, keyword (e.g. SUM, VLOOKUP, PMT, DATEDIF)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition font-sans text-gray-900 dark:text-white placeholder-gray-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        {/* Category Chips Carousel */}
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
                            {FORMULA_CATEGORIES.map(cat => {
                                const isCatActive = selectedCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`px-2 py-1 rounded-md whitespace-nowrap font-medium transition cursor-pointer shrink-0 ${
                                            isCatActive
                                                ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                                                : 'bg-gray-100 dark:bg-[#0d1117] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#21262d]'
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Catalog Formula List */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                            <span>Formulas ({filteredFormulas.length})</span>
                            <span>Click to build</span>
                        </div>

                        {filteredFormulas.length === 0 ? (
                            <div className="text-center py-12 px-4">
                                <Calculator size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                    No formulas matched "{searchQuery}"
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1">
                                    Try searching for math, lookup, text, or financial terms.
                                </p>
                            </div>
                        ) : (
                            filteredFormulas.map(formula => (
                                <ExcelFormulaCard
                                    key={formula.name}
                                    formula={formula}
                                    isSelected={selectedFormula?.name === formula.name}
                                    onSelect={(f) => {
                                        setSelectedFormula(f);
                                        if (activeTab === 'guide' || activeTab === 'construction') {
                                            setActiveTab('builder');
                                        }
                                    }}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* ── RIGHT PANE: Interactive Workspace ───────────────────────────── */}
                <div className="flex-1 flex flex-col overflow-y-auto bg-gray-50/50 dark:bg-[#0d1117]/50 p-4 md:p-6">
                    {/* ═══════════════════════════════════════════════════════════ */}
                    {/* TAB 1: FUNCTION BUILDER & REAL-TIME EVALUATOR               */}
                    {/* ═══════════════════════════════════════════════════════════ */}
                    {activeTab === 'builder' && selectedFormula && (
                        <div className="max-w-4xl w-full mx-auto space-y-5 animate-in fade-in duration-200">
                            {/* Formula Overview Card */}
                            <div className="p-4 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xs space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div className="flex items-center space-x-2.5">
                                        <h3 className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                                            {selectedFormula.name}
                                        </h3>
                                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                            {selectedFormula.category}
                                        </span>
                                    </div>

                                    <div className="flex items-center space-x-1.5">
                                        <button
                                            type="button"
                                            onClick={handleResetBuilder}
                                            className="px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md border border-gray-200 dark:border-white/10 transition flex items-center space-x-1 cursor-pointer"
                                        >
                                            <RotateCcw size={12} />
                                            <span>Reset Demo</span>
                                        </button>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                    {selectedFormula.description}
                                </p>

                                <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-[#0d1117] border border-gray-200/80 dark:border-white/5">
                                    <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Standard Syntax</div>
                                    <code className="font-mono text-xs text-gray-900 dark:text-gray-100 font-semibold block">
                                        ={selectedFormula.syntax}
                                    </code>
                                </div>
                            </div>

                            {/* Dynamic Argument Inputs */}
                            <div className="p-4 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xs space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5">
                                    <div className="flex items-center space-x-2">
                                        <Sliders size={15} className="text-blue-500" />
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                            Function Parameters ({selectedFormula.args?.length || 0})
                                        </h4>
                                    </div>
                                    <span className="text-[11px] text-gray-400">
                                        Fill in arguments to calculate in real-time
                                    </span>
                                </div>

                                {(!selectedFormula.args || selectedFormula.args.length === 0) ? (
                                    <div className="py-4 text-center text-xs text-gray-500">
                                        This function takes no parameters (e.g. <code className="font-mono text-blue-500">={selectedFormula.name}()</code>).
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        {selectedFormula.args.map((arg, idx) => {
                                            const argKey = arg.name || `arg_${idx}`;
                                            const val = builderArgs[argKey] ?? '';

                                            return (
                                                <div key={argKey} className="space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                                                            <span>{arg.name}</span>
                                                            <span className="text-[10px] font-sans font-normal text-gray-400">
                                                                ({arg.type || 'any'})
                                                            </span>
                                                        </label>
                                                        <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-xs ${
                                                            arg.required
                                                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                                                : 'bg-gray-100 dark:bg-white/5 text-gray-500'
                                                        }`}>
                                                            {arg.required ? 'Required' : 'Optional'}
                                                        </span>
                                                    </div>

                                                    <input
                                                        type="text"
                                                        value={val}
                                                        onChange={(e) => handleArgChange(argKey, e.target.value)}
                                                        placeholder={arg.example || `Enter ${arg.name}...`}
                                                        className="w-full px-3 py-1.5 text-xs bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-md outline-none focus:ring-1 focus:ring-blue-500 font-mono text-gray-900 dark:text-white transition"
                                                    />

                                                    <p className="text-[10px] text-gray-400 leading-tight">
                                                        {arg.description}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Real-Time Live Computed Output Box */}
                            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50/70 to-indigo-50/70 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-800/40 shadow-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Zap size={15} className="text-amber-500 fill-amber-500" />
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                                            Calculated Live Preview
                                        </h4>
                                    </div>

                                    {builderEvalResult.durationMs !== undefined && (
                                        <span className="text-[10px] font-mono text-gray-500">
                                            Computed in {builderEvalResult.durationMs}ms
                                        </span>
                                    )}
                                </div>

                                {/* Generated Formula Display */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 px-3 py-2 bg-white dark:bg-[#0d1117] rounded-lg border border-blue-200 dark:border-white/10 font-mono text-xs text-blue-700 dark:text-blue-300 font-bold break-all shadow-2xs">
                                        {liveBuilderFormula}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopyString(liveBuilderFormula, 'Formula')}
                                        className="p-2 bg-white dark:bg-[#161b22] hover:bg-gray-50 dark:hover:bg-[#21262d] border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-lg shadow-2xs transition cursor-pointer"
                                        title="Copy Formula String"
                                    >
                                        {copiedFormula ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                    </button>
                                </div>

                                {/* Evaluated Result Box */}
                                <div className="p-3.5 bg-white dark:bg-[#0d1117] rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-between shadow-2xs">
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-gray-400">Evaluated Output</div>
                                        <div className={`text-base font-bold font-mono mt-0.5 ${
                                            builderEvalResult.success
                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                : 'text-rose-600 dark:text-rose-400'
                                        }`}>
                                            {builderEvalResult.formattedResult || '—'}
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        {onInsertFormula ? (
                                            <button
                                                type="button"
                                                onClick={() => handleInsert(liveBuilderFormula)}
                                                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs shadow-blue-500/20 transition flex items-center space-x-1 cursor-pointer"
                                            >
                                                <span>Insert into Cell</span>
                                                <CornerDownLeft size={13} />
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleCopyString(liveBuilderFormula, 'Formula')}
                                                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs shadow-blue-500/20 transition flex items-center space-x-1 cursor-pointer"
                                            >
                                                <Copy size={13} />
                                                <span>Copy Formula</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════ */}
                    {/* TAB 2: LIVE FORMULA PLAYGROUND                              */}
                    {/* ═══════════════════════════════════════════════════════════ */}
                    {activeTab === 'playground' && (
                        <div className="max-w-4xl w-full mx-auto space-y-5 animate-in fade-in duration-200">
                            <div className="p-4 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xs space-y-3">
                                <div className="flex items-center space-x-2">
                                    <Code size={16} className="text-blue-500" />
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Interactive Formula Playground
                                    </h3>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Write any complex nested Excel formula, math operation, or logical statement. Evaluated instantly via open-source FormulaJS / AST parser.
                                </p>

                                {/* Formula Expression Input */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        Formula Expression (prefix with =)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={playgroundInput}
                                            onChange={(e) => setPlaygroundInput(e.target.value)}
                                            placeholder="=SUM(10, 20, 30) or =IF(5 > 2, 'PASS', 'FAIL')"
                                            className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono text-gray-900 dark:text-white transition"
                                        />
                                    </div>
                                </div>

                                {/* Quick Presets */}
                                <div className="space-y-1 pt-1">
                                    <div className="text-[10px] uppercase font-bold text-gray-400">Sample Expressions to Try:</div>
                                    <div className="flex flex-wrap gap-1.5 text-xs">
                                        {[
                                            '=SUM(100, 250, 450, 800)',
                                            '=AVERAGE(15, 25, 35, 45, 95)',
                                            '=IF(SUM(A1, B1) > 1000, "Eligible", "Below Minimum")',
                                            '=PMT(0.085/12, 36, 650000)',
                                            '=DATEDIF("2026-01-01", "2026-12-31", "D")',
                                            '=CONCATENATE("Invoice Total: ₹", ROUND(1450.789, 2))',
                                            '=IFERROR(100 / 0, "Calculation Safe Fallback")'
                                        ].map(preset => (
                                            <button
                                                key={preset}
                                                type="button"
                                                onClick={() => setPlaygroundInput(preset)}
                                                className="px-2 py-1 bg-gray-100 dark:bg-[#0d1117] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-gray-700 dark:text-gray-300 hover:text-blue-600 rounded-md border border-gray-200 dark:border-white/5 font-mono text-[11px] transition cursor-pointer truncate max-w-xs"
                                            >
                                                {preset}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Playground Result Display */}
                            <div className="p-4 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Execution Outcome
                                    </h4>
                                    {playgroundEvalResult.durationMs !== undefined && (
                                        <span className="text-[10px] font-mono text-gray-400">
                                            {playgroundEvalResult.durationMs}ms latency
                                        </span>
                                    )}
                                </div>

                                <div className={`p-4 rounded-lg border font-mono ${
                                    playgroundEvalResult.success
                                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-300'
                                }`}>
                                    <div className="text-xs font-semibold opacity-70 mb-1">
                                        {playgroundEvalResult.success ? 'Computed Result:' : 'Error Message:'}
                                    </div>
                                    <div className="text-lg font-bold">
                                        {playgroundEvalResult.success
                                            ? playgroundEvalResult.formattedResult
                                            : playgroundEvalResult.error || playgroundEvalResult.formattedResult}
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyString(playgroundInput, 'Formula')}
                                        className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#21262d] hover:bg-gray-200 rounded-md transition flex items-center space-x-1 cursor-pointer"
                                    >
                                        <Copy size={13} />
                                        <span>Copy Formula</span>
                                    </button>

                                    {onInsertFormula && (
                                        <button
                                            type="button"
                                            onClick={() => handleInsert(playgroundInput)}
                                            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition flex items-center space-x-1 cursor-pointer"
                                        >
                                            <span>Insert into Active Cell</span>
                                            <CornerDownLeft size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════ */}
                    {/* TAB 3: CIVIL & CONSTRUCTION PRESETS                         */}
                    {/* ═══════════════════════════════════════════════════════════ */}
                    {activeTab === 'construction' && (
                        <div className="max-w-4xl w-full mx-auto space-y-4 animate-in fade-in duration-200">
                            <div className="p-4 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xs space-y-2">
                                <div className="flex items-center space-x-2">
                                    <HardHat size={18} className="text-orange-500" />
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Civil Engineering & ERP Quick Formulas
                                    </h3>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Standard quantity takeoff, material wastage markup, GST billing, retention withholdings, and steel rebar estimation models.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {EXCEL_FORMULAS_CATALOG.filter(f => f.category === 'construction').map(item => (
                                    <div
                                        key={item.name}
                                        className="p-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] shadow-xs flex flex-col justify-between space-y-2.5 group hover:border-orange-400 transition"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono font-bold text-xs text-orange-600 dark:text-orange-400">
                                                    {item.name}
                                                </span>
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40">
                                                    Preset
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                                                {item.description}
                                            </p>
                                            <div className="mt-2 p-2 rounded-md bg-gray-50 dark:bg-[#0d1117] border border-gray-200/80 dark:border-white/5">
                                                <code className="font-mono text-[11px] text-gray-800 dark:text-gray-200 block truncate">
                                                    {item.example}
                                                </code>
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-xs">
                                            <button
                                                type="button"
                                                onClick={() => handleCopyString(item.example, item.name)}
                                                className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 inline-flex items-center gap-1 cursor-pointer"
                                            >
                                                <Copy size={12} />
                                                <span>Copy Formula</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedFormula(item);
                                                    setActiveTab('builder');
                                                }}
                                                className="text-orange-600 dark:text-orange-400 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                                            >
                                                <span>Configure Parameters</span>
                                                <ArrowRight size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════ */}
                    {/* TAB 4: CHEATSHEET & OPERATORS GUIDE                         */}
                    {/* ═══════════════════════════════════════════════════════════ */}
                    {activeTab === 'guide' && (
                        <div className="max-w-4xl w-full mx-auto space-y-4 animate-in fade-in duration-200 text-xs">
                            <div className="p-4 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xs space-y-2">
                                <div className="flex items-center space-x-2">
                                    <BookOpen size={18} className="text-purple-500" />
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        Excel Formulas & Operators Reference Guide
                                    </h3>
                                </div>
                                <p className="text-gray-500 leading-relaxed">
                                    Quick reference for mathematical operators, cell referencing modes, range syntax, and error diagnostics.
                                </p>
                            </div>

                            {/* Grid of Operators */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                <div className="p-4 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xs space-y-2.5">
                                    <h4 className="font-bold text-xs uppercase text-gray-800 dark:text-gray-200">
                                        Arithmetic Operators
                                    </h4>
                                    <div className="space-y-1.5 font-mono text-[11px]">
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-blue-500">+ (Addition)</span>
                                            <span className="text-gray-400">=A1 + B1</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-blue-500">- (Subtraction)</span>
                                            <span className="text-gray-400">=A1 - B1</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-blue-500">* (Multiplication)</span>
                                            <span className="text-gray-400">=A1 * B1</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-blue-500">/ (Division)</span>
                                            <span className="text-gray-400">=A1 / B1</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-blue-500">^ (Exponentiation)</span>
                                            <span className="text-gray-400">=A1 ^ 2</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-blue-500">& (Text Concatenation)</span>
                                            <span className="text-gray-400">=A1 & " " & B1</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-xs space-y-2.5">
                                    <h4 className="font-bold text-xs uppercase text-gray-800 dark:text-gray-200">
                                        Comparison Operators
                                    </h4>
                                    <div className="space-y-1.5 font-mono text-[11px]">
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-purple-500">= (Equal to)</span>
                                            <span className="text-gray-400">=IF(A1 = B1, 1, 0)</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-purple-500">&lt;&gt; (Not equal to)</span>
                                            <span className="text-gray-400">=IF(A1 &lt;&gt; 0, A1, 1)</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-purple-500">&gt; (Greater than)</span>
                                            <span className="text-gray-400">=IF(A1 &gt; 100, "High", "Low")</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-purple-500">&gt;= (Greater than or equal)</span>
                                            <span className="text-gray-400">=IF(A1 &gt;= 50, "Pass", "Fail")</span>
                                        </div>
                                        <div className="flex justify-between p-1.5 bg-gray-50 dark:bg-[#0d1117] rounded-sm">
                                            <span className="text-purple-500">&lt;= (Less than or equal)</span>
                                            <span className="text-gray-400">=IF(A1 &lt;= 10, "Reorder", "OK")</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExcelFormulaExplorer;
