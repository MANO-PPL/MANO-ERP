import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CAL_EVENTS, DAYS, MONTHS } from '../../../pages/Collaboration/constants';
import MobileCard from '../../components/MobileCard';
import MobileEmptyState from '../../components/MobileEmptyState';
import { calendarGrid, eventsForDay, upcomingEvents } from './mobileCollaborationModel';

export default function MobileCalendar() {
    const today = new Date();
    const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [selectedDay, setSelectedDay] = useState(today.getDate());
    const grid = useMemo(() => calendarGrid(cursor.year, cursor.month), [cursor]);
    const selected = eventsForDay(CAL_EVENTS, selectedDay);
    const upcoming = upcomingEvents(CAL_EVENTS).slice(0, 6);
    const move = (delta) => setCursor((current) => { const date = new Date(current.year, current.month + delta, 1); return { year: date.getFullYear(), month: date.getMonth() }; });
    const reset = () => { setCursor({ year: today.getFullYear(), month: today.getMonth() }); setSelectedDay(today.getDate()); };
    return <div className="space-y-4 px-4 pb-[calc(var(--mobile-agent-clearance,4.75rem)+1rem)]" data-mobile-collaboration-calendar>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Demo Schedule — Static preview data. Calendar changes are not saved. Events repeat by day number across displayed months.</div>
        <MobileCard><div className="flex items-center justify-between gap-2"><button type="button" aria-label="Previous month" onClick={() => move(-1)} className="min-h-11 min-w-11 rounded-xl border border-gray-200 dark:border-gh-border"><ChevronLeft className="mx-auto" size={20} /></button><div className="text-center"><h2 className="font-extrabold">{MONTHS[cursor.month]} {cursor.year}</h2><button type="button" onClick={reset} className="mt-1 min-h-11 px-3 text-xs font-bold text-blue-600">Today</button></div><button type="button" aria-label="Next month" onClick={() => move(1)} className="min-h-11 min-w-11 rounded-xl border border-gray-200 dark:border-gh-border"><ChevronRight className="mx-auto" size={20} /></button></div>
            <div className="mt-3 grid grid-cols-7 gap-1">{DAYS.map((day) => <span key={day} className="py-1 text-center text-[10px] font-bold text-gray-500">{day}</span>)}{grid.map((day, index) => day == null ? <span key={`blank-${index}`} /> : <button key={day} type="button" aria-label={`Select day ${day}`} onClick={() => setSelectedDay(day)} className={`relative aspect-square min-h-11 rounded-xl text-xs font-bold ${selectedDay === day ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-gh-hover'}`}>{day}{eventsForDay(CAL_EVENTS, day).length > 0 && <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${selectedDay === day ? 'bg-white' : 'bg-blue-500'}`} />}</button>)}</div>
        </MobileCard>
        <section><h2 className="mb-2 text-sm font-bold">{MONTHS[cursor.month]} {selectedDay}</h2>{selected.length ? <div className="space-y-2">{selected.map((event) => <EventCard key={event.id} event={event} />)}</div> : <MobileEmptyState title="No events for this day" description="The static source has no schedule entry for this day." />}</section>
        <section><h2 className="mb-2 text-sm font-bold">Upcoming preview</h2><div className="space-y-2">{upcoming.map((event) => <button key={event.id} type="button" onClick={() => setSelectedDay(event.day)} className="w-full text-left"><EventCard event={event} day={event.day} /></button>)}</div></section>
    </div>;
}

function EventCard({ event, day }) { return <MobileCard className="p-3"><div className="flex gap-3"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${event.color}`} /><div><p className="text-sm font-bold">{event.title}</p><p className="mt-1 text-xs text-gray-500 dark:text-gh-muted">{day ? `Day ${day} · ` : ''}{event.time} · {event.who}</p></div></div></MobileCard>; }
