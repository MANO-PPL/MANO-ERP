import React from 'react';
import { Copy, Check, Play, Sparkles, ExternalLink, Calculator, HardHat, FileSpreadsheet } from 'lucide-react';
import { customToast } from '../../../utils/toast';

const CATEGORY_COLORS = {
    math: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    stats: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
    logical: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    text: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
    datetime: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
    lookup: 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/60',
    financial: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800/60',
    engineering: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60',
    construction: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/60'
};

export const ExcelFormulaCard = ({
    formula,
    isSelected = false,
    onSelect,
    onUseExample
}) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = (e) => {
        e.stopPropagation();
        if (formula?.example) {
            navigator.clipboard.writeText(formula.example);
            setCopied(true);
            customToast.success(`Copied ${formula.name} formula to clipboard`, 'Formula Copied');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const colorClass = CATEGORY_COLORS[formula.category] || 'bg-gray-50 text-gray-700 border-gray-200';

    return (
        <div
            onClick={() => onSelect && onSelect(formula)}
            className={`p-3 rounded-lg border transition-all duration-150 cursor-pointer flex flex-col justify-between group ${
                isSelected
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 dark:border-blue-500/80 shadow-xs ring-1 ring-blue-500/30'
                    : 'border-gray-200 dark:border-white/10 bg-white dark:bg-[#161b22] hover:border-blue-400 dark:hover:border-blue-500/50 hover:shadow-xs'
            }`}
        >
            <div>
                {/* Header: Name + Badge */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                            {formula.name}
                        </span>
                        {formula.category === 'construction' && (
                            <HardHat size={12} className="text-orange-500 shrink-0" title="Civil / Construction Preset" />
                        )}
                    </div>

                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${colorClass} shrink-0`}>
                        {formula.category}
                    </span>
                </div>

                {/* Syntax Pill */}
                <div className="mb-2">
                    <code className="font-mono text-[10px] text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-[#0d1117] px-1.5 py-0.5 rounded-sm block truncate border border-gray-200 dark:border-white/5">
                        {formula.syntax}
                    </code>
                </div>

                {/* Description */}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-2.5">
                    {formula.description}
                </p>
            </div>

            {/* Footer / Quick Actions */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between text-[11px]">
                <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer"
                    title="Copy sample formula"
                >
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                </button>

                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span className="text-[11px]">Builder</span>
                    <Play size={11} className="fill-current" />
                </div>
            </div>
        </div>
    );
};

export default ExcelFormulaCard;
