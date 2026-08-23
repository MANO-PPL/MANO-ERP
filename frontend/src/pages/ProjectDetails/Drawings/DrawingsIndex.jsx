import React, { useState, useEffect } from 'react';
import { 
    ChevronRight, PenTool, Layers, Droplets, Zap, Flame, Plus, X, Check, FolderPlus,
    Building2, Wrench, Construction, Ruler, Lightbulb, Shield, Edit2, Trash2, Search,
    FileText, Layers3, Folder, Loader2
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import ConfirmModal from '../../../components/ConfirmModal';
import DrawingsDetail from './DrawingCategoryDetail';

// Icon options for new/edited categories
const ICON_MAP = {
    PenTool: <PenTool size={22} />,
    Layers: <Layers size={22} />,
    Droplets: <Droplets size={22} />,
    Zap: <Zap size={22} />,
    Flame: <Flame size={22} />,
    Folder: <FolderPlus size={22} />,
    Building2: <Building2 size={22} />,
    Wrench: <Wrench size={22} />,
    Construction: <Construction size={22} />,
    Ruler: <Ruler size={22} />,
    Lightbulb: <Lightbulb size={22} />,
    Shield: <Shield size={22} />,
};

const ICON_OPTIONS = [
    { key: 'PenTool', label: '✏️' },
    { key: 'Layers', label: '🗂️' },
    { key: 'Droplets', label: '💧' },
    { key: 'Zap', label: '⚡' },
    { key: 'Flame', label: '🔥' },
    { key: 'Folder', label: '📁' },
    { key: 'Building2', label: '🏗️' },
    { key: 'Wrench', label: '🔧' },
    { key: 'Construction', label: '🚧' },
    { key: 'Ruler', label: '📐' },
    { key: 'Lightbulb', label: '💡' },
    { key: 'Shield', label: '🛡️' }
];

// Category Drawer (Create & Edit)
const CategoryDrawer = ({ open, onClose, onAdd, onEdit, editingCategory }) => {
    const [name, setName] = useState('');
    const [iconKey, setIconKey] = useState('Folder');

    useEffect(() => {
        if (open) {
            if (editingCategory) {
                setName(editingCategory.name || '');
                setIconKey(editingCategory.icon_key || editingCategory.iconKey || 'Folder');
            } else {
                setName('');
                setIconKey('Folder');
            }
        }
    }, [open, editingCategory]);

    const handleSubmit = () => {
        if (!name.trim()) return;
        if (editingCategory) {
            onEdit(editingCategory.id, { name: name.trim(), icon_key: iconKey });
        } else {
            onAdd({ name: name.trim(), icon_key: iconKey });
        }
        onClose();
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-xs" 
                        onClick={onClose} 
                    />
                    <motion.div 
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                        className="fixed top-0 right-0 h-full w-full max-w-[420px] z-[201] bg-white dark:bg-[#161b22] border-l border-gray-200 dark:border-gh-border shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#0d1117]">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <FolderPlus size={16} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                        {editingCategory ? 'Edit Category' : 'New Drawing Category'}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {editingCategory ? 'Modify category details' : 'Add a custom drawing category'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-left text-xs">
                            {/* Live Preview */}
                            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-[#0d1117] rounded-lg border border-gray-200 dark:border-gh-border shadow-xs">
                                <div className="w-10 h-10 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg flex items-center justify-center text-gray-700 dark:text-gray-300 text-lg shrink-0 shadow-xs">
                                    {ICON_MAP[iconKey] || <FolderPlus size={20} />}
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Live Card Preview</p>
                                    <p className="text-sm font-bold text-gray-900 dark:text-white">{name || 'Category Name'}</p>
                                    <span className="inline-block px-2 py-0.5 mt-1 text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-md border border-blue-200/50 dark:border-blue-800/40">
                                        0 Drawings
                                    </span>
                                </div>
                            </div>

                            {/* Category Name */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">Category Name *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    placeholder="e.g. Structural Drawings, Architectural Layouts..."
                                    autoFocus
                                    className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-gray-400"
                                />
                            </div>

                            {/* Icon Selection Grid */}
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">Category Icon</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {ICON_OPTIONS.map(opt => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => setIconKey(opt.key)}
                                            className={`h-10 rounded-lg flex items-center justify-center text-base border transition-all cursor-pointer ${iconKey === opt.key
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-500/20 shadow-xs'
                                                : 'border-gray-200 dark:border-gh-border hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-[#0d1117]'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#0d1117] flex gap-2">
                            <button
                                onClick={handleSubmit}
                                disabled={!name.trim()}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
                            >
                                <Check size={14} /> {editingCategory ? 'Save Changes' : 'Create Category'}
                            </button>
                            <button 
                                onClick={onClose} 
                                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gh-border text-gray-600 dark:text-gray-300 text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Drawings Index Component
const DrawingsIndex = ({ setExtraBreadcrumbs, project, canWrite }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [categoryToDelete, setCategoryToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const currentView = searchParams.get('view') || 'grid';
    const catId = searchParams.get('cat');
    const selectedCategory = categories.find(c => String(c.id) === String(catId));

    const fetchCategories = async () => {
        if (!project || !project.id) return;
        try {
            setLoading(true);
            const response = await fetch(`/api/projects/${project.id}/drawings/categories`);
            const data = await response.json();
            if (data.success) {
                setCategories(data.categories || []);
            } else {
                toast.error(data.message || 'Failed to load categories');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error loading drawing categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [project?.id]);

    const handleCategoryClick = (cat) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('view', 'detail');
        newParams.set('cat', cat.id);
        setSearchParams(newParams);
    };

    const handleBack = React.useCallback(() => {
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('view');
        newParams.delete('cat');
        setSearchParams(newParams);
        fetchCategories();
    }, [searchParams, setSearchParams, project?.id]);

    const handleAddCategory = async (catData) => {
        try {
            const response = await fetch(`/api/projects/${project.id}/drawings/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Category created successfully');
                fetchCategories();
            } else {
                toast.error(data.message || 'Failed to create category');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error creating category');
        }
    };

    const handleEditCategory = async (id, catData) => {
        try {
            const response = await fetch(`/api/projects/${project.id}/drawings/categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(catData)
            });
            const data = await response.json();
            if (data.success) {
                toast.success('Category updated successfully');
                fetchCategories();
            } else {
                toast.error(data.message || 'Failed to update category');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error updating category');
        }
    };

    const handleConfirmDeleteCategory = async () => {
        if (!categoryToDelete) return;
        setDeleteLoading(true);
        try {
            const url = `/api/projects/${project.id}/drawings/categories/${categoryToDelete.id}?confirm=true`;
            const response = await fetch(url, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                toast.success(`Category "${categoryToDelete.name}" deleted successfully`);
                setCategoryToDelete(null);
                fetchCategories();
            } else {
                toast.error(data.message || 'Failed to delete category');
            }
        } catch (e) {
            console.error(e);
            toast.error('Error deleting category');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleNewCategoryClick = () => {
        setEditingCategory(null);
        setDrawerOpen(true);
    };

    useEffect(() => {
        if (currentView === 'grid') {
            setExtraBreadcrumbs([]);
        }
    }, [currentView, setExtraBreadcrumbs]);

    if (currentView === 'detail' && selectedCategory) {
        return (
            <DrawingsDetail
                category={selectedCategory}
                projectId={project.id}
                onBack={handleBack}
                setExtraBreadcrumbs={setExtraBreadcrumbs}
                canWrite={canWrite}
            />
        );
    }

    const filteredCategories = categories.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in font-sans text-left">
            <CategoryDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onAdd={handleAddCategory}
                onEdit={handleEditCategory}
                editingCategory={editingCategory}
            />

            {/* CONTROL TOOLBAR */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gh-border bg-white dark:bg-[#0d1117] gap-3">
                <div className="relative min-w-[240px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search drawing categories..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-1.5 text-xs bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-gh-border rounded-lg outline-none focus:border-blue-500 text-gray-900 dark:text-white transition-all placeholder:text-gray-400"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white">
                            <X size={13} />
                        </button>
                    )}
                </div>

                {canWrite && (
                    <button
                        onClick={handleNewCategoryClick}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center shadow-xs active:scale-95 cursor-pointer self-end sm:self-auto"
                    >
                        <Plus size={14} className="mr-1" /> New Category
                    </button>
                )}
            </div>

            {/* CATEGORY GRID */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#f9fafb] dark:bg-gh-bg">
                {loading ? (
                    <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400">
                        <Loader2 className="animate-spin mb-2.5 text-blue-500" size={24} />
                        <span className="text-xs font-semibold">Loading drawing categories...</span>
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed border-gray-200 dark:border-gh-border rounded-lg p-8 bg-white dark:bg-[#0d1117]">
                        <FolderPlus className="text-gray-300 dark:text-gray-600 mb-3" size={44} />
                        <h4 className="font-bold text-gray-700 dark:text-gray-300 text-xs">No drawing categories found</h4>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Create a new category to start storing drawing blueprints.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {filteredCategories.map((cat, index) => (
                            <motion.div
                                key={cat.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.03 }}
                                onClick={() => handleCategoryClick(cat)}
                                className="group relative bg-white dark:bg-[#161b22] p-4 rounded-lg border border-gray-200 dark:border-gh-border shadow-2xs hover:shadow-md hover:border-blue-500/50 transition-all duration-300 cursor-pointer flex flex-col justify-between overflow-hidden"
                            >
                                {/* Subtle Hover Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-indigo-600/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg" />

                                <div>
                                    {/* Top Header */}
                                    <div className="flex items-start justify-between mb-3 relative z-10">
                                        <div className="w-10 h-10 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-gh-border rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-300 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all duration-300 shadow-2xs">
                                            {ICON_MAP[cat.icon_key || cat.iconKey] ?? <FolderPlus size={20} />}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
                                                {cat.drawing_count || 0} {(cat.drawing_count === 1) ? 'Drawing' : 'Drawings'}
                                            </span>

                                            {canWrite && (
                                                <div className="flex items-center space-x-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingCategory(cat);
                                                            setDrawerOpen(true);
                                                        }}
                                                        className="p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all cursor-pointer"
                                                        title="Edit Category"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setCategoryToDelete(cat);
                                                        }}
                                                        className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer"
                                                        title="Delete Category"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Title & Info */}
                                    <div className="relative z-10">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors uppercase tracking-wide">
                                            {cat.name}
                                        </h3>
                                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 font-medium">
                                            Architectural & Civil Drawing Repository
                                        </p>
                                    </div>
                                </div>

                                {/* Footer Link */}
                                <div className="mt-4 pt-2.5 border-t border-gray-100 dark:border-gh-border/50 flex items-center justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400 relative z-10">
                                    <span>Explore Category</span>
                                    <ChevronRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!categoryToDelete}
                onClose={() => setCategoryToDelete(null)}
                onConfirm={handleConfirmDeleteCategory}
                title="Delete Drawing Category?"
                message={
                    <span>
                        Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{categoryToDelete?.name}</strong>? All associated blueprints and revision history files will be permanently removed.
                    </span>
                }
                confirmText="Delete Category"
                cancelText="Cancel"
                variant="danger"
                isLoading={deleteLoading}
            />
        </div>
    );
};

export default DrawingsIndex;
