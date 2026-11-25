import React from 'react';
import { toast } from 'react-toastify';
import ReasonModal from './ReasonModal';

export default function PartyReasonModal({
    action, // { row, type: 'archive' | 'restore' | 'delete' } | null
    entityLabel = 'Party',
    onArchive,
    onRestore,
    onDelete,
    onClose,
    onSuccess
}) {
    const type = action?.type;
    const row = action?.row;

    const config = {
        delete: {
            title: `Delete ${entityLabel} "${row?.name}"`,
            subtitle: `This permanently removes the ${entityLabel.toLowerCase()} if unused. Linked records must be archived instead.`,
            placeholder: 'e.g. Test entry, Created by mistake...',
            confirmText: 'Delete Permanently',
            confirmCls: 'bg-rose-600 hover:bg-rose-700 text-white'
        },
        restore: {
            title: `Restore ${entityLabel} "${row?.name}"`,
            subtitle: `This will reactivate the ${entityLabel.toLowerCase()} and move it back to the Active tab.`,
            placeholder: 'e.g. Contract renewed, Re-engaged...',
            confirmText: `Restore ${entityLabel}`,
            confirmCls: 'bg-emerald-600 hover:bg-emerald-700 text-white'
        },
        archive: {
            title: `Archive ${entityLabel} "${row?.name}"`,
            subtitle: `Archiving hides this ${entityLabel.toLowerCase()} from active lists. You can restore it anytime from the Archived tab.`,
            placeholder: 'e.g. Closed account, Duplicate entry, Inactive...',
            confirmText: `Archive ${entityLabel}`,
            confirmCls: 'bg-amber-600 hover:bg-amber-700 text-white'
        }
    }[type || 'archive'];

    return (
        <ReasonModal
            isOpen={Boolean(action)}
            onClose={onClose}
            onConfirm={async (reason) => {
                if (!row) return;
                if (type === 'archive') {
                    await onArchive(row.id, reason);
                    toast.success(`Archived "${row.name}"`);
                } else if (type === 'restore') {
                    await onRestore(row.id, reason);
                    toast.success(`Restored "${row.name}"`);
                } else if (type === 'delete') {
                    await onDelete(row.id, reason);
                    toast.success(`Deleted "${row.name}"`);
                }
                onSuccess?.();
            }}
            {...config}
        />
    );
}
