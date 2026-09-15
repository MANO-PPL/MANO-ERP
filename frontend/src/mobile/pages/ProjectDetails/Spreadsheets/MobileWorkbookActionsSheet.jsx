import React from 'react';
import { Copy, FileDown, FileSpreadsheet, Trash2 } from 'lucide-react';
import { MobileActionSheet } from '../../../components/MobileBottomSheet';

export default function MobileWorkbookActionsSheet({ open, onClose, workbook, canWrite, onOpen, onDuplicate, onDelete }) {
    return <MobileActionSheet
        open={open}
        onClose={onClose}
        title={workbook?.name || 'Workbook actions'}
        actions={[
            { id: 'open', label: 'Open workbook', icon: FileSpreadsheet, onSelect: onOpen },
            { id: 'export', label: 'Open to export', icon: FileDown, onSelect: onOpen },
            ...(canWrite ? [
                { id: 'duplicate', label: 'Duplicate workbook', icon: Copy, onSelect: onDuplicate },
                { id: 'delete', label: 'Delete workbook', icon: Trash2, danger: true, onSelect: onDelete },
            ] : []),
        ]}
    />;
}
