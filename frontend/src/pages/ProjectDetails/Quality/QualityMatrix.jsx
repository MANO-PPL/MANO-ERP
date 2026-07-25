import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
    Plus, Trash2, ArrowLeft, Search, Layers, ChevronRight, GripVertical,
    FolderPlus, Sparkles, MoveVertical, ArrowUp, ArrowDown, Split, Copy, ClipboardCheck
} from 'lucide-react';
import { toast } from 'react-toastify';

/**
 * Auto-resizing multi-line textarea component.
 * - Single click: focus & edit
 * - Double click: select all text in box
 * - Shift + Enter: new line
 * - Enter: submit & return to highlight / move down
 */
const AutoResizingTextarea = ({ 
    value, 
    onChange, 
    placeholder, 
    isEditing, 
    onFocus, 
    onCommit,
    className = '', 
    ...props 
}) => {
    const textareaRef = useRef(null);

    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [value]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            const len = textareaRef.current.value ? textareaRef.current.value.length : 0;
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.setSelectionRange(len, len);
                }
            });
            adjustHeight();
        }
    }, [isEditing]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            if (onCommit) onCommit();
            return;
        }

        // Ctrl / Cmd / Alt + Left Arrow (move caret back word by word)
        if ((e.ctrlKey || e.metaKey || e.altKey) && e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            if (textareaRef.current) {
                const text = textareaRef.current.value;
                const pos = textareaRef.current.selectionStart;
                if (pos > 0) {
                    let newPos = pos - 1;
                    while (newPos > 0 && text[newPos - 1] === ' ') {
                        newPos--;
                    }
                    while (newPos > 0 && text[newPos - 1] !== ' ') {
                        newPos--;
                    }
                    textareaRef.current.setSelectionRange(newPos, newPos);
                }
            }
            return;
        }

        // Ctrl / Cmd / Alt + Right Arrow (move caret forward word by word)
        if ((e.ctrlKey || e.metaKey || e.altKey) && e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            if (textareaRef.current) {
                const text = textareaRef.current.value;
                const pos = textareaRef.current.selectionEnd;
                if (pos < text.length) {
                    let newPos = pos + 1;
                    while (newPos < text.length && text[newPos] === ' ') {
                        newPos++;
                    }
                    while (newPos < text.length && text[newPos] !== ' ') {
                        newPos++;
                    }
                    textareaRef.current.setSelectionRange(newPos, newPos);
                }
            }
            return;
        }
    };

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        if (textareaRef.current) {
            textareaRef.current.select();
        }
    };

    if (!isEditing) {
        return (
            <div 
                className={`w-full px-1.5 py-1 text-xs leading-relaxed whitespace-pre-wrap break-words min-h-[24px] cursor-pointer select-none ${className}`}
            >
                {value || <span className="text-gray-400 dark:text-gray-600 italic">{placeholder}</span>}
            </div>
        );
    }

    return (
        <textarea
            ref={textareaRef}
            rows={1}
            value={value || ''}
            onChange={(e) => {
                onChange(e);
                adjustHeight();
            }}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            onDoubleClick={handleDoubleClick}
            placeholder={placeholder}
            className={`w-full bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-1 resize-none overflow-hidden whitespace-pre-wrap break-words text-xs leading-relaxed transition-all ${className}`}
            {...props}
        />
    );
};

/**
 * Pre-populated initial sample matrix data matching the reference images
 */
const INITIAL_MATRIX_DATA = [
    {
        id: 'cat_a',
        type: 'category',
        code: 'A',
        title: 'Civil Works'
    },
    {
        id: 'mat_1',
        type: 'material',
        categoryId: 'cat_a',
        code: '1',
        title: 'Ordinary Portland Cement',
        subtitle: '43 grade or 53 Grade',
        reference: 'IS 8112 / IS 12269',
        remarks: 'Sample test certificates to be maintained at site lab.',
        hasSubdivisions: false,
        tests: [
            { id: 't1_1', name: 'Physical - Setting time (Initial)', result: 'Not less than 30 min', interval: '5000 bags or change of brand' },
            { id: 't1_2', name: 'Physical - Setting time (Final)', result: 'not more than 600 min', interval: '' },
            { id: 't1_3', name: 'Fineness', result: 'not more than 10% of weight pass through 90 micron sieve', interval: '' },
            { id: 't1_4', name: 'Compressive strength at 28 days', result: 'should be more than 43N/mm² and 53N/mm² respectively for 43 and 53 grade cement', interval: '' },
            { id: 't1_5', name: 'Chemical Composition', result: 'As per manufacturer test report', interval: '' }
        ]
    },
    {
        id: 'mat_2',
        type: 'material',
        categoryId: 'cat_a',
        code: '2',
        title: 'R/F Steel',
        subtitle: '[Fe 415 / Fe 500]',
        reference: 'IS 1786',
        remarks: 'Check for manufacturer logo & grade embossing on bars.',
        hasSubdivisions: false,
        tests: [
            { id: 't2_1', name: 'Physical - % Elongation', result: 'Min 14.5%', interval: 'Each lot' },
            { id: 't2_2', name: 'Physical - Proof strength', result: '415 N/mm²', interval: '' },
            { id: 't2_3', name: 'Physical - Ultimate strength', result: '485 N/mm²', interval: '' },
            { id: 't2_4', name: 'Physical - Unit weight', result: 'as per IS 1786 table 3', interval: '' },
            { id: 't2_5', name: 'Physical - Rolling margin', result: 'Within permissible limit as per IS code', interval: '' },
            { id: 't2_6', name: 'Chemical composition', result: 'As per manufacturer test report', interval: '' }
        ]
    },
    {
        id: 'mat_3',
        type: 'material',
        categoryId: 'cat_a',
        code: '3',
        title: 'Soil for backfilling',
        subtitle: '',
        reference: 'IS 2720',
        remarks: 'Free from organic matter, roots, and debris.',
        hasSubdivisions: false,
        tests: [
            { id: 't3_1', name: 'Maximum dry density & Optimum Moisture content', result: 'As per IS 2720', interval: 'Each source or change of soil type from each borrow pit' },
            { id: 't3_2', name: 'Field dry density per each layer of filling', result: 'minimum 90 to 95 % of MDD', interval: 'Each layer of filling and compaction' }
        ]
    },
    {
        id: 'mat_4',
        type: 'material',
        categoryId: 'cat_a',
        code: '4',
        title: 'Fine aggregate',
        subtitle: '',
        reference: 'IS 383',
        remarks: 'Washed sand required if silt content exceeds 8%.',
        hasSubdivisions: false,
        tests: [
            { id: 't4_1', name: 'Sieve analysis', result: 'should conform to zone 1 or 2', interval: 'every 200M3 or change of source' },
            { id: 't4_2', name: 'Silt content', result: 'Max 8% by volume', interval: '' },
            { id: 't4_3', name: 'Specific gravity', result: '2.6 to 2.8 (once for each source)', interval: '' }
        ]
    },
    {
        id: 'mat_15',
        type: 'material_group',
        categoryId: 'cat_a',
        code: '15',
        title: 'Flooring Materials',
        hasSubdivisions: true,
        subdivisions: [
            {
                id: 'sub_15a',
                code: 'a',
                title: 'Kota / Jaisalmer / Cuddapa / Shahabad / Granite',
                reference: 'Physical inspection report to be maintained',
                remarks: 'Check edges for chipping and uniformity of shade.',
                tests: [
                    { id: 't15a_1', name: 'Visual Inspection for shades, thickness, colour & Cracks', result: 'As per BOQ', interval: 'Each Lot' }
                ]
            },
            {
                id: 'sub_15b',
                code: 'b',
                title: 'Ceramic / Vitrified',
                reference: 'Physical inspection report to be maintained',
                remarks: 'Verify water absorption test as per manufacturer spec.',
                tests: [
                    { id: 't15b_1', name: 'Visual Inspection for shades, thickness, colour & Cracks', result: 'As per BOQ / Approved Mock up', interval: 'Each Lot' }
                ]
            }
        ]
    }
];

