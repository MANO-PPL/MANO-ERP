import React, { useState, useEffect } from 'react';
import { X, Search, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';
import LogoLoader from './LogoLoader';

/**
 * A reusable modal to manage metadata like Job Natures, Sectors, Departments, and Designations.
 * 
 * @param {string} title - The title of the modal (e.g., "Manage Job Natures")
 * @param {string} endpoint - The API endpoint to fetch and manage (e.g., "/admin/job-natures")
 * @param {string} itemNameKey - The key for the name field (e.g., "job_name")
 * @param {string} itemIdKey - The key for the ID field (e.g., "job_id")
 * @param {string} listKey - The key for the array in the response (e.g., "job_natures")
 * @param {string} addPlaceholder - Placeholder for the add input
 */
const ManageMetadataModal = ({
    isOpen,
    onClose,
    title,
    endpoint,
    itemNameKey,
    itemIdKey,
    listKey,
    addPlaceholder = "Add new item...",
    onUpdate
}) => {
    const [items, setItems] = useState([]);
    const [newItemName, setNewItemName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (!isActionLoading && onClose) onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, isActionLoading, onClose]);

    useEffect(() => {
        if (isOpen) {
            fetchItems();
            setNewItemName('');
            setSearchTerm('');
        }
    }, [isOpen, endpoint]);

    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(endpoint);
            if (res.data.success) {
                setItems(res.data[listKey] || []);
            }
        } catch (err) {
            console.error(`Error fetching ${listKey}:`, err);
            toast.error(`Failed to load ${title.toLowerCase()}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newItemName.trim() || isActionLoading) return;

        setIsActionLoading(true);
        try {
            const payload = { [itemNameKey]: newItemName.trim() };
            const res = await api.post(endpoint, payload);
            if (res.data.success) {
                toast.success('Added successfully');
                setNewItemName('');
                fetchItems();
                if (onUpdate) onUpdate();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add item');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;

        setIsActionLoading(true);
        try {
            const res = await api.delete(`${endpoint}/${id}`);
            if (res.data.success) {
                toast.success('Deleted successfully');
                fetchItems();
                if (onUpdate) onUpdate();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete item');
        } finally {
            setIsActionLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        item[itemNameKey]?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-[#161b22] shadow-2xl z-[5000] transform transition-transform duration-300 flex flex-col border-l border-gray-200 dark:border-white/10 overflow-hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >

                <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4 flex flex-col flex-1 overflow-hidden">
                    {/* Add Form */}
                    <form onSubmit={handleAdd} className="flex gap-2">
                        <input
                            type="text"
                            placeholder={addPlaceholder}
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="flex-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isActionLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isActionLoading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                        </button>
                    </form>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar border border-gray-100 dark:border-white/5 rounded-lg dark:bg-[#0d1117]">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-8">
                                <LogoLoader text="Rendering Metadata..." size="sm" fullPage={false} />
                            </div>
                        ) : filteredItems.length > 0 ? (
                            <div className="divide-y divide-gray-100 dark:divide-white/5">
                                {filteredItems.map((item) => (
                                    <div key={item[itemIdKey]} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{item[itemNameKey]}</span>
                                        <button
                                            onClick={() => handleDelete(item[itemIdKey])}
                                            disabled={isActionLoading}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                            title="Delete Item"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-center py-8 text-gray-500">No items found</p>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </>
    );
};

export default ManageMetadataModal;
