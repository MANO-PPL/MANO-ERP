import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Building2, Check, ArrowRight } from 'lucide-react';

// ─── Inline CRM Auto-Suggest & New Company Editor ───
const CrmPartyAutoSuggestEditor = ({
    value,
    row,
    onChange,
    onBlur,
    rowIndex,
    onChangeValue,
    crmSuggestions = []
}) => {
    const [inputValue, setInputValue] = useState(value || '');
    const [isOpen, setIsOpen] = useState(true);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const [coords, setCoords] = useState({
        buttonTop: 0,
        buttonBottom: 0,
        left: 0,
        width: 320,
        openUpward: false,
        maxHeight: 280,
        ready: false
    });
    const inputRef = useRef(null);
    const blurTimeoutRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
            if (inputRef.current.select) {
                inputRef.current.select();
            }
        }
        return () => {
            if (blurTimeoutRef.current) {
                clearTimeout(blurTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const updateCoords = () => {
            if (inputRef.current) {
                const rect = inputRef.current.getBoundingClientRect();
                const dropdownWidth = Math.max(320, Math.min(rect.width, 440));

                let left = rect.left;
                if (left + dropdownWidth > window.innerWidth - 16) {
                    left = Math.max(16, window.innerWidth - dropdownWidth - 16);
                }
                if (left < 16) left = 16;

                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
                const availableHeight = openUpward ? spaceAbove - 16 : spaceBelow - 16;
                const maxHeight = Math.max(120, Math.min(280, availableHeight));

                setCoords({
                    buttonTop: rect.top,
                    buttonBottom: rect.bottom,
                    left,
                    width: dropdownWidth,
                    openUpward,
                    maxHeight,
                    ready: true
                });
            }
        };
        updateCoords();
        window.addEventListener('scroll', updateCoords, true);
        window.addEventListener('resize', updateCoords);
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen, inputValue]);

    const trimmedInput = String(inputValue || '').trim();
    const hasCustomOption = trimmedInput.length > 0;

    const filteredCrm = useMemo(() => {
        const q = trimmedInput.toLowerCase();
        if (!q) return crmSuggestions.slice(0, 8);
        return crmSuggestions
            .filter(
                (c) =>
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.contact_person || '').toLowerCase().includes(q) ||
                    (c.category || '').toLowerCase().includes(q)
            )
            .slice(0, 8);
    }, [trimmedInput, crmSuggestions]);

    const totalNavItems = (hasCustomOption ? 1 : 0) + filteredCrm.length;

    // Commit custom typed company name
    const handleCommitCustomCompany = (customName) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        const nameToSave = (customName !== undefined ? customName : inputValue || '').trim();
        setInputValue(nameToSave);
        setIsOpen(false);
        onChange(nameToSave);
        if (onChangeValue) {
            onChangeValue(rowIndex, 'name', nameToSave);
        }
        if (onBlur) {
            onBlur(nameToSave);
        }
    };

    // Commit existing CRM suggestion (with POC autofill)
    const handleSelectSuggestion = (item) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        const selectedName = item.name || '';
        setInputValue(selectedName);
        setIsOpen(false);
        onChange(selectedName);

        // Autofill row fields from CRM record
        if (onChangeValue) {
            onChangeValue(rowIndex, 'name', selectedName);
            if (item.category) onChangeValue(rowIndex, 'category', item.category);
            if (item.job_nature || item.job_name) {
                onChangeValue(rowIndex, 'job_name', item.job_nature || item.job_name);
            }
            if (item.contact_person || item.contact_name) {
                onChangeValue(rowIndex, 'contact_person', item.contact_person || item.contact_name);
            }
            if (item.designation) onChangeValue(rowIndex, 'designation', item.designation);
            if (item.responsibility || item.responsibilities) {
                onChangeValue(rowIndex, 'responsibilities', item.responsibility || item.responsibilities);
            }
            if (item.telephone_no || item.phone || item.mobile) {
                onChangeValue(rowIndex, 'telephone_no', item.telephone_no || item.phone || item.mobile);
            }
            if (item.email) onChangeValue(rowIndex, 'email', item.email);
            if (item.address) onChangeValue(rowIndex, 'address', item.address);
        }
        if (onBlur) {
            onBlur(selectedName);
        }
    };

    return (
        <div className="relative w-full h-full flex items-center">
            <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => {
                    const nextVal = e.target.value;
                    setInputValue(nextVal);
                    onChange(nextVal);
                    // Real-time synchronization so the value is saved even if unmounted abruptly
                    if (onChangeValue) {
                        onChangeValue(rowIndex, 'name', nextVal);
                    }
                    setIsOpen(true);
                    setHighlightIndex(0);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightIndex((prev) => (prev + 1) % Math.max(1, totalNavItems));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightIndex((prev) => (prev - 1 + totalNavItems) % Math.max(1, totalNavItems));
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (hasCustomOption && highlightIndex === 0) {
                            handleCommitCustomCompany(inputValue);
                        } else if (hasCustomOption && highlightIndex > 0 && filteredCrm[highlightIndex - 1]) {
                            handleSelectSuggestion(filteredCrm[highlightIndex - 1]);
                        } else if (!hasCustomOption && filteredCrm[highlightIndex]) {
                            handleSelectSuggestion(filteredCrm[highlightIndex]);
                        } else {
                            handleCommitCustomCompany(inputValue);
                        }
                    } else if (e.key === 'Tab') {
                        // On Tab, commit current input value and let default navigation proceed
                        const finalVal = (inputValue || '').trim();
                        onChange(finalVal);
                        if (onChangeValue) {
                            onChangeValue(rowIndex, 'name', finalVal);
                        }
                        if (onBlur) {
                            onBlur(finalVal);
                        }
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsOpen(false);
                        if (onBlur) {
                            onBlur(inputValue);
                        }
                    }
                }}
                onBlur={() => {
                    blurTimeoutRef.current = setTimeout(() => {
                        setIsOpen(false);
                        const finalVal = (inputValue || '').trim();
                        if (finalVal) {
                            onChange(finalVal);
                            if (onChangeValue) {
                                onChangeValue(rowIndex, 'name', finalVal);
                            }
                        }
                        if (onBlur) {
                            onBlur(finalVal);
                        }
                    }, 150);
                }}
                className="w-full h-full px-2 text-xs bg-white dark:bg-[#161b22] text-gray-900 dark:text-white border-2 border-blue-500 rounded outline-none shadow-xs font-semibold"
                placeholder="Type new company or select from CRM..."
            />

            {isOpen && coords.ready && (hasCustomOption || filteredCrm.length > 0) && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: coords.openUpward ? undefined : (coords.buttonBottom ?? 0) + 4,
                        bottom: coords.openUpward ? window.innerHeight - (coords.buttonTop ?? 0) + 4 : undefined,
                        left: coords.left ?? 0,
                        width: coords.width ?? 320,
                        maxHeight: coords.maxHeight ?? 280,
                        zIndex: 99999
                    }}
                    className="bg-white dark:bg-[#1c2128] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100 p-1.5 select-none"
                >
                    {/* 1. Add as New Company Option (Shown whenever user types a company name) */}
                    {hasCustomOption && (
                        <div
                            onMouseDown={(e) => {
                                e.preventDefault();
                                handleCommitCustomCompany(inputValue);
                            }}
                            className={`px-2.5 py-2 rounded-lg text-xs cursor-pointer flex items-center justify-between gap-2 border transition ${
                                highlightIndex === 0
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600/50 text-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                                    : 'bg-gray-50/80 dark:bg-white/[0.03] border-gray-200/60 dark:border-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10'
                            }`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <div className="w-5 h-5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                    <Plus size={12} className="stroke-[3]" />
                                </div>
                                <div className="truncate">
                                    <span className="font-bold text-xs truncate">Use "{trimmedInput}"</span>
                                    <span className="text-[10px] text-blue-600 dark:text-blue-400 ml-1.5 font-normal">(New Company)</span>
                                </div>
                            </div>
                            <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 text-gray-400 shrink-0">
                                ↵ Enter
                            </kbd>
                        </div>
                    )}

                    {/* 2. CRM Suggestions Section */}
                    {filteredCrm.length > 0 ? (
                        <>
                            <div className="px-2 pt-2 pb-1 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-white/5 mb-1 flex items-center justify-between">
                                <span>Select from CRM ({filteredCrm.length})</span>
                                <span className="text-[8px] font-normal normal-case text-gray-400">Autofills category & POC</span>
                            </div>
                            {filteredCrm.map((item, idx) => {
                                const navIdx = (hasCustomOption ? 1 : 0) + idx;
                                const isHighlighted = highlightIndex === navIdx;

                                return (
                                    <div
                                        key={item.id ? `crm-sugg-${item.id}-${idx}` : `crm-sugg-${idx}`}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectSuggestion(item);
                                        }}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer flex items-center justify-between gap-2 transition ${
                                            isHighlighted
                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="truncate flex-1 min-w-0">
                                            <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                                                <Building2 size={12} className="text-gray-400 shrink-0" />
                                                <span className="truncate">{item.name}</span>
                                            </div>
                                            {(item.contact_person || item.telephone_no || item.phone) && (
                                                <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate pl-4">
                                                    {item.contact_person ? `POC: ${item.contact_person}` : ''}
                                                    {item.telephone_no || item.mobile || item.phone ? ` • ${item.telephone_no || item.mobile || item.phone}` : ''}
                                                </div>
                                            )}
                                        </div>
                                        {item.category && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 shrink-0">
                                                {item.category}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    ) : hasCustomOption ? (
                        <div className="px-2.5 py-2 text-[11px] text-gray-400 dark:text-gray-500 italic flex items-center gap-1.5">
                            <Check size={12} className="text-emerald-500 shrink-0" />
                            <span>No CRM match. Press <strong>Enter</strong> to create as new company.</span>
                        </div>
                    ) : null}
                </div>,
                document.body
            )}
        </div>
    );
};

export default CrmPartyAutoSuggestEditor;
