import React from 'react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileCard from '../../components/MobileCard';

export default function MobileResourceDetail({ resource, open, onClose, canWrite, onEdit, onDelete, onOpenTab }) {
    if (!resource) return null;
    const rate = resource.rate ?? resource.resolved_rate ?? resource.current_rate;
    return <MobileBottomSheet open={open} onClose={onClose} title={resource.name} description={`${resource.type} · ${resource.base_unit_code || 'No unit'}`} footer={canWrite && <div className="flex gap-2"><button onClick={() => onDelete(resource)} className="min-h-11 flex-1 rounded-xl border border-red-200 text-sm font-bold text-red-600">Delete</button><button onClick={() => onEdit(resource)} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white">Edit</button></div>}>
        <div className="space-y-3" data-mobile-detail="resource">
            <MobileCard className="grid grid-cols-2 gap-3"><div><p className="text-[10px] font-bold uppercase text-gray-500">Code</p><p className="mt-1 font-mono text-sm">{resource.code || '-'}</p></div><div><p className="text-[10px] font-bold uppercase text-gray-500">Current rate</p><p className="mt-1 text-sm font-bold">{rate === undefined || rate === null ? 'Not available' : `₹${Number(rate).toLocaleString('en-IN')}`}</p></div></MobileCard>
            {resource.description && <MobileCard><p className="text-xs font-bold text-gray-500">Description</p><p className="mt-2 text-sm">{resource.description}</p></MobileCard>}
            {resource.remarks && <MobileCard><p className="text-xs font-bold text-gray-500">Remarks</p><p className="mt-2 text-sm">{resource.remarks}</p></MobileCard>}
            <MobileCard><p className="text-xs font-bold text-gray-500">Related workspaces</p><div className="mt-2 grid grid-cols-3 gap-2">{resource.type === 'item' && <button onClick={() => onOpenTab('recipes')} className="min-h-11 rounded-xl bg-purple-50 px-2 text-xs font-bold text-purple-700 dark:bg-purple-950/40">Recipe</button>}<button onClick={() => onOpenTab('rates')} className="min-h-11 rounded-xl bg-blue-50 px-2 text-xs font-bold text-blue-700 dark:bg-blue-950/40">Rates</button><button onClick={() => onOpenTab('conversions')} className="min-h-11 rounded-xl bg-gray-100 px-2 text-xs font-bold dark:bg-gh-bg">Conversions</button></div></MobileCard>
            <MobileCard><p className="text-xs font-bold text-gray-500">Current conversions</p><p className="mt-2 text-sm">{resource.conversions?.length || 0} named scale{resource.conversions?.length === 1 ? '' : 's'}</p></MobileCard>
        </div>
    </MobileBottomSheet>;
}
