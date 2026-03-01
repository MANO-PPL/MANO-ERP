import {
    FileText, Calendar, Activity
} from 'lucide-react';

export const CHANNELS = [
    { id: 1, name: 'general', type: 'public', unread: 3, description: 'Company-wide announcements and all org members' },
    { id: 2, name: 'project-hm1', type: 'public', unread: 0, description: 'HM-1 project discussions' },
    { id: 3, name: 'design-review', type: 'private', unread: 7, description: 'Private design review channel' },
    { id: 4, name: 'site-updates', type: 'public', unread: 0, description: 'Live site progress updates' },
    { id: 5, name: 'hr-announcements', type: 'private', unread: 1, description: 'HR and admin notices' },
];

export const DMS = [
    { id: 1, name: 'Madhavan', initials: 'LS', color: 'from-pink-500 to-rose-500', status: 'online', unread: 2 },
    { id: 2, name: 'Mano', initials: 'MK', color: 'from-blue-500 to-indigo-500', status: 'online', unread: 0 },
    { id: 3, name: 'Sathish', initials: 'TM', color: 'from-green-500 to-teal-500', status: 'away', unread: 0 },
    { id: 4, name: 'Admin', initials: 'AU', color: 'from-purple-500 to-violet-500', status: 'offline', unread: 0 },
];

export const CHANNEL_MESSAGES = {
    1: [
        { id: 1, author: 'Admin User', initials: 'AU', color: 'from-purple-500 to-violet-500', time: '10:00 AM', text: 'Good morning team! Monthly sync call is scheduled for Friday at 11 AM. Please come prepared with your project status updates.' },
        { id: 2, author: 'Latika SSR', initials: 'LS', color: 'from-pink-500 to-rose-500', time: '10:05 AM', text: "Got it! Will share the HM-1 drawing updates by Thursday." },
        { id: 3, author: 'Mano KAKOOS', initials: 'MK', color: 'from-blue-500 to-indigo-500', time: '10:12 AM', text: "Confirmed. I'll prepare the WIP summary and budget overview slides." },
        { id: 4, author: 'Tp MANAGER', initials: 'TM', color: 'from-green-500 to-teal-500', time: '10:18 AM', text: 'Looking forward to it!' },
    ],
    2: [
        { id: 2, author: 'Mano KAKOOS', initials: 'MK', color: 'from-blue-500 to-indigo-500', time: '9:30 AM', text: 'Reviewed. Found 2 discrepancies in the column alignment — shared notes in the file.' },
        { id: 3, author: 'Admin User', initials: 'AU', color: 'from-purple-500 to-violet-500', time: '9:45 AM', text: 'Thanks team. This needs to be resolved before the client presentation on Thursday.' },
    ],
    3: [
        { id: 1, author: 'Tp MANAGER', initials: 'TM', color: 'from-green-500 to-teal-500', time: 'Yesterday', text: 'Private design review started. Only team leads have access to this channel.' },
        { id: 2, author: 'Admin User', initials: 'AU', color: 'from-purple-500 to-violet-500', time: 'Yesterday', text: "Good idea. Let's use this to discuss sensitive design decisions before they go public." },
    ],
};

export const PINNED = [
    { icon: FileText, label: 'Q1 Project Report', type: 'File' },
    { icon: Calendar, label: 'Friday Sync - 11 AM', type: 'Event' },
    { icon: Activity, label: 'Live Draw Updates', type: 'Updates' },
];

export const CAL_EVENTS = {
    3: [{ id: 1, title: 'Site Inspection', time: '10:00 AM', color: 'bg-blue-500', who: 'LS, MK' }],
    5: [{ id: 2, title: 'Design Review', time: '2:00 PM', color: 'bg-purple-500', who: 'AU, TM' }],
    7: [{ id: 3, title: 'Client Meeting', time: '11:00 AM', color: 'bg-green-500', who: 'All' }],
    10: [{ id: 4, title: 'HM-1 Sync', time: '3:00 PM', color: 'bg-orange-500', who: 'MK, LS' }],
    14: [{ id: 5, title: 'Monthly Sync', time: '11:00 AM', color: 'bg-blue-500', who: 'All' }],
    18: [
        { id: 6, title: 'Budget Review', time: '9:00 AM', color: 'bg-red-500', who: 'AU' },
        { id: 7, title: 'QA Checklist', time: '3:00 PM', color: 'bg-teal-500', who: 'TM' },
    ],
    21: [{ id: 8, title: 'Contractor Brief', time: '4:00 PM', color: 'bg-indigo-500', who: 'LS, TM' }],
    25: [{ id: 9, title: 'Safety Audit', time: '10:30 AM', color: 'bg-pink-500', who: 'All' }],
    28: [{ id: 10, title: 'Sprint Planning', time: '1:00 PM', color: 'bg-amber-500', who: 'MK, AU' }],
};

export const statusColor = { online: 'bg-green-400', away: 'bg-yellow-400', offline: 'bg-gray-500' };
export const statusLabel = { online: 'Online', away: 'Away', offline: 'Offline' };
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
