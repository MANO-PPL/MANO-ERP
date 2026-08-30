import React from 'react';
import { X, Sparkles, Calculator, Maximize2, Minimize2 } from 'lucide-react';
import { ExcelFormulaExplorer } from './ExcelFormulaExplorer';

export const ExcelFormulaAssistantModal = ({
    isOpen,
    onClose,
    onInsertFormula = null,
    initialFormulaName = 'SUM'
}) => {
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
            <div
                className={`bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
                    isFullscreen
                        ? 'w-full h-full rounded-none'
                        : 'w-full max-w-5xl h-[88vh] max-h-[900px]'
                }`}
            >
                {/* Modal Titlebar */}
                <div className="px-4 py-2.5 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-white/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center space-x-2">
                        <div className="p-1.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                            <Calculator size={16} />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <span>Formula Assistant & Function Inserter</span>
                                <span className="font-serif italic font-bold text-blue-500 text-[11px]">(fx)</span>
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center space-x-1">
                        <button
                            type="button"
                            onClick={() => setIsFullscreen(prev => !prev)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition cursor-pointer"
                            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition cursor-pointer"
                            title="Close (Esc)"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Explorer Component Body */}
                <div className="flex-1 overflow-hidden">
                    <ExcelFormulaExplorer
                        initialFormulaName={initialFormulaName}
                        onInsertFormula={(formula) => {
                            if (onInsertFormula) {
                                onInsertFormula(formula);
                                onClose();
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ExcelFormulaAssistantModal;
