import React from 'react';
import { X, Copy, Pencil, Trash2 } from 'lucide-react';

const VendorDetails = ({ isOpen, onClose, vendor, onEdit, onDelete, canWrite }) => {
    if (!isOpen || !vendor) return null;

    const handleCopy = () => {
        const detailsText = `
Company: ${vendor.name}
Category: ${vendor.category}
Contact Person: ${vendor.contact_person}
Nature of Job: ${vendor.job_name}
Mobile: ${vendor.mobile}
Email: ${vendor.email}
Telephone: ${vendor.telephone || '-'}
GST No: ${vendor.gst_no || 'NA'}
Location: ${vendor.location || '-'}
Website: ${vendor.website || 'NA'}
Address: ${vendor.address}
Reference: ${vendor.reference || '-'}
        `.trim();
        navigator.clipboard.writeText(detailsText);
    };

    return (
        <div className="fixed inset-0 z-[5000] flex justify-end p-0 sm:p-0 anim-fade-in text-left">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#0d1117] shadow-2xl border-l border-gray-200 dark:border-white/10 overflow-hidden flex flex-col h-full anim-slide-left">

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{vendor.name}</h2>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider">{vendor.category || 'VENDOR'}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Contact Person</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{vendor.contact_person || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Nature of Job</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{vendor.job_name || '-'}</p>
                        </div>

                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Mobile</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{vendor.mobile || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Email</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{vendor.email || '-'}</p>
                        </div>

                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Telephone</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{vendor.telephone || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">GST NO</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{vendor.gst_no || 'NA'}</p>
                        </div>

                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Location</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-200">{vendor.location || '-'}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Website</p>
                            {vendor.website && vendor.website !== 'NA' ? (
                                <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                    {vendor.website}
                                </a>
                            ) : (
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-200">NA</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-2">Address</p>
                        <div className="p-3 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-lg text-sm text-gray-800 dark:text-gray-300">
                            {vendor.address || '-'}
                        </div>
                    </div>

                    {vendor.reference && (
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Reference</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-300 italic">"{vendor.reference}"</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center gap-3">
                    <button
                        onClick={handleCopy}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Copy size={16} />
                        <span>Copy Details</span>
                    </button>

                    {canWrite && (
                        <div className="flex items-center space-x-2">
                            {onEdit && (
                                <button
                                    onClick={() => onEdit(vendor)}
                                    className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
                                >
                                    <Pencil size={15} />
                                    <span>Edit</span>
                                </button>
                            )}
                            {onDelete && (
                                <button
                                    onClick={() => onDelete(vendor.id)}
                                    className="flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm"
                                >
                                    <Trash2 size={15} />
                                    <span>Delete</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VendorDetails;
