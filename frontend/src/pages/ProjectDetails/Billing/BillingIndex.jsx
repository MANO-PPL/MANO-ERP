import React, { useEffect } from 'react';
import { FileText, Receipt, FileSpreadsheet, CreditCard, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

// ─── GeneralDocuments-style compact vertical card ──────────────────────────────
const GDCard = ({ name, desc, icon: Icon, type = 'Single Instance', onClick }) => (
    <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onClick}
        className="group relative bg-white dark:bg-[#161b22] p-4 rounded-xl border border-gray-200/60 dark:border-white/5 shadow-sm hover:shadow-md hover:border-blue-500/40 hover:shadow-blue-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between h-[145px] overflow-hidden"
    >
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.03] to-indigo-600/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative flex flex-col h-full justify-between">
            <div className="space-y-2">
                <div className="flex items-start justify-between w-full">
                    <div className="w-10 h-10 bg-gray-50 dark:bg-white/[0.03] rounded-lg flex items-center justify-center text-gray-400 group-hover:text-blue-500 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 shadow-inner border border-gray-100/50 dark:border-white/5 group-hover:scale-105 transition-all duration-300">
                        <Icon size={20} />
                    </div>
                    <span className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-full border ${
                        type === 'Single Instance'
                            ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                            : 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                    }`}>
                        {type}
                    </span>
                </div>
                <div className="space-y-1 text-left">
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-tight leading-tight group-hover:text-blue-500 transition-colors duration-300">
                        {name}
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-300/80 leading-relaxed font-light line-clamp-2">
                        {desc}
                    </p>
                </div>
            </div>
            <div className="flex items-center space-x-2 pt-2 border-t border-gray-100/50 dark:border-white/5 w-full">
                <span className="text-[8px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-300">
                    Open Document
                </span>
                <ChevronRight size={8} className="text-gray-400 dark:text-gh-text group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5 duration-300" />
            </div>
        </div>
    </motion.div>
);

const BillingIndex = ({ setExtraBreadcrumbs }) => {
    useEffect(() => { setExtraBreadcrumbs([{ label: 'Billing' }]); }, [setExtraBreadcrumbs]);

    const docs = [
        { 
            name: 'Invoice – Materials', 
            desc: 'All material supply invoices raised for the project, categorized by vendor and date.',
            icon: FileText, 
            type: 'Episodic' 
        },
        { 
            name: 'Invoice – Contractors', 
            desc: 'Contractor invoices and progress billing documents submitted for payment processing.',
            icon: FileText, 
            type: 'Episodic' 
        },
        { 
            name: 'Certified Bills Copy', 
            desc: 'Certified and approved bill copies verified by the project engineer or authority.',
            icon: Receipt, 
            type: 'Episodic' 
        },
        { 
            name: 'List of Certified Bills (Monthly)', 
            desc: 'Monthly consolidated register of all certified bills with amounts and approval status.',
            icon: FileSpreadsheet, 
            type: 'Episodic' 
        },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins text-left">
            <div className="flex-1 overflow-y-auto p-4 md:p-5 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="w-full space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {docs.map((d, i) => (
                            <GDCard key={i} name={d.name} desc={d.desc} icon={d.icon} type={d.type} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BillingIndex;
