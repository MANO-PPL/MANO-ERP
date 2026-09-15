import React from 'react';
import MobileBottomSheet from '../../components/MobileBottomSheet';

export default function MobileProjectModuleSheet({ open, onClose, modules, activeKey, onSelect }) {
    return <MobileBottomSheet open={open} onClose={onClose} title="Project modules" description="Choose an available project workspace.">
        <div className="space-y-1" role="listbox" aria-label="Project modules">
            {modules.map((module) => <button key={module.key} type="button" role="option" aria-selected={module.key === activeKey} onClick={() => onSelect(module.key)} className={`flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm font-semibold ${module.key === activeKey ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : 'text-gray-700 hover:bg-gray-100 dark:text-gh-text dark:hover:bg-gh-hover'}`}>
                <span className="min-w-0 flex-1">{module.label}</span><span className="text-[10px] font-bold uppercase text-gray-400">{module.key === activeKey ? 'Current' : module.stage}</span>
            </button>)}
        </div>
    </MobileBottomSheet>;
}