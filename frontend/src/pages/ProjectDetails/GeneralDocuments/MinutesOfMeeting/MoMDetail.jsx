import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Plus, Trash2, ChevronRight } from 'lucide-react';
import { motion, Reorder, AnimatePresence } from 'framer-motion';

// --- Reusable Input Components ---
const ResizableInput = ({ value, onChange, placeholder = "", className = "", minW = "50px" }) => (
    <div className="inline-grid w-fit max-w-full items-center align-middle relative">
        <span className={`invisible col-start-1 row-start-1 whitespace-pre pointer-events-none min-h-[26px] flex items-center ${className}`} style={{ minWidth: minW }}>
            {value || placeholder || ' '}
        </span>
        <input
            className={`absolute inset-0 w-full h-full bg-transparent border-0 outline-none text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500/50 rounded transition-all ${className}`}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
        />
    </div>
);

const ResizableTextarea = ({ value, onChange, placeholder = "", className = "" }) => (
    <div className="grid w-full items-start align-top relative min-w-0 flex-1">
        {/* Invisible span for auto-height, perfectly matching textarea padding/font/line-height */}
        <div
            className={`invisible col-start-1 row-start-1 whitespace-pre-wrap break-words min-h-[40px] px-1 py-1 w-full ${className}`}
        >
            {value || placeholder || ' '}
            {/* Adding an extra line break ensures empty lines at the end render correctly for sizing */}
            {value && value.endsWith('\n') ? <br /> : null}
        </div>
        <textarea
            className={`col-start-1 row-start-1 w-full h-full resize-none overflow-hidden bg-transparent border-0 outline-none text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500/50 rounded px-1 py-1 transition-all ${className}`}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            style={{ margin: 0 }}
        />
    </div>
);


