import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';

const ResourceForm = ({ resource, units, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        type: 'material',
        base_unit_id: '',
        description: '',
        remarks: ''
    });
    
    // For items
    const [compositions, setCompositions] = useState([]);
    const [allResources, setAllResources] = useState([]); // Needed for selecting materials in composition
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (resource) {
            setFormData({
                name: resource.name || '',
                code: resource.code || '',
                type: resource.type || 'material',
                base_unit_id: resource.base_unit_id || '',
                description: resource.description || '',
                remarks: resource.remarks || ''
            });
            // Compositions are usually fetched explicitly, but if we have them:
            if (resource.compositions) setCompositions(resource.compositions);
        }
        
        // Fetch materials for composition builder
        const fetchMaterials = async () => {
            try {
                const res = await resourceApi.getResources({ type: 'material' });
                setAllResources(res.resources || []);
            } catch (err) {
                console.error("Failed to fetch materials", err);
            }
        };
        fetchMaterials();
    }, [resource]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddComposition = () => {
        setCompositions([...compositions, { component_resource_id: '', quantity: '', unit_id: '' }]);
    };

    const handleCompositionChange = (index, field, value) => {
        const newComps = [...compositions];
        newComps[index][field] = value;
        
        // Auto-fill unit based on selected material's base_unit_id if component_resource_id changed
        if (field === 'component_resource_id' && value) {
            const material = allResources.find(r => r.id.toString() === value.toString());
            if (material) {
                newComps[index].unit_id = material.base_unit_id;
            }
        }
        setCompositions(newComps);
    };

    const handleRemoveComposition = (index) => {
        setCompositions(compositions.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const payload = {
                ...formData,
                compositions: formData.type === 'item' ? compositions.map(c => ({
                    component_resource_id: parseInt(c.component_resource_id),
                    quantity: parseFloat(c.quantity),
                    unit_id: c.unit_id ? parseInt(c.unit_id) : null
                })) : []
            };

            if (resource) {
                await resourceApi.updateResource(resource.id, payload);
                if (formData.type === 'item') {
                   await resourceApi.setCompositions(resource.id, payload.compositions);
                }
            } else {
                await resourceApi.createResource(payload);
            }
            onSave();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save resource');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6 anim-fade-in text-left">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#161b22] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 flex flex-col max-h-[90vh] anim-slide-up">
                
                <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {resource ? 'Edit Resource' : 'Add New Resource'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">{error}</div>}
                    
                    <form id="resource-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Code</label>
                                <input type="text" name="code" value={formData.code} onChange={handleChange} className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Type *</label>
                                <select required name="type" value={formData.type} onChange={handleChange} disabled={!!resource} className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50">
                                    <option value="material">Material</option>
                                    <option value="item">Item</option>
                                </select>
                                {resource && <span className="text-[10px] text-gray-400 mt-1">Type cannot be changed after creation.</span>}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Base Unit *</label>
                                <select required name="base_unit_id" value={formData.base_unit_id} onChange={handleChange} className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select a unit...</option>
                                    {units.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</label>
                            <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Remarks</label>
                            <input type="text" name="remarks" value={formData.remarks} onChange={handleChange} className="w-full bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>

                        {/* Composition Builder (Items only) */}
                        {formData.type === 'item' && (
                            <div className="mt-6 border-t border-gray-200 dark:border-white/10 pt-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">Item Composition</h3>
                                    <button type="button" onClick={handleAddComposition} className="text-xs flex items-center text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors">
                                        <Plus size={14} className="mr-1" /> Add Component
                                    </button>
                                </div>
                                {compositions.length === 0 ? (
                                    <div className="text-xs text-center p-4 bg-gray-50 dark:bg-white/[0.02] rounded border border-dashed border-gray-300 dark:border-white/10 text-gray-500">
                                        No components added yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {compositions.map((comp, idx) => (
                                            <div key={idx} className="flex gap-2 items-center bg-gray-50 dark:bg-white/[0.02] p-2 rounded border border-gray-200 dark:border-white/10">
                                                <select required value={comp.component_resource_id} onChange={(e) => handleCompositionChange(idx, 'component_resource_id', e.target.value)} className="flex-1 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500">
                                                    <option value="">Select Material</option>
                                                    {allResources.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                                                    ))}
                                                </select>
                                                <input required type="number" step="any" placeholder="Qty" value={comp.quantity} onChange={(e) => handleCompositionChange(idx, 'quantity', e.target.value)} className="w-20 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500" />
                                                <select required value={comp.unit_id} onChange={(e) => handleCompositionChange(idx, 'unit_id', e.target.value)} className="w-24 bg-white dark:bg-[#0d1117] border border-gray-300 dark:border-white/10 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500">
                                                    <option value="">Unit</option>
                                                    {units.map(u => (
                                                        <option key={u.id} value={u.id}>{u.symbol}</option>
                                                    ))}
                                                </select>
                                                <button type="button" onClick={() => handleRemoveComposition(idx)} className="text-gray-400 hover:text-red-500 p-1 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] flex justify-end gap-3 rounded-b-xl">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#161b22] border border-gray-300 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="resource-form" disabled={isLoading} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors disabled:opacity-50">
                        {isLoading ? 'Saving...' : 'Save Resource'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResourceForm;
