import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { resourceApi } from '../../../services/resourceApi.js';
import { projectApi } from '../../../services/projectApi.js';
import MobileEmptyState from '../../components/MobileEmptyState';
import MobileLoadingState from '../../components/MobileLoadingState';
import MobilePageHeader from '../../components/MobilePageHeader';
import MobileTabs from '../../components/MobileTabs';
import useMobileResources from '../../hooks/useMobileResources.js';
import MobileResourceConversions from './MobileResourceConversions';
import MobileResourceDirectory from './MobileResourceDirectory';
import MobileResourceRates from './MobileResourceRates';
import MobileResourceRecipes from './MobileResourceRecipes';
import { normalizeResourceTab } from './resourceModel.js';
import { resourceRateServices } from './resourceContracts.js';

const tabs = [
    { value: 'directory', label: 'Directory' },
    { value: 'recipes', label: 'Recipes' },
    { value: 'rates', label: 'Rates' },
    { value: 'conversions', label: 'Conversions' },
];

export default function MobileResources({ authOverride, service = resourceApi, projectService = projectApi, loadResources, loadProjects, onNavigate }) {
    const auth = useAuth(); const activeAuth = authOverride || auth; const navigate = useNavigate(); const [searchParams, setSearchParams] = useSearchParams();
    const { resources, loading, error, accessDenied: loadDenied, refresh } = useMobileResources({ loadResources }); const [mutationDenied, setMutationDenied] = useState(false); const activeTab = normalizeResourceTab(searchParams.get('tab')); const canWrite = activeAuth.hasPermission('resources', 2); const denied = loadDenied || mutationDenied;
    const rateServices = resourceRateServices(service, projectService);
    const changeTab = (tab) => { const next = new URLSearchParams(searchParams); next.set('tab', tab); setSearchParams(next); setMutationDenied(false); };
    const go = (path) => onNavigate ? onNavigate(path) : navigate(path);
    return <div data-mobile-page="resources" className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28">
        <MobilePageHeader eyebrow="Catalog" title="Resources" subtitle="Materials, items, labour, recipes and rates" actions={canWrite && <button aria-label="Resource bulk upload" onClick={() => go('/resources/bulk-upload')} className="min-h-11 min-w-11"><Upload className="mx-auto" size={19} /></button>} />
        <div className="overflow-x-auto pb-1"><MobileTabs segmented value={activeTab} onChange={changeTab} items={tabs} /></div>
        {denied ? <MobileEmptyState title="Resource access denied" description="The current ERP permissions did not allow this resource request. No data or mutation result has been applied." action={<button onClick={() => { setMutationDenied(false); refresh(); }} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Try again</button>} /> : loading ? <MobileLoadingState label="Loading resources" rows={5} /> : error ? <MobileEmptyState title="Resources unavailable" description={error?.response?.data?.message || 'The resource catalog could not be loaded.'} action={<button onClick={refresh} className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Try again</button>} /> : <>
            {activeTab === 'directory' && <MobileResourceDirectory resources={resources} canWrite={canWrite} service={service} onRefresh={refresh} onAccessDenied={() => setMutationDenied(true)} onOpenTab={changeTab} />}
            {activeTab === 'recipes' && <MobileResourceRecipes resources={resources} canWrite={canWrite} service={service} projectService={projectService} loadProjects={loadProjects} onRefresh={refresh} onAccessDenied={() => setMutationDenied(true)} />}
            {activeTab === 'rates' && <MobileResourceRates resources={resources} canWrite={canWrite} service={rateServices.master} projectService={rateServices.project} loadProjects={loadProjects} onRefresh={refresh} onAccessDenied={() => setMutationDenied(true)} />}
            {activeTab === 'conversions' && <MobileResourceConversions resources={resources} canWrite={canWrite} service={service} onRefresh={refresh} onAccessDenied={() => setMutationDenied(true)} />}
        </>}
    </div>;
}
