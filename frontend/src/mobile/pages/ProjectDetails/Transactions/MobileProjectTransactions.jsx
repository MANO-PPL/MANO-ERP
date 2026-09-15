import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ledgerApi } from '../../../../services/ledgerApi';
import { projectApi } from '../../../../services/projectApi';
import { unitApi } from '../../../../services/unitApi';
import MobileFAB from '../../../components/MobileFAB';
import MobilePageHeader from '../../../components/MobilePageHeader';
import MobileTabs from '../../../components/MobileTabs';
import MobileTransactionEditor from './MobileTransactionEditor';
import MobileTransactionHistory from './MobileTransactionHistory';
import MobileTransactionRegister from './MobileTransactionRegister';
import MobilePartyStockStatements from './MobilePartyStockStatements';
import { buildTransactionPayload, createTransactionRequestGuard, resolveTransactionView, updateTransactionViewSearch } from './mobileTransactionModel';

const unwrap = (value, key) => Array.isArray(value?.[key]) ? value[key] : Array.isArray(value?.data) ? value.data : Array.isArray(value) ? value : [];
const normalizeResources = (value) => unwrap(value, 'resources').map((resource) => ({ ...resource, project_resource_id: resource.project_resource_id ?? resource.resource_id ?? resource.id }));

export default function MobileProjectTransactions({ project, projectId, canWrite, services = {} }) {
    const ledger = services.ledger || ledgerApi; const projects = services.projects || projectApi; const unitsApi = services.units || unitApi;
    const [search, setSearch] = useSearchParams(); const view = resolveTransactionView(search.get('txnView'));
    const [state, setState] = useState({ transactions: [], parties: [], resources: [], units: [], stockMap: {}, loading: true, error: null });
    const [editor, setEditor] = useState(false); const [pending, setPending] = useState(false); const [mutationError, setMutationError] = useState(null);
    const guard = useRef(createTransactionRequestGuard()); const activeProject = useRef(String(projectId));
    const load = useCallback(async () => { const token = guard.current.begin(projectId); setState({ transactions: [], parties: [], resources: [], units: [], stockMap: {}, loading: true, error: null }); const [history, parties, resources, units, stock] = await Promise.allSettled([ledger.listTransactions({ project_id: projectId, limit: 1000 }), ledger.getProjectParties(projectId), projects.listProjectResources(projectId), unitsApi.getUnits(), ledger.getProjectStock(projectId, project?.org_id)]); if (!guard.current.isCurrent(token) || String(activeProject.current) !== String(projectId)) return; const rejected = [history, parties, resources, units, stock].find((result) => result.status === 'rejected'); const stockRows = stock.status === 'fulfilled' ? unwrap(stock.value, 'data') : []; const stockMap = {}; stockRows.forEach((row) => { stockMap[`${row.party_id}_${row.project_resource_id}`] = Number(row.net_qty) || 0; }); setState({ transactions: history.status === 'fulfilled' ? unwrap(history.value, 'data') : [], parties: parties.status === 'fulfilled' ? unwrap(parties.value, 'data') : [], resources: resources.status === 'fulfilled' ? normalizeResources(resources.value) : [], units: units.status === 'fulfilled' ? unwrap(units.value, 'units') : [], stockMap, loading: false, error: rejected?.reason || null }); }, [ledger, project?.org_id, projectId, projects, unitsApi]);
    useEffect(() => { activeProject.current = String(projectId); guard.current.invalidate(); setEditor(false); setPending(false); setMutationError(null); }, [projectId]);
    useEffect(() => { load(); }, [load]);
    const selectView = (next) => { const params = updateTransactionViewSearch(search, next); setSearch(params); };
    const save = async ({ txnType, remarks, lines }) => { if (!canWrite || pending) return; const token = guard.current.begin(projectId); const origin = String(projectId); setPending(true); setMutationError(null); try { await ledger.createTransaction(buildTransactionPayload({ projectId, orgId: project?.org_id || 1, txnType, remarks, lines })); if (!guard.current.isCurrent(token) || activeProject.current !== origin) return; setEditor(false); setPending(false); await load(); } catch (error) { if (!guard.current.isCurrent(token) || activeProject.current !== origin) return; setPending(false); setMutationError(error); } };
    const historyContent = <MobileTransactionHistory projectId={projectId} {...state} onRetry={load} />;
    const content = view === 'history' ? historyContent : view === 'register' ? <MobileTransactionRegister project={project} projectId={projectId} canWrite={canWrite} parties={state.parties} resources={state.resources} units={state.units} stockMap={state.stockMap} ledger={ledger} onRefresh={load} /> : <MobilePartyStockStatements project={project} projectId={projectId} parties={state.parties} resources={state.resources} transactions={state.transactions} ledger={ledger} />;
    return <section data-m8-module="Transactions" className="min-w-0"><MobilePageHeader eyebrow="PROJECT WORKSPACE" title="Transactions" subtitle="Confirmed project ledger transactions" actions={<button type="button" onClick={load} aria-label="Refresh transactions" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-gray-200 dark:border-gh-border"><RefreshCw size={18} /></button>} /><div className="px-4"><MobileTabs label="Transactions workspace" value={view} onChange={selectView} items={[{ value: 'history', label: 'History' }, { value: 'register', label: 'Entry Register' }, { value: 'party-stock', label: 'Party stock' }]} /></div>{mutationError && <p role="alert" className="mx-4 mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">{mutationError?.message || 'Transaction could not be recorded. The form is unchanged.'}</p>}{content}{canWrite && view === 'history' && <MobileFAB extended label="New transaction" onClick={() => { setMutationError(null); setEditor(true); }} />}{canWrite && <MobileTransactionEditor open={editor} onClose={() => !pending && setEditor(false)} onSave={save} pending={pending} parties={state.parties} resources={state.resources} units={state.units} stockMap={state.stockMap} />}</section>;
}
