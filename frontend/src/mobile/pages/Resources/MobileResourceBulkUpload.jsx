import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { resourceApi } from '../../../services/resourceApi.js';
import MobileBulkImportWorkflow from '../../components/MobileBulkImportWorkflow';
import { buildResourceImportPayload, normalizeResourceImportRows } from './resourceModel.js';
import { resourceBulkUploadRequests } from './resourceContracts.js';

const productionBulkRequests = resourceBulkUploadRequests(resourceApi);

export default function MobileResourceBulkUpload({ authOverride, validateRequest = productionBulkRequests.validateRequest, importRequest = productionBulkRequests.importRequest, onNavigate }) {
    const auth = useAuth(); const activeAuth = authOverride || auth; const navigate = useNavigate();
    return <MobileBulkImportWorkflow title="Resource bulk upload" entityLabel="resources" canWrite={activeAuth.hasPermission('resources', 2)} validateRows={validateRequest} normalizeRows={normalizeResourceImportRows} importRows={importRequest} buildPayload={buildResourceImportPayload} atomic onBack={() => onNavigate ? onNavigate('/resources') : navigate('/resources')} />;
}
