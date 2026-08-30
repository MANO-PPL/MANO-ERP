import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { resourceApi } from '../../services/resourceApi';
import { useAuth } from '../../context/AuthContext';
import ResourceDirectoryTab from './ResourceDirectoryTab';
import ResourceRecipesTab from './ResourceRecipesTab';
import ResourceRatesTab from './ResourceRatesTab';
import ResourceConversionsTab from './ResourceConversionsTab';

export const ResourceList = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('resources', 2);
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'directory';

    const [resources, setResources] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch Resources
    const fetchResources = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await resourceApi.getResources({ limit: 50000 });
            const list = res.resources || res.data || [];
            setResources(list);
        } catch (err) {
            console.error('Failed to load resources:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    return (
        <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0d1117]">
            {/* Sub-Tab Navigation (Matching Material Management & Transactions Style) */}
            <div className="px-3 py-1.5 border-b border-gray-200 dark:border-white/5 flex items-center justify-between overflow-x-auto shrink-0 gap-3 bg-white dark:bg-[#0d1117] select-none">
                <div className="flex items-center gap-1">
                    {[
                        { id: 'directory', label: 'Resource Directory' },
                        { id: 'recipes', label: 'Recipes & History' },
                        { id: 'rates', label: 'Rates' },
                        { id: 'conversions', label: 'Conversions' }
                    ].map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSearchParams({ tab: tab.id })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                                    isActive
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-gray-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab 1: Main Directory Grid */}
            {activeTab === 'directory' && (
                <ResourceDirectoryTab
                    resources={resources}
                    isLoading={isLoading}
                    canWrite={canWrite}
                    fetchResources={fetchResources}
                />
            )}

            {/* Tab 2: Item Recipes (BOM) */}
            {activeTab === 'recipes' && (
                <div className="flex-1 overflow-auto">
                    <ResourceRecipesTab canWrite={canWrite} />
                </div>
            )}

            {/* Tab 3: Rate History */}
            {activeTab === 'rates' && (
                <div className="flex-1 overflow-auto">
                    <ResourceRatesTab canWrite={canWrite} />
                </div>
            )}

            {/* Tab 4: Unit Conversions */}
            {activeTab === 'conversions' && (
                <div className="flex-1 overflow-auto">
                    <ResourceConversionsTab canWrite={canWrite} />
                </div>
            )}
        </div>
    );
};

export default ResourceList;
