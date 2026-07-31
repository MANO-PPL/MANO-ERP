import React, { useState, useEffect } from 'react';
import { Plus, X, Save, Settings, Users, Share2, UserCheck, RotateCcw } from 'lucide-react';
import { customToast } from '../../../utils/toast';

const DEFAULT_TRADES = [
    { key: 'plumber', label: 'Plumber' },
    { key: 'super', label: 'Supervisor' },
    { key: 'carp', label: 'Carpenter' },
    { key: 'fitter', label: 'Fitter' },
    { key: 'elect', label: 'Electrician' },
    { key: 'opera', label: 'Operator' },
    { key: 'mason', label: 'Mason' },
    { key: 'labou', label: 'Labour' },
    { key: 'storel', label: 'Storekeeper' },
    { key: 'staff', label: 'Staff' }
];

const DEFAULT_DISTRIBUTIONS = ['GLOWMEX', 'MANO CPL', 'CLIENT'];
const DEFAULT_PREPARED_BYS = ['MANO CPL', 'SITE ENGINEER', 'PROJECT DIRECTOR'];

const DPRConfig = ({ project }) => {
    const projectId = project?.id || project?.dbId || 'default';
    const storageKey = `dpr_config_${projectId}`;

    const [trades, setTrades] = useState(DEFAULT_TRADES);
    const [distributions, setDistributions] = useState(DEFAULT_DISTRIBUTIONS);
    const [preparedBys, setPreparedBys] = useState(DEFAULT_PREPARED_BYS);

    const [newTradeLabel, setNewTradeLabel] = useState('');
    const [newDistLabel, setNewDistLabel] = useState('');
    const [newPrepLabel, setNewPrepLabel] = useState('');

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.trades && Array.isArray(parsed.trades)) setTrades(parsed.trades);
                if (parsed.distributions && Array.isArray(parsed.distributions)) setDistributions(parsed.distributions);
                if (parsed.preparedBys && Array.isArray(parsed.preparedBys)) setPreparedBys(parsed.preparedBys);
            }
        } catch (err) {
            console.error('Failed to load DPR config:', err);
        }
    }, [storageKey]);

    // Save to localStorage
    const handleSaveConfig = () => {
        try {
            const configData = {
                trades,
                distributions,
                preparedBys,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem(storageKey, JSON.stringify(configData));
            customToast.success('DPR Configuration saved successfully!', 'Saved');
        } catch (err) {
            console.error('Failed to save DPR config:', err);
            customToast.error('Failed to save configuration');
        }
    };

    const handleResetDefaults = () => {
        setTrades(DEFAULT_TRADES);
        setDistributions(DEFAULT_DISTRIBUTIONS);
        setPreparedBys(DEFAULT_PREPARED_BYS);
        localStorage.removeItem(storageKey);
        customToast.info('Reset DPR Configuration to default presets');
    };

    // Trade Operations
    const handleAddTrade = (e) => {
        e?.preventDefault();
        if (!newTradeLabel.trim()) return;
        const label = newTradeLabel.trim();
        const key = label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || `trade_${Date.now()}`;
        if (trades.some(t => t.key === key || t.label.toLowerCase() === label.toLowerCase())) {
            customToast.warning('This trade already exists');
            return;
        }
        setTrades([...trades, { key, label }]);
        setNewTradeLabel('');
    };

    const handleRemoveTrade = (key) => {
        if (trades.length <= 1) {
            customToast.warning('At least one trade column is required');
            return;
        }
        setTrades(trades.filter(t => t.key !== key));
    };

    // Distribution Operations
    const handleAddDistribution = (e) => {
        e?.preventDefault();
        if (!newDistLabel.trim()) return;
        const val = newDistLabel.trim();
        if (distributions.includes(val)) {
            customToast.warning('This distribution option already exists');
            return;
        }
        setDistributions([...distributions, val]);
        setNewDistLabel('');
    };

    const handleRemoveDistribution = (val) => {
        setDistributions(distributions.filter(d => d !== val));
    };

    // Prepared By Operations
    const handleAddPreparedBy = (e) => {
        e?.preventDefault();
        if (!newPrepLabel.trim()) return;
        const val = newPrepLabel.trim();
        if (preparedBys.includes(val)) {
            customToast.warning('This Prepared-By option already exists');
            return;
        }
        setPreparedBys([...preparedBys, val]);
        setNewPrepLabel('');
    };

    const handleRemovePreparedBy = (val) => {
        setPreparedBys(preparedBys.filter(p => p !== val));
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 font-sans">
            {/* Control Bar Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-zinc-800">
                <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                        <Settings size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                            DPR Configuration
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            Define dynamic trades/agencies, distribution presets, and prepared-by templates for {project?.name || 'this project'}.
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleResetDefaults}
                        className="px-3.5 py-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 text-gray-700 dark:text-zinc-300 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all"
                    >
                        <RotateCcw size={13} />
                        <span>Reset Defaults</span>
                    </button>

                    <button
                        onClick={handleSaveConfig}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-500/20 flex items-center space-x-1.5 active:scale-95 transition-all"
                    >
                        <Save size={14} />
                        <span>Save Configuration</span>
                    </button>
                </div>
            </div>

            {/* 1. Dynamic Trades / Manpower Roles */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                        <Users size={18} className="text-blue-500" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Project Agency Trades / Roles ({trades.length})
                        </h3>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 font-medium">
                        These will appear as columns in the Labour Report grid
                    </span>
                </div>

                {/* Add Trade Bar */}
                <form onSubmit={handleAddTrade} className="flex items-center space-x-2">
                    <input
                        type="text"
                        placeholder="Enter new trade (e.g. Welder, Painter, Surveyor...)"
                        value={newTradeLabel}
                        onChange={(e) => setNewTradeLabel(e.target.value)}
                        className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-all active:scale-95"
                    >
                        <Plus size={14} />
                        <span>Add Trade</span>
                    </button>
                </form>

                {/* Trades Grid Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2">
                    {trades.map((t, idx) => (
                        <div
                            key={t.key || idx}
                            className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-gray-800 dark:text-zinc-200 group hover:border-blue-500/50 transition-all"
                        >
                            <span className="truncate">{t.label}</span>
                            <button
                                onClick={() => handleRemoveTrade(t.key)}
                                className="text-gray-400 hover:text-red-500 opacity-80 group-hover:opacity-100 p-0.5 rounded transition-colors"
                                title="Remove trade"
                            >
                                <X size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Dynamic Distribution Presets */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                        <Share2 size={18} className="text-indigo-500" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Distribution Presets ({distributions.length})
                        </h3>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 font-medium">
                        Default recipients / agency distribution names
                    </span>
                </div>

                {/* Add Distribution Form */}
                <form onSubmit={handleAddDistribution} className="flex items-center space-x-2">
                    <input
                        type="text"
                        placeholder="Enter distribution preset (e.g. GLOWMEX, CLIENT, CONSULTANT...)"
                        value={newDistLabel}
                        onChange={(e) => setNewDistLabel(e.target.value)}
                        className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500"
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-all active:scale-95"
                    >
                        <Plus size={14} />
                        <span>Add Option</span>
                    </button>
                </form>

                {/* Distribution Badges */}
                <div className="flex flex-wrap gap-2 pt-2">
                    {distributions.map((d, idx) => (
                        <div
                            key={idx}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-50/60 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/40 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300"
                        >
                            <span>{d}</span>
                            <button
                                onClick={() => handleRemoveDistribution(d)}
                                className="text-indigo-400 hover:text-red-500 p-0.5 rounded transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 3. Dynamic Prepared By Presets */}
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                        <UserCheck size={18} className="text-emerald-500" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                            Prepared By Presets ({preparedBys.length})
                        </h3>
                    </div>
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 font-medium">
                        Default author roles / organization sign-offs
                    </span>
                </div>

                {/* Add Prepared By Form */}
                <form onSubmit={handleAddPreparedBy} className="flex items-center space-x-2">
                    <input
                        type="text"
                        placeholder="Enter prepared-by preset (e.g. MANO CPL, SITE ENGINEER...)"
                        value={newPrepLabel}
                        onChange={(e) => setNewPrepLabel(e.target.value)}
                        className="flex-1 px-3.5 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-zinc-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                    <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-all active:scale-95"
                    >
                        <Plus size={14} />
                        <span>Add Option</span>
                    </button>
                </form>

                {/* Prepared By Badges */}
                <div className="flex flex-wrap gap-2 pt-2">
                    {preparedBys.map((p, idx) => (
                        <div
                            key={idx}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-50/60 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300"
                        >
                            <span>{p}</span>
                            <button
                                onClick={() => handleRemovePreparedBy(p)}
                                className="text-emerald-400 hover:text-red-500 p-0.5 rounded transition-colors"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DPRConfig;
