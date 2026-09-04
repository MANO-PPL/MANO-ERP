import React, { useState, useRef, useEffect } from 'react';
import { Filter, ChevronDown } from 'lucide-react';

const ClientFilterDropdown = ({ activeFilters, onApply, availableSectors = [], availableJobNatures = [] }) => {
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
        (activeFilters.sectors?.length || 0) +
        (activeFilters.jobs?.length || 0);

    const toggleSector = (sectorName) => {
        const current = activeFilters.sectors || [];
        const next = current.includes(sectorName)
            ? current.filter(s => s !== sectorName)
            : [...current, sectorName];
        onApply({ ...activeFilters, sectors: next });
    };

    const toggleJob = (jobName) => {
        const current = activeFilters.jobs || [];
        const next = current.includes(jobName)
            ? current.filter(j => j !== jobName)
            : [...current, jobName];
        onApply({ ...activeFilters, jobs: next });
    };

    const handleReset = () => {
        onApply({ jobs: [], sectors: [] });
    };

    const filteredSectors = availableSectors.filter(s =>
        !sectorSearch || s.sector_name.toLowerCase().includes(sectorSearch.toLowerCase())
    );

    const filteredJobs = availableJobNatures.filter(j =>
        !jobSearch || j.job_name.toLowerCase().includes(jobSearch.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Filter Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${activeCount > 0
                    ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
            >
                <Filter size={13} />
                <span>Filter</span>
                {activeCount > 0 && (
                    <span className="ml-0.5 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                        {activeCount}
                    </span>
                )}
                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Inline Dropdown Popup */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl z-[6000] p-4 font-medium text-xs flex flex-col gap-3 text-gray-800 dark:text-gray-200 select-none">
                    {/* Sector Searchable Section (No Scrollbar) */}
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Sector</p>
                        <input
                            type="text"
                            placeholder="Search sector..."
                            className="w-full px-2.5 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs mb-1.5 focus:outline-none font-semibold text-gray-900 dark:text-white"
                            value={sectorSearch}
                            onChange={e => setSectorSearch(e.target.value)}
                            onKeyDown={e => e.stopPropagation()}
                        />
                        <div
                            className="max-h-32 overflow-y-auto border border-gray-150 dark:border-white/10 rounded-lg p-1 space-y-0.5 [&::-webkit-scrollbar]:hidden"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {filteredSectors.length > 0 ? (
                                filteredSectors.slice(0, 5).map(s => {
                                    const isSelected = (activeFilters.sectors || []).includes(s.sector_name);
                                    return (
                                        <div
                                            key={s.id || s.sector_name}
                                            onClick={() => toggleSector(s.sector_name)}
                                            className={`px-2 py-1 rounded cursor-pointer transition text-xs font-medium ${isSelected
                                                ? 'bg-blue-50 dark:bg-blue-900/30 font-bold text-blue-600 dark:text-blue-400'
                                                : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            {s.sector_name}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[11px] text-gray-400 text-center py-2">No sectors found</p>
                            )}
                        </div>
                    </div>

                    {/* Nature of Job Searchable Section (No Scrollbar) */}
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Nature of Job</p>
                        <input
                            type="text"
                            placeholder="Search job nature..."
                            className="w-full px-2.5 py-1 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded text-xs mb-1.5 focus:outline-none font-semibold text-gray-900 dark:text-white"
                            value={jobSearch}
                            onChange={e => setJobSearch(e.target.value)}
                            onKeyDown={e => e.stopPropagation()}
                        />
                        <div
                            className="max-h-32 overflow-y-auto border border-gray-150 dark:border-white/10 rounded-lg p-1 space-y-0.5 [&::-webkit-scrollbar]:hidden"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {filteredJobs.length > 0 ? (
                                filteredJobs.slice(0, 5).map(j => {
                                    const isSelected = (activeFilters.jobs || []).includes(j.job_name);
                                    return (
                                        <div
                                            key={j.id || j.job_name}
                                            onClick={() => toggleJob(j.job_name)}
                                            className={`px-2 py-1 rounded cursor-pointer transition text-xs font-medium ${isSelected
                                                ? 'bg-blue-50 dark:bg-blue-900/30 font-bold text-blue-600 dark:text-blue-400'
                                                : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                                                }`}
                                        >
                                            {j.job_name}
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-[11px] text-gray-400 text-center py-2">No jobs found</p>
                            )}
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-white/10">
                        <button
                            onClick={handleReset}
                            className="text-[11px] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white font-semibold"
                        >
                            Reset All
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition shadow-sm"
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
