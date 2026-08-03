import React, { useState } from 'react';
import { ArrowLeftRight, Box } from 'lucide-react';
import UnitList from './UnitList';
import ResourceConversions from './ResourceConversions';
import { useAuth } from '../../context/AuthContext';

const TABS = [
    {
        id: 'units',
        label: 'Unit Conversions',
        icon: ArrowLeftRight,
        component: UnitList,
    },
    {
        id: 'resource',
        label: 'Resource Conversions',
        icon: Box,
        component: ResourceConversions,
    },
];

const UnitsPage = () => {
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('units', 2);
    const [activeTab, setActiveTab] = useState('units');

    const ActiveComponent = TABS.find(t => t.id === activeTab)?.component ?? UnitList;

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0d1117] h-full">

            {/* ── Page-level Header ── */}
            <div className="px-8 pt-5 pb-0 border-b border-gray-100 dark:border-white/5 shrink-0">
                <div className="mb-4">
                    <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ArrowLeftRight size={20} className="text-blue-500" />
                        Conversions
                    </h1>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Manage unit conversions and resource-level quantity aliases
                    </p>
                </div>

                {/* Tab Bar */}
                <div className="flex gap-1">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium border-b-2 transition-all
                                    ${isActive
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                                    }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] hidden sm:inline ml-1 ${isActive ? 'text-blue-400/70' : 'text-gray-400/70'}`}>
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Active Tab Content ── */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <ActiveComponent canWrite={canWrite} />
            </div>
        </div>
    );
};

export default UnitsPage;
