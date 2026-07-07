import React, { useState } from 'react';
import {
    Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon
} from 'lucide-react';
import {
    CAL_EVENTS, MONTHS, DAYS
} from './constants';

export default function Calendar({ activeTab, setActiveTab }) {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [selectedDay, setSelectedDay] = useState(today.getDate());
    const [showAddEvent, setShowAddEvent] = useState(false);
    const [newEvent, setNewEvent] = useState({ title: '', time: '', attendees: '', color: 'bg-blue-500' });

    const colorOptions = [
        { label: 'Blue', value: 'bg-blue-500' },
        { label: 'Green', value: 'bg-green-500' },
        { label: 'Purple', value: 'bg-purple-500' },
        { label: 'Orange', value: 'bg-orange-500' },
        { label: 'Red', value: 'bg-red-500' },
        { label: 'Pink', value: 'bg-pink-500' },
    ];

    const handleAddEvent = (e) => {
        e.preventDefault();
        setShowAddEvent(false);
        setNewEvent({ title: '', time: '', attendees: '', color: 'bg-blue-500' });
    };

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysBefore = Array(firstDay).fill(null);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const grid = [...daysBefore, ...daysArray];

    const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

    const selectedEvents = CAL_EVENTS[selectedDay] || [];
    const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    return (
        <div className="flex flex-1 overflow-hidden">
            {/* Calendar Grid */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Tab Bar Integration */}
                <div className="flex-shrink-0 px-6 pt-5 pb-3 bg-white dark:bg-[#0d1117]">
                    <div className="inline-flex p-0.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
                        {['chat', 'calendar'].map(tabId => (
                            <button
                                key={tabId}
                                onClick={() => setActiveTab(tabId)}
                                className={`flex items-center px-4 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === tabId
                                    ? 'bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {tabId.charAt(0).toUpperCase() + tabId.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 p-6 pt-0 overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{MONTHS[month]} {year}</h2>
                            <p className="text-sm text-gray-500 mt-0.5">Team schedule and upcoming meetings</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={prevMonth} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                                <ChevronLeft size={15} />
                            </button>
                            <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); setSelectedDay(today.getDate()); }} className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                                Today
                            </button>
                            <button onClick={nextMonth} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                                <ChevronRight size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Day labels */}
                    <div className="grid grid-cols-7 mb-2">
                        {DAYS.map(d => (
                            <div key={d} className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center py-2">{d}</div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-1 flex-1">
                        {grid.map((day, idx) => {
                            if (!day) return <div key={`empty-${idx}`} />;
                            const events = CAL_EVENTS[day] || [];
                            const selected = day === selectedDay;
                            const todayCell = isToday(day);
                            return (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDay(day)}
                                    className={`min-h-[140px] p-1.5 rounded-xl text-left border transition-all flex flex-col ${selected
                                        ? 'border-blue-500/60 bg-blue-50 dark:bg-blue-500/10'
                                        : 'border-gray-100 dark:border-white/5 bg-white dark:bg-white/[0.02] hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-1.5">
                                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${todayCell ? 'bg-blue-600 text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                                            {day}
                                        </span>
                                    </div>
                                    <div className="flex-1 space-y-1 w-full">
                                        {events.slice(0, 4).map(ev => (
                                            <div key={ev.id} className={`${ev.color} text-white text-[9px] font-semibold px-2 py-0.5 rounded-md truncate w-full shadow-sm`}>
                                                {ev.title}
                                            </div>
                                        ))}
                                        {events.length > 4 && (
                                            <div className="text-[9px] text-gray-400 dark:text-gray-500 pl-1">+{events.length - 4} more</div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right: Day Detail */}
            <aside className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-white/5 flex flex-col bg-white dark:bg-[#0d1117]">
                {/* Header */}
                <div className="p-5 border-b border-gray-200 dark:border-white/5 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {MONTHS[month]} {selectedDay}, {year}
                        </p>
                        <button
                            onClick={() => setShowAddEvent(v => !v)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${showAddEvent ? 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                        >
                            <Plus size={12} /> {showAddEvent ? 'Cancel' : 'Event'}
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">{selectedEvents.length === 0 ? 'No events scheduled' : `${selectedEvents.length} event${selectedEvents.length !== 1 ? 's' : ''}`}</p>
                </div>

                {/* Add Event Form */}
                {showAddEvent && (
                    <div className="border-b border-gray-200 dark:border-white/5 flex-shrink-0 bg-white dark:bg-[#161b22]">
                        <form onSubmit={handleAddEvent} className="p-4 space-y-3">
                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-2">New Event</p>

                            {/* Title */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                                <input
                                    required
                                    value={newEvent.title}
                                    onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))}
                                    placeholder="e.g. Site Inspection"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                                />
                            </div>

                            {/* Time */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Time</label>
                                <input
                                    type="time"
                                    value={newEvent.time}
                                    onChange={e => setNewEvent(v => ({ ...v, time: e.target.value }))}
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-800 dark:text-gray-200 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                                />
                            </div>

                            {/* Attendees */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Attendees</label>
                                <input
                                    value={newEvent.attendees}
                                    onChange={e => setNewEvent(v => ({ ...v, attendees: e.target.value }))}
                                    placeholder="e.g. Madhavan, Mano"
                                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                                />
                            </div>

                            {/* Color */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Colour</label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {colorOptions.map(c => (
                                        <button
                                            key={c.value}
                                            type="button"
                                            onClick={() => setNewEvent(v => ({ ...v, color: c.value }))}
                                            className={`w-6 h-6 rounded-full ${c.value} transition-all ${newEvent.color === c.value ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#161b22] scale-110' : 'opacity-70 hover:opacity-100'}`}
                                            title={c.label}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2 rounded-lg transition-colors mt-1"
                            >
                                Add Event
                            </button>
                        </form>
                    </div>
                )}

                {/* Events list */}
                <div className="flex-1 p-4 space-y-3 overflow-y-auto custom-scrollbar">
                    {selectedEvents.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
                                <CalendarIcon size={22} className="text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-500">No events</p>
                            <p className="text-xs text-gray-400 mt-1">Click the + Event button to add one</p>
                        </div>
                    ) : selectedEvents.map(ev => (
                        <div key={ev.id} className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl p-4 hover:border-blue-400/40 transition-colors cursor-pointer group">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ev.color}`} />
                                <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">{ev.title}</p>
                            </div>
                            <div className="space-y-1 pl-4">
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="font-medium">Time:</span> {ev.time}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="font-medium">Attendees:</span> {ev.who}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Upcoming summary */}
                <div className="p-4 border-t border-gray-200 dark:border-white/5 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Upcoming This Month</p>
                    <div className="space-y-2">
                        {Object.entries(CAL_EVENTS).sort(([a], [b]) => Number(a) - Number(b)).slice(0, 4).map(([day, evs]) => evs.map(ev => (
                            <button key={ev.id} onClick={() => setSelectedDay(Number(day))} className="w-full flex items-center gap-2.5 text-left hover:bg-gray-100 dark:hover:bg-white/5 p-1.5 rounded-lg transition-colors">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.color}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{ev.title}</p>
                                    <p className="text-[10px] text-gray-400">{MONTHS[month].slice(0, 3)} {day} · {ev.time}</p>
                                </div>
                            </button>
                        )))}
                    </div>
                </div>
            </aside>
        </div>
    );
}
