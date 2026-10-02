import React, { lazy, Suspense } from 'react';
import MobileProjectModulePlaceholder from './MobileProjectModulePlaceholder';
import MobileProjectDashboard from './Dashboard/MobileProjectDashboard';
import MobileProjectTasks from './Tasks/MobileProjectTasks';
import MobileProjectWIP from './WIP/MobileProjectWIP';
import MobileProjectPhases from './Phases/MobileProjectPhases';
import MobileProjectSettings from './Settings/MobileProjectSettings';
import MobileGeneralDocuments from './GeneralDocuments/MobileGeneralDocuments';
import MobileProjectQuality from './Quality/MobileProjectQuality';
import MobileProjectSafety from './Safety/MobileProjectSafety';
import MobileProjectMaterialManagement from './MaterialManagement/MobileProjectMaterialManagement';
import MobileProjectTransactions from './Transactions/MobileProjectTransactions';
import MobileProjectPlanning from './Planning/MobileProjectPlanningParity';
import MobileProjectContracts from './Contracts/MobileProjectContractsParity';
import MobileProjectBilling from './Billing/MobileProjectBilling';
import MobileProjectApprovals from './Approvals/MobileProjectApprovals';
import MobileProjectReports from './Reports/MobileProjectReports';
import MobileLoadingState from '../../components/MobileLoadingState';

const MobileProjectSpreadsheets = lazy(() => import('./Spreadsheets/MobileProjectSpreadsheets'));
const MobileProjectDrawings = lazy(() => import('./Drawings/MobileProjectDrawings'));

const IMPLEMENTED_MODULES = { Dashboard: MobileProjectDashboard, Tasks: MobileProjectTasks, WIP: MobileProjectWIP, Phases: MobileProjectPhases, Settings: MobileProjectSettings, Reports: MobileProjectReports, 'General Documents': MobileGeneralDocuments, Spreadsheets: MobileProjectSpreadsheets, Drawings: MobileProjectDrawings, Quality: MobileProjectQuality, Safety: MobileProjectSafety, 'Material Management': MobileProjectMaterialManagement, Transactions: MobileProjectTransactions, Planning: MobileProjectPlanning, Contracts: MobileProjectContracts, Billing: MobileProjectBilling, Approvals: MobileProjectApprovals };

export default function MobileProjectModuleOutlet({ module, ...workspaceProps }) {
    const Component = IMPLEMENTED_MODULES[module.key];
    return <section aria-label={`${module.label} mobile workspace`} className="min-w-0">{Component ? <Suspense fallback={<MobileLoadingState label={`Loading ${module.label}`} rows={3} />}><Component {...workspaceProps} /></Suspense> : <MobileProjectModulePlaceholder module={module} />}</section>;
}
