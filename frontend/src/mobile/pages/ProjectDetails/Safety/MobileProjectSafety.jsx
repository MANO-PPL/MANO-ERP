import React, { useState } from 'react';
import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    ClipboardCheck,
    FileText,
    HardHat,
    MapPin,
    Radio,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Users,
} from 'lucide-react';
import MobileCard from '../../../components/MobileCard';
import MobilePageHeader from '../../../components/MobilePageHeader';
import MobileTabs from '../../../components/MobileTabs';

const SAFETY_TABS = [
    { value: 'incidents', label: 'Incidents & Near-Misses', icon: AlertTriangle },
    { value: 'toolbox', label: 'Toolbox Talks', icon: Radio },
    { value: 'ppe', label: 'PPE Compliance', icon: Shield },
    { value: 'guidelines', label: 'Safety Guidelines', icon: FileText },
];

const MOCK_INCIDENTS = [
    {
        id: 1,
        title: 'Unsecured Scaffold Guard Rail Identified at Level 4',
        severity: 'Near Miss',
        location: 'Tower A / West Elevation Grid 2',
        date: '2026-08-27',
        description: 'Intermediate guardrail pipe was disconnected during shuttering removal.',
        correctiveAction: 'Immediate work stop. Scaffold pipe re-clamped with double couplers; supervisor issued safety warning.',
        status: 'Investigated & Closed',
    },
    {
        id: 2,
        title: 'Minor Finger Laceration while Handling Rebar Coil',
        severity: 'First Aid',
        location: 'Rebar Bending Yard',
        date: '2026-08-14',
        description: 'Worker sustained minor cut on right hand index finger while tying stirrup binding wire.',
        correctiveAction: 'First aid dressing administered immediately on site. Reinforced leather gloves issued to all bar benders.',
        status: 'Investigated & Closed',
    },
];

const MOCK_TALKS = [
    {
        id: 1,
        topic: 'Fall Protection & Double Lanyard Full-Body Harness Usage',
        conductor: 'HSE Officer Suresh Patel',
        attendeesCount: 142,
        date: '2026-08-30',
        keyPoints: '100% tie-off mandatory above 1.8m height; lifeline anchor inspection prior to climb.',
    },
    {
        id: 2,
        topic: 'Safe Deep Excavation & Trench Shoring Protocols',
        conductor: 'HSE Officer Suresh Patel',
        attendeesCount: 130,
        date: '2026-08-28',
        keyPoints: 'No un-shored entry beyond 1.5m; daily soil face inspection before morning shift.',
    },
];

const PPE_AUDITS = [
    { item: 'Safety Helmets (Hard Hats with Chin Straps)', compliance: '99%', status: 'Compliant', color: 'emerald' },
    { item: 'Steel-Toe High-Ankle Safety Boots', compliance: '98%', status: 'Compliant', color: 'emerald' },
    { item: 'High-Visibility Reflective Jackets', compliance: '100%', status: 'Compliant', color: 'emerald' },
    { item: 'Full-Body Double Lanyard Safety Harnesses', compliance: '95%', status: 'Audit Passed', color: 'blue' },
    { item: 'Cut-Resistant Rebar Hand Gloves & Goggles', compliance: '92%', status: 'Warning Issued', color: 'amber' },
];

const REFERENCE_DOCS = [
    { title: 'HS Plan', description: 'Health and safety planning documents for the project.', icon: ShieldCheck, type: 'Single Instance' },
    { title: 'Safety Guideline', description: 'Safety guidelines and standard practices.', icon: FileText, type: 'Single Instance' },
    { title: 'Incident & Near-Miss Reports', description: 'Existing ERP safety incident reference area.', icon: ShieldAlert, type: 'Episodic' },
    { title: 'Safety Inspection Checklists', description: 'Safety inspection checklist reference area.', icon: ClipboardCheck, type: 'Episodic' },
];