const COLUMNS = ['material', 'test', 'result', 'reference', 'interval', 'remarks'];

const QualityMatrix = ({ project, canWrite, onBack }) => {
    const [matrixItems, setMatrixItems] = useState(INITIAL_MATRIX_DATA);
    const [searchTerm, setSearchTerm] = useState('');

    // Excel Selection & Edit state
    const [activeCell, setActiveCell] = useState({
        matId: 'mat_1',
        subId: null,
        testId: 't1_1',
        colKey: 'material',
        isEditing: false
    });

    // Undo / Redo Stack State
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);

    // Clipboard for Ctrl+C / Ctrl+V
    const [copiedBuffer, setCopiedBuffer] = useState(null); // { type: 'MATERIAL_BLOCK' | 'TEST_ROW', data: obj }

    const [draggedTest, setDraggedTest] = useState(null);
    const [dragOverTarget, setDragOverTarget] = useState(null);

    // Save previous state to undo stack
    const pushUndoState = useCallback((currentItems) => {
        setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(currentItems))]);
        setRedoStack([]);
    }, []);

    // Filter items based on search term
    const filteredItems = useMemo(() => {
        return matrixItems.filter(item => {
            if (!searchTerm) return true;
            const q = searchTerm.toLowerCase();
            if (item.title?.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q)) return true;
            if (item.reference?.toLowerCase().includes(q)) return true;
            if (item.tests?.some(t => t.name.toLowerCase().includes(q) || t.result.toLowerCase().includes(q))) return true;
            if (item.subdivisions?.some(sub => sub.title.toLowerCase().includes(q))) return true;
            return false;
        });
    }, [matrixItems, searchTerm]);

    // ─── Generate Flat List of Rendered Rows for Precise Arrow Navigation ──────
    const flatRowMap = useMemo(() => {
        const rows = [];
        filteredItems.forEach(item => {
            if (item.type === 'category') {
                rows.push({ rowType: 'category', matId: item.id, subId: null, testId: null });
            } else if (item.type === 'material') {
                const tests = item.tests && item.tests.length > 0 ? item.tests : [{ id: 'empty' }];
                tests.forEach(t => {
                    rows.push({ rowType: 'material', matId: item.id, subId: null, testId: t.id });
                });
            } else if (item.type === 'material_group') {
                rows.push({ rowType: 'material_group_header', matId: item.id, subId: null, testId: null });
                item.subdivisions?.forEach(sub => {
                    const tests = sub.tests && sub.tests.length > 0 ? sub.tests : [{ id: 'empty' }];
                    tests.forEach(t => {
                        rows.push({ rowType: 'subdivision', matId: item.id, subId: sub.id, testId: t.id });
                    });
                });
            }
        });
        return rows;
    }, [filteredItems]);

    // ─── Move Focus Up/Down in Flat Row Map ────────────────────────────────────
    const navigateRow = useCallback((direction) => {
        if (flatRowMap.length === 0) return;

        let currentIdx = flatRowMap.findIndex(r => {
            if (r.matId !== activeCell.matId) return false;
            if (r.subId !== activeCell.subId) return false;
            if (r.testId && activeCell.testId && r.testId !== activeCell.testId) return false;
            return true;
        });

        if (currentIdx === -1) currentIdx = 0;

        let targetIdx = direction === 'down' ? currentIdx + 1 : currentIdx - 1;
        if (targetIdx < 0) targetIdx = 0;
        if (targetIdx >= flatRowMap.length) targetIdx = flatRowMap.length - 1;

        const targetRow = flatRowMap[targetIdx];
        if (targetRow) {
            setActiveCell(prev => ({
                ...prev,
                matId: targetRow.matId,
                subId: targetRow.subId,
                testId: targetRow.testId,
                isEditing: false
            }));
        }
    }, [flatRowMap, activeCell]);

    // ─── Undo & Redo Handlers ──────────────────────────────────────────────────
    const handleUndo = useCallback(() => {
        if (undoStack.length === 0) return;
        const previousState = undoStack[undoStack.length - 1];
        setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(matrixItems))]);
        setMatrixItems(previousState);
        setUndoStack(prev => prev.slice(0, -1));
        toast.info('Undo action (Ctrl+Z)');
    }, [undoStack, matrixItems]);

    const handleRedo = useCallback(() => {
        if (redoStack.length === 0) return;
        const nextState = redoStack[redoStack.length - 1];
        setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(matrixItems))]);
        setMatrixItems(nextState);
        setRedoStack(prev => prev.slice(0, -1));
        toast.info('Redo action (Ctrl+Y)');
    }, [redoStack, matrixItems]);

    // ─── Copy & Paste Handlers ─────────────────────────────────────────────────
    const handleCopy = useCallback(() => {
        if (!activeCell.matId) return;
        const currentMat = matrixItems.find(i => i.id === activeCell.matId);
        if (!currentMat) return;

        if (activeCell.colKey === 'material') {
            setCopiedBuffer({
                type: 'MATERIAL_BLOCK',
                data: JSON.parse(JSON.stringify(currentMat))
            });
            toast.success(`Copied entire material "${currentMat.title}"! Press Ctrl+V to duplicate.`);
        } else {
            let testRow = null;
            if (!currentMat.hasSubdivisions) {
                testRow = currentMat.tests?.find(t => t.id === activeCell.testId);
            } else if (activeCell.subId) {
                const sub = currentMat.subdivisions?.find(s => s.id === activeCell.subId);
                testRow = sub?.tests?.find(t => t.id === activeCell.testId);
            }

            if (testRow) {
                setCopiedBuffer({
                    type: 'TEST_ROW',
                    data: JSON.parse(JSON.stringify(testRow))
                });
                toast.success(`Copied test "${testRow.name}"! Press Ctrl+V to paste into material.`);
            }
        }
    }, [activeCell, matrixItems]);

    const handlePaste = useCallback(() => {
        if (!copiedBuffer || !activeCell.matId) return;

        pushUndoState(matrixItems);

        if (copiedBuffer.type === 'MATERIAL_BLOCK') {
            const sourceMat = copiedBuffer.data;
            const newMatId = `mat_${Date.now()}`;
            
            const clonedMat = {
                ...sourceMat,
                id: newMatId,
                title: `${sourceMat.title} (Copy)`,
                tests: sourceMat.tests?.map((t, idx) => ({ ...t, id: `t_${Date.now()}_${idx}` })),
                subdivisions: sourceMat.subdivisions?.map((sub, sIdx) => ({
                    ...sub,
                    id: `sub_${Date.now()}_${sIdx}`,
                    tests: sub.tests?.map((t, idx) => ({ ...t, id: `t_${Date.now()}_${sIdx}_${idx}` }))
                }))
            };

            const targetIdx = matrixItems.findIndex(i => i.id === activeCell.matId);
            const updated = [...matrixItems];
            updated.splice(targetIdx !== -1 ? targetIdx + 1 : matrixItems.length, 0, clonedMat);
            setMatrixItems(updated);
            setActiveCell({ matId: newMatId, subId: null, testId: clonedMat.tests?.[0]?.id || null, colKey: 'material', isEditing: false });
            toast.success(`Duplicated material block "${clonedMat.title}"!`);
        } else if (copiedBuffer.type === 'TEST_ROW') {
            const sourceTest = copiedBuffer.data;
            const newTestId = `t_${Date.now()}`;
            const clonedTest = { ...sourceTest, id: newTestId, name: `${sourceTest.name} (Copy)` };

            setMatrixItems(prev => prev.map(item => {
                if (item.id === activeCell.matId) {
                    if (!item.hasSubdivisions) {
                        return { ...item, tests: [...item.tests, clonedTest] };
                    } else if (activeCell.subId) {
                        const updatedSubs = item.subdivisions.map(sub => {
                            if (sub.id === activeCell.subId) {
                                return { ...sub, tests: [...sub.tests, clonedTest] };
                            }
                            return sub;
                        });
                        return { ...item, subdivisions: updatedSubs };
                    }
                }
                return item;
            }));
            toast.success(`Pasted test parameter "${clonedTest.name}"!`);
        }
    }, [copiedBuffer, activeCell, matrixItems, pushUndoState]);

    // ─── Global Keyboard Shortcuts Listener ────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (e.shiftKey) {
                    e.preventDefault();
                    handleRedo();
                } else {
                    e.preventDefault();
                    handleUndo();
                }
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                handleRedo();
                return;
            }

            // Copy / Paste
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !activeCell.isEditing) {
                e.preventDefault();
                handleCopy();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !activeCell.isEditing) {
                e.preventDefault();
                handlePaste();
                return;
            }

            // Edit Mode Toggles
            if (activeCell.isEditing) {
                if (e.key === 'Escape') {
                    setActiveCell(prev => ({ ...prev, isEditing: false }));
                }
                return;
            }

            if (e.key === 'F2' || e.key === 'Enter') {
                e.preventDefault();
                setActiveCell(prev => ({ ...prev, isEditing: true }));
                return;
            }

            // Column and Row Navigation via Arrow Keys
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const colIdx = COLUMNS.indexOf(activeCell.colKey);

                if (e.key === 'ArrowRight' && colIdx < COLUMNS.length - 1) {
                    setActiveCell(prev => ({ ...prev, colKey: COLUMNS[colIdx + 1] }));
                } else if (e.key === 'ArrowLeft' && colIdx > 0) {
                    setActiveCell(prev => ({ ...prev, colKey: COLUMNS[colIdx - 1] }));
                } else if (e.key === 'ArrowDown') {
                    navigateRow('down');
                } else if (e.key === 'ArrowUp') {
                    navigateRow('up');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeCell, handleCopy, handlePaste, handleUndo, handleRedo, navigateRow]);

    // ─── Add Category (A, B, C...) ─────────────────────────────────────────────
    const handleAddCategory = () => {
        pushUndoState(matrixItems);
        const catCount = matrixItems.filter(i => i.type === 'category').length;
        const nextCode = String.fromCharCode(65 + catCount);
        const newCat = {
            id: `cat_${Date.now()}`,
            type: 'category',
            code: nextCode,
            title: `Section ${nextCode}`
        };
        setMatrixItems(prev => [...prev, newCat]);
        toast.info(`Added Section ${nextCode}`);
    };

    // ─── Add Material under specific Category Section ──────────────────────────
    const handleAddMaterialToCategory = (catId, hasSubdivisions = false) => {
        pushUndoState(matrixItems);
        const catIndex = matrixItems.findIndex(i => i.id === catId);
        if (catIndex === -1) return;

        let lastItemIndex = catIndex;
        for (let i = catIndex + 1; i < matrixItems.length; i++) {
            if (matrixItems[i].type === 'category') break;
            lastItemIndex = i;
        }

        const currentMatCount = matrixItems.filter((item, idx) => 
            idx <= lastItemIndex && (item.type === 'material' || item.type === 'material_group')
        ).length + 1;

        const newMatId = `mat_${Date.now()}`;
        const newMat = hasSubdivisions
            ? {
                id: newMatId,
                type: 'material_group',
                categoryId: catId,
                code: String(currentMatCount),
                title: 'New Material Group',
                hasSubdivisions: true,
                subdivisions: [
                    {
                        id: `sub_${Date.now()}_a`,
                        code: 'a',
                        title: 'Sub-division A',
                        reference: 'IS standard',
                        remarks: '',
                        tests: [{ id: `t_${Date.now()}_1`, name: 'Visual Inspection', result: 'As per BOQ', interval: 'Each Lot' }]
                    }
                ]
            }
            : {
                id: newMatId,
                type: 'material',
                categoryId: catId,
                code: String(currentMatCount),
                title: 'New Material Description',
                subtitle: '',
                reference: 'IS standard reference',
                remarks: '',
                hasSubdivisions: false,
                tests: [
                    { id: `t_${Date.now()}_1`, name: 'Test to be conducted', result: 'Acceptable result criteria', interval: 'Interval' }
                ]
            };

        const updated = [...matrixItems];
        updated.splice(lastItemIndex + 1, 0, newMat);
        setMatrixItems(updated);
        toast.success(`Added Material into Section`);
    };

    // ─── Convert simple material into sub-divisions (a, b...) ────────────────
    const handleConvertToSubdivisions = (matId) => {
        pushUndoState(matrixItems);
        setMatrixItems(prev => prev.map(item => {
            if (item.id === matId && item.type === 'material') {
                const existingTests = item.tests && item.tests.length > 0 ? item.tests : [
                    { id: `t_${Date.now()}_1`, name: 'Visual Inspection', result: 'As per BOQ', interval: 'Each Lot' }
                ];

                return {
                    ...item,
                    type: 'material_group',
                    hasSubdivisions: true,
                    subdivisions: [
                        {
                            id: `sub_${Date.now()}_a`,
                            code: 'a',
                            title: `${item.title} (Sub-item a)`,
                            reference: item.reference || 'IS standard',
                            remarks: item.remarks || '',
                            tests: existingTests
                        }
                    ]
                };
            }
            return item;
        }));
        toast.success('Converted material into sub-divisions (a, b...)!');
    };

    // ─── Add Sub-division (a, b, c) under Material Group ───────────────────────
    const handleAddSubdivision = (matId) => {
        pushUndoState(matrixItems);
        setMatrixItems(prev => prev.map(item => {
            if (item.id === matId && item.hasSubdivisions) {
                const subCount = item.subdivisions.length;
                const nextCode = String.fromCharCode(97 + subCount);
                const newSub = {
                    id: `sub_${Date.now()}_${nextCode}`,
                    code: nextCode,
                    title: `Sub-division ${nextCode}`,
                    reference: item.reference || 'IS standard reference',
                    remarks: '',
                    tests: [{ id: `t_${Date.now()}_1`, name: 'Inspection / Test', result: 'As per BOQ', interval: 'Each Lot' }]
                };
                return { ...item, subdivisions: [...item.subdivisions, newSub] };
            }
            return item;
        }));
        toast.info('Added Sub-division');
    };

    // ─── Add Test Row ──────────────────────────────────────────────────────────
    const handleAddTestRow = (matId, subId = null) => {
        pushUndoState(matrixItems);
        setMatrixItems(prev => prev.map(item => {
            if (item.id === matId) {
                if (!subId && !item.hasSubdivisions) {
                    const newTest = {
                        id: `t_${Date.now()}`,
                        name: 'New Test to be conducted',
                        result: 'Acceptable test result criteria',
                        interval: 'Testing interval'
                    };
                    return { ...item, tests: [...item.tests, newTest] };
                } else if (subId && item.hasSubdivisions) {
                    const updatedSubs = item.subdivisions.map(sub => {
                        if (sub.id === subId) {
                            const newTest = {
                                id: `t_${Date.now()}`,
                                name: 'New Test to be conducted',
                                result: 'Acceptable test result criteria',
                                interval: 'Testing interval'
                            };
                            return { ...sub, tests: [...sub.tests, newTest] };
                        }
                        return sub;
                    });
                    return { ...item, subdivisions: updatedSubs };
                }
            }
            return item;
        }));
    };

    // ─── Delete Item / Test Row ────────────────────────────────────────────────
    const handleDeleteItem = (itemId) => {
        pushUndoState(matrixItems);
        setMatrixItems(prev => prev.filter(i => i.id !== itemId));
        toast.info('Item removed');
    };

    const handleDeleteTestRow = (matId, testId, subId = null) => {
        pushUndoState(matrixItems);
        setMatrixItems(prev => prev.map(item => {
            if (item.id === matId) {
                if (!subId && !item.hasSubdivisions) {
                    return { ...item, tests: item.tests.filter(t => t.id !== testId) };
                } else if (subId && item.hasSubdivisions) {
                    const updatedSubs = item.subdivisions.map(sub => {
                        if (sub.id === subId) {
                            return { ...sub, tests: sub.tests.filter(t => t.id !== testId) };
                        }
                        return sub;
                    });
                    return { ...item, subdivisions: updatedSubs };
                }
            }
            return item;
        }));
    };

    // ─── Update Fields ────────────────────────────────────────────────────────
    const handleUpdateField = (matId, field, value, testId = null, subId = null) => {
        setMatrixItems(prev => prev.map(item => {
            if (item.id === matId) {
                if (testId && !subId && !item.hasSubdivisions) {
                    const updatedTests = item.tests.map(t => t.id === testId ? { ...t, [field]: value } : t);
                    return { ...item, tests: updatedTests };
                }
                if (testId && subId && item.hasSubdivisions) {
                    const updatedSubs = item.subdivisions.map(sub => {
                        if (sub.id === subId) {
                            const updatedTests = sub.tests.map(t => t.id === testId ? { ...t, [field]: value } : t);
                            return { ...sub, tests: updatedTests };
                        }
                        return sub;
                    });
                    return { ...item, subdivisions: updatedSubs };
                }
                if (subId && !testId && item.hasSubdivisions) {
                    const updatedSubs = item.subdivisions.map(sub => sub.id === subId ? { ...sub, [field]: value } : sub);
                    return { ...item, subdivisions: updatedSubs };
                }
                return { ...item, [field]: value };
            }
            return item;
        }));
    };

    // ─── HTML5 Drag and Drop Handlers for Reordering ────────────────────────────
    const handleDragStartTest = (e, matId, subId, testId, index) => {
        e.stopPropagation();
        setDraggedTest({ matId, subId, testId, index });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', JSON.stringify({ matId, subId, testId, index }));
    };

    const handleDragOverTest = (e, matId, subId, targetIndex) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverTarget({ matId, subId, index: targetIndex });
    };

    const handleDropTest = (e, targetMatId, targetSubId, targetIndex) => {
        e.preventDefault();
        setDragOverTarget(null);
        if (!draggedTest) return;

        pushUndoState(matrixItems);
        const { matId: sourceMatId, subId: sourceSubId, testId: sourceTestId } = draggedTest;

        setMatrixItems(prev => prev.map(item => {
            if (item.id === sourceMatId && targetMatId === sourceMatId && !item.hasSubdivisions) {
                const tests = [...item.tests];
                const sourceIdx = tests.findIndex(t => t.id === sourceTestId);
                if (sourceIdx === -1) return item;
                const [moved] = tests.splice(sourceIdx, 1);
                tests.splice(targetIndex, 0, moved);
                return { ...item, tests };
            }

            if (item.id === targetMatId && item.hasSubdivisions) {
                let movedTestObj = null;

                const updatedSubs = item.subdivisions.map(sub => {
                    if (sub.id === sourceSubId) {
                        const tests = [...sub.tests];
                        const sIdx = tests.findIndex(t => t.id === sourceTestId);
                        if (sIdx !== -1) {
                            [movedTestObj] = tests.splice(sIdx, 1);
                        }
                        return { ...sub, tests };
                    }
                    return sub;
                });

                if (!movedTestObj) return item;

                const finalSubs = updatedSubs.map(sub => {
                    if (sub.id === targetSubId) {
                        const tests = [...sub.tests];
                        tests.splice(targetIndex, 0, movedTestObj);
                        return { ...sub, tests };
                    }
                    return sub;
                });

                return { ...item, subdivisions: finalSubs };
            }

            return item;
        }));

        setDraggedTest(null);
        toast.success('Reordered test parameter!');
    };

    // Helper for active cell highlight
    const isCellActive = (matId, colKey, testId = null, subId = null) => {
        if (activeCell.matId !== matId || activeCell.colKey !== colKey) return false;
        if (testId && activeCell.testId !== testId) return false;
        if (subId && activeCell.subId !== subId) return false;
        return true;
    };

    const handleCommit = () => {
        setActiveCell(prev => ({ ...prev, isEditing: false }));
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0d1117] overflow-hidden Poppins select-none">
            {/* Top Toolbar */}
            <div className="px-6 py-3.5 border-b border-gray-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-4 shrink-0 bg-gray-50/50 dark:bg-white/[0.01]">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-white/10 transition-all flex items-center space-x-2 text-xs font-semibold"
                    >
                        <ArrowLeft size={16} />
                        <span>Back</span>
                    </button>
                    <div>
                        <h2 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center space-x-2">
                            <span>QA/QC Matrix Parameters</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
                                Excel Editor Mode
                            </span>
                        </h2>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 font-normal">
                            Single click edit · Enter to submit & next row · Shift+Enter new line · Double-click select all · Arrow keys navigate · Ctrl+Z Undo
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search material or test..."
                            className="w-56 bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>

                    {canWrite && (
                        <button
                            onClick={handleAddCategory}
                            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center space-x-1.5"
                        >
                            <Plus size={14} />
                            <span>+ Add Section (A, B)</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Matrix Table View */}
            <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-gray-50/20 dark:bg-transparent">
                <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-[#0d1117]">
                    <table className="w-full text-left border-collapse text-xs table-fixed">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-[#161b22] text-gray-700 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-white/10 uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-3 w-14 text-center border-r border-gray-200 dark:border-white/10">Sl. No.</th>
                                <th className="py-3 px-4 w-[260px] border-r border-gray-200 dark:border-white/10">Description of Material / Item</th>
                                <th className="py-3 px-4 w-[280px] border-r border-gray-200 dark:border-white/10">Tests to be conducted</th>
                                <th className="py-3 px-4 w-[280px] border-r border-gray-200 dark:border-white/10">Acceptable Test Results</th>
                                <th className="py-3 px-4 w-[200px] border-r border-gray-200 dark:border-white/10">Reference (IS Code)</th>
                                <th className="py-3 px-4 w-[200px] border-r border-gray-200 dark:border-white/10">Time and Interval</th>
                                <th className="py-3 px-4 border-r border-gray-200 dark:border-white/10">Remarks</th>
                                {canWrite && <th className="py-3 px-3 w-16 text-center">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                            {filteredItems.map(item => {
                                // 1. Render Category Banner with Contextual Actions
                                if (item.type === 'category') {
                                    return (
                                        <tr key={item.id} className="bg-gray-200/90 dark:bg-white/[0.07] font-extrabold text-gray-900 dark:text-white text-xs group">
                                            <td className="py-2.5 px-3 text-center border-r border-gray-300 dark:border-white/10 font-black text-blue-600 dark:text-blue-400">{item.code}</td>
                                            <td 
                                                colSpan={canWrite ? 5 : 6} 
                                                onClick={() => setActiveCell({ matId: item.id, subId: null, testId: null, colKey: 'material', isEditing: false })}
                                                onDoubleClick={() => setActiveCell({ matId: item.id, subId: null, testId: null, colKey: 'material', isEditing: true })}
                                                className="py-2.5 px-4 uppercase tracking-wider text-blue-600 dark:text-blue-400"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <AutoResizingTextarea
                                                        value={item.title}
                                                        onChange={e => handleUpdateField(item.id, 'title', e.target.value)}
                                                        isEditing={activeCell.matId === item.id && activeCell.isEditing}
                                                        onCommit={handleCommit}
                                                        className="font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider text-sm"
                                                    />
                                                    
                                                    {canWrite && (
                                                        <div className="flex items-center space-x-2 opacity-90 group-hover:opacity-100 transition-opacity ml-4 shrink-0">
                                                            <button
                                                                onClick={() => handleAddMaterialToCategory(item.id, false)}
                                                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold shadow-xs transition-all flex items-center space-x-1"
                                                            >
                                                                <Plus size={12} />
                                                                <span>+ Material to Section {item.code}</span>
                                                            </button>

                                                            <button
                                                                onClick={() => handleAddMaterialToCategory(item.id, true)}
                                                                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[10px] font-bold shadow-xs transition-all flex items-center space-x-1"
                                                            >
                                                                <FolderPlus size={12} />
                                                                <span>+ Group (a, b...)</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            {canWrite && (
                                                <td className="py-2.5 px-3 text-center border-l border-gray-300 dark:border-white/10">
                                                    <button onClick={() => handleDeleteItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                }

                                // 2. Render Material without sub-divisions (Simple Material)
                                if (item.type === 'material') {
                                    const testRows = item.tests && item.tests.length > 0 ? item.tests : [{ id: 'empty', name: '', result: '', interval: '' }];
                                    const totalRows = testRows.length;

                                    return testRows.map((test, index) => {
                                        const isDragTarget = dragOverTarget && dragOverTarget.matId === item.id && !dragOverTarget.subId && dragOverTarget.index === index;

                                        return (
                                            <tr 
                                                key={`${item.id}_${test.id}_${index}`} 
                                                onDragOver={e => handleDragOverTest(e, item.id, null, index)}
                                                onDrop={e => handleDropTest(e, item.id, null, index)}
                                                className={`hover:bg-gray-50/50 dark:hover:bg-white/[0.01] transition-all group ${isDragTarget ? 'border-t-2 border-blue-500 bg-blue-500/5' : ''}`}
                                            >
                                                {/* Sl. No & Material Description (Spans across all test rows for this material) */}
                                                {index === 0 && (
                                                    <>
                                                        <td rowSpan={totalRows} className="py-3 px-3 text-center font-black text-gray-900 dark:text-white align-top border-r border-gray-200 dark:border-white/10 bg-gray-50/30 dark:bg-white/[0.01]">
                                                            {item.code}
                                                        </td>
                                                        <td 
                                                            rowSpan={totalRows} 
                                                            onClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'material', isEditing: false })}
                                                            onDoubleClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'material', isEditing: true })}
                                                            className={`py-3 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'material') ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                        >
                                                            <AutoResizingTextarea
                                                                value={item.title}
                                                                onChange={e => handleUpdateField(item.id, 'title', e.target.value)}
                                                                isEditing={isCellActive(item.id, 'material') && activeCell.isEditing}
                                                                onCommit={handleCommit}
                                                                className="font-bold text-gray-900 dark:text-white mb-1"
                                                                placeholder="Material Name"
                                                            />
                                                            <AutoResizingTextarea
                                                                value={item.subtitle || ''}
                                                                onChange={e => handleUpdateField(item.id, 'subtitle', e.target.value)}
                                                                isEditing={isCellActive(item.id, 'material') && activeCell.isEditing}
                                                                onCommit={handleCommit}
                                                                className="text-[11px] text-gray-500 dark:text-gray-400 mb-2"
                                                                placeholder="Spec / Subtitle (e.g. 43 grade)"
                                                            />
                                                            
                                                            {canWrite && (
                                                                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-white/5">
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleAddTestRow(item.id); }}
                                                                        className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center space-x-1"
                                                                    >
                                                                        <Plus size={11} />
                                                                        <span>Add Test Row</span>
                                                                    </button>

                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleConvertToSubdivisions(item.id); }}
                                                                        className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center space-x-1 ml-2"
                                                                    >
                                                                        <Split size={11} />
                                                                        <span>Group into Sub-divisions (a, b...)</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </>
                                                )}

                                                {/* Test Name */}
                                                <td 
                                                    onClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'test', isEditing: false })}
                                                    onDoubleClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'test', isEditing: true })}
                                                    className={`py-2.5 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'test', test.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                >
                                                    <div className="flex items-start space-x-1.5">
                                                        {canWrite && (
                                                            <div 
                                                                draggable={true}
                                                                onDragStart={e => handleDragStartTest(e, item.id, null, test.id, index)}
                                                                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-blue-500 p-0.5 mt-0.5"
                                                            >
                                                                <GripVertical size={13} />
                                                            </div>
                                                        )}
                                                        <AutoResizingTextarea
                                                            value={test.name}
                                                            onChange={e => handleUpdateField(item.id, 'name', e.target.value, test.id)}
                                                            isEditing={isCellActive(item.id, 'test', test.id) && activeCell.isEditing}
                                                            onCommit={handleCommit}
                                                            className="text-gray-800 dark:text-gray-200"
                                                            placeholder="Test Name"
                                                        />
                                                    </div>
                                                </td>

                                                {/* Acceptable Test Result */}
                                                <td 
                                                    onClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'result', isEditing: false })}
                                                    onDoubleClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'result', isEditing: true })}
                                                    className={`py-2.5 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'result', test.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                >
                                                    <AutoResizingTextarea
                                                        value={test.result}
                                                        onChange={e => handleUpdateField(item.id, 'result', e.target.value, test.id)}
                                                        isEditing={isCellActive(item.id, 'result', test.id) && activeCell.isEditing}
                                                        onCommit={handleCommit}
                                                        className="text-gray-800 dark:text-gray-200"
                                                        placeholder="Acceptance criteria"
                                                    />
                                                </td>

                                                {/* Reference IS Code */}
                                                {index === 0 && (
                                                    <td 
                                                        rowSpan={totalRows} 
                                                        onClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'reference', isEditing: false })}
                                                        onDoubleClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'reference', isEditing: true })}
                                                        className={`py-3 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'reference') ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                    >
                                                        <AutoResizingTextarea
                                                            value={item.reference || ''}
                                                            onChange={e => handleUpdateField(item.id, 'reference', e.target.value)}
                                                            isEditing={isCellActive(item.id, 'reference') && activeCell.isEditing}
                                                            onCommit={handleCommit}
                                                            className="font-semibold text-gray-700 dark:text-gray-300"
                                                            placeholder="e.g. IS 8112 / IS 12269"
                                                        />
                                                    </td>
                                                )}

                                                {/* Time and Interval */}
                                                <td 
                                                    onClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'interval', isEditing: false })}
                                                    onDoubleClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'interval', isEditing: true })}
                                                    className={`py-2.5 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'interval', test.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                >
                                                    <AutoResizingTextarea
                                                        value={test.interval || ''}
                                                        onChange={e => handleUpdateField(item.id, 'interval', e.target.value, test.id)}
                                                        isEditing={isCellActive(item.id, 'interval', test.id) && activeCell.isEditing}
                                                        onCommit={handleCommit}
                                                        className="text-gray-600 dark:text-gray-400"
                                                        placeholder="Testing frequency"
                                                    />
                                                </td>

                                                {/* Remarks */}
                                                {index === 0 && (
                                                    <td 
                                                        rowSpan={totalRows} 
                                                        onClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'remarks', isEditing: false })}
                                                        onDoubleClick={() => setActiveCell({ matId: item.id, subId: null, testId: test.id, colKey: 'remarks', isEditing: true })}
                                                        className={`py-3 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'remarks') ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                    >
                                                        <AutoResizingTextarea
                                                            value={item.remarks || ''}
                                                            onChange={e => handleUpdateField(item.id, 'remarks', e.target.value)}
                                                            isEditing={isCellActive(item.id, 'remarks') && activeCell.isEditing}
                                                            onCommit={handleCommit}
                                                            className="text-gray-500 dark:text-gray-400"
                                                            placeholder="General remarks for material..."
                                                        />
                                                    </td>
                                                )}

                                                {/* Actions */}
                                                {canWrite && (
                                                    <td className="py-2.5 px-2 text-center align-top">
                                                        {totalRows > 1 ? (
                                                            <button
                                                                onClick={() => handleDeleteTestRow(item.id, test.id)}
                                                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        ) : index === 0 ? (
                                                            <button
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        ) : null}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    });
                                }

                                // 3. Render Material Group with Sub-divisions (a, b, c)
                                if (item.type === 'material_group') {
                                    const totalSubRows = item.subdivisions.reduce((acc, sub) => acc + (sub.tests.length || 1), 0);

                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr className="bg-gray-100/60 dark:bg-white/[0.02] font-extrabold text-gray-900 dark:text-white">
                                                <td rowSpan={totalSubRows + 1} className="py-3 px-3 text-center font-black align-top border-r border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.01]">
                                                    {item.code}
                                                </td>
                                                <td 
                                                    colSpan={canWrite ? 6 : 5} 
                                                    onClick={() => setActiveCell({ matId: item.id, subId: null, testId: null, colKey: 'material', isEditing: false })}
                                                    onDoubleClick={() => setActiveCell({ matId: item.id, subId: null, testId: null, colKey: 'material', isEditing: true })}
                                                    className={`py-2.5 px-4 font-black uppercase text-gray-900 dark:text-white border-b border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'material') ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <AutoResizingTextarea
                                                            value={item.title}
                                                            onChange={e => handleUpdateField(item.id, 'title', e.target.value)}
                                                            isEditing={isCellActive(item.id, 'material') && activeCell.isEditing}
                                                            onCommit={handleCommit}
                                                            className="font-black text-gray-900 dark:text-white uppercase"
                                                        />
                                                        {canWrite && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleAddSubdivision(item.id); }}
                                                                className="text-[11px] text-purple-600 dark:text-purple-400 font-bold hover:underline flex items-center space-x-1 shrink-0 ml-4"
                                                            >
                                                                <Plus size={13} />
                                                                <span>+ Add Sub-division (a, b...)</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                {canWrite && (
                                                    <td className="py-2 px-2 text-center border-b border-gray-200 dark:border-white/10">
                                                        <button onClick={() => handleDeleteItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>

                                            {/* Sub-divisions Rendering */}
                                            {item.subdivisions.map(sub => {
                                                const subTests = sub.tests && sub.tests.length > 0 ? sub.tests : [{ id: 'empty', name: '', result: '', interval: '' }];
                                                const subRowsCount = subTests.length;

                                                return subTests.map((t, tIndex) => {
                                                    const isDragTarget = dragOverTarget && dragOverTarget.matId === item.id && dragOverTarget.subId === sub.id && dragOverTarget.index === tIndex;

                                                    return (
                                                        <tr 
                                                            key={`${sub.id}_${t.id}_${tIndex}`} 
                                                            onDragOver={e => handleDragOverTest(e, item.id, sub.id, tIndex)}
                                                            onDrop={e => handleDropTest(e, item.id, sub.id, tIndex)}
                                                            className={`hover:bg-gray-50/40 dark:hover:bg-white/[0.01] transition-all group ${isDragTarget ? 'border-t-2 border-purple-500 bg-purple-500/5' : ''}`}
                                                        >
                                                            {/* Sub-item Title */}
                                                            {tIndex === 0 && (
                                                                <td 
                                                                    rowSpan={subRowsCount} 
                                                                    onClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'material', isEditing: false })}
                                                                    onDoubleClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'material', isEditing: true })}
                                                                    className={`py-2.5 px-4 align-top border-r border-gray-200 dark:border-white/10 pl-6 transition-all ${isCellActive(item.id, 'material', t.id, sub.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                                >
                                                                    <div className="flex items-start space-x-1.5">
                                                                        <span className="font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">{sub.code}.</span>
                                                                        <AutoResizingTextarea
                                                                            value={sub.title}
                                                                            onChange={e => handleUpdateField(item.id, 'title', e.target.value, null, sub.id)}
                                                                            isEditing={isCellActive(item.id, 'material', t.id, sub.id) && activeCell.isEditing}
                                                                            onCommit={handleCommit}
                                                                            className="font-bold text-gray-800 dark:text-gray-200 text-xs"
                                                                        />
                                                                    </div>
                                                                    {canWrite && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleAddTestRow(item.id, sub.id); }}
                                                                            className="mt-1 ml-4 text-[10px] text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center space-x-1"
                                                                        >
                                                                            <Plus size={11} />
                                                                            <span>Add Sub-test Row</span>
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            )}

                                                            {/* Test Name */}
                                                            <td 
                                                                onClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'test', isEditing: false })}
                                                                onDoubleClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'test', isEditing: true })}
                                                                className={`py-2 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'test', t.id, sub.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                            >
                                                                <div className="flex items-start space-x-1.5">
                                                                    {canWrite && (
                                                                        <div 
                                                                            draggable={true}
                                                                            onDragStart={e => handleDragStartTest(e, item.id, sub.id, t.id, tIndex)}
                                                                            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-purple-500 p-0.5 mt-0.5"
                                                                        >
                                                                            <GripVertical size={13} />
                                                                        </div>
                                                                    )}
                                                                    <AutoResizingTextarea
                                                                        value={t.name}
                                                                        onChange={e => handleUpdateField(item.id, 'name', e.target.value, t.id, sub.id)}
                                                                        isEditing={isCellActive(item.id, 'test', t.id, sub.id) && activeCell.isEditing}
                                                                        onCommit={handleCommit}
                                                                        className="text-gray-800 dark:text-gray-200"
                                                                    />
                                                                </div>
                                                            </td>

                                                            {/* Acceptable Test Result */}
                                                            <td 
                                                                onClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'result', isEditing: false })}
                                                                onDoubleClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'result', isEditing: true })}
                                                                className={`py-2 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'result', t.id, sub.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                            >
                                                                <AutoResizingTextarea
                                                                    value={t.result}
                                                                    onChange={e => handleUpdateField(item.id, 'result', e.target.value, t.id, sub.id)}
                                                                    isEditing={isCellActive(item.id, 'result', t.id, sub.id) && activeCell.isEditing}
                                                                    onCommit={handleCommit}
                                                                    className="text-gray-800 dark:text-gray-200"
                                                                />
                                                            </td>

                                                            {/* Reference */}
                                                            {tIndex === 0 && (
                                                                <td 
                                                                    rowSpan={subRowsCount} 
                                                                    onClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'reference', isEditing: false })}
                                                                    onDoubleClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'reference', isEditing: true })}
                                                                    className={`py-2.5 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'reference', t.id, sub.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                                >
                                                                    <AutoResizingTextarea
                                                                        value={sub.reference || ''}
                                                                        onChange={e => handleUpdateField(item.id, 'reference', e.target.value, null, sub.id)}
                                                                        isEditing={isCellActive(item.id, 'reference', t.id, sub.id) && activeCell.isEditing}
                                                                        onCommit={handleCommit}
                                                                        className="font-semibold text-gray-700 dark:text-gray-300"
                                                                    />
                                                                </td>
                                                            )}

                                                            {/* Time and Interval */}
                                                            <td 
                                                                onClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'interval', isEditing: false })}
                                                                onDoubleClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'interval', isEditing: true })}
                                                                className={`py-2 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'interval', t.id, sub.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                            >
                                                                <AutoResizingTextarea
                                                                    value={t.interval || ''}
                                                                    onChange={e => handleUpdateField(item.id, 'interval', e.target.value, t.id, sub.id)}
                                                                    isEditing={isCellActive(item.id, 'interval', t.id, sub.id) && activeCell.isEditing}
                                                                    onCommit={handleCommit}
                                                                    className="text-gray-600 dark:text-gray-400"
                                                                />
                                                            </td>

                                                            {/* Remarks */}
                                                            {tIndex === 0 && (
                                                                <td 
                                                                    rowSpan={subRowsCount} 
                                                                    onClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'remarks', isEditing: false })}
                                                                    onDoubleClick={() => setActiveCell({ matId: item.id, subId: sub.id, testId: t.id, colKey: 'remarks', isEditing: true })}
                                                                    className={`py-2.5 px-4 align-top border-r border-gray-200 dark:border-white/10 transition-all ${isCellActive(item.id, 'remarks', t.id, sub.id) ? 'ring-2 ring-blue-500 bg-blue-500/5 z-10' : ''}`}
                                                                >
                                                                    <AutoResizingTextarea
                                                                        value={sub.remarks || ''}
                                                                        onChange={e => handleUpdateField(item.id, 'remarks', e.target.value, null, sub.id)}
                                                                        isEditing={isCellActive(item.id, 'remarks', t.id, sub.id) && activeCell.isEditing}
                                                                        onCommit={handleCommit}
                                                                        className="text-gray-500 dark:text-gray-400"
                                                                    />
                                                                </td>
                                                            )}

                                                            {/* Actions */}
                                                            {canWrite && (
                                                                <td className="py-2 px-2 text-center align-top">
                                                                    <button
                                                                        onClick={() => handleDeleteTestRow(item.id, t.id, sub.id)}
                                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    );
                                                });
                                            })}
                                        </React.Fragment>
                                    );
                                }

                                return null;
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default QualityMatrix;
