import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileCard from '../../components/MobileCard';

export default function MobileVendorDetail({ vendor, open, onClose, canWrite, onEdit, onDelete }) {
    if (!vendor) return null;
    const rows = [['Nature of job', vendor.jobNature], ['Contact person', vendor.contact_person], ['Designation', vendor.designation], ['GST number', vendor.gst_no], ['Responsibility', vendor.responsibility], ['Reference', vendor.reference], ['Website', vendor.website]];
    return <MobileBottomSheet open={open} onClose={onClose} title={vendor.name} description={vendor.category || 'Vendor'} footer={canWrite && <div className="flex gap-2"><button onClick={() => onDelete(vendor)} className="min-h-9 flex-1 rounded-lg border border-red-200 text-xs font-semibold text-red-600">Delete</button><button onClick={() => onEdit(vendor)} className="min-h-9 flex-1 rounded-lg bg-blue-600 text-xs font-semibold text-white">Edit</button></div>}>
        <div className="space-y-2" data-mobile-detail="vendor">
            <MobileCard className="space-y-1.5 p-2.5 sm:p-3">{vendor.contactNumber && <a className="flex min-h-8 items-center gap-2 text-xs font-normal text-blue-600 dark:text-blue-400" href={`tel:${vendor.contactNumber}`}><Phone size={15} />{vendor.contactNumber}</a>}{vendor.email && <a className="flex min-h-8 items-center gap-2 text-xs font-normal text-blue-600 dark:text-blue-400" href={`mailto:${vendor.email}`}><Mail size={15} />{vendor.email}</a>}{vendor.location && <p className="flex items-center gap-2 text-xs font-normal text-gray-700 dark:text-gh-muted"><MapPin size={15} />{vendor.location}</p>}</MobileCard>
            <MobileCard className="divide-y divide-gray-100 p-2.5 sm:p-3 dark:divide-gh-border">{rows.filter(([, item]) => item).map(([label, item]) => <div key={label} className="py-1.5"><p className="text-[10px] font-normal text-gray-500">{label}</p><p className="mt-0.5 break-words text-xs font-medium text-gray-900 dark:text-gh-text">{item}</p></div>)}</MobileCard>
            {vendor.address && <MobileCard className="p-2.5 sm:p-3"><p className="text-[10px] font-normal text-gray-500">Address</p><p className="mt-1 text-xs font-normal text-gray-900 dark:text-gh-text">{vendor.address}</p></MobileCard>}
            {vendor.remarks && <MobileCard className="p-2.5 sm:p-3"><p className="text-[10px] font-normal text-gray-500">Remarks</p><p className="mt-1 text-xs font-normal text-gray-900 dark:text-gh-text">{vendor.remarks}</p></MobileCard>}
        </div>
    </MobileBottomSheet>;
}
