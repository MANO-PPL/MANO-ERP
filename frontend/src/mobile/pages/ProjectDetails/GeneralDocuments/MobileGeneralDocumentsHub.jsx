import React from 'react';
import { Building2, CalendarDays, Contact, FileText, Network } from 'lucide-react';
import { MobileEntityCard } from '../../../components/MobileCard';

const entries = [
    ['parties', 'Project Parties', 'Linked organisations and CRM contacts', Building2],
    ['directory', 'Project Directory', 'Project contact details and responsibilities', Contact],
    ['summary', 'Project Summary', 'Milestones, dates, and status updates', FileText],
    ['meetings', 'Project Meetings', 'Agenda, minutes, participants, and attendance', CalendarDays],
    ['organisation', 'Organisation Chart', 'Project, party, and contact hierarchy', Network],
];

export default function MobileGeneralDocumentsHub({ counts = {}, onSelect }) {
    return <div data-m6-view="hub" className="space-y-3 px-4 pb-28">{entries.map(([key, title, description, Icon]) => <MobileEntityCard key={key} title={title} description={description} icon={Icon} onClick={() => onSelect(key)} meta={counts[key] == null ? 'Not loaded' : `${counts[key]} record${counts[key] === 1 ? '' : 's'}`} />)}</div>;
}
