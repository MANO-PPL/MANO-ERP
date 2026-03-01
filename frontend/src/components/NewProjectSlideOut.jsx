import React, { useState } from 'react';
import { X, Users, UserMinus } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';
import CustomInput from './CustomInput';

const EMPLOYEE_OPTIONS = [
    { id: 1, name: 'Madhavan S', role: 'Super Admin', initials: 'MS', color: 'from-blue-400 to-indigo-500' },
    { id: 2, name: 'Sathish Kumar', role: 'Project Manager', initials: 'SK', color: 'from-purple-400 to-pink-500' },
    { id: 3, name: 'Mano Kakoos', role: 'Site Lead', initials: 'MK', color: 'from-orange-400 to-red-500' },
    { id: 4, name: 'Harish R', role: 'Viewer', initials: 'HR', color: 'from-teal-400 to-green-500' },
    { id: 5, name: 'Admin User', role: 'Admin', initials: 'AU', color: 'from-gray-400 to-slate-500' },
    { id: 6, name: 'Jane Doe', role: 'Designer', initials: 'JD', color: 'from-pink-400 to-rose-500' },
];

const NewProjectSlideOut = ({ isOpen, onClose }) => {
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const toggleEmployee = (emp) => {
        setSelectedEmployees(prev =>
            prev.find(e => e.id === emp.id)
                ? prev.filter(e => e.id !== emp.id)
                : [...prev, emp]
        );
    };

    const removeEmployee = (id) => setSelectedEmployees(prev => prev.filter(e => e.id !== id));

    const unselected = EMPLOYEE_OPTIONS.filter(e => !selectedEmployees.find(s => s.id === e.id));

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-gray-900/40 dark:bg-black/60 backdrop-blur-sm z-40 transition-all duration-300 ease-out"
                    onClick={onClose}
                />
            )}

            {/* Right Slide-out Drawer */}
            <div
                className={`fixed top-0 right-0 h-full w-[480px] max-w-full bg-white dark:bg-[#151A25] shadow-2xl z-50 transform transition-transform duration-300 flex flex-col border-l border-gray-200 dark:border-[#2A3445] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-5 border-b border-gray-200 dark:border-[#2A3445] bg-white dark:bg-[#151A25]">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create New Project</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-500 hover:text-gray-900 dark:text-[#7A8AAB] dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2A3445] rounded-md transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body / Form */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Row 1: Name and Code */}
                    <div className="grid grid-cols-2 gap-5">
                        <CustomInput label="Project Name" />
                        <CustomInput label="Project Code" />
                    </div>

                    {/* Row 2: Description */}
                    <CustomInput label="Description" rows={4} />

                    {/* Row 3: Location */}
                    <CustomInput label="Location" />

                    {/* Row 4: Employer */}
                    <CustomInput label="Employer" />

                    {/* Row 5: Dates */}
                    <div className="grid grid-cols-2 gap-5">
                        <CustomDatePicker label="Start Date" />
                        <CustomDatePicker label="End Date" />
                    </div>

                    {/* Row 6: Add Employees */}
                    <div className="relative">
                        <label className="block text-xs font-semibold text-gray-500 dark:text-[#7A8AAB] uppercase tracking-wider mb-2">
                            Add Employees
                        </label>

                        {/* Dropdown trigger */}
                        <button
                            type="button"
                            onClick={() => setDropdownOpen(o => !o)}
                            className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-[#1A2235] border border-gray-200 dark:border-[#2A3445] rounded-lg text-sm text-gray-500 dark:text-[#7A8AAB] hover:border-blue-400 transition-colors text-left"
                        >
                            <Users size={14} className="shrink-0" />
                            <span className="flex-1">
                                {selectedEmployees.length > 0
                                    ? `${selectedEmployees.length} employee${selectedEmployees.length > 1 ? 's' : ''} selected`
                                    : 'Select employees to add…'}
                            </span>
                        </button>

                        {/* Dropdown list */}
                        {dropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#1A2235] border border-gray-200 dark:border-[#2A3445] rounded-xl shadow-xl z-50 overflow-hidden">
                                {EMPLOYEE_OPTIONS.map(emp => {
                                    const isSelected = !!selectedEmployees.find(e => e.id === emp.id);
                                    return (
                                        <button
                                            key={emp.id}
                                            type="button"
                                            onClick={() => toggleEmployee(emp)}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-white/5'}`}
                                        >
                                            <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>
                                                {emp.initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{emp.name}</p>
                                                <p className="text-xs text-gray-400">{emp.role}</p>
                                            </div>
                                            {/* Tick indicator */}
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-white/20'}`}>
                                                {isSelected && (
                                                    <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="1,4 3.5,6.5 9,1" />
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Selected employee chips */}
                        {selectedEmployees.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedEmployees.map(emp => (
                                    <div key={emp.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/30 rounded-full">
                                        <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${emp.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                                            {emp.initials}
                                        </div>
                                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">{emp.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeEmployee(emp.id)}
                                            className="text-blue-400 hover:text-red-500 transition-colors ml-0.5"
                                        >
                                            <X size={11} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Row 7: Clients */}
                    <div className="pb-4">
                        <CustomSelect
                            label="Clients"
                            options={["Select Client", "Client A", "Client B"]}
                        />
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-[#2A3445] bg-gray-50 dark:bg-[#1A202C] flex justify-end gap-3 items-center">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2A3445] rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors flex items-center justify-center gap-2">
                        <span className="text-lg leading-none mt-[-2px]">+</span>
                        Create Project
                    </button>
                </div>
            </div>
        </>
    );
};

export default NewProjectSlideOut;
