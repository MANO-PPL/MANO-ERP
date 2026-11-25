import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api.js';
import { createPartyApi } from '../../../services/partyApi.js';
import { useAuth } from '../../../context/AuthContext';
import MobileBulkImportWorkflow from '../../components/MobileBulkImportWorkflow';
import { normalizeVendorImportRows } from './vendorModel.js';

const defaultImportVendors = createPartyApi('vendor').bulkCreate;

export default function MobileVendorBulkUpload({ authOverride, validateRequest = (rows) => api.post('/parties/bulk-validate', { vendors: rows }, { params: { party_type: 'vendor' } }).then(({ data }) => data), importRequest = defaultImportVendors, onNavigate }) {
    const auth = useAuth(); const activeAuth = authOverride || auth; const navigate = useNavigate();
    return <MobileBulkImportWorkflow title="Vendor bulk upload" entityLabel="vendors" canWrite={activeAuth.hasPermission('vendors', 2)} validateRows={validateRequest} normalizeRows={normalizeVendorImportRows} importRows={importRequest} onBack={() => onNavigate ? onNavigate('/vendors') : navigate('/vendors')} />;
}
