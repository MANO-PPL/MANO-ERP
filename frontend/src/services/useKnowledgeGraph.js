/**
 * useKnowledgeGraph.js
 * React hook to fetch graph data, maintain filter state (including page-scoped filtering),
 * and listen to real-time Server-Sent Events (SSE) for minute database changes.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Maps router path & query tab to canonical Page ID
 */
export function resolvePageFromRoute(pathname = '/', search = '') {
  const path = pathname.toLowerCase();
  const params = new URLSearchParams(search.toLowerCase());
  const tab = (params.get('tab') || '').toLowerCase();
  const view = (params.get('view') || '').toLowerCase();
  const report = (params.get('report') || '').toLowerCase();
  const type = (params.get('type') || '').toLowerCase();
  const matTab = (params.get('mattab') || '').toLowerCase();
  const subTab = (params.get('subtab') || '').toLowerCase();
  const section = (params.get('section') || '').toLowerCase();

  if (path === '/' || path === '') return 'page:dashboard';
  if (path === '/projects' || path === '/projects/') return 'page:projects';

  if (path.startsWith('/projects/')) {
    // 1. Dashboard
    if (tab === 'dashboard') return 'page:project_details';

    // 2. Tasks
    if (tab === 'tasks') return 'page:project_tasks';

    // 3. WIP
    if (tab === 'wip') return 'page:project_wip';

    // 4. Reports & DPR
    if (tab === 'reports') {
      if (type === 'daily') return 'subpage:project_reports_daily';
      if (type === 'weekly') return 'subpage:project_reports_weekly';
      if (type === 'monthly') return 'subpage:project_reports_monthly';
      if (type === 'team') return 'subpage:project_reports_team';
      if (type === 'config') return 'subpage:project_reports_config';
      return 'page:project_reports';
    }

    // 5. General Documents
    if (tab === 'general documents' || tab === 'generaldocuments' || tab === 'mom' || tab === 'meetings') {
      if (view === 'project-summary') return 'subpage:project_general_summary';
      if (view === 'directory') return 'subpage:project_general_directory';
      if (view === 'party-list') return 'subpage:project_general_parties';
      if (view === 'org-chart') return 'subpage:project_general_org_chart';
      if (view === 'meeting-list' || view === 'meeting-detail') return 'subpage:project_general_meetings';
      return 'page:project_general_docs';
    }

    // 6. Spreadsheets
    if (tab === 'spreadsheets') return 'page:project_spreadsheets';

    // 7. Drawings
    if (tab === 'drawings') {
      if (view === 'categories' || view === 'disciplines') return 'subpage:project_drawings_categories';
      if (view === 'sheets' || view === 'register' || view === 'revisions') return 'subpage:project_drawings_revisions';
      return 'page:project_drawings';
    }

    // 8. Planning
    if (tab === 'planning') {
      if (report === 'project-planning') return 'subpage:project_planning_barchart';
      if (report === 'logistic-plan') return 'subpage:project_planning_logistic';
      if (report === 'manpower-histogram') return 'subpage:project_planning_manpower';
      if (report === 'material-histogram') return 'subpage:project_planning_material';
      if (report === 'hindrance-report') return 'subpage:project_planning_hindrance';
      if (report === 'budget') return 'subpage:project_planning_budget';
      return 'page:project_planning';
    }

    // 9. Phases
    if (tab === 'phases') return 'page:project_phases';

    // 10. Contracts
    if (tab === 'contracts') {
      if (view === 'qs') return 'subpage:project_contracts_qs';
      if (view === 'quotations') return 'subpage:project_contracts_quotations';
      if (view === 'tender') return 'subpage:project_contracts_tender';
      if (view === 'orders') return 'subpage:project_contracts_orders';
      return 'page:project_contracts';
    }

    // 11. Quality
    if (tab === 'quality') {
      if (view === 'control') return 'subpage:project_quality_control';
      if (view === 'methodology') return 'subpage:project_quality_methodology';
      if (view === 'matrix') return 'subpage:project_quality_matrix';
      if (view === 'assurance-plan') return 'subpage:project_quality_assurance_plan';
      if (view === 'check-snag') return 'subpage:project_quality_checklists';
      return 'page:project_quality';
    }

    // 12. Safety
    if (tab === 'safety') {
      if (view === 'hs-plan') return 'subpage:project_safety_hs_plan';
      if (view === 'guideline') return 'subpage:project_safety_guideline';
      if (view === 'incidents') return 'subpage:project_safety_incidents';
      if (view === 'checklists') return 'subpage:project_safety_checklists';
      return 'page:project_safety';
    }

    // 13. Billing
    if (tab === 'billing') {
      if (view === 'materials') return 'subpage:project_billing_material_invoices';
      if (view === 'contractors') return 'subpage:project_billing_contractor_invoices';
      if (view === 'certified') return 'subpage:project_billing_certified_bills';
      if (view === 'monthly') return 'subpage:project_billing_monthly_register';
      return 'page:project_billing';
    }

    // 14. Material Management
    if (tab === 'material management' || tab === 'materialmanagement' || tab === 'materials') {
      if (matTab === 'grid') return 'subpage:project_materials_grid';
      if (matTab === 'recipes') return 'subpage:project_materials_recipes';
      if (matTab === 'rates') return 'subpage:project_materials_rates';
      if (matTab === 'conversions') return 'subpage:project_materials_conversions';
      return 'page:project_materials';
    }

    // 15. Transactions
    if (tab === 'transactions') {
      if (subTab === 'transactions') return 'subpage:project_txn_history';
      if (subTab === 'excel-grid') return 'subpage:project_txn_grid';
      if (subTab === 'party-hub') return 'subpage:project_txn_party_hub';
      return 'page:project_transactions';
    }

    // 16. Approvals
    if (tab === 'approvals') return 'page:project_approvals';

    // 17. Settings
    if (tab === 'settings') {
      if (section === 'general') return 'subpage:project_settings_general';
      if (section === 'branding') return 'subpage:project_settings_branding';
      if (section === 'timeline') return 'subpage:project_settings_timeline';
      return 'page:project_settings';
    }

    return 'page:project_details';
  }

  if (path.startsWith('/vendors')) return 'page:vendors';
  if (path.startsWith('/clients')) return 'page:clients';
  if (path.startsWith('/resources') || path.startsWith('/resource-rate') || path.startsWith('/units')) {
    const rawTab = params.get('tab')?.toLowerCase();
    if (rawTab === 'rates') return 'subpage:resources_rates';
    if (rawTab === 'recipes') return 'subpage:resources_recipes';
    if (rawTab === 'conversions') return 'subpage:resources_conversions';
    return 'page:resources';
  }
  if (path.startsWith('/spreadsheets')) return 'page:spreadsheets';
  if (path.startsWith('/collaboration')) return 'page:collaboration';
  if (path.startsWith('/admin')) return 'page:admin';
  if (path.startsWith('/drawing')) return 'page:project_drawings';

  return 'page:dashboard';
}

