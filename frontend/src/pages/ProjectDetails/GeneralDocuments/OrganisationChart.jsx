import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Edit2, Trash2, ZoomIn, ZoomOut, Maximize, Save, X, User, Briefcase, Building, Info, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import { generalDocsApi } from '../../../services/generalDocsApi';

// --- Default Hierarchy Data ---
const INITIAL_DATA = {
    id: 'root',
    name: '30 Juin Hotel',
    role: 'PROJECT LOCATION',
    location: 'Congo',
    type: 'project',
    children: [
        {
            id: 'mano-project',
            name: 'Mano Project',
            role: 'PVT. LTD.',
            subRole: 'Mr. Mugilan (Director)',
            type: 'company',
            children: [
                {
                    id: 'glowmex',
                    name: 'GLOWMEX LLP',
                    role: 'Processing',
                    type: 'department',
                    children: [
                        {
                            id: 'jay-vaja',
                            name: 'Mr. Jay Vaja',
                            role: 'Lead',
                            type: 'staff',
                            children: [
                                { id: 'samir', name: 'Mr. Samir Jasani', role: 'Staff', type: 'staff' }
                            ]
                        }
                    ]
                },
                {
                    id: 'elemental',
                    name: 'Elemental Studio',
                    role: 'Architect',
                    type: 'department',
                    children: [
                        {
                            id: 'keyur',
                            name: 'Mr. Keyur Khorasia',
                            role: 'Lead',
                            type: 'staff',
                            children: [
                                { id: 'civil', name: 'Civil Contractor', role: 'Contractor', type: 'staff' }
                            ]
                        }
                    ]
                },
                {
                    id: 'pmc',
                    name: 'PMC Staff',
                    role: 'Management',
                    type: 'department',
                    children: [
                        { id: 'manoj', name: 'Mr. Manoj', role: 'Head', type: 'staff' },
                        { id: 'shaveena', name: 'Shaveena', role: 'Coord', type: 'staff' }
                    ]
                },
                {
                    id: 'enjinia-struct',
                    name: 'Enjinia',
                    role: 'Structural',
                    type: 'department',
                    children: [
                        {
                            id: 'devang',
                            name: 'Mr. Devang Chotalia',
                            role: 'Lead',
                            type: 'staff',
                            children: [
                                { id: 'elec', name: 'Electrical', role: 'Trade', type: 'staff' },
                                { id: 'plum', name: 'Plumbing', role: 'Trade', type: 'staff' }
                            ]
                        }
                    ]
                },
                {
                    id: 'enjinia-mep',
                    name: 'Enjinia',
                    role: 'MEP',
                    type: 'department',
                    children: [
                        {
                            id: 'vaishal',
                            name: 'Mr. Vaishal Shah',
                            role: 'Lead',
                            type: 'staff',
                            children: [
                                { id: 'fire', name: 'Firefighting', role: 'Trade', type: 'staff' }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
};

// --- Sub-component: The Node Card ---
const NodeCard = React.memo(({ node, onSelect, onEdit, onDelete, selectedNodeId, level = 0, isFirst = true, isLast = true, parentHasMany = false, canWrite }) => {
    const isStaff = node.type === 'staff';
    const isDept = node.type === 'department';
    const isCompany = node.type === 'company';
    const isProject = node.type === 'project';
    const isSelected = selectedNodeId === node.id;

    return (
        <div className="relative flex flex-col items-center group flex-shrink-0">
            {/* Connection Line Above (The Stem) */}
            {level > 0 && (
                <div className="relative flex flex-col items-center h-10 w-full flex-shrink-0">
                    {parentHasMany && (
                        <div className={`absolute top-0 h-px bg-gray-600 ${isFirst ? 'left-1/2 w-1/2' : isLast ? 'right-1/2 w-1/2' : 'w-full'}`} />
                    )}
                    <div className="w-px h-full bg-gray-600 relative">
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1">
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                <path d="M1 1L5 5L9 1" stroke="#4b5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>
            )}

            {/* The Visual Block */}
            <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                onClick={(e) => { e.stopPropagation(); onSelect(node); canWrite && onEdit(node); }}
                className={`
                    px-7 py-5 rounded-2xl border transition-all duration-300 relative
                    ${isProject ? 'bg-blue-600 border-blue-400 text-white min-w-[220px]' : ''}
                    ${isCompany ? 'bg-slate-50 dark:bg-[#1e293b] border-blue-500/30 text-slate-800 dark:text-white min-w-[240px]' : ''}
                    ${isDept ? 'bg-emerald-50 dark:bg-[#0f172a] border-emerald-500/30 text-emerald-900 dark:text-emerald-50 min-w-[200px]' : ''}
                    ${isStaff ? 'bg-white dark:bg-[#1a202c] border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 min-w-[180px]' : ''}
                    ${isSelected ? 'ring-2 ring-blue-500/50 ring-offset-2 ring-offset-white dark:ring-offset-[#0d1117] border-blue-400 z-10' : 'hover:border-gray-300 dark:hover:border-white/30'}
                    cursor-pointer select-none
                `}
            >

                <div className="relative flex flex-col items-center text-center space-y-1">
                    <div className="mb-1 text-white/50">
                        {isProject && <Maximize size={16} />}
                        {isCompany && <Building size={16} />}
                        {isDept && <Briefcase size={16} />}
                        {isStaff && <User size={16} />}
                    </div>
                    <h3 className="font-bold text-sm tracking-tight text-inherit">{node.name || 'Untitled'}</h3>
                    <p className="text-[10px] uppercase tracking-widest text-inherit opacity-60 font-semibold">{node.role || 'No Role'}</p>
                    {node.location && <p className="text-[10px] opacity-40 italic">{node.location}</p>}
                    {node.subRole && <p className="text-[10px] opacity-70 border-t border-gray-200 dark:border-white/5 mt-1 pt-1 w-full">{node.subRole}</p>}
                </div>

                {/* Legend Dot */}
                <div className={`absolute top-3 left-3 w-2 h-2 rounded-full border border-white/10
                    ${isProject ? 'bg-blue-400' : ''}
                    ${isCompany ? 'bg-blue-500' : ''}
                    ${isDept ? 'bg-emerald-500' : ''}
                    ${isStaff ? 'bg-gray-500' : ''}
                `} />


                {/* Quick Actions */}
                {canWrite && (
                    <div className="absolute -right-2 -top-2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(node); }} className="p-1.5 bg-blue-600 rounded-full text-white shadow-lg hover:bg-blue-500 scale-75 hover:scale-100 transition-transform">
                            <Edit2 size={12} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="p-1.5 bg-red-600 rounded-full text-white shadow-lg shadow-red-500/20 hover:bg-red-500 scale-75 hover:scale-100 transition-transform">
                            <Trash2 size={12} />
                        </button>
                    </div>
                )}
            </motion.div>

            {/* Child Connector (Stem Out) */}
            {node.children && node.children.length > 0 && (
                <div className="w-px h-10 bg-gray-600 flex-shrink-0" />
            )}

            {/* Children Row */}
            {node.children && node.children.length > 0 && (
                <div className="flex flex-row items-start justify-center">
                    {node.children.map((child, idx) => (
                        <div key={child.id} className="flex flex-col items-center px-6">
                            <NodeCard
                                node={child}
                                onSelect={onSelect}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                selectedNodeId={selectedNodeId}
                                level={level + 1}
                                isFirst={idx === 0}
                                isLast={idx === node.children.length - 1}
                                parentHasMany={node.children.length > 1}
                                canWrite={canWrite}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

// --- Main Container Component ---
const OrganisationChart = ({ onBack, setExtraBreadcrumbs, canWrite }) => {
    const { id: projectId } = useParams();

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: 'Organisation Chart' }
        ]);
    }, [onBack, setExtraBreadcrumbs, projectId]);

    const [data, setData] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [selectedNodeId, setSelectedNodeId] = useState('root');
    const [isEditing, setIsEditing] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [activeNode, setActiveNode] = useState(null); // The node currently being edited in modal
    const [editForm, setEditForm] = useState({ name: '', role: '', type: 'staff' });

    const auditTrail = [
        { id: 1, action: "API Connected Session", user: "Auto Generator", timestamp: new Date().toLocaleString(), type: "update" },
    ];
    const containerRef = useRef(null);

    const mapOrgApiToTree = useCallback((apiData) => {
        const { client_name, project_name, project_location, vendors = [], directory = [] } = apiData;

        // Group directory by vendor tracking ID
        const dirByVendor = {};
        const standaloneDir = [];
        
        directory.forEach(d => {
            if (d.vendor_id) {
                if (!dirByVendor[d.vendor_id]) dirByVendor[d.vendor_id] = [];
                dirByVendor[d.vendor_id].push(d);
            } else {
                standaloneDir.push(d);
            }
        });

        const clientChildren = [];

        vendors.forEach(v => {
            const vendorNode = {
                id: `vendor-${v.pv_id || v.vendor_id}`,
                name: v.company_name || 'Unknown Vendor',
                role: v.job_nature || 'Contractor',
                type: 'company',
                children: []
            };
            
            // Add its directory members underneath
            const associatedDir = dirByVendor[v.pv_id || v.vendor_id] || dirByVendor[v.vendor_id] || [];
            associatedDir.forEach(d => {
                vendorNode.children.push({
                    id: `dir-${d.pd_id}`,
                    name: d.contact_person || 'N/A',
                    role: d.designation || 'Staff',
                    type: 'staff',
                    subRole: d.mobile_no || ''
                });
            });

            clientChildren.push(vendorNode);
        });

        // Standalone directories as their own
        standaloneDir.forEach(d => {
            clientChildren.push({
                id: `dir-solo-${d.pd_id}`,
                name: d.company_name || d.contact_person || 'Unknown',
                role: d.job_nature || d.designation || 'Entity',
                type: 'department',
                children: [
                    {
                        id: `dir-child-${d.pd_id}`,
                        name: d.contact_person || 'N/A',
                        role: d.designation || 'Staff',
                        type: 'staff',
                        subRole: d.mobile_no || ''
                    }
                ]
            });
        });

        const clientNode = {
            id: 'client',
            name: client_name || 'Client',
            role: 'CLIENT',
            type: 'company',
            children: clientChildren
        };

        return {
            id: 'root',
            name: project_name || 'Project Name',
            role: 'PROJECT LOCATION',
            location: project_location || 'Location',
            type: 'project',
            children: [clientNode]
        };
    }, []);

    const fetchOrgChart = useCallback(async () => {
        try {
            const response = await generalDocsApi.getOrgChart(projectId);
            if (response && response.success) {
                const tree = mapOrgApiToTree(response);
                setData(tree);
                setSelectedNodeId('root');
            }
        } catch(err) {
            console.error("Failed to fetch Org Chart API, falling back to dummy", err);
            setData(INITIAL_DATA);
        }
    }, [projectId, mapOrgApiToTree]);

    useEffect(() => {
        fetchOrgChart();
    }, [fetchOrgChart]);

    // Helpers for Tree Mutation
    const findNode = (nodes, id) => {
        if (!nodes) return null;
        if (nodes.id === id) return nodes;
        if (nodes.children) {
            for (let child of nodes.children) {
                const found = findNode(child, id);
                if (found) return found;
            }
        }
        return null;
    };

    const findAndAdd = (nodes, parentId, newNode) => {
        if (!nodes) return newNode;
        if (nodes.id === parentId) {
            return { ...nodes, children: [...(nodes.children || []), newNode] };
        }
        if (nodes.children) {
            return { ...nodes, children: nodes.children.map(child => findAndAdd(child, parentId, newNode)) };
        }
        return nodes;
    };

    const findAndUpdate = (nodes, id, updates) => {
        if (!nodes) return null;
        if (nodes.id === id) {
            return { ...nodes, ...updates };
        }
        if (nodes.children) {
            return { ...nodes, children: nodes.children.map(child => findAndUpdate(child, id, updates)) };
        }
        return nodes;
    };

    const findAndDelete = (nodes, id) => {
        if (!nodes) return null;
        if (nodes.children) {
            const filtered = nodes.children.filter(c => c.id !== id);
            if (filtered.length !== nodes.children.length) {
                return { ...nodes, children: filtered };
            }
            return { ...nodes, children: nodes.children.map(c => findAndDelete(c, id)) };
        }
        return nodes;
    };

    // Tree actions
    const handleSelect = useCallback((node) => {
        setSelectedNodeId(node.id);
    }, []);

    const handleEdit = useCallback((node) => {
        setActiveNode(node);
        setEditForm({ name: node.name || '', role: node.role || '', type: node.type || 'staff', location: node.location || '', subRole: node.subRole || '' });
        setIsEditing(true);
    }, []);

    const handleDelete = useCallback((id) => {
        if (id === data?.id) {
            setData(null);
            setSelectedNodeId(null);
            return;
        }
        setData(prev => findAndDelete(prev, id));
        if (selectedNodeId === id) setSelectedNodeId(null);
    }, [data, selectedNodeId]);

    const handleAddChild = (type) => {
        if (!selectedNodeId) return;
        const newNode = {
            id: `node-${Date.now()}`,
            name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            role: 'ROLE / DESIGNATION',
            type: type,
            children: []
        };
        setData(prev => findAndAdd(prev, selectedNodeId, newNode));
    };

    const handleSave = () => {
        setData(prev => findAndUpdate(prev, activeNode.id, editForm));
        setIsEditing(false);
    };

    const handleAddRoot = () => {
        const root = { id: 'root', name: 'New Project', role: 'PROJECT LOCATION', type: 'project', children: [] };
        setData(root);
        setSelectedNodeId(root.id);
    };

    // Recursive rendering helper defined inside but outside of loop
    const renderChart = (node, level = 0, isFirst = true, isLast = true, parentHasMany = false) => {
        if (!node) return null;
        return (
            <NodeCard
                key={node.id}
                node={node}
                level={level}
                isFirst={isFirst}
                isLast={isLast}
                parentHasMany={parentHasMany}
                selectedNodeId={selectedNodeId}
                onSelect={handleSelect}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canWrite={canWrite}
            />
        );
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 dark:bg-[#0d1117] overflow-hidden anim-fade-in Poppins select-none relative">
            {/* Floating Toolbar */}
            <div className="absolute top-4 right-4 flex items-center space-x-4 z-30">
                <div className="flex items-center bg-white dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl p-1 shadow-sm">
                    <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg active:scale-90">
                        <ZoomOut size={16} />
                    </button>
                    <span className="text-[10px] font-mono w-12 text-center text-blue-500 font-bold">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))} className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg active:scale-90">
                        <ZoomIn size={16} />
                    </button>
                </div>
                {canWrite && (
                    <button
                        onClick={() => { setData(INITIAL_DATA); setSelectedNodeId('root'); }}
                        className="px-4 py-2 bg-white dark:bg-[#161b22] hover:bg-gray-50 dark:hover:bg-[#1e293b] text-gray-700 dark:text-gray-300 rounded-md text-[11px] font-bold border border-gray-200 dark:border-white/10 transition-all shadow-sm active:scale-95"
                    >
                        Reset to Default
                    </button>
                )}
                <button
                    onClick={() => setIsInfoOpen(true)}
                    className="p-2 bg-white dark:bg-[#161b22] hover:bg-gray-50 dark:hover:bg-[#1e293b] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 rounded-md transition-all active:scale-95 shadow-sm"
                    title="View Audit Trail"
                >
                    <Info size={16} />
                </button>
            </div>

            {/* Main Interactive Stage */}
            <div ref={containerRef} className="flex-1 overflow-auto relative custom-scrollbar bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px]">
                {data ? (
                    <div
                        className="p-48 min-w-max flex justify-center origin-top will-change-transform"
                        style={{ transform: `scale(${zoom})`, transition: 'transform 0.1s linear' }}
                        onClick={() => setSelectedNodeId(null)} // Click background to deselect
                    >
                        {renderChart(data)}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="p-16 border border-gray-200 dark:border-white/5 rounded-2xl flex flex-col items-center text-center max-w-sm bg-white dark:bg-[#161b22]/80 backdrop-blur-xl shadow-lg"
                        >
                            <div className="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-8 text-blue-600">
                                <Building size={40} />
                            </div>
                            <h3 className="text-gray-900 dark:text-white font-bold text-xl tracking-tight mb-2">Blank Canvas</h3>
                            <p className="text-gray-500 text-sm mb-10 leading-relaxed">Great organizations are built brick by brick. Start your project structure today.</p>
                            {canWrite && (
                                <button
                                    onClick={handleAddRoot}
                                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-blue-600/20 active:scale-95 flex items-center justify-center space-x-2"
                                >
                                    <Plus size={20} />
                                    <span>Create Root Node</span>
                                </button>
                            )}
                        </motion.div>
                    </div>
                )}

                {/* The "Construction Kit" - macOS Glassmorphism & Draggable */}
                <AnimatePresence>
                    {data && canWrite && (
                        <motion.div
                            drag
                            dragConstraints={containerRef}
                            dragElastic={0.1}
                            dragMomentum={false}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            whileDrag={{ scale: 1.02, boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.2)" }}
                            className="absolute left-8 bottom-8 p-6 bg-white/90 dark:bg-[#161b22]/90 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg z-40 w-64 cursor-grab active:cursor-grabbing group/kit"
                        >
                            {/* Drag Handle Indicator */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-300 dark:bg-white/10 rounded-full group-hover/kit:bg-gray-400 dark:group-hover/kit:bg-white/20 transition-colors" />

                            <div className="mb-5 mt-1">
                                <div className="flex items-center mb-1">
                                    <h4 className="text-[11px] text-gray-900 dark:text-white/90 font-medium tracking-widest flex items-center whitespace-nowrap">
                                        <Plus className="text-blue-400 mr-2" size={12} />
                                        Construction kit
                                    </h4>
                                </div>
                                <div className={`mt-3 p-3 rounded-md border transition-all duration-300 flex items-center space-x-3
                                    ${selectedNodeId ? 'bg-white/90 border-gray-200 dark:bg-white/5 dark:border-white/10 shadow-sm' : 'bg-gray-100 border-gray-200 dark:bg-black/20 dark:border-white/5 opacity-80'}
                                `}>
                                    <div className={`w-2 h-2 rounded-full ${selectedNodeId ? 'bg-blue-500' : 'bg-gray-400 dark:bg-gray-700'}`} />
                                    <span className={`text-[10px] font-medium truncate max-w-[150px]
                                        ${selectedNodeId ? 'text-gray-700 dark:text-white/80' : 'text-gray-500 italic'}
                                    `}>
                                        {selectedNodeId ? `Parent: ${findNode(data, selectedNodeId)?.name || 'Building...'}` : 'Pick a parent first'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-2.5">
                                {[
                                    { type: 'project', label: 'PROJECT', color: 'bg-blue-400', desc: 'Main worksite' },
                                    { type: 'company', label: 'COMPANY', color: 'bg-blue-500', desc: 'Partner / Client' },
                                    { type: 'department', label: 'DEPARTMENT', color: 'bg-emerald-500', desc: 'Functional unit' },
                                    { type: 'staff', label: 'STAFF / TRADE', color: 'bg-gray-400', desc: 'Personnel member' }
                                ].map((item) => (
                                    <button
                                        key={item.type}
                                        onClick={() => handleAddChild(item.type)}
                                        disabled={!selectedNodeId}
                                        className={`
                                            group w-full flex items-center justify-between p-3.5 rounded-md border transition-all active:scale-95
                                            ${selectedNodeId
                                                ? 'bg-white/5 border-gray-200 dark:border-white/5 hover:border-white/20 hover:bg-gray-200 dark:bg-white/10 shadow-sm'
                                                : 'bg-black/10 border-transparent cursor-not-allowed opacity-20'}
                                        `}
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-3.5 h-3.5 rounded-full ${item.color} shadow-lg ring-2 ring-black/20 group-hover:scale-110 transition-transform`} />
                                            <div className="text-left">
                                                <div className="text-[11px] font-medium tracking-wide text-gray-700 dark:text-white/80 group-hover:text-blue-600 dark:group-hover:text-white capitalize">{item.label}</div>
                                                <div className="text-[9px] text-gray-500 dark:text-white/40 font-light group-hover:text-gray-600 dark:group-hover:text-white/60">{item.desc}</div>
                                            </div>
                                        </div>
                                        <Plus size={14} className={`transition-all ${selectedNodeId ? 'text-gray-400 dark:text-white/20 group-hover:text-blue-600 dark:group-hover:text-blue-400' : 'text-gray-300 dark:text-white/10'}`} />
                                    </button>
                                ))}
                            </div>

                            {!selectedNodeId && (
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5 text-center">
                                    <p className="text-[10px] text-gray-400 dark:text-white/40 font-medium">Select a chart node to unlock</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Edit Drawer (Same Premium Design) */}
            <AnimatePresence>
                {isEditing && (
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="absolute right-0 top-0 bottom-0 w-96 bg-white dark:bg-[#0d1117] border-l border-gray-200 dark:border-white/5 z-50 p-8 flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-gray-900 dark:text-white font-normal text-lg tracking-tight flex items-center space-x-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Edit2 size={18} className="text-blue-500" />
                                    </div>
                                    <span>Node Editor</span>
                                </h2>
                                <p className="text-[10px] text-gray-500 dark:text-white/40 mt-1 tracking-widest font-light italic">Configure identity & location</p>
                            </div>
                            <button onClick={() => setIsEditing(false)} className="p-2 text-gray-600 hover:text-white transition-colors bg-gray-50 dark:bg-[#161b22] rounded-xl border border-gray-200 dark:border-white/5">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-600 dark:text-white/50 font-normal tracking-widest pl-1">Target Entity Type</label>
                                <select
                                    className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl py-3.5 px-4 text-sm text-gray-900 dark:text-white/90 font-light outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 appearance-none shadow-inner"
                                    value={editForm.type}
                                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                                >
                                    <option value="project">Project / Location</option>
                                    <option value="company">Contractor / Firm</option>
                                    <option value="department">Internal Dept</option>
                                    <option value="staff">Staff Member / Personnel</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-600 dark:text-white/50 font-normal tracking-widest pl-1">Legal Name</label>
                                <input
                                    type="text"
                                    placeholder="Enter entity name..."
                                    className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl py-3.5 px-4 text-sm text-gray-900 dark:text-white/90 font-light outline-none focus:border-blue-500 shadow-inner placeholder:text-gray-400 dark:placeholder:text-white/20"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] text-gray-600 dark:text-white/50 font-normal tracking-widest pl-1">Primary Job Title / Role</label>
                                <input
                                    type="text"
                                    placeholder="General Manager, Architect, etc..."
                                    className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl py-3.5 px-4 text-sm text-gray-900 dark:text-white/90 font-light outline-none focus:border-blue-500 shadow-inner placeholder:text-gray-400 dark:placeholder:text-white/20"
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                />
                            </div>

                            {editForm.type === 'project' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-600 dark:text-white/50 font-normal tracking-widest pl-1">Geographical Site</label>
                                    <input
                                        type="text"
                                        placeholder="City, Country..."
                                        className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl py-3.5 px-4 text-sm text-gray-900 dark:text-white/90 font-light outline-none focus:border-blue-500 shadow-inner placeholder:text-gray-400 dark:placeholder:text-white/20"
                                        value={editForm.location}
                                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                                    />
                                </div>
                            )}

                            {(editForm.type === 'company' || editForm.type === 'department') && (
                                <div className="space-y-2">
                                    <label className="text-[10px] text-gray-600 dark:text-white/50 font-normal tracking-widest pl-1">Operational Header</label>
                                    <input
                                        type="text"
                                        placeholder="Managed by (e.g. Director)..."
                                        className="w-full bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-xl py-3.5 px-4 text-sm text-gray-900 dark:text-white/90 font-light outline-none focus:border-blue-500 shadow-inner placeholder:text-gray-400 dark:placeholder:text-white/20"
                                        value={editForm.subRole}
                                        onChange={(e) => setEditForm({ ...editForm, subRole: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="pt-8 border-t border-gray-200 dark:border-white/5 mt-8 space-y-3">
                            <button
                                onClick={handleSave}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-4 text-lg font-light shadow-2xl shadow-blue-600/20 transition-all flex items-center justify-center space-x-3 active:scale-[0.98] ring-1 ring-white/10"
                            >
                                <Save size={20} />
                                <span>Save System Updates</span>
                            </button>
                            <button
                                onClick={() => {
                                    handleDelete(activeNode.id);
                                    setIsEditing(false);
                                }}
                                className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl py-4 text-lg font-light transition-all flex items-center justify-center space-x-3 active:scale-[0.98] border border-red-500/20 hover:border-red-600 shadow-lg"
                            >
                                <Trash2 size={20} />
                                <span>Delete This Node</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Audit Trail Drawer */}
            <AnimatePresence>
                {isInfoOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsInfoOpen(false)}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 h-full w-[380px] bg-white dark:bg-[#0d1117] border-l border-gray-200 dark:border-white/10 shadow-2xl z-[101] flex flex-col"
                        >
                            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22]">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <Info size={20} className="text-blue-400" />
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Audit trail & history</h2>
                                </div>
                                <button
                                    onClick={() => setIsInfoOpen(false)}
                                    className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all outline-none"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {auditTrail.map((log) => (
                                    <div key={log.id} className="relative pl-8 pb-2">
                                        {/* Activity Line */}
                                        <div className="absolute left-3 top-2 bottom-0 w-[1px] bg-gray-200 dark:bg-white/10" />

                                        {/* Activity Icon */}
                                        <div className={`absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-white dark:border-[#0d1117] z-10 flex items-center justify-center ${log.type === 'create' ? 'bg-green-500/20 text-green-400' :
                                            'bg-blue-500/20 text-blue-400'
                                            }`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current" />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
                                                {log.action}
                                            </p>
                                            <div className="flex items-center space-x-2 text-[11px] text-gray-500">
                                                <span className="font-medium text-gray-400">{log.user}</span>
                                                <span>•</span>
                                                <div className="flex items-center space-x-1">
                                                    <Clock size={10} />
                                                    <span>{log.timestamp}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161b22]/50">
                                <button
                                    onClick={() => setIsInfoOpen(false)}
                                    className="w-full py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-md text-sm font-bold transition-all outline-none border border-gray-300 dark:border-white/10"
                                >
                                    Close panel
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default OrganisationChart;
