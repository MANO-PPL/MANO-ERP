import React from 'react';
import { ChevronDown } from 'lucide-react';

const CustomSelect = ({ label, options, value, onChange }) => {
    return (
        <div className="w-full">
            {label && <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>}
            <div className="relative">
                <select
                    value={value}
                    onChange={onChange}
                    className="w-full bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer shadow-sm dark:shadow-none hover:border-blue-500/30 dark:hover:border-white/20"
                >
                    {options.map((opt, idx) => (
                        <option key={idx} value={typeof opt === 'object' ? opt.value : opt} className="bg-white dark:bg-[#1E2433] text-gray-900 dark:text-white">
                            {typeof opt === 'object' ? opt.label : opt}
                        </option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500 dark:text-[#7A8AAB]">
                    <ChevronDown size={16} />
                </div>
            </div>
        </div>
    );
};

export default CustomSelect;