export default function MobileProjectSafety() {
    const [activeTab, setActiveTab] = useState('incidents');

    return (
        <section data-m7-module="Safety" className="w-full min-w-0">
            <MobilePageHeader
                eyebrow="PROJECT WORKSPACE"
                title="Safety"
                subtitle="Incidents, toolbox talks, and PPE compliance monitoring"
            />

            <div className="px-2 sm:px-3 pt-1">
                <MobileTabs
                    label="Safety sections"
                    value={activeTab}
                    onChange={setActiveTab}
                    items={SAFETY_TABS}
                />
            </div>

            <div className="w-full min-w-0 space-y-2.5 px-2 sm:px-3 pb-24 pt-2">
                {activeTab === 'incidents' && (
                    <div className="space-y-2.5">
                        {MOCK_INCIDENTS.map((inc) => (
                            <div
                                key={inc.id}
                                className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]"
                            >
                                <div className="flex items-start gap-2.5">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                                        <AlertTriangle size={18} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-xs font-bold leading-snug text-gray-900 dark:text-gh-text">
                                                {inc.title}
                                            </h3>
                                            <span className="shrink-0 rounded bg-orange-100/70 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                                                {inc.severity}
                                            </span>
                                        </div>
                                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gh-muted">
                                            <MapPin size={11} className="shrink-0 text-gray-400" />
                                            <span>{inc.location}</span>
                                            <span>•</span>
                                            <Calendar size={11} className="shrink-0 text-gray-400" />
                                            <span>{inc.date}</span>
                                        </p>
                                    </div>
                                </div>

                                <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gh-muted">
                                    {inc.description}
                                </p>

                                <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-emerald-50/80 p-2 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <p className="text-[11.5px] leading-snug">
                                        <span className="font-semibold">Corrective Action: </span>
                                        {inc.correctiveAction}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'toolbox' && (
                    <div className="space-y-2.5">
                        {MOCK_TALKS.map((talk) => (
                            <div
                                key={talk.id}
                                className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs dark:border-gh-border dark:bg-[#161B22]"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="text-xs font-bold leading-snug text-gray-900 dark:text-gh-text">
                                        {talk.topic}
                                    </h3>
                                    <span className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[10.5px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                        {talk.attendeesCount} Attendees
                                    </span>
                                </div>

                                <p className="mt-1 text-[11px] text-gray-500 dark:text-gh-muted">
                                    Conducted by: <span className="font-medium text-gray-700 dark:text-gh-text">{talk.conductor}</span> • Date: {talk.date}
                                </p>

                                <div className="mt-2 rounded-lg bg-gray-50 p-2 dark:bg-gh-bg">
                                    <p className="text-xs leading-relaxed text-gray-700 dark:text-gh-muted">
                                        <span className="font-semibold text-gray-900 dark:text-gh-text">Key Takeaways: </span>
                                        {talk.keyPoints}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'ppe' && (
                    <div className="space-y-2">
                        {PPE_AUDITS.map((p) => {
                            const isGreen = p.color === 'emerald';
                            const isBlue = p.color === 'blue';
                            const badgeColor = isGreen
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                                : isBlue
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900';

                            return (
                                <div
                                    key={p.item}
                                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gh-border dark:bg-[#161B22]"
                                >
                                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${badgeColor}`}>
                                        <HardHat size={18} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="truncate text-xs font-bold text-gray-900 dark:text-gh-text">
                                            {p.item}
                                        </h4>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gh-muted">
                                            Audit Status: <span className="font-semibold">{p.status}</span>
                                        </p>
                                    </div>
                                    <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                                        {p.compliance}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'guidelines' && (
                    <div className="space-y-2">
                        {REFERENCE_DOCS.map(({ title, description, icon: Icon, type }) => (
                            <MobileCard key={title}>
                                <div className="flex items-start gap-3">
                                    <span className="rounded-lg bg-orange-50 p-2 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300">
                                        <Icon size={18} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-xs font-semibold text-gray-950 dark:text-gh-text">
                                            {title}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] leading-4 font-normal text-gray-600 dark:text-gh-muted">
                                            {description}
                                        </span>
                                        <span className="mt-1.5 inline-block rounded bg-orange-100/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-800 dark:bg-orange-950/50 dark:text-orange-200">
                                            {type}
                                        </span>
                                    </div>
                                </div>
                            </MobileCard>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