const MoMDetail = ({ onBack, setExtraBreadcrumbs, momId: id }) => {
    const { id: projectId } = useParams();

    // Form State
    const [details, setDetails] = useState({
        subject: '',
        meetingNo: '',
        venue: '',
        date: ''
    });

    const [participants, setParticipants] = useState([
        { id: 1, organization: '241 Design Studio', responsibility: 'Nothing', representatives: 'Latika SSR' },
        { id: 2, organization: 'Test', responsibility: 'Chai', representatives: 'Mano KAKOOS' },
        { id: 3, organization: '"u" Know Urself', responsibility: 'Who Knows', representatives: 'Tp MANAGER' }
    ]);

    const [points, setPoints] = useState([
        { id: 1, slNo: '1', description: 'MANO discussed following points with teams...', status: 'P', targetDate: '-', actionBy: '-' },
        { id: 2, slNo: '1.1', description: 'Delay in submission of MEP...', status: 'P', targetDate: '-', actionBy: '-' },
        { id: 3, slNo: '1.2', description: 'Tender Documents not done as per...', status: 'P', targetDate: '-', actionBy: '-' },
    ]);

    // Mock Load Data
    useEffect(() => {
        if (id && id !== 'new') {
            // In a real app, fetch from API here. For now, populating mock data matching the screenshot.
            setDetails({
                subject: 'kakooos',
                meetingNo: '23',
                venue: 'con room',
                date: '12-01-2026'
            });
        }
    }, [id]);

    useEffect(() => {
        setExtraBreadcrumbs([
            { label: 'General Documents', onClick: onBack },
            { label: 'Minutes of Meeting', onClick: onBack },
            { label: id === 'new' ? 'New MoM' : details.subject || 'Edit MoM' }
        ]);
    }, [onBack, setExtraBreadcrumbs, id, details.subject]);

    const handleSave = () => {
        // Save logic here
        onBack();
    };

    // --- Participants Actions ---
    const addParticipant = () => {
        setParticipants([...participants, { id: Date.now(), organization: '', responsibility: '', representatives: '' }]);
    };

    const removeParticipant = (pid) => {
        setParticipants(participants.filter(p => p.id !== pid));
    };

    const updateParticipant = (pid, field, value) => {
        setParticipants(participants.map(p => p.id === pid ? { ...p, [field]: value } : p));
    };

    // --- Points Actions ---
    const addPoint = () => {
        // Find highest main integer point
        const highestMain = points.reduce((max, p) => {
            const num = parseInt(p.slNo);
            return (!isNaN(num) && !p.slNo.includes('.') && num > max) ? num : max;
        }, 0);
        const newSlNo = `${highestMain + 1}`;
        setPoints([...points, { id: Date.now(), slNo: newSlNo, description: '', status: '', targetDate: '', actionBy: '' }]);
    };

    const addSubPoint = (index, parentSlNo) => {
        // Find existing subpoints for this parent to determine the next number
        const prefix = parentSlNo + '.';
        const subPoints = points.filter(p => p.slNo.startsWith(prefix));

        // Find highest existing subpoint number, default to 0 so next is .1
        const highestSub = subPoints.reduce((max, p) => {
            const suffix = p.slNo.split('.').pop();
            const num = parseInt(suffix);
            return (!isNaN(num) && num > max) ? num : max;
        }, 0);

        const newSlNo = `${parentSlNo}.${highestSub + 1}`;
        const newPoint = { id: Date.now(), slNo: newSlNo, description: '', status: '', targetDate: '', actionBy: '' };

        // Insert immediately after the parent or its existing subpoints
        const newPoints = [...points];
        // Insert at index + 1 + length of existing subpoints to keep them grouped visually
        newPoints.splice(index + subPoints.length + 1, 0, newPoint);
        setPoints(newPoints);
    };

    const removePoint = (pid) => {
        setPoints(points.filter(p => p.id !== pid));
    };

    const updatePoint = (pid, field, value) => {
        setPoints(points.map(p => p.id === pid ? { ...p, [field]: value } : p));
    };

    return (
        <div className="flex-1 flex flex-col bg-[#fafafa] dark:bg-[#0d1117] font-sans text-gray-900 dark:text-gray-700 dark:text-gray-300 transition-colors overflow-hidden">
            {/* Top Bar */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#0d1117] sticky top-0 z-10 w-full">
                <button
                    onClick={onBack}
                    className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:text-white transition-colors text-sm font-medium px-2 py-1.5"
                >
                    <X size={16} />
                    <span>Cancel</span>
                </button>
                <button
                    onClick={handleSave}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-md font-medium text-sm transition-colors shadow-sm"
                >
                    <Plus size={16} />
                    <span>Save Changes</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <div className="w-full space-y-6">

                    {/* Section 1: Edit Details */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden flex flex-col shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10">
                            <h2 className="text-gray-900 dark:text-white font-bold text-[15px]">Edit Details</h2>
                        </div>
                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                            {/* Subject */}
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs text-gray-500 font-medium tracking-wide">Subject</label>
                                <div className="bg-white dark:bg-[#1c222b] border border-gray-200 dark:border-gray-700/50 rounded-md p-1 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white px-2 py-1 text-sm placeholder-gray-400 dark:placeholder-gray-600"
                                        value={details.subject}
                                        onChange={(e) => setDetails({ ...details, subject: e.target.value })}
                                        placeholder="Enter subject..."
                                    />
                                </div>
                            </div>
                            {/* Meeting No */}
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs text-gray-500 font-medium tracking-wide">Meeting No</label>
                                <div className="bg-white dark:bg-[#1c222b] border border-gray-200 dark:border-gray-700/50 rounded-md p-1 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white px-2 py-1 text-sm placeholder-gray-400 dark:placeholder-gray-600"
                                        value={details.meetingNo}
                                        onChange={(e) => setDetails({ ...details, meetingNo: e.target.value })}
                                    />
                                </div>
                            </div>
                            {/* Venue */}
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs text-gray-500 font-medium tracking-wide">Venue</label>
                                <div className="bg-white dark:bg-[#1c222b] border border-gray-200 dark:border-gray-700/50 rounded-md p-1 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white px-2 py-1 text-sm placeholder-gray-400 dark:placeholder-gray-600"
                                        value={details.venue}
                                        onChange={(e) => setDetails({ ...details, venue: e.target.value })}
                                    />
                                </div>
                            </div>
                            {/* Date */}
                            <div className="flex flex-col space-y-1.5">
                                <label className="text-xs text-gray-500 font-medium tracking-wide">Date</label>
                                <div className="bg-white dark:bg-[#1c222b] border border-gray-200 dark:border-gray-700/50 rounded-md p-1 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all flex items-center pr-2">
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white px-2 py-1 text-sm placeholder-gray-400 dark:placeholder-gray-600"
                                        value={details.date}
                                        onChange={(e) => setDetails({ ...details, date: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Participants */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden flex flex-col shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22]">
                            <h2 className="text-gray-900 dark:text-white font-bold text-[15px]">Participants</h2>
                            <button
                                onClick={addParticipant}
                                className="flex items-center space-x-1 bg-blue-600/90 hover:bg-blue-500 text-gray-900 dark:text-white px-2 py-1 rounded-md text-xs font-medium transition-colors"
                            >
                                <Plus size={14} />
                                <span>Add</span>
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm table-fixed whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500 bg-gray-100 dark:bg-[#12161c]">
                                        <th className="px-5 py-2 w-1/3 text-xs font-medium hidden sm:table-cell">Organization</th>
                                        <th className="px-5 py-2 w-1/3 text-xs font-medium hidden sm:table-cell">Responsibility</th>
                                        <th className="px-5 py-2 w-1/3 text-xs font-medium">Representatives</th>
                                        <th className="px-2 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <AnimatePresence>
                                        {participants.map((p) => (
                                            <motion.tr
                                                key={p.id}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="border-b border-gray-200 dark:border-white/10/50 group/row hover:bg-gray-800/10"
                                            >
                                                <td className="px-5 py-2">
                                                    <ResizableInput
                                                        value={p.organization}
                                                        onChange={(e) => updateParticipant(p.id, 'organization', e.target.value)}
                                                        className="font-medium text-gray-700 dark:text-gray-300 w-full"
                                                        minW="100%"
                                                    />
                                                </td>
                                                <td className="px-5 py-2 hidden sm:table-cell text-gray-600 dark:text-gray-400">
                                                    <ResizableInput
                                                        value={p.responsibility}
                                                        onChange={(e) => updateParticipant(p.id, 'responsibility', e.target.value)}
                                                        className="text-gray-600 dark:text-gray-400 w-full"
                                                        minW="100%"
                                                    />
                                                </td>
                                                <td className="px-5 py-2 text-gray-600 dark:text-gray-400">
                                                    <ResizableInput
                                                        value={p.representatives}
                                                        onChange={(e) => updateParticipant(p.id, 'representatives', e.target.value)}
                                                        className="text-gray-600 dark:text-gray-400 w-full"
                                                        minW="100%"
                                                    />
                                                </td>
                                                <td className="px-2 py-2 text-right">
                                                    <button
                                                        onClick={() => removeParticipant(p.id)}
                                                        className="text-red-500/70 hover:text-red-500 p-1 opacity-0 group-hover/row:opacity-100 transition-all rounded hover:bg-red-500/10"
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Section 3: Points */}
                    <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden flex flex-col shadow-sm">
                        <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-[#161b22]">
                            <h2 className="text-gray-900 dark:text-white font-bold text-[15px]">Points</h2>
                            <button
                                onClick={addPoint}
                                className="flex items-center space-x-1 bg-blue-600/90 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                            >
                                <span>Add Main Point</span>
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500 bg-gray-100 dark:bg-[#12161c]">
                                        <th className="px-5 py-3 w-[60px] text-xs font-medium text-center">Sl No.</th>
                                        <th className="px-5 py-3 min-w-[300px] text-xs font-medium">Description</th>
                                        <th className="px-2 py-3 w-[40px] text-xs font-medium text-center">S</th>
                                        <th className="px-4 py-3 w-[140px] text-xs font-medium text-center">Target Date</th>
                                        <th className="px-4 py-3 w-[180px] text-xs font-medium">Action By</th>
                                        <th className="px-2 py-3 w-[100px] text-xs font-medium text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <Reorder.Group axis="y" values={points} onReorder={setPoints} as="tbody">
                                        <AnimatePresence>
                                            {points.map((pt) => (
                                                <Reorder.Item
                                                    key={pt.id}
                                                    value={pt}
                                                    as="tr"
                                                    className="border-b border-gray-200 dark:border-white/10/50 group/row hover:bg-gray-800/10 align-top"
                                                >
                                                    <td className="px-4 py-4 text-center text-gray-600 dark:text-gray-400 font-medium align-top">
                                                        <div className="flex flex-col items-center justify-start h-full">
                                                            <div className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600 flex items-center justify-center opacity-0 group-hover/row:opacity-100 cursor-grab mb-2 transition-opacity">
                                                                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
                                                            </div>
                                                            <input
                                                                value={pt.slNo}
                                                                onChange={(e) => updatePoint(pt.id, 'slNo', e.target.value)}
                                                                className="w-10 bg-transparent text-center font-bold outline-none focus:bg-white dark:bg-[#1c222b] focus:ring-1 focus:ring-blue-500/50 rounded py-0.5 transition-colors text-xs"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-4 align-top">
                                                        <div className="w-full group-hover/row:bg-white dark:bg-[#1c222b]/30 rounded-lg p-2 transition-colors border border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:bg-[#1c222b] h-full flex flex-col">
                                                            <ResizableTextarea
                                                                value={pt.description}
                                                                onChange={(e) => updatePoint(pt.id, 'description', e.target.value)}
                                                                className="text-gray-800 dark:text-gray-200 w-full min-h-[44px] flex-1 text-sm pt-0"
                                                                placeholder="Enter description..."
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-4 text-center align-top">
                                                        <div className="w-full group-hover/row:bg-white dark:bg-[#1c222b]/30 rounded-lg p-2 transition-colors border border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:bg-[#1c222b] h-full flex items-center justify-center">
                                                            <input
                                                                value={pt.status}
                                                                onChange={(e) => updatePoint(pt.id, 'status', e.target.value)}
                                                                className="w-full bg-transparent text-center font-bold outline-none focus:ring-1 focus:ring-blue-500/50 rounded py-1 transition-colors text-gray-700 dark:text-gray-300 text-sm"
                                                                placeholder="-"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center align-top">
                                                        <div className="w-full group-hover/row:bg-white dark:bg-[#1c222b]/30 rounded-lg p-2 transition-colors border border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:bg-[#1c222b] h-full flex flex-col mx-auto">
                                                            <input
                                                                value={pt.targetDate}
                                                                onChange={(e) => updatePoint(pt.id, 'targetDate', e.target.value)}
                                                                className="w-full bg-transparent text-center text-gray-600 dark:text-gray-400 outline-none focus:ring-1 focus:ring-blue-500/50 rounded transition-all text-sm"
                                                                placeholder="-"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 align-top">
                                                        <div className="w-full group-hover/row:bg-white dark:bg-[#1c222b]/30 rounded-lg p-2 transition-colors border border-transparent focus-within:border-blue-500/30 focus-within:bg-white dark:bg-[#1c222b] h-full flex flex-col">
                                                            <input
                                                                value={pt.actionBy}
                                                                onChange={(e) => updatePoint(pt.id, 'actionBy', e.target.value)}
                                                                className="w-full bg-transparent text-gray-600 dark:text-gray-400 outline-none focus:ring-1 focus:ring-blue-500/50 rounded transition-all text-sm"
                                                                placeholder="-"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-3">
                                                        <div className="flex flex-col items-center justify-center space-y-2 h-full opacity-0 group-hover/row:opacity-100 transition-opacity p-2">
                                                            <button
                                                                onClick={() => addSubPoint(points.findIndex(p => p.id === pt.id), pt.slNo)}
                                                                className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 rounded transition-colors p-1"
                                                                title="Add Sub-point"
                                                            >
                                                                <Plus size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => removePoint(pt.id)}
                                                                className="text-red-500/80 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors p-1"
                                                                title="Delete Point"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </Reorder.Item>
                                            ))}
                                        </AnimatePresence>
                                    </Reorder.Group>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Notes Section */}
                    <div className="bg-orange-50 dark:bg-[#1e170c] border border-orange-900/50 rounded-lg p-4 shadow-sm text-orange-800 dark:text-orange-200/90 text-sm mt-2">
                        <strong className="text-orange-500 font-bold mb-2 block text-xs">NOTE :</strong>
                        <ol className="list-decimal pl-5 space-y-1 text-xs">
                            <li>In case of any missing points or discrepancy, respective stakeholders are requested to highlight the issues within 24 hours of circulation of this MOM and unless notified, the contents of this MOM stands final and fully justified.</li>
                            <li>All communications / correspondence shall be done via mail strictly. Other mode of communication will not be entertained.</li>
                        </ol>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default MoMDetail;
