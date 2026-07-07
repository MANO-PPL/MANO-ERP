import React, { useState, useEffect } from 'react';

const AddEditClient = ({ isOpen, onClose, onSave, initialData = null, availableSectors = [], availableJobNatures = [] }) => {
    const [formData, setFormData] = useState({
        name: '',
        contact_person: '',
        designation: '',
        email: '',
        contact_no: '',
        website: '',
        address: '',
        reference: '',
        remarks: '',
        job_nature: '',
        location: '',
        sector: '',
        responsibility: ''
    });

    const [sectorSearch, setSectorSearch] = useState('');
    const [jobNatureSearch, setJobNatureSearch] = useState('');
    const [showSectorDropdown, setShowSectorDropdown] = useState(false);
    const [showJobNatureDropdown, setShowJobNatureDropdown] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                contact_person: initialData.contact_person || '',
                designation: initialData.designation || '',
                email: initialData.email || '',
                contact_no: initialData.contact_no || '',
                website: initialData.website || '',
                address: initialData.address || '',
                reference: initialData.reference || '',
                remarks: initialData.remarks || '',
                job_nature: initialData.job_name || initialData.job_nature || '',
                location: initialData.location || '',
                sector: initialData.sector_name || initialData.sector || '',
                responsibility: initialData.responsibility || ''
            });
            setSectorSearch(initialData.sector_name || initialData.sector || '');
            setJobNatureSearch(initialData.job_name || initialData.job_nature || '');
        } else {
            setFormData({
                name: '', contact_person: '', designation: '', email: '', contact_no: '', website: '', address: '', reference: '', remarks: '', job_nature: '', location: '', sector: '', responsibility: ''
            });
            setSectorSearch('');
            setJobNatureSearch('');
        }
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const inputClasses = "w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow appearance-none cursor-pointer";
    const labelClasses = "block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

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
                className={`fixed top-0 right-0 h-full w-full max-w-2xl bg-white dark:bg-[#161b22] shadow-2xl z-[5000] transform transition-transform duration-300 flex flex-col border-l border-gray-200 dark:border-white/10 overflow-hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >

                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {initialData ? 'Edit Client' : 'Add New Client'}
                    </h2>
                    <p className="text-sm text-gray-500">{initialData ? 'Update the details for the selected client.' : 'Fill in the details below to add a new client to the system.'}</p>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    <form id="clientForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>Company Name</label>
                            <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClasses} required />
                        </div>
                        <div>
                            <label className={labelClasses}>Contact Person</label>
                            <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} className={inputClasses} required />
                        </div>
                        <div>
                            <label className={labelClasses}>Designation</label>
                            <input type="text" name="designation" value={formData.designation} onChange={handleChange} placeholder="e.g. Manager, CEO" className={inputClasses} />
                        </div>

                        <div>
                            <label className={labelClasses}>Email Address</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClasses} required />
                        </div>
                        <div>
                            <label className={labelClasses}>Contact Number</label>
                            <input type="text" name="contact_no" value={formData.contact_no} onChange={handleChange} className={inputClasses} required />
                        </div>

                        <div>
                            <label className={labelClasses}>Website</label>
                            <input type="text" name="website" value={formData.website} onChange={handleChange} className={inputClasses} />
                        </div>

                        <div className="md:col-span-2">
                            <label className={labelClasses}>Address</label>
                            <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClasses} required />
                        </div>

                        <div>
                            <label className={labelClasses}>Location</label>
                            <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g. Indore, Mumbai" className={inputClasses} />
                        </div>
                        <div className="relative">
                            <label className={labelClasses}>Nature of Job</label>
                            <input
                                type="text"
                                name="job_nature"
                                value={jobNatureSearch}
                                onChange={(e) => {
                                    setJobNatureSearch(e.target.value);
                                    setFormData(prev => ({ ...prev, job_nature: e.target.value }));
                                }}
                                onFocus={() => setShowJobNatureDropdown(true)}
                                onBlur={() => setTimeout(() => setShowJobNatureDropdown(false), 200)}
                                placeholder="e.g. Interior Designer"
                                className={inputClasses}
                            />
                            {showJobNatureDropdown && availableJobNatures.filter(j => j.job_name.toLowerCase().includes(jobNatureSearch.toLowerCase())).length > 0 && (
                                <div className="absolute z-[6000] w-full mt-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl max-h-40 overflow-y-auto custom-scrollbar">
                                    {availableJobNatures
                                        .filter(j => j.job_name.toLowerCase().includes(jobNatureSearch.toLowerCase()))
                                        .map(j => (
                                            <div
                                                key={j.job_id}
                                                className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-white/5 cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors"
                                                onClick={() => {
                                                    setJobNatureSearch(j.job_name);
                                                    setFormData(prev => ({ ...prev, job_nature: j.job_name }));
                                                    setShowJobNatureDropdown(false);
                                                }}
                                            >
                                                {j.job_name}
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <label className={labelClasses}>Sector</label>
                            <input
                                type="text"
                                name="sector"
                                value={sectorSearch}
                                onChange={(e) => {
                                    setSectorSearch(e.target.value);
                                    setFormData(prev => ({ ...prev, sector: e.target.value }));
                                }}
                                onFocus={() => setShowSectorDropdown(true)}
                                onBlur={() => setTimeout(() => setShowSectorDropdown(false), 200)}
                                placeholder="e.g. IT, Manufacturing"
                                className={inputClasses}
                            />
                            {showSectorDropdown && availableSectors.filter(s => s.sector_name.toLowerCase().includes(sectorSearch.toLowerCase())).length > 0 && (
                                <div className="absolute z-[6000] w-full mt-1 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl max-h-40 overflow-y-auto custom-scrollbar">
                                    {availableSectors
                                        .filter(s => s.sector_name.toLowerCase().includes(sectorSearch.toLowerCase()))
                                        .map(s => (
                                            <div
                                                key={s.sector_id}
                                                className="px-4 py-2 hover:bg-blue-50 dark:hover:bg-white/5 cursor-pointer text-sm text-gray-700 dark:text-gray-300 transition-colors"
                                                onClick={() => {
                                                    setSectorSearch(s.sector_name);
                                                    setFormData(prev => ({ ...prev, sector: s.sector_name }));
                                                    setShowSectorDropdown(false);
                                                }}
                                            >
                                                {s.sector_name}
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                        <div>
                            <label className={labelClasses}>Responsibility</label>
                            <input type="text" name="responsibility" value={formData.responsibility} onChange={handleChange} placeholder="e.g. Sales, Technical" className={inputClasses} />
                        </div>

                        <div>
                            <label className={labelClasses}>Reference</label>
                            <input type="text" name="reference" value={formData.reference} onChange={handleChange} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Remarks</label>
                            <input type="text" name="remarks" value={formData.remarks} onChange={handleChange} className={inputClasses} />
                        </div>
                    </form>
                </div>

                <div className="px-8 py-5 border-t border-gray-100 dark:border-white/5 flex justify-end space-x-3 bg-gray-50 dark:bg-white/[0.02]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="clientForm"
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                        {initialData ? 'Update Client' : 'Add Client'}
                    </button>
                </div>
            </div>
        </>
    );
};

export default AddEditClient;
