import React, { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';

const VendorFilter = ({ isOpen, onClose, onApply, currentFilters, availableJobs = [] }) => {
    const [jobSearch, setJobSearch] = useState('');
    const [selectedJobs, setSelectedJobs] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);

    useEffect(() => {
        if (isOpen) {
            setSelectedJobs(currentFilters.jobs || []);
            setSelectedCategories(currentFilters.categories || []);
            setJobSearch('');
        }
    }, [isOpen, currentFilters]);

    const categories = ['contractor', 'consultants', 'supplier', 'Other'];

    const filteredJobs = availableJobs.filter(job =>
        jobSearch === '' || job.toLowerCase().includes(jobSearch.toLowerCase())
    );

    const toggleJob = (job) => {
        setSelectedJobs(prev =>
            prev.includes(job) ? prev.filter(j => j !== job) : [...prev, job]
        );
    };

    const toggleCategory = (cat) => {
        setSelectedCategories(prev =>
            prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
        );
    };

    const handleClear = () => {
        setSelectedJobs([]);
        setSelectedCategories([]);
    };

    const handleApply = () => {
        onApply({ jobs: selectedJobs, categories: selectedCategories });
        onClose();
    };

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm z-[4999] transition-all duration-300 ease-out"
                    onClick={onClose}
                />
            )}

            {/* Right Slide-out Drawer */}
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-xl bg-white dark:bg-[#161b22] shadow-2xl z-[5000] transform transition-transform duration-300 flex flex-col border-l border-gray-200 dark:border-white/10 overflow-hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 dark:border-white/5">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Filters</h2>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-8 custom-scrollbar overflow-y-auto flex-1">
                    {/* Nature of Job Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Nature of Job</h3>
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search Jobs..."
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={jobSearch}
                                onChange={(e) => setJobSearch(e.target.value)}
                            />
                        </div>
                        <div className="h-48 overflow-y-auto custom-scrollbar border border-gray-100 dark:border-white/5 rounded-lg p-2 dark:bg-[#0d1117] space-y-1">
                            {filteredJobs.length > 0 ? filteredJobs.map(job => (
                                <label key={job} className="flex items-center space-x-3 p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded cursor-pointer group">
                                    <div className="relative flex items-center justify-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedJobs.includes(job)}
                                            onChange={() => toggleJob(job)}
                                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-transparent dark:checked:bg-blue-500"
                                        />
                                    </div>
                                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{job}</span>
                                </label>
                            )) : (
                                <p className="text-xs text-center p-4 text-gray-500">No jobs found matching "{jobSearch}"</p>
                            )}
                        </div>
                    </div>

                    {/* Category Section */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Category</h3>
                        <div className="border border-gray-100 dark:border-white/5 rounded-lg p-4 dark:bg-[#0d1117] space-y-3">
                            {categories.map(cat => (
                                <label key={cat} className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.includes(cat)}
                                        onChange={() => toggleCategory(cat)}
                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-transparent dark:checked:bg-blue-500"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors capitalize">{cat}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex justify-end space-x-3 bg-gray-50 dark:bg-white/[0.02]">
                    <button
                        onClick={handleClear}
                        className="px-5 py-2.5 text-sm font-medium bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white rounded-lg transition-colors"
                    >
                        Clear Filters
                    </button>
                    <button
                        onClick={handleApply}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>
    );
};

export default VendorFilter;
