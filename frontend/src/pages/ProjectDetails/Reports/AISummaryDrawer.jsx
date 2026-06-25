import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, AlertCircle, RefreshCw, CheckCircle, Briefcase, Cloud, Users, Activity, Eye } from 'lucide-react';
import api from '../../../services/api';

const POINT_ICONS = [Briefcase, Cloud, Users, Activity, Eye];
const POINT_COLORS = [
    { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', ring: 'ring-blue-500/20' },
    { text: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', ring: 'ring-yellow-500/20' },
    { text: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', ring: 'ring-cyan-500/20' },
    { text: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', ring: 'ring-green-500/20' },
    { text: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', ring: 'ring-purple-500/20' },
];

const AISummaryDrawer = ({ isOpen, onClose, reportData, reportType }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [summaryData, setSummaryData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && reportData) {
            generateSummary();
        }
        // Reset state when drawer closes
        if (!isOpen) {
            setSummaryData(null);
            setError(null);
        }
    }, [isOpen, reportData]);

    const generateSummary = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Enrich report with project context so the LLM can summarize it
            const reportDate = new Date(reportData.date || new Date());
            const projectStartDate = new Date('2026-02-01');
            const projectEndDate = new Date('2027-01-31');
            const totalDuration = Math.floor((projectEndDate - projectStartDate) / (1000 * 60 * 60 * 24)) + 1;
            const daysElapsed = Math.max(0, Math.floor((reportDate - projectStartDate) / (1000 * 60 * 60 * 24)));
            const daysRemaining = Math.max(0, totalDuration - daysElapsed);

            const enrichedData = {
                ...reportData,
                projectName: 'New Airport Terminal - Phase 1',
                employer: 'Airports Authority of India',
                contractNo: 'AAI/ENGG/2026/089',
                location: 'Chennai, Tamil Nadu',
                startDate: '2026-02-01',
                endDate: '2027-01-31',
                description: 'Construction of the new International terminal with glass facade and steel roof structure.',
                metrics: {
                    totalDays: totalDuration,
                    daysElapsed,
                    daysRemaining,
                },
            };

            const response = await api.post('/ai/analyze-report', { reportData: enrichedData });
            setSummaryData(response.data.data);
        } catch (err) {
            console.error('AI Summary Error:', err);
            setError(err.response?.data?.message || 'Failed to generate AI analysis. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen || !reportData) return null;

    const title = `${reportType} AI Analysis`;
    const confidenceScore = summaryData?.confidenceScore || 0;

    return (
        <div className="fixed inset-0 z-[3000] flex justify-end overflow-hidden anim-fade-in group/ai-drawer">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            ></div>
            <div className="relative w-full max-w-[50%] bg-white dark:bg-[#0d1117] shadow-2xl anim-slide-left flex flex-col h-full border-l border-gray-200 dark:border-white/5">

                {/* Drawer Header */}
                <div className="p-10 bg-gradient-to-br from-indigo-600/10 to-transparent dark:from-indigo-900/20 border-b border-gray-100 dark:border-white/5 relative overflow-hidden text-left">
                    <button
                        onClick={onClose}
                        className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all hover:rotate-90"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex items-center space-x-3 mb-4">
                        <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20 text-white flex items-center justify-center">
                            <Sparkles size={24} />
                        </div>
                        <span className="text-[10px] font-bold text-indigo-500 tracking-[0.2em] uppercase">AI Summarization</span>
                    </div>

                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h2>
                    <p className="text-gray-500 text-sm mt-2">Executive automated synthesis & insights</p>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-6 text-left">

                    {/* Loading State */}
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-6">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                    <Loader2 size={28} className="text-indigo-500 animate-spin" />
                                </div>
                                <div className="absolute inset-0 rounded-2xl bg-indigo-500/5 animate-ping"></div>
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-sm font-bold text-gray-900 dark:text-white">Analyzing Report Data</p>
                                <p className="text-xs text-gray-500">AI is processing the daily progress report...</p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && !isLoading && (
                        <div className="flex flex-col items-center justify-center py-16 space-y-6">
                            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                <AlertCircle size={28} className="text-red-500" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-sm font-bold text-red-500">Analysis Failed</p>
                                <p className="text-xs text-gray-500 max-w-xs">{error}</p>
                            </div>
                            <button
                                onClick={generateSummary}
                                className="flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
                            >
                                <RefreshCw size={14} />
                                <span>Retry Analysis</span>
                            </button>
                        </div>
                    )}

                    {/* Success State — Individual Tiles */}
                    {summaryData && !isLoading && !error && (
                        <>
                            {/* Executive Summary — No Title, No Tile */}
                            {summaryData.executiveSummary && (
                                <div className="mb-8">
                                    <p className="text-lg font-medium text-gray-800 dark:text-gray-200 leading-relaxed italic border-l-4 border-indigo-500 pl-6">
                                        {summaryData.executiveSummary}
                                    </p>
                                </div>
                            )}

                            {summaryData.points?.map((point, index) => {
                                const Icon = POINT_ICONS[index] || Sparkles;
                                const color = POINT_COLORS[index] || POINT_COLORS[0];
                                return (
                                    <div
                                        key={index}
                                        className={`p-5 rounded-2xl ${color.bg} border ${color.border} transition-all hover:scale-[1.01]`}
                                    >
                                        <div className="flex items-center space-x-3 mb-3">
                                            <div className={`p-2 rounded-xl ${color.bg} ${color.text}`}>
                                                <Icon size={16} />
                                            </div>
                                            <h4 className="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                                Point {index + 1}: {point.title}
                                            </h4>
                                        </div>
                                        <div className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed space-y-2 pl-14">
                                            {point.content.split('\n').map((line, i) => {
                                                const colonIdx = line.indexOf(':');
                                                if (colonIdx > 0) {
                                                    return (
                                                        <p key={i}>
                                                            <span className="font-bold text-gray-950 dark:text-gray-50">{line.slice(0, colonIdx + 1)}</span>
                                                            {line.slice(colonIdx + 1)}
                                                        </p>
                                                    );
                                                }
                                                return <p key={i}>{line}</p>;
                                            })}
                                        </div>
                                    </div>
                                );
                            })}



                            {/* Regenerate Button */}
                            <div className="flex justify-center pt-2">
                                <button
                                    onClick={generateSummary}
                                    className="flex items-center space-x-2 text-xs font-medium text-gray-400 hover:text-indigo-500 transition-colors"
                                >
                                    <RefreshCw size={12} />
                                    <span>Regenerate Summary</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Drawer Footer */}
                <div className="p-6 bg-gray-50 dark:bg-[#0a0d11] border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                    <p className="text-[10px] text-gray-400 tracking-widest uppercase">Powered by Groq · Llama 3.3 70B</p>
                    {summaryData && (
                        <div className="flex items-center space-x-1.5 text-[10px] text-green-500 font-medium">
                            <CheckCircle size={12} />
                            <span>Analysis Complete</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AISummaryDrawer;
