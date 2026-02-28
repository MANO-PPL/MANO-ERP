import React from 'react';
import { X } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import CustomSelect from './CustomSelect';
import CustomInput from './CustomInput';

const NewProjectSlideOut = ({ isOpen, onClose }) => {
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

                    {/* Row 6: Reporters */}
                    <CustomSelect
                        label="Reporters"
                        options={["Select Reporter", "Admin User", "Jane Doe"]}
                    />

                    {/* Row 7: Approvers */}
                    <div className="grid grid-cols-2 gap-5">
                        <CustomSelect
                            label="Approver"
                            options={["Select Approver", "Admin User", "John Smith"]}
                        />
                        <CustomSelect
                            label="Final Approver"
                            options={["Select Final Approver", "Admin User", "CEO"]}
                        />
                    </div>

                    {/* Row 8: Clients */}
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