export function useKnowledgeGraph({ context = null } = {}) {
  const [data, setData] = useState({ nodes: [], edges: [], stats: {} });
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveActivity, setLiveActivity] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedPage, setSelectedPage] = useState('auto'); // 'auto' | 'all' | pageId
  const [searchTerm, setSearchTerm] = useState('');
  const [pulsingNodeId, setPulsingNodeId] = useState(null);

  // Auto-resolved page from current route context
  const autoPageId = useMemo(() => {
    if (context?.route) {
      return resolvePageFromRoute(context.route, window?.location?.search || '');
    }
    if (typeof window !== 'undefined') {
      return resolvePageFromRoute(window.location.pathname, window.location.search);
    }
    return 'page:dashboard';
  }, [context?.route]);

  const effectivePageId = selectedPage === 'auto' ? autoPageId : selectedPage;

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const url = effectivePageId && effectivePageId !== 'all'
        ? `/api/agent/knowledge-graph?page=${encodeURIComponent(effectivePageId)}&limit=160`
        : '/api/agent/knowledge-graph?limit=180';

      const [graphRes, pagesRes] = await Promise.all([
        fetch(url, { headers: { 'Accept': 'application/json' } }),
        fetch('/api/agent/knowledge-graph/pages', { headers: { 'Accept': 'application/json' } }).catch(() => null)
      ]);

      if (!graphRes.ok) throw new Error(`HTTP ${graphRes.status}`);
      const json = await graphRes.json();
      if (json.success) {
        setData({
          nodes: json.nodes || [],
          edges: json.edges || [],
          stats: json.stats || {}
        });
        if (json.changeHistory?.length) {
          setLiveActivity(json.changeHistory);
        }
      }

      if (pagesRes && pagesRes.ok) {
        const pagesJson = await pagesRes.json();
        if (pagesJson.success && Array.isArray(pagesJson.pages)) {
          setPages(pagesJson.pages);
        }
      }
    } catch (err) {
      console.warn('[useKnowledgeGraph] Fetch warning:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [effectivePageId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Connect to real-time Server-Sent Events (SSE)
  useEffect(() => {
    let eventSource = null;
    let reconnectTimeout = null;

    function connect() {
      try {
        eventSource = new EventSource('/api/agent/knowledge-graph/events');

        eventSource.addEventListener('connected', () => {
          setLiveConnected(true);
        });

        eventSource.addEventListener('change', (event) => {
          try {
            const change = JSON.parse(event.data);
            setLiveActivity(prev => [change, ...prev].slice(0, 15));
            setPulsingNodeId(change.nodeId);

            setData(prev => {
              const nodes = [...prev.nodes];
              const nodeIndex = nodes.findIndex(n => n.id === change.nodeId);

              if (change.type === 'DELETE') {
                return {
                  ...prev,
                  nodes: nodes.filter(n => n.id !== change.nodeId),
                  edges: prev.edges.filter(e => e.source !== change.nodeId && e.target !== change.nodeId)
                };
              }

              if (nodeIndex >= 0) {
                // UPDATE node
                nodes[nodeIndex] = {
                  ...nodes[nodeIndex],
                  pulse: true,
                  lastUpdated: change.timestamp
                };
                return { ...prev, nodes };
              }

              // INSERT node (re-fetch to accurately link schemas and pages)
              fetchGraph();
              return prev;
            });

            // Clear pulse after 2.5 seconds
            setTimeout(() => {
              setPulsingNodeId(null);
            }, 2500);
          } catch (e) {
            console.warn('[useKnowledgeGraph] SSE parse error:', e);
          }
        });

        eventSource.onerror = () => {
          setLiveConnected(false);
          eventSource.close();
          reconnectTimeout = setTimeout(connect, 6000);
        };
      } catch {
        setLiveConnected(false);
      }
    }

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [fetchGraph]);

  // Filtered nodes
  const filteredNodes = data.nodes.filter(n => {
    if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;
    if (selectedModule !== 'all' && n.module !== selectedModule && n.module !== 'general') return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchLabel = n.label.toLowerCase().includes(q);
      const matchTable = (n.table || '').toLowerCase().includes(q);
      const matchDesc = (n.description || n.summary || '').toLowerCase().includes(q);
      if (!matchLabel && !matchTable && !matchDesc) return false;
    }
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = data.edges.filter(
    e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    allNodes: data.nodes,
    stats: data.stats,
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
    refresh: fetchGraph
  };
}

export default useKnowledgeGraph;
