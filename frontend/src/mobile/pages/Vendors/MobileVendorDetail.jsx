import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import MobileBottomSheet from '../../components/MobileBottomSheet';
import MobileCard from '../../components/MobileCard';

export default function MobileVendorDetail({ vendor, open, onClose, canWrite, onEdit, onDelete }) {
    if (!vendor) return null;
    const rows = [['Nature of job', vendor.jobNature], ['Contact person', vendor.contact_person], ['Designation', vendor.designation], ['GST number', vendor.gst_no], ['Responsibility', vendor.responsibility], ['Reference', vendor.reference], ['Website', vendor.website]];
    return <MobileBottomSheet open={open} onClose={onClose} title={vendor.name} description={vendor.category || 'Vendor'} footer={canWrite && <div className="flex gap-2"><button onClick={() => onDelete(vendor)} className="min-h-11 flex-1 rounded-xl border border-red-200 text-sm font-bold text-red-600">Delete</button><button onClick={() => onEdit(vendor)} className="min-h-11 flex-1 rounded-xl bg-blue-600 text-sm font-bold text-white">Edit</button></div>}>
        <div className="space-y-3" data-mobile-detail="vendor">
            <MobileCard className="space-y-2 p-3">{vendor.contactNumber && <a className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-600" href={`tel:${vendor.contactNumber}`}><Phone size={17} />{vendor.contactNumber}</a>}{vendor.email && <a className="flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-600" href={`mailto:${vendor.email}`}><Mail size={17} />{vendor.email}</a>}{vendor.location && <p className="flex items-center gap-2 text-sm"><MapPin size={17} />{vendor.location}</p>}</MobileCard>
            <MobileCard className="divide-y divide-gray-100 p-3 dark:divide-gh-border">{rows.filter(([, item]) => item).map(([label, item]) => <div key={label} className="py-2"><p className="text-[10px] font-bold uppercase text-gray-500">{label}</p><p className="mt-1 break-words text-sm">{item}</p></div>)}</MobileCard>
            {vendor.address && <MobileCard><p className="text-xs font-bold text-gray-500">Address</p><p className="mt-2 text-sm">{vendor.address}</p></MobileCard>}
            {vendor.remarks && <MobileCard><p className="text-xs font-bold text-gray-500">Remarks</p><p className="mt-2 text-sm">{vendor.remarks}</p></MobileCard>}
        </div>
    </MobileBottomSheet>;
}
