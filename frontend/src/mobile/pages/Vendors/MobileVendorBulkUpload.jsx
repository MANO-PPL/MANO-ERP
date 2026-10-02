import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api.js';
import vendorApi from '../../../services/vendorApi.js';
import { useAuth } from '../../../context/AuthContext';
import MobileBulkImportWorkflow from '../../components/MobileBulkImportWorkflow';
import { normalizeVendorImportRows } from './vendorModel.js';

export default function MobileVendorBulkUpload({ authOverride, validateRequest = (rows) => api.post('/vendors/bulk-validate', { vendors: rows }).then(({ data }) => data), importRequest = vendorApi.bulkCreateVendors, onNavigate }) {
    const auth = useAuth(); const activeAuth = authOverride || auth; const navigate = useNavigate();
    return <MobileBulkImportWorkflow title="Vendor bulk upload" entityLabel="vendors" canWrite={activeAuth.hasPermission('vendors', 2)} validateRows={validateRequest} normalizeRows={normalizeVendorImportRows} importRows={importRequest} onBack={() => onNavigate ? onNavigate('/vendors') : navigate('/vendors')} />;
}
