import React, { useState, useEffect } from 'react';
import { FileText, ChevronRight, ShoppingCart, Truck, Package, Activity } from 'lucide-react';

const MaterialManagementIndex = ({ setExtraBreadcrumbs }) => {
    const [currentView, setCurrentView] = useState('grid');
    useEffect(() => {
        if (currentView === 'grid') setExtraBreadcrumbs([{ label: 'Material Management' }]);
    }, [currentView, setExtraBreadcrumbs]);

    const categories = [
        { name: 'Material Requisition', icon: <ShoppingCart size={24} /> },
        { name: 'Purchase Orders', icon: <FileText size={24} /> },
        { name: 'Delivery Notes', icon: <Truck size={24} /> },
        { name: 'Inventory Status', icon: <Activity size={24} /> },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="w-full space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                        {categories.map((cat, i) => (
                            <div key={i} className="group relative bg-white dark:bg-gray-50 dark:bg-[#161b22] px-8 py-8 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/40 transition-all duration-500 cursor-pointer flex items-center overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/0 to-blue-600/[0.02] group-hover:via-blue-600/[0.04] transition-all duration-700"></div>
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-gray-200 dark:bg-gray-200 dark:bg-white/10 rounded-r-full group-hover:h-16 group-hover:bg-blue-500 transition-all duration-500"></div>
                                <div className="relative flex items-center w-full">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/[0.03] rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner border border-transparent group-hover:border-blue-400/50 group-hover:rotate-[10deg] group-hover:scale-110"><cat.icon.type {...cat.icon.props} /></div>
                                    <div className="ml-8 flex-1 text-left">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight group-hover:text-blue-500 uppercase font-black">{cat.name}</h3>
                                        <div className="flex items-center space-x-3 mt-1.5">
                                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] group-hover:text-gray-300">Explore Archive</span>
                                            <div className="h-px w-12 bg-gray-100 dark:bg-gray-200 dark:bg-white/10 group-hover:w-24 group-hover:bg-blue-500/30 transition-all duration-700"></div>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all duration-500">
                                        <div className="w-10 h-10 rounded-full border border-blue-500/30 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all"><ChevronRight size={18} /></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaterialManagementIndex;
