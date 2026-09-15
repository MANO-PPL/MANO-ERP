export const GENERAL_DOCUMENTS_VIEWS = Object.freeze(['hub', 'parties', 'directory', 'summary', 'meetings', 'organisation']);

export function resolveGeneralDocumentsView(value) {
    return GENERAL_DOCUMENTS_VIEWS.includes(value) ? value : 'hub';
}

export function normalizeAvailableParties(response = {}) {
    return response.available_parties || response.parties || [];
}

export function areAllForbidden(results = []) {
    const rejected = results.filter((result) => result?.status === 'rejected');
    return rejected.length > 0 && rejected.length === results.length && rejected.every((result) => result.reason?.response?.status === 403);
}

export function normalizeDirectory(response = {}) {
    return (response.directory || []).map((item) => ({
        id: item.pd_id ?? item.id,
        partyId: item.party_id ?? item.pv_id ?? null,
        companyName: item.company_name || item.name || '', category: item.category || '', jobNature: item.job_nature || '',
        contactPerson: item.contact_person || '', designation: item.designation || '', responsibilities: item.responsibilities || '',
        mobileNo: item.mobile_no || '', email: item.email || '', addressLine: item.address_line || '', raw: item,
    }));
}

export function directoryPayload(form = {}) {
    const partyId = form.partyId || form.party_id || form.pv_id || null;
    return { party_id: partyId, pv_id: partyId, contact_person: form.contactPerson || form.contact_person || '', designation: form.designation || '', responsibilities: form.responsibilities || '', mobile_no: form.mobileNo || form.mobile_no || '', email: form.email || '', address_line: form.addressLine || form.address_line || '' };
}

export function summaryPayload(form = {}, id) {
    const payload = { title: form.title || '', date: form.date || null, status: form.status || '', details: form.details || '' };
    return id == null ? payload : { id, ...payload };
}

export function meetingPayload(form = {}) {
    const agenda = (form.agenda_points || []).filter((point) => point?.point?.trim()).map((point, index) => ({ sl_no: index + 1, point: point.point.trim() }));
    const mom = (form.mom_points || []).filter((point) => point?.point?.trim()).map((point, index) => ({ sl_no: index + 1, point: point.point.trim() }));
    const participants = (form.participants || []).map((person) => ({ pd_id: person.pd_id, attended: person.attended !== false }));
    const attendance = Object.fromEntries(participants.map((person) => [person.pd_id, person.attended ? 'present' : 'absent']));
    return { subject: (form.subject || '').trim(), meeting_no: form.meeting_no ? Number(form.meeting_no) : undefined, venue: (form.venue || '').trim(), date: form.date || '', time: form.time || '', participants, agenda_points: agenda, mom_points: mom, content: { time: form.time || '', attendance, agenda_points: agenda, mom_points: mom } };
}

export function createGeneralDocumentsRequestGuard() {
    let generation = 0; let activeKey = '';
    return { begin(projectId, service) { generation += 1; activeKey = `${projectId}:${service || 'default'}`; return { generation, key: activeKey }; }, isCurrent(token) { return token?.generation === generation && token?.key === activeKey; } };
}
