import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Package,
    Layers,
    Scale,
    ChevronRight
} from 'lucide-react';
import catalogApi from '../../services/catalogApi';
import { showCatalogErrorToast } from './catalogErrors';
import ResourcesTab from './ResourcesTab';
import ActivitiesTab from './ActivitiesTab';
import UnitsTab from './UnitsTab';

/**
 * Master Catalog (Organization / Company Level)
 * Simplified, fast, zero redundant header banners.
 */
export default function CatalogPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const resParam = searchParams.get('res');

    // Active Navigation Tab: 'resources' | 'activities' | 'units'
    const [activeTab, setActiveTab] = useState('resources');

    // Units Cache (fetched from /api/catalog/units; never hardcoded)
    const [units, setUnits] = useState([]);

    const loadUnits = async () => {
        try {
            const data = await catalogApi.listUnits();
            setUnits(data || []);
        } catch (err) {
            showCatalogErrorToast(err, 'Failed to load catalog units');
        }
    };

    useEffect(() => {
        loadUnits();
    }, []);

    return (
        <div className="flex-1 min-h-0 h-full flex flex-col bg-gray-50/50 dark:bg-gh-bg text-gray-900 dark:text-gh-text overflow-hidden">
            {/* ─── Breadcrumbs Bar ─────────────────────────────────────────── */}
            <div className="flex items-center px-4 sm:px-6 py-2 border-b border-gray-200 dark:border-gh-border bg-gray-50/50 dark:bg-[#161b22]/30 text-xs text-gray-500 dark:text-gray-400 shrink-0 select-none">
                <span
                    className={resParam ? "text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium cursor-pointer" : "text-gray-900 dark:text-white font-semibold"}
                    onClick={() => {
                        if (resParam) {
                            const newParams = new URLSearchParams(searchParams);
                            newParams.delete('res');
                            setSearchParams(newParams);
                        }
                    }}
                >
                    Master Catalog
                </span>
                {resParam && (
                    <React.Fragment>
                        <ChevronRight size={12} className="text-gray-400 dark:text-gray-600 mx-1.5" />
                        <span className="text-gray-900 dark:text-white font-semibold font-mono">
                            {resParam}
                        </span>
                    </React.Fragment>
                )}
            </div>

            {/* ─── Navigation Tabs: Resources | Activities | Units (Pinned Header, hidden in detail page) ─── */}
            {!resParam && (
                <div className="px-4 sm:px-6 pt-3.5 pb-0 bg-white dark:bg-[#161b22] border-b border-gray-200 dark:border-gh-border shrink-0 select-none">
                    <div className="flex border-b-0 gap-6">
                        <button
                            type="button"
                            onClick={() => setActiveTab('resources')}
                            className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                                activeTab === 'resources'
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            <Package size={16} />
                            Master Resources
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('activities')}
                            className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                                activeTab === 'activities'
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            <Layers size={16} />
                            Master Activities &amp; Norms
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('units')}
                            className={`pb-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                                activeTab === 'units'
                                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                        >
                            <Scale size={16} />
                            Units &amp; Conversions
                        </button>
                    </div>
                </div>
            )}

            {/* ─── Scrollable Tab Content Container (Scrolls smoothly to the bottom) ─── */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 pb-16">
                <div style={{ display: activeTab === 'resources' ? 'block' : 'none' }}>
                    <ResourcesTab
                        scope="master"
                        units={units}
                    />
                </div>

                <div style={{ display: activeTab === 'activities' ? 'block' : 'none' }}>
                    <ActivitiesTab
                        scope="master"
                        units={units}
                    />
                </div>

                <div style={{ display: activeTab === 'units' ? 'block' : 'none' }}>
                    <UnitsTab
                        units={units}
                        onUnitsUpdated={loadUnits}
                    />
                </div>
            </div>
        </div>
    );
}
