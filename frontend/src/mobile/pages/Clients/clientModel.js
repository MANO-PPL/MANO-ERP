const value = (row, keys) => keys.map((key) => row?.[key]).find((item) => item !== undefined && item !== null && item !== '');

export const CLIENT_INTERACTION_TYPES = Object.freeze(['Call', 'WhatsApp', 'Email', 'Site Visit', 'Meeting']);

export function normalizeClient(client = {}) {
    return {
        ...client,
        id: client.id,
        name: String(client.name || '').trim(),
        jobNature: client.job_name || client.job_nature || '',
        sector: client.sector_name || client.sector || '',
        contactNumber: client.contact_no || client.telephone_no || client.mobile || '',
        interactions: Array.isArray(client.interactions) ? client.interactions : [],
    };
}

export function filterClients(clients, { query = '', jobs = [], sectors = [] } = {}) {
    const needle = query.trim().toLowerCase();
    return clients.filter((client) => {
        if (jobs.length && !jobs.includes(client.jobNature)) return false;
        if (sectors.length && !sectors.includes(client.sector)) return false;
        if (!needle) return true;
        return [client.name, client.jobNature, client.sector, client.contact_person, client.contactNumber,
            client.email, client.location].some((field) => String(field || '').toLowerCase().includes(needle));
    });
}

export function clientFormValues(client = {}) {
    client = client || {};
    return {
        name: client.name || '', contact_person: client.contact_person || '', designation: client.designation || '',
        email: client.email || '', contact_no: client.contact_no || client.telephone_no || '', website: client.website || '',
        address: client.address || '', location: client.location || '', job_nature: client.job_name || client.job_nature || '',
        sector: client.sector_name || client.sector || '', responsibility: client.responsibility || '',
        reference: client.reference || '', remarks: client.remarks || '',
    };
}

export function buildClientPayload(form) {
    return Object.fromEntries(Object.entries(form).map(([key, item]) => [key, typeof item === 'string' ? item.trim() : item]));
}

export function buildInteractionPayload(form) {
    return {
        type: form.type,
        interaction_date: form.interaction_date,
        follow_up_date: form.follow_up_date || '',
        remarks: String(form.remarks || '').trim(),
    };
}

export function normalizeClientImportRows(rows, validation = {}) {
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
            contact_no: value(row, ['Contact No', 'contact no', 'Telephone', 'telephone', 'Mobile', 'mobile']) || '',
            designation: value(row, ['Designation', 'designation']) || '',
            jobNature: value(row, ['Job Nature', 'job nature', 'job_nature', 'Nature of Job', 'nature of job']) || '',
            issues,
            status: issues.length ? 'Error' : 'Valid',
        };
    });
}
