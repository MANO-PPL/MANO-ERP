export const VENDOR_CATEGORIES = Object.freeze([
    'Consultant', 'Contractor', 'Supplier', 'Manufacturer', 'Service Provider', 'Other',
]);

const value = (row, keys) => keys.map((key) => row?.[key]).find((item) => item !== undefined && item !== null && item !== '');

export function normalizeVendor(vendor = {}) {
    return {
        ...vendor,
        id: vendor.id,
        name: String(vendor.name || '').trim(),
        category: vendor.category || 'Contractor',
        jobNature: vendor.job_name || vendor.job_nature || '',
        contactNumber: vendor.contact_no || vendor.telephone_no || vendor.mobile || '',
    };
}

export function filterVendors(vendors, { query = '', categories = [], jobs = [] } = {}) {
    const needle = query.trim().toLowerCase();
    return vendors.filter((vendor) => {
        if (categories.length && !categories.includes(vendor.category)) return false;
        if (jobs.length && !jobs.includes(vendor.jobNature)) return false;
        if (!needle) return true;
        return [vendor.name, vendor.category, vendor.jobNature, vendor.contact_person, vendor.contactNumber,
            vendor.email, vendor.location].some((field) => String(field || '').toLowerCase().includes(needle));
    });
}

export function vendorFormValues(vendor = {}) {
    vendor = vendor || {};
    return {
        name: vendor.name || '', category: vendor.category || '', contact_person: vendor.contact_person || '',
        designation: vendor.designation || '', email: vendor.email || '',
        contact_no: vendor.contact_no || vendor.telephone_no || '', mobile: vendor.mobile || '',
        website: vendor.website || '', gst_no: vendor.gst_no || '', address: vendor.address || '',
        reference: vendor.reference || '', responsibility: vendor.responsibility || '', remarks: vendor.remarks || '',
        job_nature: vendor.job_name || vendor.job_nature || '', location: vendor.location || '',
    };
}

export function buildVendorPayload(form) {
    return Object.fromEntries(Object.entries(form).map(([key, item]) => [key, typeof item === 'string' ? item.trim() : item]));
}

export function normalizeVendorImportRows(rows, validation = {}) {
    const duplicates = validation.duplicates || [];
    return rows.map((row, index) => {
        const rowNumber = index + 1;
        const issues = duplicates.filter((item) => Number(item.row) === rowNumber).map((item) => item.reason);
        const name = value(row, ['Name', 'name', 'Company', 'company']);
        if (!name) issues.push('Missing Name');
        return {
            ...row,
            rowNumber,
            name: name || '',
            email: value(row, ['Email', 'email']) || '',
            contact_no: value(row, ['Contact No', 'contact no', 'Mobile', 'mobile', 'Telephone', 'telephone']) || '',
            jobNature: value(row, ['Job Nature', 'job nature', 'job_nature', 'Nature of Job', 'nature of job']) || '',
            issues,
            status: issues.length ? 'Error' : 'Valid',
        };
    });
}
