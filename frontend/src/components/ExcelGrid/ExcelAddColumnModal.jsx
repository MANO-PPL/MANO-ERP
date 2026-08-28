import React, { useState, useEffect, useRef } from 'react';
import { Columns3, Plus, X, Type, Hash, Calendar, CheckSquare, List, Sparkles } from 'lucide-react';

const COLUMN_TYPES = [
    { value: 'text', label: 'Text', icon: Type, desc: 'Single line or multi-line text' },
    { value: 'number', label: 'Number', icon: Hash, desc: 'Numeric values, rates, counts' },
    { value: 'date', label: 'Date', icon: Calendar, desc: 'Calendar date picker' },
    { value: 'checkbox', label: 'Checkbox', icon: CheckSquare, desc: 'Yes / No boolean state' },
    { value: 'select', label: 'Dropdown Select', icon: List, desc: 'Pre-defined dropdown options' }
];

export const ExcelAddColumnModal = ({ isOpen, onClose, onAddColumn, existingColumns = [] }) => {
    const [label, setLabel] = useState('');
    const [type, setType] = useState('text');
    const [defaultValue, setDefaultValue] = useState('');
    const [required, setRequired] = useState(false);
    const [optionsText, setOptionsText] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setLabel('');
            setType('text');
            setDefaultValue('');
            setRequired(false);
            setOptionsText('');
            setError('');
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanLabel = label.trim();
        if (!cleanLabel) {
            setError('Please enter a column name');
            return;
        }

        // Generate a clean key
        const generatedKey = cleanLabel
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '') || `col_${Date.now()}`;

        const isDuplicate = existingColumns.some(
            (c) => c.key === generatedKey || (c.label && c.label.toLowerCase() === cleanLabel.toLowerCase())
        );

        if (isDuplicate) {
            setError(`A column with the name "${cleanLabel}" already exists.`);
            return;
        }

        const options =
            type === 'select'
                ? optionsText
                      .split(/[\n,]/)
                      .map((opt) => opt.trim())
                      .filter(Boolean)
                : [];

        const newColumn = {
            key: generatedKey,
            label: cleanLabel,
            type,
            width: type === 'number' || type === 'checkbox' ? '130px' : '180px',
            minWidth: '130px',
            required,
            defaultValue: type === 'checkbox' ? false : defaultValue.trim(),
            options: options.length > 0 ? options : undefined,
            isCustom: true
        };

        onAddColumn(newColumn);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 font-sans">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <Columns3 size={16} />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white">
                                Add New Column
                            </h3>
                            <p className="text-[10px] text-gray-400">
                                Add a custom field to this table view
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
                    {error && (
                        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                            {error}
                        </div>
                    )}

                    {/* Column Name */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                            Column Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={label}
                            onChange={(e) => {
                                setLabel(e.target.value);
                                if (error) setError('');
                            }}
                            placeholder="e.g. Tax Rate, Vendor Code, Priority"
                            className="w-full px-3 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                        />
                    </div>

                    {/* Column Type */}
                    <div>
                        <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                            Data Type
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {COLUMN_TYPES.map((t) => {
                                const Icon = t.icon;
                                const isSelected = type === t.value;
                                return (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => setType(t.value)}
                                        className={`p-2 rounded-lg border text-left flex items-start gap-2 transition cursor-pointer ${
                                            isSelected
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                                                : 'bg-white dark:bg-[#0d1117] border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                                        }`}
                                    >
                                        <Icon size={14} className="mt-0.5 shrink-0" />
                                        <div className="truncate">
                                            <div className="text-xs font-semibold">{t.label}</div>
                                            <div className="text-[10px] text-gray-400 font-normal truncate">
                                                {t.desc}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Options for Select dropdown */}
                    {type === 'select' && (
                        <div>
                            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Dropdown Options (comma or line separated)
                            </label>
                            <textarea
                                rows={3}
                                value={optionsText}
                                onChange={(e) => setOptionsText(e.target.value)}
                                placeholder="Option 1, Option 2, Option 3"
                                className="w-full px-3 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Default Value */}
                    {type !== 'checkbox' && (
                        <div>
                            <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                Default Value (Optional)
                            </label>
                            <input
                                type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                                value={defaultValue}
                                onChange={(e) => setDefaultValue(e.target.value)}
                                placeholder="Default value for existing rows"
                                className="w-full px-3 py-1.5 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    {/* Required Checkbox */}
                    <div className="pt-1">
                        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={required}
                                onChange={(e) => setRequired(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-semibold">Mark as Required field</span>
                        </label>
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-gray-200 dark:border-white/10 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                            <Plus size={13} className="stroke-[3]" />
                            <span>Add Column</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExcelAddColumnModal;
