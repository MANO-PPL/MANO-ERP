import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api.js';
import { createPartyApi } from '../../../services/partyApi.js';
import { useAuth } from '../../../context/AuthContext';
import MobileBulkImportWorkflow from '../../components/MobileBulkImportWorkflow';
import { normalizeClientImportRows } from './clientModel.js';

const defaultImportClients = createPartyApi('client').bulkCreate;

export default function MobileClientBulkUpload({ authOverride, validateRequest = (rows) => api.post('/parties/bulk-validate', { clients: rows }, { params: { party_type: 'client' } }).then(({ data }) => data), importRequest = defaultImportClients, onNavigate }) {
    const auth = useAuth(); const activeAuth = authOverride || auth; const navigate = useNavigate();
    return <MobileBulkImportWorkflow title="Client bulk upload" entityLabel="clients" canWrite={activeAuth.hasPermission('clients', 2)} validateRows={validateRequest} normalizeRows={normalizeClientImportRows} importRows={importRequest} onBack={() => onNavigate ? onNavigate('/clients') : navigate('/clients')} />;
}
