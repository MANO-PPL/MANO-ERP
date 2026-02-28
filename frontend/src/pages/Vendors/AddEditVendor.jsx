import React, { useState, useEffect } from 'react';

const AddEditVendor = ({ isOpen, onClose, onSave, initialData = null }) => {
    const [formData, setFormData] = useState({
        company: '',
        category: '',
        person: '',
        email: '',
        mobile: '',
        website: '',
        gst: '',
        address: '',
        reference: '',
        remarks: '',
        jobNature: '',
        location: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({
                company: '', category: '', person: '', email: '', mobile: '', website: '', gst: '', address: '', reference: '', remarks: '', jobNature: '', location: ''
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    const inputClasses = "w-full bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow";
    const labelClasses = "block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5";

    return (
        <div className="fixed inset-0 z-[5000] flex justify-end p-0 sm:p-0 anim-fade-in text-left">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            <div className="relative w-full max-w-2xl bg-white dark:bg-[#161b22] shadow-2xl border-l border-gray-200 dark:border-white/10 overflow-hidden flex flex-col h-full anim-slide-left">

                <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                        {initialData ? 'Edit Vendor' : 'Add New Vendor'}
                    </h2>
                    <p className="text-sm text-gray-500">{initialData ? 'Update the details for the selected vendor.' : 'Fill in the details below to add a new vendor to the system.'}</p>
                </div>

                <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    <form id="vendorForm" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClasses}>Company Name</label>
                            <input type="text" name="company" value={formData.company} onChange={handleChange} className={inputClasses} required />
                        </div>
                        <div>
                            <label className={labelClasses}>Category</label>
                            <select name="category" value={formData.category} onChange={handleChange} className={inputClasses} required>
                                <option value="" disabled>Select Category</option>
                                <option value="Contractor">Contractor</option>
                                <option value="Consultant">Consultant</option>
                                <option value="Supplier">Supplier</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className={labelClasses}>Contact Person</label>
                            <input type="text" name="person" value={formData.person} onChange={handleChange} className={inputClasses} required />
                        </div>
                        <div>
                            <label className={labelClasses}>Email Address</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClasses} required />
                        </div>

                        <div>
                            <label className={labelClasses}>Phone Number</label>
                            <input type="text" name="mobile" value={formData.mobile} onChange={handleChange} className={inputClasses} required />
                        </div>
                        <div>
                            <label className={labelClasses}>Website</label>
                            <input type="text" name="website" value={formData.website} onChange={handleChange} className={inputClasses} />
                        </div>

                        <div>
                            <label className={labelClasses}>GST Number</label>
                            <input type="text" name="gst" value={formData.gst} onChange={handleChange} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Address</label>
                            <input type="text" name="address" value={formData.address} onChange={handleChange} className={inputClasses} required />
                        </div>

                        <div>
                            <label className={labelClasses}>Reference</label>
                            <input type="text" name="reference" value={formData.reference} onChange={handleChange} className={inputClasses} />
                        </div>
                        <div>
                            <label className={labelClasses}>Remarks</label>
                            <input type="text" name="remarks" value={formData.remarks} onChange={handleChange} className={inputClasses} />
                        </div>

                        <div>
                            <label className={labelClasses}>Nature of Job</label>
                            <input type="text" name="jobNature" value={formData.jobNature} onChange={handleChange} placeholder="Start typing to search..." className={inputClasses} required />
                        </div>
                        <div>
                            <label className={labelClasses}>Location</label>
                            <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Start typing to search..." className={inputClasses} />
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
                        form="vendorForm"
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                        {initialData ? 'Update Vendor' : 'Add Vendor'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddEditVendor;
