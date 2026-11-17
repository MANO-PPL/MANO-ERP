import React from 'react';
import { useNavigate } from 'react-router-dom';
import EmployeeBulkUpload from '../../../pages/Admin/EmployeeBulkUpload';

export default function MobileEmployeeBulkUpload() {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-gh-bg p-3 pb-24">
            <EmployeeBulkUpload onNavigateBack={() => navigate('/admin')} />
        </div>
    );
}

