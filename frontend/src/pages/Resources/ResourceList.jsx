import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Info, RefreshCw } from 'lucide-react';
import { resourceApi } from '../../services/resourceApi';
import { unitApi } from '../../services/unitApi';
import ResourceForm from './ResourceForm';
import ResourceDetail from './ResourceDetail';

const ResourceList = () => {
    const [resources, setResources] = useState([]);
    const [units, setUnits] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState(''); // 'material' | 'item' | ''

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingResource, setEditingResource] = useState(null);
    const [viewingResource, setViewingResource] = useState(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [resData, unitsData] = await Promise.all([
                resourceApi.getResources(),
                unitApi.getUnits()
            ]);
            setResources(resData.resources || []);
            setUnits(unitsData.units || []);
        } catch (error) {
            console.error('Failed to fetch resources', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredResources = resources.filter(r => {
        const matchesType = filterType ? r.type === filterType : true;
        const matchesSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesType && matchesSearch;
    });

    const handleAddClick = () => {
        setEditingResource(null);
        setIsFormOpen(true);
    };

    const handleEditClick = (resource) => {
        setEditingResource(resource);
        setIsFormOpen(true);
    };

    const handleDeleteClick = async (id) => {
        if (!window.confirm('Are you sure you want to delete this resource?')) return;
        try {
            await resourceApi.deleteResource(id);
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to delete resource');
        }
    };

    const handleSaveSuccess = () => {
        setIsFormOpen(false);
        fetchData();
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors h-full">
            {/* Header Area */}
            <div className="px-8 py-3 flex items-center justify-between border-b border-gray-200 dark:border-white/5 shrink-0">
                <div className="flex space-x-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search name or code..."
                            className="w-48 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                    >
                        <option value="">All Types</option>
                        <option value="material">Material</option>
                        <option value="item">Item</option>
                    </select>
                </div>

                <div className="flex space-x-3">
                    <button 
                        onClick={fetchData}
                        className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button
                        onClick={handleAddClick}
                        className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
                    >
                        <Plus size={16} />
                        <span>Add Resource</span>
                    </button>
                </div>
            </div>

            {/* Table Area */}
            <div className="flex-1 overflow-auto custom-scrollbar p-0">
                <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-widest text-[10px] uppercase font-bold">
                        <tr>
                            <th className="px-6 py-4 w-12 text-center">ID</th>
                            <th className="px-4 py-4">CODE</th>
                            <th className="px-4 py-4">NAME</th>
                            <th className="px-4 py-4">TYPE</th>
                            <th className="px-4 py-4">BASE UNIT</th>
                            <th className="px-4 py-4 text-center">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {filteredResources.map((resource) => (
                            <tr
                                key={resource.id}
                                className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300"
                                onClick={() => setViewingResource(resource.id)}
                            >
                                <td className="px-6 py-3 text-center font-mono text-gray-400">{resource.id}</td>
                                <td className="px-4 py-3 font-mono text-xs">{resource.code || '-'}</td>
                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 cursor-pointer">{resource.name}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded-full ${resource.type === 'material' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                                        {resource.type}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs">
                                    {resource.base_unit_name} ({resource.base_unit_symbol})
                                </td>
                                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-center space-x-2">
                                        <button
                                            onClick={() => setViewingResource(resource.id)}
                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
                                            title="View Details"
                                        >
                                            <Info size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleEditClick(resource)}
                                            className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-all"
                                            title="Edit Resource"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(resource.id)}
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all"
                                            title="Delete Resource"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredResources.length === 0 && !isLoading && (
                            <tr>
                                <td colSpan="6" className="py-12 text-center text-gray-500 dark:text-gray-400">
                                    No resources found.
                                </td>
                            </tr>
                        )}
                        {isLoading && (
                            <tr>
                                <td colSpan="6" className="py-12 text-center text-gray-500 dark:text-gray-400">
                                    Loading...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {isFormOpen && (
                <ResourceForm 
                    resource={editingResource} 
                    units={units}
                    onClose={() => setIsFormOpen(false)} 
                    onSave={handleSaveSuccess} 
                />
            )}

            {viewingResource && (
                <ResourceDetail 
                    resourceId={viewingResource} 
                    units={units}
                    onClose={() => setViewingResource(null)} 
                    onUpdate={fetchData}
                />
            )}
        </div>
    );
};

export default ResourceList;
