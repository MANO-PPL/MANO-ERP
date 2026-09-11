/**
 * KnowledgeGraphViewer.jsx
 * Multi-Perspective, Human-Understandable Knowledge Graph Visualizer for MANO-ERP.
 * Clean, modern enterprise UI with zero emojis and no decorative icon clutter.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RefreshCw,
  X
} from 'lucide-react';
import { useKnowledgeGraph } from '../../services/useKnowledgeGraph.js';
import KnowledgeGraphNodeDrawer from './KnowledgeGraphNodeDrawer.jsx';
import { CATEGORY_STYLES, CATEGORY_ORDER, MODULE_COLORS } from './knowledgeGraphStyles.js';

export default function KnowledgeGraphViewer({ activeTrace, onAskAgent, context }) {
  const {
    nodes,
    edges,
    stats,
    pages,
    selectedPage,
    setSelectedPage,
    effectivePageId,
    autoPageId,
    loading,
    error,
    liveConnected,
    liveActivity,
    pulsingNodeId,
    selectedNodeId,
    setSelectedNodeId,
    selectedCategory,
    setSelectedCategory,
    selectedModule,
    setSelectedModule,
    searchTerm,
    setSearchTerm,
    refresh
  } = useKnowledgeGraph({ context });

  // Visual perspective: 'flow' (Architecture Flow) | 'map' (Interactive Mindmap) | 'blueprint' (Knowledge Blueprint)
  const [viewMode, setViewMode] = useState('flow');

  // Focus filter: Focus on current page/context (clean ~10-25 nodes) vs full system (150+ nodes)
  const [focusOnly, setFocusOnly] = useState(true);

  // Hovered node for cross-column & edge highlights
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Map canvas controls
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedNode, setDraggedNode] = useState(null);

  // Position cache: nodeId -> { x, y, vx, vy }
  const positionsRef = useRef(new Map());

  // Node Map: id -> Node
  const nodeMap = useMemo(() => {
    const map = new Map();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Current page or sub-page object
  const currentPageObj = useMemo(() => {
    const parentPage = pages.find(p => p.id === effectivePageId);
    if (parentPage) return parentPage;
    for (const p of pages) {
      const sub = (p.subpages || []).find(sp => sp.id === effectivePageId);
      if (sub) return { ...sub, parentName: p.name };
    }
    const node = nodeMap.get(effectivePageId);
    if (node) return { id: node.id, name: node.label, description: node.description };
    return null;
  }, [pages, effectivePageId, nodeMap]);

  // Active trace sets
  const traceNodeIds = useMemo(() => {
    return new Set((activeTrace?.nodes || []).map(n => n.id));
  }, [activeTrace]);

  const traceEdgeIds = useMemo(() => {
    return new Set((activeTrace?.edges || []).map(e => e.id));
  }, [activeTrace]);

  // Adjacency graph for neighborhood traversal
  const { adjacencyMap, nodeEdgeMap } = useMemo(() => {
    const adj = new Map();
    const edgeMap = new Map();

    nodes.forEach(n => {
      adj.set(n.id, new Set());
      edgeMap.set(n.id, []);
    });

    edges.forEach(e => {
      if (adj.has(e.source)) adj.get(e.source).add(e.target);
      if (adj.has(e.target)) adj.get(e.target).add(e.source);

      if (edgeMap.has(e.source)) edgeMap.get(e.source).push(e);
      if (edgeMap.has(e.target)) edgeMap.get(e.target).push(e);
    });

    return { adjacencyMap: adj, nodeEdgeMap: edgeMap };
  }, [nodes, edges]);

  // Filtered nodes based on focusOnly, search, category, and module
  const displayNodes = useMemo(() => {
    let list = nodes;

    // Focus mode: Keep only nodes directly connected (1 or 2 hops) to the current page/context
    if (focusOnly && effectivePageId && effectivePageId !== 'all') {
      const rootId = effectivePageId;
      const relevantIds = new Set();
      if (nodeMap.has(rootId)) relevantIds.add(rootId);

      // 1-hop neighbors
      const direct = adjacencyMap.get(rootId) || new Set();
      direct.forEach(id => relevantIds.add(id));

      // 2-hop neighbors (e.g. Schemas -> Rules / Entities)
      direct.forEach(firstHop => {
        const secondHop = adjacencyMap.get(firstHop) || new Set();
        secondHop.forEach(id => relevantIds.add(id));
      });

      if (relevantIds.size > 0) {
        list = list.filter(n => relevantIds.has(n.id));
      }
    }

    // Category filter
    if (selectedCategory && selectedCategory !== 'all') {
      list = list.filter(n => n.category === selectedCategory);
    }

    // Module filter
    if (selectedModule && selectedModule !== 'all') {
      list = list.filter(n => n.module === selectedModule || n.module === 'general');
    }

    // Search filter
    if (searchTerm && searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(n =>
        n.label.toLowerCase().includes(q) ||
        (n.table && n.table.toLowerCase().includes(q)) ||
        (n.description && n.description.toLowerCase().includes(q)) ||
        (n.summary && n.summary.toLowerCase().includes(q))
      );
    }

    return list;
  }, [nodes, focusOnly, effectivePageId, nodeMap, adjacencyMap, selectedCategory, selectedModule, searchTerm]);

  const displayNodeIds = useMemo(() => new Set(displayNodes.map(n => n.id)), [displayNodes]);

  // Filtered edges
  const displayEdges = useMemo(() => {
    return edges.filter(e => displayNodeIds.has(e.source) && displayNodeIds.has(e.target));
  }, [edges, displayNodeIds]);

  // Nodes grouped by category for Flow & Blueprint views
  const nodesByCategory = useMemo(() => {
    const groups = {
      page: [],
      subpage: [],
      module: [],
      schema: [],
      rule: [],
      entity: []
    };
    displayNodes.forEach(node => {
      if (groups[node.category]) {
        groups[node.category].push(node);
      }
    });
    return groups;
  }, [displayNodes]);

  // Connected neighbors of the hovered/selected node
  const activeHighlightedNeighbors = useMemo(() => {
    const activeId = hoveredNodeId || selectedNodeId;
    if (!activeId) return new Set();
    const set = new Set();
    set.add(activeId);
    const neighbors = adjacencyMap.get(activeId) || new Set();
    neighbors.forEach(id => set.add(id));
    return set;
  }, [hoveredNodeId, selectedNodeId, adjacencyMap]);

  // Radial / Structured Layout Computation for Map View
  useEffect(() => {
    if (!displayNodes.length) return;

    const width = 850;
    const height = 620;
    const centerX = width / 2;
    const centerY = height / 2;
    const pos = positionsRef.current;

    const rootPageNode = displayNodes.find(n => n.id === effectivePageId) || displayNodes.find(n => n.category === 'page');

    if (rootPageNode && focusOnly) {
      pos.set(rootPageNode.id, { x: centerX, y: centerY, vx: 0, vy: 0 });

      const subpages = displayNodes.filter(n => n.id !== rootPageNode.id && n.category === 'subpage');
      const modules = displayNodes.filter(n => n.id !== rootPageNode.id && n.category === 'module');
      const schemas = displayNodes.filter(n => n.id !== rootPageNode.id && n.category === 'schema');
      const rules = displayNodes.filter(n => n.id !== rootPageNode.id && n.category === 'rule');
      const entities = displayNodes.filter(n => n.id !== rootPageNode.id && n.category === 'entity');

      subpages.forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / (subpages.length || 1) - Math.PI / 3;
        pos.set(node.id, {
          x: centerX + Math.cos(angle) * 75,
          y: centerY + Math.sin(angle) * 70,
          vx: 0, vy: 0
        });
      });

      modules.forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / (modules.length || 1) - Math.PI / 2;
        pos.set(node.id, {
          x: centerX + Math.cos(angle) * 125,
          y: centerY + Math.sin(angle) * 115,
          vx: 0, vy: 0
        });
      });

      schemas.forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / (schemas.length || 1) - Math.PI / 2 + 0.3;
        pos.set(node.id, {
          x: centerX + Math.cos(angle) * 205,
          y: centerY + Math.sin(angle) * 190,
          vx: 0, vy: 0
        });
      });

      rules.forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / (rules.length || 1) + 0.5;
        pos.set(node.id, {
          x: centerX + Math.cos(angle) * 285,
          y: centerY + Math.sin(angle) * 255,
          vx: 0, vy: 0
        });
      });

      entities.forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / (entities.length || 1) - 0.4;
        pos.set(node.id, {
          x: centerX + Math.cos(angle) * 355,
          y: centerY + Math.sin(angle) * 300,
          vx: 0, vy: 0
        });
      });
    } else {
      const moduleAnchors = {
        dashboard: { x: width * 0.5, y: height * 0.22 },
        projects: { x: width * 0.28, y: height * 0.38 },
        vendors: { x: width * 0.72, y: height * 0.35 },
        clients: { x: width * 0.75, y: height * 0.72 },
        resources: { x: width * 0.24, y: height * 0.74 },
        spreadsheets: { x: width * 0.45, y: height * 0.8 },
        collaboration: { x: width * 0.55, y: height * 0.52 },
        admin: { x: width * 0.85, y: height * 0.2 },
        general: { x: width * 0.5, y: height * 0.5 }
      };

      displayNodes.forEach((node, i) => {
        if (!pos.has(node.id)) {
          const anchor = moduleAnchors[node.module] || moduleAnchors.general;
          const angle = (i * 137.5 * Math.PI) / 180;
          const distance = node.category === 'page' ? 10 :
                           node.category === 'subpage' ? 24 :
                           node.category === 'module' ? 45 :
                           node.category === 'schema' ? 95 :
                           node.category === 'rule' ? 145 : 185 + (i % 6) * 16;
          pos.set(node.id, {
            x: anchor.x + Math.cos(angle) * distance,
            y: anchor.y + Math.sin(angle) * distance,
            vx: 0, vy: 0
          });
        }
      });

      let animationFrame;
      let iteration = 0;
      const maxIterations = 25;

      function relax() {
        if (iteration++ >= maxIterations) return;
        const kRepulsion = 1100;
        const kAttraction = 0.04;

        for (let i = 0; i < displayNodes.length; i++) {
          const p1 = pos.get(displayNodes[i].id);
          if (!p1) continue;
          for (let j = i + 1; j < displayNodes.length; j++) {
            const p2 = pos.get(displayNodes[j].id);
            if (!p2) continue;
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);
            if (dist < 200) {
              const force = kRepulsion / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              p1.x -= fx; p1.y -= fy;
              p2.x += fx; p2.y += fy;
            }
          }
        }

        displayEdges.forEach(edge => {
          const p1 = pos.get(edge.source);
          const p2 = pos.get(edge.target);
          if (!p1 || !p2) return;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 100) * kAttraction;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          p1.x += fx; p1.y += fy;
          p2.x -= fx; p2.y -= fy;
        });

        animationFrame = requestAnimationFrame(relax);
      }
      relax();
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [displayNodes, displayEdges, effectivePageId, focusOnly]);

  // Pan handlers for map view
  const handleMouseDown = e => {
    if (e.target.closest('.node-element')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = e => {
    if (draggedNode) {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (svgRect) {
        const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
        const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;
        const p = positionsRef.current.get(draggedNode);
        if (p) {
          p.x = mouseX;
          p.y = mouseY;
          setDraggedNode(draggedNode);
        }
      }
      return;
    }
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNode(null);
  };

  const handleWheel = e => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(prev => Math.min(Math.max(prev * zoomFactor, 0.35), 2.5));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleNodeClick = useCallback(nodeId => {
    setSelectedNodeId(nodeId);
  }, [setSelectedNodeId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-gh-bg overflow-hidden select-none relative">
      {/* 1. Header Bar: Perspective Switcher, Scope & Status */}
      <div className="shrink-0 border-b border-gray-200/90 bg-white/95 px-3 py-2 dark:border-gh-border dark:bg-gh-bg/95 flex flex-wrap items-center justify-between gap-2 z-20">
        {/* Left: Live Indicator, Perspective Switcher & Scope Selector */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Subtle Live Sync Indicator */}
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 dark:bg-gh-subtle border border-slate-200 dark:border-gh-border text-[11px] font-medium text-gray-700 dark:text-gh-text">
            <span className={`h-1.5 w-1.5 rounded-full ${liveConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className="hidden sm:inline">
              {liveConnected
                ? (stats?.liveMutationsCount > 0 ? `Live Synced (${stats.liveMutationsCount} mut)` : 'Live Synced')
                : 'Connecting'}
            </span>
          </span>

          {/* Perspective Switcher */}
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100/90 p-0.5 dark:border-gh-border dark:bg-gh-subtle text-xs">
            <button
              type="button"
              onClick={() => setViewMode('flow')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'flow'
                  ? 'bg-white text-blue-700 shadow-2xs dark:bg-gh-bg dark:text-blue-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gh-muted dark:hover:text-white'
              }`}
            >
              Flow View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white text-blue-700 shadow-2xs dark:bg-gh-bg dark:text-blue-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gh-muted dark:hover:text-white'
              }`}
            >
              Mindmap
            </button>
            <button
              type="button"
              onClick={() => setViewMode('blueprint')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                viewMode === 'blueprint'
                  ? 'bg-white text-blue-700 shadow-2xs dark:bg-gh-bg dark:text-blue-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gh-muted dark:hover:text-white'
              }`}
            >
              Blueprint
            </button>
          </div>

          {/* Dynamic Scope Selector: 17 Project Tabs + Sub-Pages */}
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gh-muted hidden md:inline">
              Scope:
            </span>
            <select
              value={selectedPage || 'auto'}
              onChange={e => setSelectedPage(e.target.value === 'auto' ? null : e.target.value)}
              className="text-xs font-medium bg-white dark:bg-gh-subtle text-gray-800 dark:text-gh-text border border-gray-200 dark:border-gh-border rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[210px] truncate"
            >
              <option value="auto">
                Auto ({currentPageObj?.name || 'Context Route'})
              </option>
              <option value="all">All Pages & Modules</option>

              <optgroup label="Project Lifecycle (17 Tabs & Sub-Pages)">
                {pages
                  .filter(p => p.module === 'projects' || p.id.startsWith('page:project_'))
                  .map(p => (
                    <React.Fragment key={p.id}>
                      <option value={p.id}>
                        {p.name}
                      </option>
                      {(p.subpages || []).map(sp => (
                        <option key={sp.id} value={sp.id}>
                          {'  ↳ ' + sp.name}
                        </option>
                      ))}
                    </React.Fragment>
                  ))}
              </optgroup>

              <optgroup label="Enterprise Platform Modules">
                {pages
                  .filter(p => p.module !== 'projects' && !p.id.startsWith('page:project_'))
                  .map(p => (
                    <React.Fragment key={p.id}>
                      <option value={p.id}>
                        {p.name}
                      </option>
                      {(p.subpages || []).map(sp => (
                        <option key={sp.id} value={sp.id}>
                          {'  ↳ ' + sp.name}
                        </option>
                      ))}
                    </React.Fragment>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Right: Focus Mode Toggle & Zoom/Refresh */}
        <div className="flex items-center gap-2">
          {/* Focus Toggle */}
          <button
            type="button"
            onClick={() => setFocusOnly(v => !v)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
              focusOnly
                ? 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 font-semibold'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gh-subtle dark:text-gh-muted dark:border-gh-border'
            }`}
          >
            {focusOnly ? 'Focus: Active View' : 'Full System'}
          </button>

          {/* Map Zoom Controls */}
          {viewMode === 'map' && (
            <div className="flex items-center border border-gray-200 rounded-md bg-white dark:border-gh-border dark:bg-gh-subtle">
              <button
                type="button"
                onClick={() => setZoom(z => Math.min(z + 0.2, 2.5))}
                className="p-1 text-gray-500 hover:text-gray-900 dark:text-gh-muted dark:hover:text-white"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoom(z => Math.max(z - 0.2, 0.35))}
                className="p-1 text-gray-500 hover:text-gray-900 dark:text-gh-muted dark:hover:text-white border-l border-gray-200 dark:border-gh-border"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="p-1 text-gray-500 hover:text-gray-900 dark:text-gh-muted dark:hover:text-white border-l border-gray-200 dark:border-gh-border"
                title="Reset View"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={refresh}
            className="p-1 text-gray-500 hover:text-gray-900 rounded hover:bg-gray-100 dark:text-gh-muted dark:hover:text-white dark:hover:bg-gh-hover"
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. Knowledge Digest Summary Banner (Clean, Plain English) */}
      <div className="shrink-0 border-b border-gray-200/80 bg-gray-50/70 dark:bg-gh-subtle/30 px-3.5 py-2 text-xs text-gray-700 dark:text-gh-text flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="min-w-0 text-xs">
          <span>Viewing </span>
          <strong className="font-semibold text-gray-900 dark:text-white">
            {currentPageObj ? (currentPageObj.parentName ? `${currentPageObj.parentName} > ${currentPageObj.name}` : currentPageObj.name) : 'ERP Overview'}
          </strong>
          <span className="text-gray-500 dark:text-gh-muted">
            {' - '}
            {displayNodes.length} nodes grounded ({nodesByCategory.page?.length || 0} Pages, {nodesByCategory.subpage?.length || 0} Sub-Pages, {nodesByCategory.module?.length || 0} Modules, {nodesByCategory.schema?.length || 0} Database Tables, {nodesByCategory.rule?.length || 0} Business Rules, {nodesByCategory.entity?.length || 0} Live Records)
          </span>
        </div>

        {/* Explain Architecture Action */}
        {onAskAgent && (
          <button
            type="button"
            onClick={() => onAskAgent(`Explain how the ${currentPageObj?.name || 'current'} workflow and its database tables work.`)}
            className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:text-blue-800 bg-white dark:bg-gh-subtle dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 rounded-md shadow-2xs hover:bg-blue-50 transition-all cursor-pointer"
          >
            Explain Architecture
          </button>
        )}
      </div>

      {/* 3. Search & Category Filter Pills */}
      <div className="shrink-0 border-b border-gray-200/80 bg-white/90 dark:bg-gh-bg/90 px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs z-10">
        {/* Category Pill Filters (Clean text without decorative icon noise) */}
        <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all border ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gh-subtle dark:text-gh-muted dark:border-gh-border'
            }`}
          >
            All ({displayNodes.length})
          </button>
          {CATEGORY_ORDER.map(cat => {
            const count = nodesByCategory[cat]?.length || 0;
            const style = CATEGORY_STYLES[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat === selectedCategory ? 'all' : cat)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all border ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100 dark:bg-gh-subtle dark:text-gh-muted dark:border-gh-border'
                }`}
              >
                {style.plural} ({count})
              </button>
            );
          })}
        </div>

        {/* Live Search */}
        <div className="relative min-w-[150px] max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter nodes, tables, rules..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-7 pr-7 py-1 text-xs rounded-md border border-gray-200 bg-gray-50/80 dark:border-gh-border dark:bg-gh-subtle dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 4. Main Body */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 bg-white/60 dark:bg-gh-bg/60 backdrop-blur-xs flex items-center justify-center z-30">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gh-subtle shadow-md border border-gray-200 dark:border-gh-border text-xs text-gray-700 dark:text-gh-text">
              <RefreshCw size={14} className="animate-spin text-blue-600" />
              <span>Loading Knowledge Graph...</span>
            </div>
          </div>
        )}

        {/* VIEW 1: ARCHITECTURE FLOW VIEW */}
        {viewMode === 'flow' && (
          <div className="h-full w-full overflow-x-auto overflow-y-auto p-4 custom-scrollbar">
            <div className="flex items-start gap-4 min-w-[1050px] h-full">
              {CATEGORY_ORDER.map(cat => {
                const catNodes = nodesByCategory[cat] || [];
                const style = CATEGORY_STYLES[cat];

                return (
                  <div
                    key={cat}
                    className="flex-1 flex flex-col h-full rounded-xl border border-gray-200/80 bg-white/80 dark:border-gh-border dark:bg-gh-subtle/40 backdrop-blur-xs shadow-2xs overflow-hidden"
                  >
                    {/* Swimlane Column Header */}
                    <div className="shrink-0 p-3 border-b border-gray-200/80 dark:border-gh-border flex items-center justify-between gap-2 bg-gray-50/50 dark:bg-gh-subtle/30">
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {style.title}
                        </h4>
                        <p className="text-[10px] text-gray-500 dark:text-gh-muted truncate">
                          {style.description}
                        </p>
                      </div>
                      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 dark:bg-gh-hover text-gray-700 dark:text-gh-text border border-gray-200 dark:border-gh-border">
                        {catNodes.length}
                      </span>
                    </div>

                    {/* Swimlane Cards List */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
                      {catNodes.length === 0 ? (
                        <div className="p-6 text-center text-xs text-gray-400 dark:text-gh-muted italic">
                          No {style.plural.toLowerCase()} connected
                        </div>
                      ) : (
                        catNodes.map(node => {
                          const isSelected = selectedNodeId === node.id;
                          const isHovered = hoveredNodeId === node.id;
                          const isHighlighted = activeHighlightedNeighbors.has(node.id);
                          const isPulsing = pulsingNodeId === node.id || node.pulse;
                          const neighborCount = (adjacencyMap.get(node.id) || new Set()).size;

                          return (
                            <div
                              key={node.id}
                              onClick={() => handleNodeClick(node.id)}
                              onMouseEnter={() => setHoveredNodeId(node.id)}
                              onMouseLeave={() => setHoveredNodeId(null)}
                              className={`group relative rounded-lg p-2.5 transition-all cursor-pointer border text-xs ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/50 shadow-sm ring-1 ring-blue-400'
                                  : isHovered
                                  ? 'border-blue-400 bg-white dark:bg-gh-bg shadow-sm -translate-y-0.5'
                                  : isHighlighted
                                  ? 'border-blue-300 bg-blue-50/40 dark:bg-blue-950/30'
                                  : 'border-gray-200/90 bg-white hover:border-gray-300 dark:border-gh-border/80 dark:bg-gh-bg'
                              }`}
                            >
                              {/* Pulse border indicator */}
                              {isPulsing && (
                                <span className="absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-emerald-500" />
                              )}

                              {/* Card Header: Category Badge & Module */}
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${style.badge}`}>
                                  {style.label}
                                </span>
                                {node.module && (
                                  <span className="text-[10px] font-mono text-gray-400 dark:text-gh-muted uppercase truncate max-w-[80px]">
                                    {node.module}
                                  </span>
                                )}
                              </div>

                              {/* Card Title */}
                              <h5 className="font-bold text-gray-900 dark:text-white leading-snug break-words">
                                {node.label}
                              </h5>

                              {/* Table name or Description */}
                              {node.table && (
                                <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 truncate mt-0.5">
                                  table: {node.table}
                                </p>
                              )}
                              {node.description && (
                                <p className="text-[11px] text-gray-500 dark:text-gh-muted line-clamp-2 mt-1 leading-relaxed">
                                  {node.description}
                                </p>
                              )}

                              {/* Card Footer */}
                              <div className="mt-2 pt-1.5 border-t border-gray-100 dark:border-gh-border/60 flex items-center justify-between text-[10px] text-gray-400 dark:text-gh-muted">
                                <span>{neighborCount} connections</span>
                                <span className="opacity-0 group-hover:opacity-100 text-blue-600 dark:text-blue-400 font-semibold transition-opacity">
                                  Inspect
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 2: INTERACTIVE MINDMAP VIEW */}
        {viewMode === 'map' && (
          <div
            className="w-full h-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
          >
            <svg ref={svgRef} className="w-full h-full">
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
                </marker>
              </defs>

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {displayEdges.map(edge => {
                  const p1 = positionsRef.current.get(edge.source);
                  const p2 = positionsRef.current.get(edge.target);
                  if (!p1 || !p2) return null;

                  const isConnectedToHovered =
                    hoveredNodeId && (edge.source === hoveredNodeId || edge.target === hoveredNodeId);
                  const isConnectedToSelected =
                    selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);
                  const isTraced = traceEdgeIds.has(edge.id);
                  const isHighlighted = isConnectedToHovered || isConnectedToSelected || isTraced;

                  return (
                    <g key={edge.id}>
                      <line
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke={isHighlighted ? '#3b82f6' : '#cbd5e1'}
                        strokeWidth={isHighlighted ? 2.5 : 1.2}
                        strokeDasharray={isTraced ? '4 2' : undefined}
                        markerEnd={isHighlighted ? 'url(#arrow-active)' : 'url(#arrow)'}
                        className="transition-colors dark:stroke-slate-700"
                      />
                      {(isHighlighted || zoom > 0.9) && edge.label && (
                        <text
                          x={(p1.x + p2.x) / 2}
                          y={(p1.y + p2.y) / 2 - 4}
                          fill={isHighlighted ? '#2563eb' : '#94a3b8'}
                          fontSize="9"
                          fontWeight={isHighlighted ? 'bold' : 'normal'}
                          textAnchor="middle"
                          className="pointer-events-none select-none font-mono"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {displayNodes.map(node => {
                  const p = positionsRef.current.get(node.id);
                  if (!p) return null;

                  const style = CATEGORY_STYLES[node.category] || CATEGORY_STYLES.module;
                  const isSelected = selectedNodeId === node.id;
                  const isHovered = hoveredNodeId === node.id;
                  const isHighlighted = activeHighlightedNeighbors.has(node.id);
                  const radius = style.radius * (isSelected || isHovered ? 1.2 : 1);

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${p.x}, ${p.y})`}
                      className="node-element cursor-pointer group"
                      onClick={e => {
                        e.stopPropagation();
                        handleNodeClick(node.id);
                      }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        setDraggedNode(node.id);
                      }}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      {/* Selection Halo */}
                      {isSelected && (
                        <circle
                          r={radius + 5}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                        />
                      )}

                      {/* Main Node Circle */}
                      <circle
                        r={radius}
                        fill={style.color}
                        fillOpacity={node.category === 'page' ? 1 : 0.9}
                        stroke="#ffffff"
                        strokeWidth={isSelected ? 3 : 1.5}
                        className="transition-transform drop-shadow-md group-hover:scale-110"
                      />

                      {/* High-Contrast Readable Pill Label Below Node */}
                      <g transform={`translate(0, ${radius + 14})`}>
                        <rect
                          x={-(Math.min(node.label.length * 4.5, 90) + 12)}
                          y={-9}
                          width={(Math.min(node.label.length * 4.5, 90) + 12) * 2}
                          height={18}
                          rx={9}
                          fill="rgba(255, 255, 255, 0.95)"
                          stroke={isSelected ? '#3b82f6' : '#e2e8f0'}
                          strokeWidth={isSelected ? 1.5 : 1}
                          className="dark:fill-slate-900/90 dark:stroke-slate-700 shadow-2xs pointer-events-none"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="currentColor"
                          fontSize="10"
                          fontWeight={isSelected ? '700' : '600'}
                          className="text-gray-800 dark:text-gray-100 pointer-events-none select-none"
                        >
                          {node.label.length > 24 ? `${node.label.slice(0, 22)}...` : node.label}
                        </text>
                      </g>
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Hover Tooltip Card */}
            {hoveredNodeId && nodeMap.has(hoveredNodeId) && (
              <div className="absolute bottom-4 left-4 max-w-sm rounded-xl border border-gray-200/90 bg-white/95 p-3 shadow-xl backdrop-blur-md dark:border-gh-border dark:bg-gh-bg/95 z-20 text-xs pointer-events-none transition-all">
                {(() => {
                  const n = nodeMap.get(hoveredNodeId);
                  const style = CATEGORY_STYLES[n.category] || CATEGORY_STYLES.module;
                  return (
                    <>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${style.badge}`}>
                          {style.label}
                        </span>
                        {n.module && (
                          <span className="text-[10px] uppercase font-mono text-gray-400">
                            {n.module}
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-gray-900 dark:text-white text-xs mb-1">
                        {n.label}
                      </h5>
                      {n.table && (
                        <p className="text-[10px] font-mono text-blue-600 dark:text-blue-400 mb-1">
                          table: {n.table}
                        </p>
                      )}
                      {n.description && (
                        <p className="text-gray-600 dark:text-gh-muted leading-relaxed line-clamp-3">
                          {n.description}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: KNOWLEDGE BLUEPRINT VIEW */}
        {viewMode === 'blueprint' && (
          <div className="h-full w-full overflow-y-auto p-4 custom-scrollbar text-xs">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Active Workflow Hero Card */}
              <div className="rounded-xl border border-gray-200 bg-white dark:border-gh-border dark:bg-gh-subtle/50 p-4 shadow-2xs">
                <div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 uppercase tracking-wider mb-1">
                    Active ERP Workflow
                  </span>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {currentPageObj?.name || 'Overview'}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gh-muted mt-1 leading-relaxed max-w-2xl">
                    {currentPageObj?.description || 'Workflow knowledge graph organizing navigation views, relational database tables, operational rules, and real-time live entities.'}
                  </p>
                  {currentPageObj?.route && (
                    <p className="text-[11px] font-mono text-purple-700 dark:text-purple-400 mt-2">
                      Route: {currentPageObj.route}
                    </p>
                  )}
                </div>
              </div>

              {/* Internal Sub-Pages & Granular Views */}
              {nodesByCategory.subpage.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white dark:border-gh-border dark:bg-gh-subtle/50 p-4 shadow-2xs">
                  <div className="pb-2 mb-3 border-b border-gray-100 dark:border-gh-border">
                    <h4 className="font-bold text-gray-900 dark:text-white text-xs">
                      Internal Sub-Pages & Granular Views ({nodesByCategory.subpage.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {nodesByCategory.subpage.map(subpage => (
                      <div
                        key={subpage.id}
                        onClick={() => handleNodeClick(subpage.id)}
                        className="p-2.5 rounded-lg border border-purple-100 dark:border-gh-border/70 bg-purple-50/30 dark:bg-gh-bg hover:border-purple-300 transition-all cursor-pointer"
                      >
                        <span className="font-bold text-gray-900 dark:text-white text-xs truncate block">
                          {subpage.label}
                        </span>
                        {subpage.description && (
                          <p className="text-[11px] text-gray-500 dark:text-gh-muted line-clamp-2 mt-1 leading-relaxed">
                            {subpage.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grid: Database Schemas & Operational Rules */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Connected Database Tables */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gh-border dark:bg-gh-subtle/50">
                  <div className="pb-2 mb-3 border-b border-gray-100 dark:border-gh-border">
                    <h4 className="font-bold text-gray-900 dark:text-white text-xs">
                      Connected Database Tables ({nodesByCategory.schema.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {nodesByCategory.schema.length === 0 ? (
                      <p className="text-gray-400 italic">No direct database tables connected.</p>
                    ) : (
                      nodesByCategory.schema.map(schema => (
                        <div
                          key={schema.id}
                          onClick={() => handleNodeClick(schema.id)}
                          className="p-2.5 rounded-lg border border-gray-100 dark:border-gh-border/70 bg-gray-50/70 dark:bg-gh-bg hover:border-sky-300 transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-gray-900 dark:text-white text-xs">
                              {schema.label}
                            </span>
                            {schema.table && (
                              <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400">
                                {schema.table}
                              </span>
                            )}
                          </div>
                          {schema.description && (
                            <p className="text-[11px] text-gray-500 dark:text-gh-muted line-clamp-2">
                              {schema.description}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Enforced Operational Rules */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gh-border dark:bg-gh-subtle/50">
                  <div className="pb-2 mb-3 border-b border-gray-100 dark:border-gh-border">
                    <h4 className="font-bold text-gray-900 dark:text-white text-xs">
                      Active Governance Rules ({nodesByCategory.rule.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {nodesByCategory.rule.length === 0 ? (
                      <p className="text-gray-400 italic">No explicit operational rules on this view.</p>
                    ) : (
                      nodesByCategory.rule.map(rule => (
                        <div
                          key={rule.id}
                          onClick={() => handleNodeClick(rule.id)}
                          className="p-2.5 rounded-lg border border-gray-100 dark:border-gh-border/70 bg-gray-50/70 dark:bg-gh-bg hover:border-amber-300 transition-all cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-bold text-gray-900 dark:text-white text-xs">
                              {rule.label}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                              ENFORCED
                            </span>
                          </div>
                          {rule.description && (
                            <p className="text-[11px] text-gray-500 dark:text-gh-muted leading-relaxed">
                              {rule.description}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Connected Modules & Live Records */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gh-border dark:bg-gh-subtle/50">
                <div className="pb-2 mb-3 border-b border-gray-100 dark:border-gh-border">
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs">
                    Live Database Records Grounded ({nodesByCategory.entity.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {nodesByCategory.entity.slice(0, 9).map(entity => (
                    <div
                      key={entity.id}
                      onClick={() => handleNodeClick(entity.id)}
                      className="p-2 rounded-lg border border-gray-100 dark:border-gh-border/70 bg-gray-50/70 dark:bg-gh-bg hover:border-emerald-300 transition-all cursor-pointer"
                    >
                      <span className="font-bold text-gray-900 dark:text-white text-xs truncate block">
                        {entity.label}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gh-muted block mt-0.5">
                        {entity.table} {entity.recordId ? `#${entity.recordId}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Slide-over Node Inspector Drawer */}
        <KnowledgeGraphNodeDrawer
          nodeId={selectedNodeId}
          onClose={() => setSelectedNodeId(null)}
          onSelectNode={handleNodeClick}
          onAskAgent={query => {
            onAskAgent?.(query);
          }}
        />
      </div>

      {/* 5. Bottom Status Bar */}
      {liveActivity.length > 0 && (
        <div className="shrink-0 border-t border-gray-200/90 bg-white/95 px-3 py-1.5 dark:border-gh-border dark:bg-gh-bg/95 flex items-center justify-between text-xs z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
              Real-Time Sync:
            </span>
            <span className="truncate text-gray-700 dark:text-gh-text text-[11px]">
              {liveActivity[0]?.summary || 'Minute-level database listener active'}
            </span>
            {liveActivity[0]?.pageName && (
              <span className="hidden sm:inline-flex items-center rounded bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.2 text-[10px] font-medium text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                {liveActivity[0].pageName}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gh-muted shrink-0 pl-2">
            Just now
          </span>
        </div>
      )}
    </div>
  );
}
