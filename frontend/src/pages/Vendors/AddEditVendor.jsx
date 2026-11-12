import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Check, Plus } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import ManageMetadataModal from '../../components/ManageMetadataModal';

/**
 * Modal form for creating and editing vendor profiles across active trade categories
 * (Consultant, Contractor, Supplier, Manufacturer, Other).
 */
const AddEditVendor = ({
    isOpen,
    onClose,
    onSave,
    initialData = null,
    allJobNatures = [],
    availableJobNatures = [],
    jobOptions = [],
    categoryOptions = ['Consultant', 'Contractor', 'Supplier', 'Manufacturer', 'Other'],
    onRefreshMetadata
}) => {
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        contact_person: '',
        designation: '',
        email: '',
        contact_no: '',
        mobile: '',
        website: '',
        gst_no: '',
        address: '',
        reference: '',
        responsibility: '',
        remarks: '',
        job_nature: '',
        location: ''
    });

    const [jobNatureSearch, setJobNatureSearch] = useState('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showJobNatureDropdown, setShowJobNatureDropdown] = useState(false);
    const [isAddingJobNature, setIsAddingJobNature] = useState(false);
    const [isJobNatureModalOpen, setIsJobNatureModalOpen] = useState(false);

    const jobNatureContainerRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (jobNatureContainerRef.current && !jobNatureContainerRef.current.contains(e.target)) {
                setShowJobNatureDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Combine previous values from metadata lists, passed options, and existing records
    const combinedJobOptions = useMemo(() => {
        const set = new Set();
        (jobOptions || []).forEach((o) => o && set.add(String(o).trim()));
        (allJobNatures.length ? allJobNatures : availableJobNatures || []).forEach((j) => {
            const name = typeof j === 'object' ? (j?.job_name || j?.name) : String(j || '');
            if (name && name.trim()) set.add(name.trim());
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [jobOptions, allJobNatures, availableJobNatures]);

    const filteredJobNatures = useMemo(() => {
        const query = jobNatureSearch.trim().toLowerCase();
        if (!query) return combinedJobOptions;
        return combinedJobOptions.filter((j) => j.toLowerCase().includes(query));
    }, [combinedJobOptions, jobNatureSearch]);

    const isNewJobNature = Boolean(
        jobNatureSearch.trim() &&
        !combinedJobOptions.some((j) => j.toLowerCase() === jobNatureSearch.trim().toLowerCase())
    );

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                category: initialData.category || '',
                contact_person: initialData.contact_person || '',
                designation: initialData.designation || '',
                email: initialData.email || '',
                contact_no: initialData.contact_no || initialData.telephone_no || '',
                mobile: initialData.mobile || '',
                website: initialData.website || '',
                gst_no: initialData.gst_no || '',
                address: initialData.address || '',
                reference: initialData.reference || '',
                responsibility: initialData.responsibility || '',
                remarks: initialData.remarks || '',
                job_nature: initialData.job_name || initialData.job_nature || '',
                location: initialData.location || ''
            });
            setJobNatureSearch(initialData.job_name || initialData.job_nature || '');
        } else {
            setFormData({
                name: '',
                category: '',
                contact_person: '',
                designation: '',
                email: '',
                contact_no: '',
                mobile: '',
                website: '',
                gst_no: '',
                address: '',
                reference: '',
                responsibility: '',
                remarks: '',
                job_nature: '',
                location: ''
            });
            setJobNatureSearch('');
        }
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const handleQuickAddJobNature = async (name) => {
        const val = (name || jobNatureSearch).trim();
        if (!val) return;
        setIsAddingJobNature(true);
        try {
            await api.post('/admin/job-natures', { job_name: val });
            toast.success(`"${val}" added to Nature of Jobs`);
            if (onRefreshMetadata) onRefreshMetadata();
        } catch (err) {
            console.error('Failed to create job nature:', err);
        } finally {
            setIsAddingJobNature(false);
        }
        setFormData((prev) => ({ ...prev, job_nature: val }));
        setJobNatureSearch(val);
        setShowJobNatureDropdown(false);
    };

    const inputClasses =
        'w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow appearance-none cursor-pointer';
    const labelClasses = 'block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5';

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
                className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-[#161b22] shadow-2xl z-[5000] transform transition-transform duration-300 flex flex-col border-l border-gray-200 dark:border-white/10 overflow-hidden ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {initialData ? 'Edit Vendor' : 'Add New Vendor'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {initialData
                            ? 'Update the details for the selected vendor.'
                            : 'Fill in the details below to add a new vendor to the system.'}
                    </p>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    <form id="vendorForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>Company Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                className={inputClasses}
                                required
                            />
                        </div>
                        <div className="relative">
                            <label className={labelClasses}>Category</label>
                            <div className="relative">
                                <div
                                    className={`${inputClasses} flex items-center justify-between cursor-pointer`}
                                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                >
                                    <span
                                        className={
                                            formData.category
                                                ? 'text-gray-900 dark:text-gray-100 capitalize'
                                                : 'text-gray-400'
                                        }
                                    >
                                        {formData.category || 'Select Category'}
                                    </span>
                                    <div
                                        className={`text-gray-400 transition-transform duration-200 ${
                                            showCategoryDropdown ? 'rotate-180' : ''
                                        }`}
                                    >
                                        <ChevronDown size={14} />
                                    </div>
                                </div>

                                {showCategoryDropdown && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-[5500]"
                                            onClick={() => setShowCategoryDropdown(false)}
                                        />
                                        <div className="absolute z-[6000] w-full mt-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden anim-fade-in flex flex-col">
                                            {categoryOptions.map((cat) => (
                                                <div
                                                    key={cat}
                                                    className="px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-white/5 cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors block w-full text-left"
                                                    onClick={() => {
                                                        setFormData((prev) => ({ ...prev, category: cat }));
                                                        setShowCategoryDropdown(false);
                                                    }}
                                                >
                                                    <span className="capitalize">{cat}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className={labelClasses}>Contact Person</label>
                            <input
                                type="text"
                                name="contact_person"
                                value={formData.contact_person}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>

                        <div>
                            <label className={labelClasses}>Designation</label>
                            <input
                                type="text"
                                name="designation"
                                value={formData.designation}
                                onChange={handleChange}
                                placeholder="e.g. Manager"
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>Email Address</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={inputClasses}
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClasses}>Contact Number</label>
                            <input
                                type="text"
                                name="contact_no"
                                value={formData.contact_no}
                                onChange={handleChange}
                                className={inputClasses}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>Website</label>
                            <input
                                type="text"
                                name="website"
                                value={formData.website}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>

                        <div>
                            <label className={labelClasses}>GST Number</label>
                            <input
                                type="text"
                                name="gst_no"
                                value={formData.gst_no}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>Address</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className={inputClasses}
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClasses}>Reference</label>
                            <input
                                type="text"
                                name="reference"
                                value={formData.reference}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>Responsibility</label>
                            <input
                                type="text"
                                name="responsibility"
                                value={formData.responsibility}
                                onChange={handleChange}
                                placeholder="e.g. Sales"
                                className={inputClasses}
                            />
                        </div>
                        <div>
                            <label className={labelClasses}>Remarks</label>
                            <input
                                type="text"
                                name="remarks"
                                value={formData.remarks}
                                onChange={handleChange}
                                className={inputClasses}
                            />
                        </div>

                        {/* Nature of Job with Dropdown & Option to Add New */}
                        <div className="relative" ref={jobNatureContainerRef}>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className={labelClasses}>Nature of Job</label>
                                <button
                                    type="button"
                                    onClick={() => setIsJobNatureModalOpen(true)}
                                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Open Manage Nature of Jobs"
                                >
                                    <Plus size={11} className="stroke-[2.5]" />
                                    <span>Add / Manage</span>
                                </button>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    name="job_nature"
                                    value={jobNatureSearch}
                                    onChange={(e) => {
                                        setJobNatureSearch(e.target.value);
                                        setFormData((prev) => ({ ...prev, job_nature: e.target.value }));
                                        setShowJobNatureDropdown(true);
                                    }}
                                    onFocus={() => setShowJobNatureDropdown(true)}
                                    placeholder="e.g. Interior Designer"
                                    className={`${inputClasses} pr-9`}
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowJobNatureDropdown((prev) => !prev)}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                                >
                                    <ChevronDown
                                        size={14}
                                        className={`transition-transform duration-200 ${
                                            showJobNatureDropdown ? 'rotate-180 text-blue-500' : ''
                                        }`}
                                    />
                                </button>
                            </div>

                            {showJobNatureDropdown && (
                                <div className="absolute z-[6000] w-full mt-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-2xl max-h-56 overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95">
                                    {/* Option to create new if typed text doesn't exist */}
                                    {isNewJobNature && (
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => handleQuickAddJobNature(jobNatureSearch)}
                                            disabled={isAddingJobNature}
                                            className="w-full text-left px-3.5 py-2.5 bg-blue-50/70 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between transition-colors cursor-pointer"
                                        >
                                            <span className="truncate">
                                                + Add "{jobNatureSearch.trim()}" as new Nature of Job
                                            </span>
                                            <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-blue-600 text-white shrink-0 ml-2">
                                                {isAddingJobNature ? 'Adding...' : 'Create'}
                                            </span>
                                        </button>
                                    )}

                                    {/* Scrollable list of existing values */}
                                    <div className="overflow-y-auto custom-scrollbar flex-1 max-h-40 divide-y divide-gray-100 dark:divide-white/5">
                                        {filteredJobNatures.length > 0 ? (
                                            filteredJobNatures.map((j) => (
                                                <div
                                                    key={j}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={() => {
                                                        setJobNatureSearch(j);
                                                        setFormData((prev) => ({ ...prev, job_nature: j }));
                                                        setShowJobNatureDropdown(false);
                                                    }}
                                                    className={`px-3.5 py-2 hover:bg-blue-50/70 dark:hover:bg-white/5 cursor-pointer flex items-center justify-between transition-colors text-gray-800 dark:text-gray-200 ${
                                                        formData.job_nature === j
                                                            ? 'bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 font-semibold'
                                                            : ''
                                                    }`}
                                                >
                                                    <span className="truncate">{j}</span>
                                                    {formData.job_nature === j && (
                                                        <Check size={12} className="stroke-[3] text-blue-600" />
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            !isNewJobNature && (
                                                <div className="px-3.5 py-3 text-center text-gray-400 dark:text-gray-500 italic">
                                                    No previous values found
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={labelClasses}>Location</label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                placeholder="e.g. Indore, Mumbai"
                                className={inputClasses}
                            />
                        </div>
                    </form>
                </div>

                <div className="px-8 py-5 border-t border-gray-100 dark:border-white/5 flex justify-end space-x-3 bg-gray-50 dark:bg-white/[0.02]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="vendorForm"
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] cursor-pointer"
                    >
                        {initialData ? 'Update Vendor' : 'Add Vendor'}
                    </button>
                </div>
            </div>

            {/* Embedded Manage Metadata Modal for Job Natures */}
            {isJobNatureModalOpen && (
                <ManageMetadataModal
                    isOpen={isJobNatureModalOpen}
                    onClose={() => {
                        setIsJobNatureModalOpen(false);
                        if (onRefreshMetadata) onRefreshMetadata();
                    }}
                    type="job_natures"
                    title="Manage Nature of Jobs"
                    onUpdate={() => {
                        if (onRefreshMetadata) onRefreshMetadata();
                    }}
                />
            )}
        </>
    );
};

export default AddEditVendor;
