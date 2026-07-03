import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';

const ResourceDetail = ({ resourceId, units, onClose, onUpdate, canWrite = true }) => {
    const [resource, setResource] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddingConv, setIsAddingConv] = useState(false);
    const [convForm, setConvForm] = useState({ name: '', quantity: '', unit_id: '' });

    useEffect(() => {
        if (resourceId) fetchDetail();
    }, [resourceId]);

    const fetchDetail = async () => {
        setIsLoading(true);
        try {
            const data = await resourceApi.getResourceById(resourceId);
            setResource(data.resource);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddConversion = async (e) => {
        e.preventDefault();
        try {
            await resourceApi.addConversion(resource.id, {
                ...convForm,
                quantity: parseFloat(convForm.quantity),
                unit_id: parseInt(convForm.unit_id)
            });
            setIsAddingConv(false);
            setConvForm({ name: '', quantity: '', unit_id: '' });
            fetchDetail();
            if (onUpdate) onUpdate();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add conversion');
        }
    };

    const handleDeleteConversion = async (convId) => {
        if (!window.confirm('Delete this conversion?')) return;
        try {
            await resourceApi.removeConversion(resource.id, convId);
            fetchDetail();
        } catch (err) {
            console.error(err);
        }
    };

    if (isLoading || !resource) {
        return (
            <div className="fixed inset-y-0 right-0 z-[5000] w-[500px] bg-white dark:bg-[#0d1117] shadow-2xl border-l border-gray-200 dark:border-white/10 p-6 flex items-center justify-center">
                <span>Loading details...</span>
            </div>
        );
    }

    return (
        <div className="fixed inset-y-0 right-0 z-[5000] w-[500px] bg-white dark:bg-[#0d1117] shadow-2xl border-l border-gray-200 dark:border-white/10 flex flex-col anim-slide-left">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-200 dark:border-white/10 shrink-0">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        {resource.name}
                        <span className={`px-2 py-0.5 text-[10px] uppercase rounded-full ${resource.type === 'material' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                            {resource.type}
                        </span>
                    </h2>
                    <p className="text-xs text-gray-500 font-mono mt-1">Code: {resource.code || 'N/A'}</p>
                </div>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                
                {/* General Info */}
                <section>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 tracking-wide">GENERAL INFORMATION</h3>
                    <div className="bg-gray-50 dark:bg-white/[0.02] p-4 rounded-lg border border-gray-200 dark:border-white/10 text-sm space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Base Unit</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{resource.base_unit_name} ({resource.base_unit_symbol})</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Description</span>
                            <span className="text-gray-900 dark:text-white text-right max-w-[250px]">{resource.description || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Remarks</span>
                            <span className="text-gray-900 dark:text-white text-right break-words max-w-[250px]">{resource.remarks || '-'}</span>
                        </div>
                    </div>
                </section>

                {/* Unit Conversions */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">UNIT CONVERSIONS</h3>
                        {canWrite && (
                            <button onClick={() => setIsAddingConv(!isAddingConv)} className="text-xs text-blue-600 hover:text-blue-700 flex items-center bg-blue-50 px-2 py-1 rounded">
                                <Plus size={14} className="mr-1"/> Add
                            </button>
                        )}
                    </div>

                    {isAddingConv && (
                        <form onSubmit={handleAddConversion} className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 mb-3 flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-[10px] uppercase text-gray-500 block mb-1">Scale Name</label>
                                <input required placeholder="e.g. Bag" value={convForm.name} onChange={e=>setConvForm({...convForm, name: e.target.value})} className="w-full text-xs px-2 py-1.5 border rounded" />
                            </div>
                            <div className="w-16 text-center text-xs text-gray-500 pb-2">=</div >
                            <div className="w-20">
                                <label className="text-[10px] uppercase text-gray-500 block mb-1">Qty</label>
                                <input required type="number" step="any" value={convForm.quantity} onChange={e=>setConvForm({...convForm, quantity: e.target.value})} className="w-full text-xs px-2 py-1.5 border rounded" />
                            </div>
                            <div className="w-24">
                                <label className="text-[10px] uppercase text-gray-500 block mb-1">Unit</label>
                                <select required value={convForm.unit_id} onChange={e=>setConvForm({...convForm, unit_id: e.target.value})} className="w-full text-xs px-2 py-1.5 border rounded bg-white">
                                    <option value="">Select</option>
                                    {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700">Save</button>
                        </form>
                    )}

                    {resource.conversions?.length === 0 ? (
                        <div className="text-xs text-gray-400 italic">No conversions defined.</div>
                    ) : (
                        <div className="border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
                            <table className="w-full text-left text-xs bg-white dark:bg-transparent">
                                <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2">Name</th>
                                        <th className="px-3 py-2">Equals</th>
                                        <th className="px-3 py-2 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                                    {resource.conversions?.map(c => (
                                        <tr key={c.id}>
                                            <td className="px-3 py-2 font-medium">1 {c.name}</td>
                                            <td className="px-3 py-2">{c.quantity} {c.unit_symbol}</td>
                                            <td className="px-3 py-2 text-right">
                                                {canWrite && (
                                                    <button onClick={() => handleDeleteConversion(c.id)} className="text-gray-400 hover:text-red-500">
                                                        <Trash2 size={14}/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* Compositions (Items only) */}
                {resource.type === 'item' && (
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 tracking-wide">COMPOSITION</h3>
                        {resource.compositions?.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">No components defined.</div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-white/[0.02] rounded-lg border border-gray-200 dark:border-white/10 p-1">
                                <ul className="divide-y divide-gray-100 dark:divide-white/5">
                                    {resource.compositions?.map(c => (
                                        <li key={c.id} className="p-3 flex justify-between items-center">
                                            <div>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white">{c.component_name}</p>
                                                <p className="text-[10px] font-mono text-gray-500">{c.component_code}</p>
                                            </div>
                                            <div className="text-sm font-semibold bg-white dark:bg-[#0d1117] px-3 py-1 rounded shadow-sm border border-gray-100 dark:border-white/5">
                                                {c.quantity} {c.unit_symbol}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </section>
                )}

            </div>
        </div>
    );
};

export default ResourceDetail;
