import React, { forwardRef, useId, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';

const MobileSelect = forwardRef(function MobileSelect(
    {
        label,
        options = [],
        children,
        value: externalValue,
        defaultValue,
        onChange,
        placeholder = 'Select an option',
        error,
        hint,
        disabled = false,
        className = '',
        name,
        id: propId,
        required = false,
        searchable,
        ...props
    },
    ref
) {
    const generatedId = useId();
    const id = propId || generatedId;
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;

    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [internalValue, setInternalValue] = useState(defaultValue !== undefined ? defaultValue : '');
    const searchInputRef = useRef(null);

    const value = externalValue !== undefined ? externalValue : internalValue;

    // Normalize options from either options array or children <option> elements
    const normalizedOptions = useMemo(() => {
        if (options && options.length > 0) {
            return options.map((opt) => {
                if (typeof opt === 'object' && opt !== null) {
                    return {
                        value: opt.value !== undefined ? opt.value : opt.id,
                        label: opt.label !== undefined ? String(opt.label) : (opt.name ? String(opt.name) : String(opt.value)),
                        disabled: Boolean(opt.disabled),
                        description: opt.description,
                        badge: opt.badge
                    };
                }
                return { value: opt, label: String(opt), disabled: false };
            });
        }

        if (children) {
            const extracted = [];
            React.Children.forEach(children, (child) => {
                if (!child) return;
                if (child.type === 'option') {
                    extracted.push({
                        value: child.props.value !== undefined ? child.props.value : child.props.children,
                        label: child.props.children ? String(child.props.children) : String(child.props.value),
                        disabled: Boolean(child.props.disabled)
                    });
                }
            });
            return extracted;
        }

        return [];
    }, [options, children]);

    // Active selected option
    const selectedOption = useMemo(() => {
        return normalizedOptions.find((opt) => String(opt.value) === String(value));
    }, [normalizedOptions, value]);

    // Filtered options based on search query
    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return normalizedOptions;
        const q = searchQuery.toLowerCase().trim();
        return normalizedOptions.filter((opt) =>
            opt.label.toLowerCase().includes(q) ||
            String(opt.value).toLowerCase().includes(q) ||
            (opt.description && String(opt.description).toLowerCase().includes(q))
        );
    }, [normalizedOptions, searchQuery]);

    // Auto-enable search if more than 5 options, or if explicitly requested
    const showSearch = searchable !== undefined ? searchable : normalizedOptions.length > 5;

    const handleSelectOption = (opt) => {
        if (opt.disabled) return;
        setInternalValue(opt.value);
        if (onChange) {
            onChange({ target: { value: opt.value, name } });
        }
        setIsOpen(false);
        setSearchQuery('');
    };

    // Lock body scroll when bottom sheet is open
    useEffect(() => {
        if (!isOpen) return;
        const origOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        if (showSearch) {
            setTimeout(() => searchInputRef.current?.focus(), 60);
        }
        return () => {
            document.body.style.overflow = origOverflow;
        };
    }, [isOpen, showSearch]);

    const displayLabel = selectedOption
        ? selectedOption.label
        : value !== undefined && value !== ''
        ? String(value)
        : placeholder;

    return (
        <div className={`min-w-0 ${className}`}>
            {label && (
                <label htmlFor={id} className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gh-text">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            {/* Hidden Input for Form Submissions & ref handling */}
            <input
                ref={ref}
                type="hidden"
                id={id}
                name={name}
                value={value !== undefined ? value : ''}
                {...props}
            />

            {/* Interactive Select Button Trigger */}
            <button
                type="button"
                id={`${id}-trigger`}
                disabled={disabled}
                onClick={() => {
                    if (!disabled) {
                        setSearchQuery('');
                        setIsOpen(true);
                    }
                }}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : hint ? hintId : undefined}
                className={`group min-h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-left transition-all active:scale-[0.99] flex items-center justify-between gap-2 outline-none
                    dark:bg-gh-input dark:text-gh-text
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gh-hover' : 'cursor-pointer hover:border-blue-500/40'}
                    ${error
                        ? 'border-red-500 ring-2 ring-red-500/20'
                        : isOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20'
                        : 'border-gray-200 dark:border-gh-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }
                `}
            >
                <span className={`truncate text-xs ${
                    selectedOption
                        ? 'font-semibold text-gray-900 dark:text-gh-text'
                        : 'font-normal text-gray-400 dark:text-gh-muted'
                }`}>
                    {displayLabel}
                </span>

                <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-blue-500' : 'group-hover:text-gray-600 dark:group-hover:text-gray-300'
                    }`}
                />
            </button>

            {/* Error & Hint Messages */}
            {error ? (
                <p id={errorId} className="mt-0.5 text-[11px] font-normal text-red-600 dark:text-red-400">{error}</p>
            ) : (
                hint && <p id={hintId} className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-gh-muted">{hint}</p>
            )}

            {/* Custom Mobile Options Popup Modal */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Popup Container */}
                    <div className="relative w-full max-w-sm sm:max-w-md my-auto rounded-2xl bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[80dvh] overflow-hidden animate-in zoom-in-95 duration-150 z-10">
                        {/* Popup Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-2 min-w-0">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                    {label || 'Select Option'}
                                </h3>
                                <span className="text-[11px] font-medium text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full shrink-0">
                                    {normalizedOptions.length}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search Filter Bar */}
                        {showSearch && (
                            <div className="px-3 pt-2 pb-1 shrink-0">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Search options..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-8 py-2 bg-gray-50 dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl text-xs outline-none text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery('');
                                                searchInputRef.current?.focus();
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Options List */}
                        <div className="overflow-y-auto overscroll-contain flex-1 p-2 space-y-1">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-8 text-center">
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        No options found
                                    </p>
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400"
                                        >
                                            Clear search
                                        </button>
                                    )}
                                </div>
                            ) : (
                                filteredOptions.map((opt, idx) => {
                                    const isSelected = String(opt.value) === String(value);
                                    return (
                                        <button
                                            key={`${opt.value}-${idx}`}
                                            type="button"
                                            disabled={opt.disabled}
                                            onClick={() => handleSelectOption(opt)}
                                            className={`w-full min-h-11 px-3 py-2.5 rounded-xl text-left flex items-center justify-between gap-2.5 transition-all active:scale-[0.99] ${
                                                opt.disabled
                                                    ? 'opacity-40 cursor-not-allowed'
                                                    : isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                                                    : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10 active:bg-gray-200/70'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="truncate text-xs">
                                                        {opt.label}
                                                    </span>
                                                    {opt.badge && (
                                                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-600 dark:bg-white/10 dark:text-gh-muted shrink-0">
                                                            {opt.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                {opt.description && (
                                                    <p className="text-[11px] font-normal text-gray-400 dark:text-gh-muted truncate mt-0.5">
                                                        {opt.description}
                                                    </p>
                                                )}
                                            </div>

                                            {isSelected && (
                                                <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

export default MobileSelect;
