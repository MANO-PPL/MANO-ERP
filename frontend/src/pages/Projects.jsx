import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Plus, List, Zap, MoreHorizontal, ArrowUpDown, ChevronDown, ChevronRight, Box, GripVertical, Pencil, Trash2, Info, X, Search, MapPin, Building2, Users, Calendar, Layers, AlertCircle } from 'lucide-react';
import NewProjectSlideOut from '../components/NewProjectSlideOut';
import { projectApi } from '../services/projectApi';
import { useAuth } from '../context/AuthContext';
import { customToast } from '../utils/toast';
import { formatOrdinalDate } from '../utils/dateUtils';

// ─── Helper to strip emojis ──────────────────────────────────────────────────
const stripEmojis = (str) => {
    if (!str) return '';
    return String(str).replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|📍|🏢/gu, '').trim();
};

// ─── Project Filter Modal ────────────────────────────────────────────────────
const ProjectFilterModal = ({ open, onClose, activeFilters, setActiveFilters, allOwners }) => {
    if (!open) return null;

    const toggleFilter = (type, value) => {
        setActiveFilters(prev => {
            const list = prev[type] || [];
            const updated = list.includes(value) ? list.filter(v => v !== value) : [...list, value];
            return { ...prev, [type]: updated };
        });
    };

    const clearAll = () => {
        setActiveFilters({ status: [], owners: [], issues: [] });
    };

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 p-6 z-10 text-left">
                <div className="flex justify-between items-center pb-4 border-b border-gray-100 dark:border-white/10">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Filter Projects</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                        <X size={18} />
                    </button>
                </div>

                <div className="py-4 space-y-4">
                    {/* Status */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {['Active', 'Planning', 'Completed', 'On Hold'].map(st => {
                                const isSel = activeFilters.status.includes(st);
                                return (
                                    <button
                                        key={st}
                                        onClick={() => toggleFilter('status', st)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        {st}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Owner */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Employer / Owner</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                            {allOwners.map(owner => {
                                const cleanO = stripEmojis(owner);
                                const isSel = activeFilters.owners.includes(owner);
                                return (
                                    <button
                                        key={owner}
                                        onClick={() => toggleFilter('owners', owner)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        {cleanO}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Issues */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Issues Status</p>
                        <div className="flex flex-wrap gap-2">
                            {['None', 'Risk', 'Blocked', 'Resolved'].map(issue => {
                                const isSel = activeFilters.issues.includes(issue);
                                return (
                                    <button
                                        key={issue}
                                        onClick={() => toggleFilter('issues', issue)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        {issue}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-white/10">
                    <button onClick={clearAll} className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                        Reset All
                    </button>
                    <button onClick={onClose} className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md">
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── S3 Image Cache & Signing Helpers ─────────────────────────────────────────
const s3SignedUrlCache = new Map();
const bannerCache = new Map();

const getS3SignedUrl = (url, projectId = null) => {
    if (!url) return '';
    if (projectId && bannerCache.has(projectId)) {
        return bannerCache.get(projectId);
    }
    if (s3SignedUrlCache.has(url)) {
        return s3SignedUrlCache.get(url);
    }
    let finalUrl = url;
    if (url.startsWith('/uploads') || url.startsWith('uploads')) {
        const origin = window.location.origin;
        finalUrl = `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    s3SignedUrlCache.set(url, finalUrl);
    if (projectId) {
        bannerCache.set(projectId, finalUrl);
    }
    return finalUrl;
};

// ─── Project Overview Drawer ──────────────────────────────────────────────────
const ProjectOverviewDrawer = ({ open, onClose, project, navigate, canWrite, onEdit, getIssueStyles }) => {
    const [liveDetails, setLiveDetails] = useState(null);
    const [projectMembers, setProjectMembers] = useState([]);
    const [memberCount, setMemberCount] = useState(project?.memberCount || 0);
    const [isBannerLoading, setIsBannerLoading] = useState(true);
    const [bannerError, setBannerError] = useState(false);

    const projectId = project?.dbId;

    useEffect(() => {
        setLiveDetails(null);
        setProjectMembers([]);
        setMemberCount(project?.memberCount || 0);
        setBannerError(false);
        setIsBannerLoading(true);

        if (!open || !projectId) return;
        let isMounted = true;

        const fetchLiveProject = async () => {
            try {
                const [projRes, membersRes] = await Promise.all([
                    projectApi.getProject(projectId).catch(() => null),
                    projectApi.getProjectMembers(projectId).catch(() => null)
                ]);

                if (!isMounted) return;

                if (projRes && projRes.success && projRes.project) {
                    const p = projRes.project;
                    let meta = {};
                    if (p.metadata) {
                        try {
                            meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
                        } catch (e) {
                            console.error("Failed to parse metadata", e);
                        }
                    }
                    const phasesList = meta.phases || [];
                    const totalPhases = phasesList.length;
                    const completedPhases = phasesList.filter(ph => ph.progress === 100).length;
                    const freshLogoUrl = p.logo_url || meta.logo_url || project.logoUrl || '';

                    if (freshLogoUrl) {
                        const signed = getS3SignedUrl(freshLogoUrl, projectId);
                        bannerCache.set(projectId, signed);
                    }

                    setLiveDetails({
                        name: p.name,
                        code: p.project_code || p.id?.toString(),
                        status: p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : project.status,
                        location: stripEmojis(p.location || project.location),
                        description: meta.description || p.description || project.metadata?.description || '',
                        employer: stripEmojis(meta.employer || project.employer || 'System'),
                        client: stripEmojis(meta.client || project.client || ''),
                        owner: stripEmojis(meta.employer || meta.client || project.owner || 'System'),
                        completion: meta.completion !== undefined ? meta.completion : (project.completion || 0),
                        startDate: p.start_date ? formatOrdinalDate(p.start_date) : project.startDate,
                        endDate: p.end_date ? formatOrdinalDate(p.end_date) : project.endDate,
                        totalPhases: totalPhases || project.totalPhases,
                        completedPhases: completedPhases || project.completedPhases,
                        issues: meta.issues || project.issues || 'None',
                        tags: meta.tags || project.tags || [],
                        logoUrl: freshLogoUrl
                    });
                }

                if (membersRes && membersRes.success && membersRes.members) {
                    setProjectMembers(membersRes.members);
                    setMemberCount(membersRes.members.length);
                }
            } catch (err) {
                console.error("Failed to fetch live project details:", err);
            }
        };

        fetchLiveProject();
        return () => { isMounted = false; };
    }, [open, projectId]);

    if (!open || !project) return null;

    const display = liveDetails || {
        name: project.name,
        code: project.id,
        status: project.status,
        location: stripEmojis(project.location),
        description: project.metadata?.description || '',
        employer: stripEmojis(project.metadata?.employer || project.owner || 'System'),
        client: stripEmojis(project.metadata?.client || ''),
        owner: stripEmojis(project.owner),
        completion: project.completion || 0,
        startDate: project.startDate,
        endDate: project.endDate,
        totalPhases: project.totalPhases,
        completedPhases: project.completedPhases,
        issues: project.issues || 'None',
        tags: project.tags || [],
        logoUrl: project.logoUrl || ''
    };

    const cleanOwner = stripEmojis(display.owner) || 'System';
    const cleanLocation = stripEmojis(display.location);
    const rawLogoUrl = display.logoUrl || project.logoUrl || '';
    const bannerSrc = rawLogoUrl ? (bannerCache.get(projectId) || getS3SignedUrl(rawLogoUrl, projectId)) : '';

    return (
        <div className="fixed inset-0 z-[5000] flex justify-end text-left anim-fade-in font-sans">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Slideout Panel */}
            <div className="relative w-full max-w-lg bg-white dark:bg-[#0d1117] shadow-2xl border-l border-gray-200 dark:border-white/10 overflow-hidden flex flex-col h-full anim-slide-left z-10">
                {/* Project Banner Image / Rendering Skeleton */}
                {bannerSrc && !bannerError ? (
                    <div className="w-full h-44 bg-gray-100 dark:bg-white/5 relative overflow-hidden border-b border-gray-100 dark:border-white/10 shrink-0">
                        {/* Skeleton loader while banner image is loading */}
                        {isBannerLoading && (
                            <div className="absolute inset-0 z-10 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse flex flex-col items-center justify-center gap-2">
                                <div className="w-7 h-7 rounded-full border-2 border-blue-500/40 border-t-blue-500 animate-spin" />
                                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
                                    Rendering Banner...
                                </span>
                            </div>
                        )}

                        <img
                            key={bannerSrc}
                            src={bannerSrc}
                            alt={display.name}
                            className={`w-full h-full object-cover transition-opacity duration-300 ${isBannerLoading ? 'opacity-0' : 'opacity-100'}`}
                            onLoad={() => setIsBannerLoading(false)}
                            onError={() => {
                                setIsBannerLoading(false);
                                setBannerError(true);
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                        <div className="absolute bottom-3 left-6 right-6 flex items-center justify-between z-20">
                            <span className="px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-blue-600/90 text-white backdrop-blur-xs shadow-md">
                                {display.code}
                            </span>
                            <span className={`px-2.5 py-1 rounded text-[10px] font-bold shadow-md ${project.statusColor || 'bg-blue-600 text-white'}`}>
                                {display.status}
                            </span>
                        </div>
                    </div>
                ) : null}

                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex justify-between items-start bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="space-y-1 min-w-0 flex-1 pr-3">
                        {(!bannerSrc || bannerError) && (
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                    {display.code}
                                </span>
                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${project.statusColor || 'bg-blue-600 text-white'}`}>
                                    {display.status}
                                </span>
                            </div>
                        )}
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight break-words">{display.name}</h2>
                        {cleanLocation && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5 pt-0.5 break-words">
                                <MapPin size={13} className="text-blue-500 shrink-0 mt-0.5" />
                                <span className="break-words">{cleanLocation}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {canWrite && onEdit && (
                            <button
                                onClick={() => { onClose(); onEdit(project); }}
                                className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors cursor-pointer"
                                title="Edit Project Details"
                            >
                                <Pencil size={16} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors shrink-0 cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-gray-700 dark:text-gray-300 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {/* Overall Progress */}
                    <div className="p-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/20 rounded-2xl">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-[10px]">Project Completion</span>
                            <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">{display.completion}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${display.completion}%` }} />
                        </div>
                    </div>

                    {/* Description (if present) */}
                    {display.description && (
                        <div className="p-4 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-2xl">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Description</p>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{display.description}</p>
                        </div>
                    )}

                    {/* Key Details Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Employer / Owner</p>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex justify-center items-center text-[10px] font-bold text-white shrink-0 shadow-xs">
                                    {cleanOwner.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-semibold text-gray-900 dark:text-white break-words text-xs">{cleanOwner}</span>
                            </div>
                        </div>

                        {display.client ? (
                            <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Client</p>
                                <p className="font-semibold text-gray-900 dark:text-white break-words text-xs">{display.client}</p>
                            </div>
                        ) : null}

                        {/* TEAM SIZE & MEMBER AVATARS */}
                        <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl flex flex-col justify-between">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team Size</p>
                                <span className="font-bold text-gray-900 dark:text-white text-xs">{memberCount} Members</span>
                            </div>
                            <div className="flex items-center pt-1">
                                {projectMembers && projectMembers.length > 0 ? (
                                    <div className="flex items-center -space-x-2 overflow-hidden py-0.5">
                                        {projectMembers.slice(0, 5).map((m, idx) => {
                                            const avatarSrc = m.profile_image_url ? getS3SignedUrl(m.profile_image_url) : null;
                                            const initial = (m.user_name || 'U').charAt(0).toUpperCase();
                                            const bgColors = [
                                                'from-blue-500 to-indigo-600',
                                                'from-emerald-500 to-teal-600',
                                                'from-purple-500 to-pink-600',
                                                'from-amber-500 to-orange-600',
                                                'from-cyan-500 to-blue-600'
                                            ];
                                            const grad = bgColors[idx % bgColors.length];

                                            return (
                                                <div
                                                    key={m.user_id || idx}
                                                    className="relative group/avatar cursor-pointer"
                                                    title={`${m.user_name || 'User'} (${m.user_type || 'Member'})`}
                                                >
                                                    {avatarSrc ? (
                                                        <img
                                                            src={avatarSrc}
                                                            alt={m.user_name || 'Member'}
                                                            className="w-7 h-7 rounded-full border-2 border-white dark:border-[#0d1117] object-cover shadow-xs"
                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad} border-2 border-white dark:border-[#0d1117] flex items-center justify-center text-[10px] font-bold text-white shadow-xs`}>
                                                            {initial}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {projectMembers.length > 5 && (
                                            <div
                                                className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 border-2 border-white dark:border-[#0d1117] flex items-center justify-center text-[10px] font-extrabold text-gray-700 dark:text-gray-200 shadow-xs"
                                                title={`${projectMembers.length - 5} more members`}
                                            >
                                                +{projectMembers.length - 5}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-[11px] font-semibold text-gray-400">
                                        {memberCount > 0 ? `${memberCount} Assigned` : 'No Members'}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Start Date</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{display.startDate}</p>
                        </div>

                        <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">End Date</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{display.endDate}</p>
                        </div>

                        <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phases Status</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{display.completedPhases} / {display.totalPhases} Completed</p>
                        </div>

                        <div className="p-3.5 bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Issues Status</p>
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${getIssueStyles(display.issues)}`}>
                                {display.issues}
                            </span>
                        </div>
                    </div>

                    {/* Tags */}
                    {display.tags && display.tags.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tags</p>
                            <div className="flex flex-wrap gap-1.5">
                                {display.tags.map((tag, tIdx) => (
                                    <span key={tIdx} className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
                                        {stripEmojis(tag)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Action Buttons */}
                <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 flex justify-between items-center gap-3 bg-gray-50/50 dark:bg-white/[0.02]">
                    {canWrite && onEdit && (
                        <button
                            onClick={() => { onClose(); onEdit(project); }}
                            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-xs cursor-pointer"
                        >
                            <Pencil size={14} /> Edit Details
                        </button>
                    )}

                    <button
                        onClick={() => { onClose(); navigate(`/projects/${project.dbId}`); }}
                        className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all text-xs cursor-pointer"
                    >
                        <span>Access Project Directory</span>
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const Projects = () => {
    const navigate = useNavigate();
    const { hasPermission } = useAuth();
    const canWrite = hasPermission('projects', 2);
    const [activeTab, setActiveTab] = useState('Active Projects');
    const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
    const [projectToEdit, setProjectToEdit] = useState(null);

    const [projectData, setProjectData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [overviewProject, setOverviewProject] = useState(null);

    // Filter & Search States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilters, setActiveFilters] = useState({ status: [], owners: [], issues: [] });
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isManageDropdownOpen, setIsManageDropdownOpen] = useState(false);
    const [hoveredRow, setHoveredRow] = useState(null);
    const dropdownRef = useRef(null);

    // Tag edit states
    const [activeTagInputProjectId, setActiveTagInputProjectId] = useState(null);
    const [newTagVal, setNewTagVal] = useState('');

    // Action menu states
    const [activeActionsMenuId, setActiveActionsMenuId] = useState(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsManageDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchProjects = async (force = false) => {
        const cacheKey = 'crm_projects_list';
        const cacheTimeKey = 'crm_projects_list_time';
        const CACHE_TTL = 50000; // 50 seconds

        if (force) {
            sessionStorage.removeItem(cacheKey);
            sessionStorage.removeItem(cacheTimeKey);
        }

        const cached = sessionStorage.getItem(cacheKey);
        const cachedTime = sessionStorage.getItem(cacheTimeKey);
        const now = Date.now();

        if (cached && cachedTime) {
            try {
                const parsed = JSON.parse(cached);
                setProjectData(parsed);
                setIsLoading(false);
                if (now - parseInt(cachedTime) < CACHE_TTL) {
                    return;
                }
            } catch (e) {
                console.error("Failed to parse cached projects", e);
            }
        } else {
            setIsLoading(true);
        }

        try {
            const res = await projectApi.listProjects();
            if (res.success) {
                const mappedProjects = res.projects.map(p => {
                    let meta = {};
                    if (p.metadata) {
                        try {
                            meta = typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata;
                        } catch (e) {
                            console.error("Failed to parse metadata", p.metadata, e);
                        }
                    }

                    const phasesList = meta.phases || [];
                    const totalPhases = phasesList.length;
                    const completedPhases = phasesList.filter(ph => ph.progress === 100).length;

                    return {
                        id: p.project_code || p.id.toString(),
                        dbId: p.id,
                        name: p.name,
                        location: p.location || '',
                        completion: meta.completion !== undefined ? meta.completion : 0,
                        owner: meta.employer || 'System',
                        status: p.status.charAt(0).toUpperCase() + p.status.slice(1),
                        statusColor: p.status.toLowerCase() === 'active' ? 'bg-[#2E7D32] text-white' : 'bg-blue-600 text-white',
                        memberCount: p.member_count || 0,
                        totalPhases,
                        completedPhases,
                        issues: meta.issues || 'None',
                        startDate: p.start_date ? formatOrdinalDate(p.start_date) : 'N/A',
                        endDate: p.end_date ? formatOrdinalDate(p.end_date) : 'N/A',
                        startDateRaw: p.start_date ? p.start_date.split('T')[0] : '',
                        endDateRaw: p.end_date ? p.end_date.split('T')[0] : '',
                        daysAlert: '',
                        tags: meta.tags || [],
                        metadata: meta
                    };
                });
                setProjectData(mappedProjects);
                sessionStorage.setItem(cacheKey, JSON.stringify(mappedProjects));
                sessionStorage.setItem(cacheTimeKey, now.toString());
            }
        } catch (error) {
            console.error("Failed to fetch projects", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    useEffect(() => {
        const handleClickOutside = () => {
            setActiveActionsMenuId(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleUpdateIssue = async (project, newIssueStatus) => {
        try {
            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: project.status.toLowerCase(),
                project_code: project.id,
                start_date: project.startDateRaw || null,
                end_date: project.endDateRaw || null,
                metadata: {
                    ...project.metadata,
                    issues: newIssueStatus
                }
            };

            const res = await projectApi.updateProject(project.dbId, updatedPayload);
            if (res.success) {
                customToast.success(`Updated issue status to ${newIssueStatus}`, 'Issue Updated');
                fetchProjects(true);
            }
        } catch (error) {
            console.error("Failed to update issue status", error);
            customToast.error("Failed to update issue status", "Update Failed");
        }
    };

    const handleAddTag = async (project) => {
        if (!newTagVal.trim()) return;
        const newTag = newTagVal.trim();
        const currentTags = project.tags || [];
        if (currentTags.includes(newTag)) {
            setActiveTagInputProjectId(null);
            return;
        }
        const updatedTags = [...currentTags, newTag];
        setActiveTagInputProjectId(null);

        try {
            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: project.status.toLowerCase(),
                project_code: project.id,
                start_date: project.startDateRaw || null,
                end_date: project.endDateRaw || null,
                metadata: {
                    ...project.metadata,
                    tags: updatedTags
                }
            };

            const res = await projectApi.updateProject(project.dbId, updatedPayload);
            if (res.success) {
                customToast.success(`Added tag "${newTag}"`, 'Tag Added');
                fetchProjects(true);
            }
        } catch (error) {
            console.error("Failed to add tag", error);
            customToast.error("Failed to add tag", "Error");
        }
    };

    const handleDeleteTag = async (project, tagToDelete) => {
        const currentTags = project.tags || [];
        const updatedTags = currentTags.filter(t => t !== tagToDelete);

        try {
            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: project.status.toLowerCase(),
                project_code: project.id,
                start_date: project.startDateRaw || null,
                end_date: project.endDateRaw || null,
                metadata: {
                    ...project.metadata,
                    tags: updatedTags
                }
            };

            const res = await projectApi.updateProject(project.dbId, updatedPayload);
            if (res.success) {
                customToast.info(`Removed tag "${tagToDelete}"`, 'Tag Removed');
                fetchProjects(true);
            }
        } catch (error) {
            console.error("Failed to delete tag", error);
            customToast.error("Failed to delete tag", "Error");
        }
    };

    const handleToggleProjectStatus = async (project) => {
        const newStatus = project.status.toLowerCase() === 'active' ? 'completed' : 'active';
        try {
            const updatedPayload = {
                name: project.name,
                location: project.location,
                status: newStatus,
                project_code: project.id,
                start_date: project.startDateRaw || null,
                end_date: project.endDateRaw || null,
                metadata: project.metadata
            };

            const res = await projectApi.updateProject(project.dbId, updatedPayload);
            if (res.success) {
                customToast.success(`Project status changed to ${newStatus.toUpperCase()}`, 'Status Updated');
                fetchProjects(true);
            }
        } catch (error) {
            console.error("Failed to toggle project status", error);
            customToast.error("Failed to toggle project status", "Error");
        }
    };

    const handleNewProjectClick = () => {
        setProjectToEdit(null);
        setIsNewProjectOpen(true);
    };

    const handleEditProjectClick = (project) => {
        setProjectToEdit(project);
        setIsNewProjectOpen(true);
    };

    const getIssueStyles = (status) => {
        switch (status.toLowerCase()) {
            case 'risk':
                return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-500/20';
            case 'blocked':
                return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-500/20';
            case 'resolved':
                return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-500/20';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-white/5';
        }
    };

    const activeProjects = projectData.filter(p => !p.status.toLowerCase().includes('complete'));
    const completedProjects = projectData.filter(p => p.status.toLowerCase().includes('complete'));

    const allOwners = Array.from(new Set(projectData.map(p => p.owner).filter(Boolean)));

    const filteredProjects = projectData.filter(project => {
        if (activeTab === 'Active Projects' && project.status.toLowerCase().includes('complete')) return false;
        if (activeTab === 'Completed Projects' && !project.status.toLowerCase().includes('complete')) return false;

        const matchSearch = !searchTerm ||
            project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            project.owner.toLowerCase().includes(searchTerm.toLowerCase());

        const matchActiveStatus = activeFilters.status.length === 0 || activeFilters.status.includes(project.status);
        const matchActiveOwners = activeFilters.owners.length === 0 || activeFilters.owners.includes(project.owner);
        const matchActiveIssues = activeFilters.issues.length === 0 || activeFilters.issues.includes(project.issues);

        return matchSearch && matchActiveStatus && matchActiveOwners && matchActiveIssues;
    });

    const activeFilterCount = activeFilters.status.length + activeFilters.owners.length + activeFilters.issues.length;

    const tabs = [
        { id: 'Active Projects', label: 'Active Projects', count: activeProjects.length },
        { id: 'Completed Projects', label: 'Completed Projects', count: completedProjects.length }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-44px)] w-full text-gray-900 dark:text-gh-text transition-colors overflow-hidden bg-white dark:bg-[#0d1117] relative font-sans">
            {/* Top Toolbar matching single search bar layout */}
            <div className="px-6 py-3.5 flex flex-col md:flex-row items-center justify-between border-b border-gray-200 dark:border-white/5 bg-white dark:bg-[#0d1117] shrink-0 gap-3">
                {/* Left side: Tabs */}
                <div className="inline-flex p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg shrink-0">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                                }`}
                        >
                            <span>{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full ml-1 ${activeTab === tab.id
                                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                    : 'bg-red-500 text-white'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Right side: Search bar to the left of Filter + Manage Projects */}
                <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                    <div className="relative w-64 md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input
                            type="text"
                            placeholder="Search projects by name, code, owner..."
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-400"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`flex items-center space-x-2 px-6 py-2 border rounded-lg text-sm font-medium transition-all ${activeFilterCount > 0
                                ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                : 'border-blue-500 bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                    >
                        <span>Filter</span>
                        <Filter size={16} fill="currentColor" className={activeFilterCount > 0 ? '' : 'text-white'} />
                        {activeFilterCount > 0 && (
                            <span className="ml-1 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    {canWrite && (
                        <button
                            onClick={handleNewProjectClick}
                            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 whitespace-nowrap"
                        >
                            <Plus size={16} />
                            <span>Add Project</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table Area matching Vendors, Clients, Employees standard */}
            <div className="flex-1 overflow-auto custom-scrollbar p-0">
                <table className="w-full text-left whitespace-nowrap text-[13px] border-collapse bg-white dark:bg-[#0d1117]">
                    <thead className="bg-[#f9fafb] dark:bg-[#161b22] text-gray-500 dark:text-gray-400 sticky top-0 z-10 border-b border-gray-200 dark:border-white/5 tracking-widest text-[10px] uppercase font-bold">
                        <tr>
                            <th className="pl-2 pr-0.5 py-2.5 w-4"></th>
                            <th className="pl-0.5 pr-2 py-2.5 text-center">SR NO</th>
                            <th className="px-4 py-2.5">CODE</th>
                            <th className="px-4 py-2.5">PROJECT NAME</th>
                            <th className="px-4 py-2.5">%</th>
                            <th className="px-4 py-2.5">OWNER</th>
                            <th className="px-4 py-2.5">STATUS</th>
                            <th className="px-4 py-2.5">TEAM SIZE</th>
                            <th className="px-4 py-2.5">PHASES</th>
                            <th className="px-4 py-2.5">ISSUES</th>
                            <th className="px-4 py-2.5">START DATE</th>
                            <th className="px-4 py-2.5">END DATE</th>
                            <th className="px-4 py-2.5">TAGS</th>
                            <th className="px-3 py-2.5 text-center w-10">INFO</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-[#0d1117]">
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 14 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3">
                                            <div className="h-3 bg-gray-200 dark:bg-white/10 rounded"></div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : filteredProjects.length > 0 ? (
                            filteredProjects.map((project, idx) => (
                                <tr
                                    key={project.dbId}
                                    className="hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors group/row text-gray-700 dark:text-gray-300 relative cursor-pointer"
                                    onClick={() => navigate(`/projects/${project.dbId}`)}
                                >
                                    <td className="pl-2 pr-0.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                                        <GripVertical size={14} className="text-transparent group-hover/row:text-gray-400 dark:group-hover/row:text-gray-500 hover:!text-blue-500 transition-colors mx-auto cursor-grab active:cursor-grabbing" />
                                    </td>
                                    <td className="pl-0.5 pr-2 py-1.5 text-center font-mono text-gray-400">{idx + 1}</td>
                                    <td className="px-4 py-1.5 font-mono text-blue-600 dark:text-blue-400 font-semibold hover:underline">{project.id}</td>
                                    <td className="px-4 py-1.5">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors">{project.name}</span>
                                    </td>
                                    <td className="px-4 py-1.5 font-medium text-gray-700 dark:text-gray-300">{project.completion}%</td>
                                    <td className="px-4 py-1.5">
                                        <div className="flex items-center space-x-2">
                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex justify-center items-center text-[10px] font-bold text-white shadow-sm overflow-hidden shrink-0">
                                                <span>{project.owner.charAt(0)}</span>
                                            </div>
                                            <span className="font-medium text-gray-700 dark:text-gray-300">{project.owner}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-1.5">
                                        <span className={`px-2.5 py-1 rounded text-xs font-semibold shadow-sm ${project.statusColor}`}>
                                            {project.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-1.5 font-semibold text-gray-700 dark:text-gray-300">{project.memberCount} Members</td>
                                    <td className="px-4 py-1.5">
                                        {project.totalPhases === 0 ? (
                                            <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 uppercase tracking-wider">
                                                Undefined
                                            </span>
                                        ) : (
                                            <div className="flex items-center space-x-2">
                                                <div className="w-12 bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden flex">
                                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(project.completedPhases / project.totalPhases) * 100}%` }}></div>
                                                </div>
                                                <span className="text-gray-500 dark:text-gray-400 font-medium text-xs">{project.completedPhases} / {project.totalPhases}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-1.5 relative group/issue">
                                        <div className="flex items-center space-x-2">
                                            <span className={`px-2.5 py-1 border rounded text-xs font-semibold ${getIssueStyles(project.issues)}`}>
                                                {project.issues}
                                            </span>
                                            {canWrite && (
                                                <div className="opacity-0 group-hover/issue:opacity-100 flex items-center space-x-1.5 transition-opacity duration-200">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleUpdateIssue(project, 'None'); }}
                                                        className="w-3 h-3 rounded-full bg-gray-400 hover:scale-125 transition-transform"
                                                        title="Mark None"
                                                    />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleUpdateIssue(project, 'Risk'); }}
                                                        className="w-3 h-3 rounded-full bg-amber-500 hover:scale-125 transition-transform"
                                                        title="Mark Risk"
                                                    />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleUpdateIssue(project, 'Blocked'); }}
                                                        className="w-3 h-3 rounded-full bg-red-500 hover:scale-125 transition-transform"
                                                        title="Mark Blocked"
                                                    />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleUpdateIssue(project, 'Resolved'); }}
                                                        className="w-3 h-3 rounded-full bg-green-500 hover:scale-125 transition-transform"
                                                        title="Mark Resolved"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-1.5 text-xs text-gray-600 dark:text-gray-300 font-medium">{project.startDate}</td>
                                    <td className="px-4 py-1.5 text-xs text-gray-600 dark:text-gray-300 font-medium">{project.endDate}</td>
                                    <td className="px-4 py-1.5 relative group/tags">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {project.tags.map((tag, tIdx) => (
                                                <span
                                                    key={tIdx}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20"
                                                >
                                                    {tag}
                                                    {canWrite && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTag(project, tag); }}
                                                            className="text-blue-400 hover:text-red-500 transition-colors ml-0.5 font-bold"
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
                                                </span>
                                            ))}

                                            {activeTagInputProjectId === project.dbId ? (
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    placeholder="Enter Tag"
                                                    value={newTagVal}
                                                    onChange={(e) => setNewTagVal(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleAddTag(project);
                                                        else if (e.key === 'Escape') setActiveTagInputProjectId(null);
                                                    }}
                                                    onBlur={() => setActiveTagInputProjectId(null)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="px-2 py-0.5 text-[10px] border border-blue-400 bg-white dark:bg-[#161b22] rounded focus:outline-none w-20 text-gray-900 dark:text-white"
                                                />
                                            ) : canWrite && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setActiveTagInputProjectId(project.dbId); setNewTagVal(''); }}
                                                    className="opacity-0 group-hover/tags:opacity-100 text-gray-400 hover:text-blue-600 p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded transition-colors"
                                                    title="Add Tag"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => setOverviewProject(project)}
                                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                                            title="View Project Overview"
                                        >
                                            <Info size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="14" className="py-12 text-center text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <Box className="text-gray-400" size={24} />
                                        </div>
                                        <p className="text-sm font-semibold mb-1">No projects found</p>
                                        <p className="text-xs text-gray-400">Try adjusting your filters or search terms</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Overview Sidebar Drawer */}
            <ProjectOverviewDrawer
                key={overviewProject?.dbId || 'none'}
                open={!!overviewProject}
                onClose={() => setOverviewProject(null)}
                project={overviewProject}
                navigate={navigate}
                canWrite={canWrite}
                onEdit={handleEditProjectClick}
                getIssueStyles={getIssueStyles}
            />

            {/* Footer matching Vendors, Clients, Employees standard */}
            <div className="px-6 py-3.5 border-t border-gray-200 dark:border-white/5 flex justify-between items-center text-xs text-gray-400 shrink-0 bg-white dark:bg-[#0d1117]">
                <p>Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredProjects.length}</span> of <span className="font-semibold text-gray-700 dark:text-gray-300">{projectData.length}</span> projects</p>
                <div className="flex gap-2">
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg opacity-40 cursor-not-allowed">Previous</button>
                    <button className="px-3 py-1.5 border border-blue-500/30 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold">1</button>
                    <button className="px-3 py-1.5 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all">Next</button>
                </div>
            </div>

            {/* Filter Modal */}
            <ProjectFilterModal
                open={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                allOwners={allOwners}
            />

            <NewProjectSlideOut
                isOpen={isNewProjectOpen}
                onClose={() => { setIsNewProjectOpen(false); setProjectToEdit(null); }}
                projectToEdit={projectToEdit}
                onProjectCreated={() => {
                    setIsNewProjectOpen(false);
                    setProjectToEdit(null);
                    fetchProjects(true);
                }}
            />
        </div>
    );
};

export default Projects;

