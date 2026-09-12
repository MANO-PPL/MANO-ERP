import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Filter, ChevronDown, Search, X, Check } from 'lucide-react';

/**
 * Popover filter component for Clients directory with dual multi-selection
 * for business sectors and job natures with left-anchored placement.
 */
const ClientFilterDropdown = ({
    activeFilters = { sectors: [], jobs: [] },
    onApply,
    setActiveFilters,
    availableSectors = [],
    allSectors = [],
    availableJobNatures = [],
    allJobNatures = []
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [sectorSearch, setSectorSearch] = useState('');
    const [jobSearch, setJobSearch] = useState('');
    const dropdownRef = useRef(null);

    // Auto-close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const activeCount =
        (activeFilters?.sectors?.length || 0) +
        (activeFilters?.jobs?.length || 0);

    const applyFilters = (nextFilters) => {
        if (typeof onApply === 'function') {
            onApply(nextFilters);
        } else if (typeof setActiveFilters === 'function') {
            setActiveFilters(nextFilters);
        }
    };

    const toggleSector = (sectorName) => {
        const current = activeFilters?.sectors || [];
        const next = current.includes(sectorName)
            ? current.filter((s) => s !== sectorName)
            : [...current, sectorName];
        applyFilters({ ...(activeFilters || {}), sectors: next });
    };

    const toggleJob = (jobName) => {
        const current = activeFilters?.jobs || [];
        const next = current.includes(jobName)
            ? current.filter((j) => j !== jobName)
            : [...current, jobName];
        applyFilters({ ...(activeFilters || {}), jobs: next });
    };

    const handleReset = () => {
        applyFilters({ jobs: [], sectors: [] });
    };

    const effectiveSectors = useMemo(() => {
        const raw = availableSectors?.length ? availableSectors : (allSectors || []);
        const set = new Set();
        const list = [];
        raw.forEach((s) => {
            const name = typeof s === 'string' ? s.trim() : (s?.sector_name || s?.name || '').trim();
            if (name && !set.has(name.toLowerCase())) {
                set.add(name.toLowerCase());
                list.push({ id: s?.id || name, sector_name: name });
            }
        });
        return list.sort((a, b) => a.sector_name.localeCompare(b.sector_name));
    }, [availableSectors, allSectors]);

    const effectiveJobNatures = useMemo(() => {
        const raw = availableJobNatures?.length ? availableJobNatures : (allJobNatures || []);
        const set = new Set();
        const list = [];
        raw.forEach((j) => {
            const name = typeof j === 'string' ? j.trim() : (j?.job_name || j?.name || '').trim();
            if (name && !set.has(name.toLowerCase())) {
                set.add(name.toLowerCase());
                list.push({ id: j?.id || name, job_name: name });
            }
        });
        return list.sort((a, b) => a.job_name.localeCompare(b.job_name));
    }, [availableJobNatures, allJobNatures]);

    const filteredSectors = useMemo(() => {
        if (!sectorSearch.trim()) return effectiveSectors;
        const q = sectorSearch.trim().toLowerCase();
        return effectiveSectors.filter((s) => s.sector_name.toLowerCase().includes(q));
    }, [effectiveSectors, sectorSearch]);

    const filteredJobs = useMemo(() => {
        if (!jobSearch.trim()) return effectiveJobNatures;
        const q = jobSearch.trim().toLowerCase();
        return effectiveJobNatures.filter((j) => j.job_name.toLowerCase().includes(q));
    }, [effectiveJobNatures, jobSearch]);

    return (
        <div className={`relative ${isOpen ? 'z-50' : ''}`} ref={dropdownRef}>
            {/* Filter Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer shadow-2xs ${
                    activeCount > 0
                        ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold'
                        : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
                title="Filter clients by sector or nature of job"
            >
                <Filter size={13} />
                <span>Filter</span>
                {activeCount > 0 && (
                    <span className="ml-0.5 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {activeCount}
                    </span>
                )}
                <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Inline Dropdown Popup */}
            {isOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-80 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[6000] p-4 font-medium text-xs flex flex-col gap-3 text-gray-800 dark:text-gray-200 select-none animate-in fade-in zoom-in-95">
                    {/* Sector Searchable Section */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Sector</p>
                            {activeFilters?.sectors?.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => applyFilters({ ...(activeFilters || {}), sectors: [] })}
                                    className="text-[10px] text-blue-500 hover:underline font-semibold cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="relative mb-1.5">
                            <input
                                type="text"
                                placeholder="Search sector..."
                                className="w-full pl-7 pr-7 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-900 dark:text-white"
                                value={sectorSearch}
                                onChange={(e) => setSectorSearch(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                            />
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            {sectorSearch && (
                                <button
                                    type="button"
                                    onClick={() => setSectorSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                                >
                                    <X size={11} />
                                </button>
                            )}
                        </div>
                        <div className="max-h-32 overflow-y-auto border border-gray-150 dark:border-white/10 rounded-lg p-1 space-y-0.5 scrollbar-thin">
                            {filteredSectors.length > 0 ? (
                                filteredSectors.map((s) => {
                                    const isSelected = (activeFilters?.sectors || []).includes(s.sector_name);
                                    return (
                                        <div
                                            key={s.id || s.sector_name}
                                            onClick={() => toggleSector(s.sector_name)}
                                            className={`px-2 py-1.5 rounded cursor-pointer transition text-xs font-medium flex items-center justify-between ${
                                                isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 font-bold text-blue-600 dark:text-blue-400'
                                                    : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <span className="truncate">{s.sector_name}</span>
                                            {isSelected && (
                                                <Check size={12} className="stroke-[3] text-blue-600 dark:text-blue-400 shrink-0 ml-1.5" />
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[11px] text-gray-400 text-center py-2">
                                    {sectorSearch ? 'No matching sectors' : 'No sectors found'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Nature of Job Searchable Section */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Nature of Job</p>
                            {activeFilters?.jobs?.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => applyFilters({ ...(activeFilters || {}), jobs: [] })}
                                    className="text-[10px] text-blue-500 hover:underline font-semibold cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <div className="relative mb-1.5">
                            <input
                                type="text"
                                placeholder="Search job nature..."
                                className="w-full pl-7 pr-7 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-gray-900 dark:text-white"
                                value={jobSearch}
                                onChange={(e) => setJobSearch(e.target.value)}
                                onKeyDown={(e) => e.stopPropagation()}
                            />
                            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            {jobSearch && (
                                <button
                                    type="button"
                                    onClick={() => setJobSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                                >
                                    <X size={11} />
                                </button>
                            )}
                        </div>
                        <div className="max-h-32 overflow-y-auto border border-gray-150 dark:border-white/10 rounded-lg p-1 space-y-0.5 scrollbar-thin">
                            {filteredJobs.length > 0 ? (
                                filteredJobs.map((j) => {
                                    const isSelected = (activeFilters?.jobs || []).includes(j.job_name);
                                    return (
                                        <div
                                            key={j.id || j.job_name}
                                            onClick={() => toggleJob(j.job_name)}
                                            className={`px-2 py-1.5 rounded cursor-pointer transition text-xs font-medium flex items-center justify-between ${
                                                isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 font-bold text-blue-600 dark:text-blue-400'
                                                    : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <span className="truncate">{j.job_name}</span>
                                            {isSelected && (
                                                <Check size={12} className="stroke-[3] text-blue-600 dark:text-blue-400 shrink-0 ml-1.5" />
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[11px] text-gray-400 text-center py-2">
                                    {jobSearch ? 'No matching jobs' : 'No jobs found'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-white/10">
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={activeCount === 0}
                            className="text-[11px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            Reset All
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientFilterDropdown;
