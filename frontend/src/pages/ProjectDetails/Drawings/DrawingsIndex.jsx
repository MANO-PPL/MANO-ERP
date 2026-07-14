import React, { useState, useEffect } from 'react';
import { 
    ChevronRight, PenTool, Layers, Droplets, Zap, Flame, Plus, X, Check, FolderPlus,
    Building2, Wrench, Construction, Ruler, Lightbulb, Shield, Edit2, Trash2, Loader2 
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import DrawingsDetail from './DrawingCategoryDetail';

// ─── Icon options for new/edited categories ──────────────────────────────────────────
const ICON_MAP = {
    PenTool: <PenTool size={24} />,
    Layers: <Layers size={24} />,
    Droplets: <Droplets size={24} />,
    Zap: <Zap size={24} />,
    Flame: <Flame size={24} />,
    Folder: <FolderPlus size={24} />,
    Building2: <Building2 size={24} />,
    Wrench: <Wrench size={24} />,
    Construction: <Construction size={24} />,
    Ruler: <Ruler size={24} />,
    Lightbulb: <Lightbulb size={24} />,
    Shield: <Shield size={24} />,
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

// ─── Category Drawer (Create & Edit) ──────────────────────────────────────────
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
        <>
            {open && <div className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm" onClick={onClose} />}
            <div className={`fixed top-0 right-0 h-full w-[400px] z-[201] bg-white dark:bg-[#161b22] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                            <FolderPlus size={16} className="text-blue-500" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                                {editingCategory ? 'Edit Category' : 'New Drawing Category'}
                            </h3>
                            <p className="text-xs text-gray-400">
                                {editingCategory ? 'Modify category name or icon' : 'Add a custom drawing section'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition-colors">
						<X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    {/* Preview */}
                    <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/5">
                        <div className="w-14 h-14 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 dark:text-gray-400 text-xl shrink-0">
                            {ICON_MAP[iconKey] || <FolderPlus size={24} />}
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Preview</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-white">{name || 'Category Name'}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wider">Click to explore archive</p>
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Category Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            placeholder="e.g. Structural Drawings, MEP Coordination..."
                            autoFocus
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 outline-none focus:ring-2 ring-blue-400 transition-all"
                        />
                    </div>

                    {/* Icon */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Icon</label>
                        <div className="flex gap-2 flex-wrap">
                            {ICON_OPTIONS.map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => setIconKey(opt.key)}
                                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg border-2 transition-all ${iconKey === opt.key
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-110 shadow-md'
                                        : 'border-gray-200 dark:border-white/10 hover:border-blue-300 bg-white dark:bg-white/5'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex gap-2">
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all"
                    >
                        <Check size={15} /> {editingCategory ? 'Save Changes' : 'Create Category'}
                    </button>
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
                        Cancel
                    </button>
                </div>
            </div>
        </>
    );
};

// ─── Drawings Index ───────────────────────────────────────────────────────────
const DrawingsIndex = ({ setExtraBreadcrumbs, project, canWrite }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);

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
                setCategories(data.categories);
            } else {
                throw new Error(data.message || 'Failed to load categories');
            }
        } catch (e) {
            console.error(e);
            setError(e.message);
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
                fetchCategories();
            } else {
                alert(data.message || 'Failed to create category');
            }
        } catch (e) {
            console.error(e);
            alert('Error creating category: ' + e.message);
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
                fetchCategories();
            } else {
                alert(data.message || 'Failed to update category');
            }
        } catch (e) {
            console.error(e);
            alert('Error updating category: ' + e.message);
        }
    };

    const handleDeleteCategory = async (cat, confirmed = false) => {
        try {
            const url = `/api/projects/${project.id}/drawings/categories/${cat.id}${confirmed ? '?confirm=true' : ''}`;
            const response = await fetch(url, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                fetchCategories();
            } else if (data.hasDrawings) {
                const proceed = window.confirm(
                    `This category contains drawings. Deleting it will permanently delete all files and records inside.\n\nDo you really want to delete this category?`
                );
                if (proceed) {
                    handleDeleteCategory(cat, true);
                }
            } else {
                alert(data.message || 'Failed to delete category');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting category: ' + e.message);
        }
    };

    const handleNewCategoryClick = () => {
        setEditingCategory(null);
        setDrawerOpen(true);
    };

    useEffect(() => {
        if (currentView === 'grid') {
            setExtraBreadcrumbs([{ label: 'Drawings' }]);
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

    if (loading && categories.length === 0) {
        return (
            <div className="flex-grow flex items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            <CategoryDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                onAdd={handleAddCategory}
                onEdit={handleEditCategory}
                editingCategory={editingCategory}
            />

            {/* Header */}
            <div className="flex items-center justify-between px-8 pt-8 pb-2 shrink-0">
                <div>
                    <h2 className="text-sm font-black text-gray-800 dark:text-white uppercase tracking-widest">Drawings</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{categories.length} categories · Click any to open</p>
                </div>
                {canWrite && (
                    <button
                        onClick={handleNewCategoryClick}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-md shadow-blue-500/20"
                    >
                        <Plus size={14} /> New Category
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                {categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-gray-200 dark:border-white/10 rounded-[2rem] p-8">
                        <FolderPlus className="text-gray-300 dark:text-white/10 mb-4" size={48} />
                        <h4 className="font-bold text-gray-700 dark:text-gray-300 text-sm">No categories created yet</h4>
                        <p className="text-xs text-gray-400 mt-1">Create a category to begin uploading drawings.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {categories.map((cat) => (
                            <div
                                key={cat.id}
                                onClick={() => handleCategoryClick(cat)}
                                className="group relative bg-white dark:bg-[#161b22] px-8 py-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/40 transition-all duration-500 cursor-pointer flex items-center overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/0 to-blue-600/[0.02] group-hover:via-blue-600/[0.04] transition-all duration-700" />
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-gray-200 dark:bg-white/10 rounded-r-full group-hover:h-16 group-hover:bg-blue-500 transition-all duration-500" />
                                
                                {canWrite && (
                                    <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingCategory(cat);
                                                setDrawerOpen(true);
                                            }}
                                            className="p-1.5 rounded-lg bg-gray-50 dark:bg-[#161b22] hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-white/5 shadow-sm transition-all"
                                            title="Edit Category"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteCategory(cat);
                                            }}
                                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 shadow-sm transition-all"
                                            title="Delete Category"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                )}

                                <div className="relative flex items-center w-full">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/[0.03] rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner border border-transparent group-hover:border-blue-400/50 group-hover:rotate-[10deg] group-hover:scale-110">
                                        {ICON_MAP[cat.icon_key || cat.iconKey] ?? <FolderPlus size={24} />}
                                    </div>
                                    <div className="ml-8 flex-1 text-left">
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight leading-tight group-hover:text-blue-500 transition-colors uppercase mb-1.5">
                                            {cat.name}
                                        </h3>
                                        <div className="flex items-center space-x-3">
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-300 transition-colors">Click to explore archive</span>
                                            <div className="h-px w-12 bg-gray-100 dark:bg-white/10 group-hover:w-24 group-hover:bg-blue-500/30 transition-all duration-700" />
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500 mr-2">
                                        <div className="w-10 h-10 rounded-full border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                            <ChevronRight size={18} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DrawingsIndex;
