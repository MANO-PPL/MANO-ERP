import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, Filter, Search, ChevronDown, Pencil, Trash2, Info, Plus, X } from 'lucide-react';
import VendorDetails from './VendorDetails';
import VendorFilter from './VendorFilter';
import AddEditVendor from './AddEditVendor';

const VendorsList = () => {
    // Initial mock data based on the screenshot provided
    const [vendors, setVendors] = useState([
        { id: 1, company: 'Dhanraj & sons', jobNature: 'Interior Designer', person: 'Purvesh Nahar', mobile: '9977836126', email: 'purvesh.drs@gmail.com', address: '129 GOPUR COLONY, INDORE 4520...', category: 'Contractor', telephone: '-', gst: 'NA', location: '-', website: 'NA', reference: '"PRIMA PLASTICS LTD"' },
        { id: 2, company: '"U" Know Urself', jobNature: 'Life Coach', person: 'Gaurang Patel', mobile: '9909115475', email: 'gaurangsays@gmail.com', address: 'Mumbai', category: 'Consultant' },
        { id: 3, company: '241 Design Studio', jobNature: 'Graphic Designer', person: 'Shikha Salecha', mobile: '9960598784', email: 'salechashikha@gmail.com', address: 'Pune', category: 'Other' },
        { id: 4, company: '3SP Projects', jobNature: 'Interior Designer', person: 'Swapneel Ghosalkar', mobile: '9819712683', email: 'swapneel.ghosalkar@3sp.co.in', address: 'Nesco it park,goregaon East mumba...', category: 'Contractor' },
        { id: 5, company: '7 Apple', jobNature: 'Hotel Developer', person: 'Manoj Bagri', mobile: '9821870792', email: 'manoj.bagri@7applehotels.com', address: '803, Raheja Centre, Nariman Point, M...', category: 'Consultant' },
        { id: 6, company: '7 Apple', jobNature: 'Hotel Developer', person: 'Swati Bagri', mobile: '9821882872', email: 'swati.bagri@7applehotels.com', address: '812, Raheja Centre, Nariman Point, M...', category: 'Consultant' },
        { id: 7, company: '7th Heaven', jobNature: 'Interiors', person: 'Deepali Nakhare', mobile: '8035248162', email: '7heaveninterior@gmail.com', address: 'FB 14 Highland corporate center, Ab...', category: 'Contractor' },
        { id: 8, company: '99 Decor', jobNature: 'Furniture', person: 'Vipul Parekh/Vijay Parekh', mobile: '9820063851', email: '99decor2019@gmail.com', address: '536, Patthe Bapurao Road, 1st carpe...', category: 'Supplier' },
        { id: 9, company: 'A & D Computers Pvt. Ltd.', jobNature: 'Computer Hardware and Software Supplier', person: 'Amit Bhangale', mobile: '9967622872', email: 'amit@andmumbai.com', address: '1st floor, Gokul Building, Jay Prakash...', category: 'Supplier' },
        { id: 10, company: 'A & H Meyer', jobNature: 'Electrical Hardware', person: 'A & H Meyer', mobile: '-', email: 'info@frasertechno.com', address: 'Room Plaza, 4th Floor, No. 500/1, 4t...', category: 'Supplier' }
    ]);

    // Modal States
    const [viewingVendor, setViewingVendor] = useState(null);
    const [editingVendor, setEditingVendor] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isJobNatureModalOpen, setIsJobNatureModalOpen] = useState(false);
    const [newJobNature, setNewJobNature] = useState('');
    const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsManageDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter & Search States
    const [searchFilters, setSearchFilters] = useState({ company: '', jobNature: '', person: '' });
    const [activeFilters, setActiveFilters] = useState({ jobs: [], categories: [] });
    const [hoveredRow, setHoveredRow] = useState(null);

    // Derived Data
    const availableJobs = [...new Set(vendors.map(v => v.jobNature).filter(Boolean))];

    const filteredVendors = vendors.filter(v => {
        // Text searches
        const matchesCompany = v.company.toLowerCase().includes(searchFilters.company.toLowerCase());
        const matchesJob = v.jobNature.toLowerCase().includes(searchFilters.jobNature.toLowerCase());
        const matchesPerson = v.person.toLowerCase().includes(searchFilters.person.toLowerCase());

        // Modal Filters
        const matchesCategoryFilter = activeFilters.categories.length === 0 || activeFilters.categories.includes(v.category);
        const matchesJobFilter = activeFilters.jobs.length === 0 || activeFilters.jobs.includes(v.jobNature);

        return matchesCompany && matchesJob && matchesPerson && matchesCategoryFilter && matchesJobFilter;
    });

    const handleSaveVendor = (vendorData) => {
        if (editingVendor) {
            setVendors(prev => prev.map(v => v.id === editingVendor.id ? { ...vendorData, id: v.id } : v));
        } else {
            setVendors(prev => [...prev, { ...vendorData, id: Math.max(...prev.map(p => p.id), 0) + 1 }]);
        }
    };

    const handleDeleteVendor = (id) => {
        setVendors(prev => prev.filter(v => v.id !== id));
    };

    const handleAddJobNature = (e) => {
        e.preventDefault();
        if (newJobNature.trim()) {
            // In a real app, this would save to a database lookup table
            setIsJobNatureModalOpen(false);
            setNewJobNature('');
            // Optional: Toast notification here
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full">
            {/* Header Area */}
            <div className="px-8 py-8 flex flex-col gap-6 lg:flex-row lg:justify-between lg:items-end border-b border-gray-200 dark:border-white/5 shrink-0 relative overflow-visible z-20">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">Vendor List</h1>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">A continuous list of all project-related vendors and contacts.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex space-x-2">
                        <div className="relative">
                            <input
                                type="text" placeholder="Company.."
                                className="w-36 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                                value={searchFilters.company} onChange={e => setSearchFilters(prev => ({ ...prev, company: e.target.value }))}
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="text" placeholder="Job Nature.."
                                className="w-36 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                                value={searchFilters.jobNature} onChange={e => setSearchFilters(prev => ({ ...prev, jobNature: e.target.value }))}
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="text" placeholder="Person.."
                                className="w-36 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                                value={searchFilters.person} onChange={e => setSearchFilters(prev => ({ ...prev, person: e.target.value }))}
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`flex items-center space-x-2 px-6 py-2 border rounded-lg text-sm font-medium transition-all ${(activeFilters.categories.length > 0 || activeFilters.jobs.length > 0) ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'border-blue-500 bg-blue-600 dark:bg-blue-600 text-white hover:bg-blue-700'}`}
                    >
                        <span>Filter</span>
                        <Filter size={16} fill="currentColor" className={activeFilters.categories.length > 0 || activeFilters.jobs.length > 0 ? '' : 'text-white'} />
                        {(activeFilters.categories.length > 0 || activeFilters.jobs.length > 0) && (
                            <span className="ml-1 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                {activeFilters.categories.length + activeFilters.jobs.length}
                            </span>
                        )}
                    </button>

                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsManageDropdownOpen(!isManageDropdownOpen)}
                            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                        >
                            <span>Manage Vendors</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isManageDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isManageDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#161b22] rounded-lg shadow-xl border border-gray-200 dark:border-white/10 z-[5000] anim-fade-in overflow-hidden">
                                <button
                                    onClick={() => { setIsAddModalOpen(true); setIsManageDropdownOpen(false); }}
                                    className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                                >
                                    <Plus size={16} className="mr-3 text-blue-500" />
                                    Add Vendor
                                </button>
                                <button
                                    onClick={() => { setIsJobNatureModalOpen(true); setIsManageDropdownOpen(false); }}
                                    className="w-full flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border-t border-gray-100 dark:border-white/5 transition-colors"
                                >
                                    <Plus size={16} className="mr-3 text-blue-500" />
                                    Add Job Nature
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar p-0">
                <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-widest text-[10px] uppercase font-bold">
                        <tr>
                            <th className="px-3 py-4 w-6"></th>
                            <th className="px-4 py-4 w-12 text-center">SR NO</th>
                            <th className="px-4 py-4">COMPANY</th>
                            <th className="px-4 py-4">NATURE OF THE JOB</th>
                            <th className="px-4 py-4">NAME OF THE PERSON</th>
                            <th className="px-4 py-4">MOBILE NO</th>
                            <th className="px-4 py-4">EMAIL ID</th>
                            <th className="px-4 py-4">ADDRESS</th>
                            <th className="px-4 py-4 text-center">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {filteredVendors.map((vendor, idx) => (
                            <tr
                                key={vendor.id}
                                className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 relative"
                                onMouseEnter={() => setHoveredRow(idx)}
                                onMouseLeave={() => setHoveredRow(null)}
                                onClick={() => setViewingVendor(vendor)}
                            >
                                <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                                    <GripVertical size={14} className="text-transparent group-hover/row:text-gray-400 dark:group-hover/row:text-gray-500 hover:!text-blue-500 transition-colors mx-auto cursor-grab active:cursor-grabbing" />
                                </td>
                                <td className="px-4 py-3 text-center font-mono text-gray-400">{idx + 1}</td>
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 cursor-pointer">{vendor.company}</td>
                                <td className="px-4 py-3">{vendor.jobNature}</td>
                                <td className="px-4 py-3">{vendor.person}</td>
                                <td className="px-4 py-3 font-mono text-xs">{vendor.mobile}</td>
                                <td className="px-4 py-3 text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" onClick={e => e.stopPropagation()}>
                                    <a href={`mailto:${vendor.email}`}>{vendor.email}</a>
                                </td>
                                <td className="px-4 py-3 truncate max-w-[200px]" title={vendor.address}>{vendor.address}</td>
                                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                    <div className={`flex items-center justify-center space-x-2 transition-opacity duration-200 ${hoveredRow === idx ? 'opacity-100' : 'opacity-0'}`}>
                                        <button
                                            onClick={() => setViewingVendor(vendor)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
                                            title="View Details"
                                        >
                                            <Info size={16} />
                                        </button>
                                        <button
                                            onClick={() => { setEditingVendor(vendor); setIsAddModalOpen(true); }}
                                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-all"
                                            title="Edit Vendor"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteVendor(vendor.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                            title="Delete Vendor"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredVendors.length === 0 && (
                            <tr>
                                <td colSpan="9" className="py-12 text-center text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <Search size={24} className="text-gray-400" />
                                        </div>
                                        <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">No vendors found</p>
                                        <p className="text-sm">Try adjusting your filters or search terms.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            <VendorFilter
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                currentFilters={activeFilters}
                availableJobs={availableJobs}
                onApply={(filters) => setActiveFilters(filters)}
            />

            <AddEditVendor
                isOpen={isAddModalOpen}
                onClose={() => { setIsAddModalOpen(false); setEditingVendor(null); }}
                initialData={editingVendor}
                onSave={handleSaveVendor}
            />

            <VendorDetails
                isOpen={!!viewingVendor}
                onClose={() => setViewingVendor(null)}
                vendor={viewingVendor}
            />

            {/* Add Job Nature Modal */}
            {isJobNatureModalOpen && (
                <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 anim-fade-in text-left">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsJobNatureModalOpen(false)}></div>
                    <div className="relative w-full max-w-sm bg-white dark:bg-[#161b22] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col anim-slide-up">
                        <div className="px-5 py-4 flex justify-between items-center border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                            <h2 className="text-base font-bold text-gray-900 dark:text-white">Add Nature of Job</h2>
                            <button onClick={() => setIsJobNatureModalOpen(false)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleAddJobNature} className="p-5">
                            <input
                                type="text"
                                placeholder="Enter Job Nature (e.g. Electrical)"
                                value={newJobNature}
                                onChange={(e) => setNewJobNature(e.target.value)}
                                className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                                autoFocus
                                required
                            />
                            <div className="flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsJobNatureModalOpen(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Add
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VendorsList;
