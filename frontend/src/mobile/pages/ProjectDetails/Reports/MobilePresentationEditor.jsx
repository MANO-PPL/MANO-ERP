import React, { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { customToast } from '../../../../components/Toast';
import MobileBottomSheet from '../../../components/MobileBottomSheet';
import MobileConfirmModal from '../../../components/MobileConfirmModal';
import MobileSelect from '../../../components/MobileSelect';
import MobileStickyActions from '../../../components/MobileStickyActions';
import {
    addPresentationTableColumn, addPresentationTableRow, canDeleteSlide,
    deletePresentationTableColumn, deletePresentationTableRow,
    editPresentationChartItem, editPresentationTableCell, editPresentationTableHeader,
    moveSlide, presentationFilename, presentationTableField,
} from './mobileReportsModel';

const makeSlide = (id, title, text = 'Tap Edit to change this local slide.') => ({
    id, title, text, hidden: false, notes: '', background: '#ffffff', color: '#111827',
    fontSize: 18, bold: false, italic: false, align: 'center', image: '', table: null, chartData: null,
});

const initialSlides = (report) => {
    const slides = Array.from({ length: 15 }, (_, index) => makeSlide(
        `slide-${index + 1}`,
        index === 0 ? report?.month || 'Monthly Report' : `Report section ${index + 1}`,
        index === 0 ? 'Executive presentation' : undefined,
    ));
    slides[2] = { ...slides[2], title: 'Project Directory', table: {
        type: 'directory_table', headers: ['Role', 'Name', 'Company', 'Contact'], rows: [
            { role: 'Project Manager', name: 'John Doe', company: 'BuildCorp', contact: '+91 9876543210' },
            { role: 'Site Engineer', name: 'Jane Smith', company: 'BuildCorp', contact: '+91 8765432109' },
        ],
    } };
    slides[5] = { ...slides[5], title: 'Monthly Labour Distribution', chartData: [
        { label: 'Mason', value: 520000, color: '#3B82F6' },
        { label: 'Labour', value: 310000, color: '#10B981' },
    ] };
    return slides;
};

function SlidePreview({ slide, globalImages, exportSlide = false }) {
    const max = Math.max(...(slide.chartData || []).map((item) => item.value), 1);
    return <div
        {...(exportSlide ? { 'data-m10-export-slide': true } : { 'data-m10-slide-preview': true })}
        className="relative aspect-video w-full overflow-hidden rounded-2xl p-6 shadow"
        style={{ background: slide.background, color: slide.color, textAlign: slide.align }}
    >
        {globalImages.header && <img src={globalImages.header} alt="Presentation header" className="absolute left-2 top-2 h-8 max-w-[40%] object-contain" />}
        {slide.image && <img src={slide.image} alt="Slide" className="mx-auto mb-2 max-h-[34%] max-w-[70%] object-contain" />}
        <h3 style={{ fontSize: slide.fontSize, fontWeight: slide.bold ? '800' : '600', fontStyle: slide.italic ? 'italic' : 'normal' }}>{slide.title}</h3>
        <p className="mt-2 text-sm">{slide.text}</p>
        {slide.table && <div data-m10-table-preview className="mt-3 space-y-1 rounded-lg border border-current/20 p-2 text-left text-[9px]">
            <p className="truncate font-semibold">{slide.table.headers.join(' · ')}</p>
            {slide.table.rows.slice(0, 3).map((row, rowIndex) => <p key={rowIndex} className="truncate">{slide.table.headers.map((_, columnIndex) => row[presentationTableField(slide.table, columnIndex)] ?? '').join(' · ')}</p>)}
        </div>}
        {slide.chartData && <div data-m10-chart-preview className="mt-3 space-y-1.5 text-left text-[9px]">
            {slide.chartData.map((item, itemIndex) => <div key={itemIndex}>
                <div className="flex justify-between"><span>{item.label}</span><span>₹{(item.value / 100000).toFixed(2)}L</span></div>
                <div className="h-2 rounded-full bg-black/10"><div className="h-2 rounded-full" style={{ width: `${Math.max(0, item.value / max) * 100}%`, background: item.color }} /></div>
            </div>)}
        </div>}
        {globalImages.footer && <img src={globalImages.footer} alt="Presentation footer" className="absolute bottom-2 right-2 h-7 max-w-[40%] object-contain" />}
    </div>;
}

function TableEditor({ table, onChange }) {
    return <div data-m10-table-editor className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onChange(addPresentationTableRow(table))} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Add row</button>
            <button onClick={() => onChange(deletePresentationTableRow(table))} disabled={table.rows.length <= 1} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card disabled:opacity-40">Delete last row</button>
            <button onClick={() => onChange(addPresentationTableColumn(table))} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Add column</button>
            <button onClick={() => onChange(deletePresentationTableColumn(table))} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Delete last column</button>
        </div>
        <section className="space-y-2"><h4 className="text-xs font-semibold text-gray-900 dark:text-gh-text">Columns</h4>{table.headers.map((header, columnIndex) => <label key={columnIndex} className="block text-xs font-medium text-gray-700 dark:text-gh-text">Column {columnIndex + 1}<input aria-label={`Table column ${columnIndex + 1}`} value={header} onChange={(event) => onChange(editPresentationTableHeader(table, columnIndex, event.target.value))} className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-xs font-normal dark:border-gh-border" /></label>)}</section>
        <section className="space-y-2.5"><h4 className="text-xs font-semibold text-gray-900 dark:text-gh-text">Rows</h4>{table.rows.map((row, rowIndex) => <article key={rowIndex} className="rounded-lg border border-gray-200 p-2.5 dark:border-gh-border"><p className="mb-1.5 text-xs font-medium uppercase text-gray-500">Row {rowIndex + 1}</p><div className="space-y-2">{table.headers.map((header, columnIndex) => {
            const field = presentationTableField(table, columnIndex);
            const numeric = ['plannedQty', 'executedQty', 'variance', 'completionPercentage'].includes(field);
            return <label key={columnIndex} className="block text-xs font-medium text-gray-700 dark:text-gh-text">{header}<input aria-label={`Table row ${rowIndex + 1} ${header}`} type={numeric ? 'number' : 'text'} value={row[field] ?? ''} onChange={(event) => onChange(editPresentationTableCell(table, rowIndex, columnIndex, event.target.value))} className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-xs font-normal dark:border-gh-border" /></label>;
        })}</div></article>)}</section>
    </div>;
}

function ChartEditor({ chartData, onChange }) {
    return <div data-m10-chart-editor className="space-y-2.5">{chartData.map((item, index) => <article key={index} className="rounded-lg border border-gray-200 p-2.5 dark:border-gh-border"><p className="mb-1.5 text-xs font-medium uppercase text-gray-500">Series {index + 1}</p><label className="block text-xs font-medium text-gray-700 dark:text-gh-text">Label<input aria-label={`Chart label ${index + 1}`} value={item.label} onChange={(event) => onChange(editPresentationChartItem(chartData, index, 'label', event.target.value))} className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-xs font-normal dark:border-gh-border" /></label><label className="mt-1.5 block text-xs font-medium text-gray-700 dark:text-gh-text">Value in lakhs<input aria-label={`Chart value ${index + 1}`} inputMode="decimal" value={(item.value / 100000).toString()} onChange={(event) => onChange(editPresentationChartItem(chartData, index, 'value', event.target.value))} className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-xs font-normal dark:border-gh-border" /></label></article>)}</div>;
}

export default function MobilePresentationEditor({ open, onClose, report, canWrite = true }) {
    const [slides, setSlides] = useState(() => initialSlides(report));
    const [index, setIndex] = useState(0);
    const [tool, setTool] = useState(null);
    const [presenting, setPresenting] = useState(false);
    const [confirm, setConfirm] = useState(false);
    const [globalImages, setGlobalImages] = useState({ header: '', footer: '' });
    useEffect(() => { if (open) { setSlides(initialSlides(report)); setIndex(0); setTool(null); setPresenting(false); setConfirm(false); setGlobalImages({ header: '', footer: '' }); } }, [open, report]);
    const slide = slides[index];
    const patch = (data) => canWrite && setSlides((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...data } : row));
    const readImage = (file, field, target = 'slide') => { if (!canWrite || !file) return; const reader = new FileReader(); reader.onload = () => target === 'slide' ? patch({ [field]: reader.result }) : setGlobalImages((value) => ({ ...value, [field]: reader.result })); reader.readAsDataURL(file); };
    const add = () => { if (!canWrite) return; setSlides((rows) => [...rows, makeSlide(`slide-${Date.now()}`, 'New Blank Slide', '')]); setIndex(slides.length); customToast.success('New slide added.', 'Slide'); };
    const duplicate = () => { if (!canWrite) return; const copy = typeof structuredClone === 'function' ? structuredClone(slide) : JSON.parse(JSON.stringify(slide)); copy.id = `slide-${Date.now()}`; copy.title = `${copy.title} copy`; setSlides((rows) => [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)]); setIndex(index + 1); customToast.success('Slide duplicated.', 'Slide'); };
    const remove = () => { if (!canWrite || !canDeleteSlide(slides)) return; setSlides((rows) => rows.filter((_, rowIndex) => rowIndex !== index)); setIndex(Math.max(0, index - 1)); setConfirm(false); customToast.info('Slide removed.', 'Slide'); };
    const exportPdf = async () => {
        try {
            const nodes = [...document.querySelectorAll('[data-m10-export-slide]')];
            if (!nodes.length) {
                customToast.warning('No slides found to export.', 'Presentation');
                return;
            }
            customToast.info('Generating PDF presentation...', 'Presentation');
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [1280, 720] });
            for (const [pageIndex, node] of nodes.entries()) {
                if (pageIndex) pdf.addPage([1280, 720], 'landscape');
                pdf.addImage(await toPng(node), 'PNG', 0, 0, 1280, 720);
            }
            pdf.save(presentationFilename(report?.month));
            customToast.success('Presentation PDF exported.', 'Presentation');
        } catch (err) {
            console.error('Failed to export presentation', err);
            customToast.error('Failed to export presentation PDF.', 'Presentation');
        }
    };
    if (!open) return null;
    const preview = <SlidePreview slide={slide} globalImages={globalImages} />;
    if (presenting) return <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex flex-col bg-black p-4 text-white"><button onClick={() => setPresenting(false)} className="min-h-9 self-end px-3 text-xs font-semibold">Close</button><div className="flex flex-1 items-center justify-center">{preview}</div><div className="flex justify-between"><button disabled={!index} onClick={() => setIndex(index - 1)} className="min-h-9 px-3 text-xs font-semibold">Previous</button><button disabled={index === slides.length - 1} onClick={() => setIndex(index + 1)} className="min-h-9 px-3 text-xs font-semibold">Next</button></div></div>;
    return <div data-m10-presentation className="fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto bg-gray-100 p-2 sm:p-3 pb-24 dark:bg-gh-bg">
        <div aria-hidden="true" className="fixed left-[-10000px] top-0 w-[1280px]">{slides.filter((item) => !item.hidden).map((item) => <SlidePreview key={item.id} slide={item} globalImages={globalImages} exportSlide />)}</div>
        <header className="flex items-center justify-between gap-2"><button onClick={onClose} className="min-h-9 px-2 text-xs font-normal">Close</button><h2 className="truncate text-xs font-semibold text-gray-900 dark:text-gh-text">Presentation Editor</h2><button onClick={exportPdf} className="min-h-9 px-2 text-xs font-semibold text-blue-600">Export PDF</button></header>
        <p className="mb-2 text-xs font-normal text-gray-500">Local editor only. Changes are not saved or synchronized.</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1.5">{slides.map((item, slideIndex) => <button key={item.id} onClick={() => setIndex(slideIndex)} className={`min-h-8 shrink-0 rounded-lg border px-2.5 text-xs font-normal ${slideIndex === index ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30' : ''}`}>{slideIndex + 1}. {item.title}{item.hidden ? ' (hidden)' : ''}</button>)}</div>
        <div className="mt-2">{preview}</div>
        <textarea disabled={!canWrite} aria-label="Presenter notes" value={slide.notes} onChange={(event) => patch({ notes: event.target.value })} className="mt-2 min-h-20 w-full rounded-lg border border-gray-200 bg-white p-2.5 text-xs font-normal disabled:opacity-60 dark:border-gh-border dark:bg-gh-input" placeholder="Presenter notes" />
        {canWrite && <div className="mt-2 grid grid-cols-2 gap-1.5"><button onClick={() => setTool('text')} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Edit text</button><button onClick={add} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Add Slide</button><button onClick={duplicate} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Duplicate</button><button onClick={() => patch({ hidden: !slide.hidden })} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">{slide.hidden ? 'Show' : 'Hide'}</button><button disabled={!index} onClick={() => { setSlides(moveSlide(slides, index, index - 1)); setIndex(index - 1); }} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Move earlier</button><button disabled={index === slides.length - 1} onClick={() => { setSlides(moveSlide(slides, index, index + 1)); setIndex(index + 1); }} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Move later</button><button onClick={() => setTool('design')} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Design &amp; media</button>{slide.table && <button onClick={() => setTool('table')} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Edit Table</button>}{slide.chartData && <button onClick={() => setTool('chart')} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gh-border dark:text-gh-text dark:hover:bg-gh-card">Edit Chart Data</button>}<button onClick={() => setConfirm(true)} disabled={!canDeleteSlide(slides)} className="min-h-9 rounded-lg border border-red-300 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">Delete</button></div>}
        <MobileStickyActions><button onClick={() => setPresenting(true)} className="min-h-9 flex-1 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700">Present</button></MobileStickyActions>
        <MobileBottomSheet open={tool === 'text'} onClose={() => setTool(null)} title="Text editor"><label className="text-xs font-medium text-gray-700 dark:text-gh-text">Title<input value={slide.title} onChange={(event) => patch({ title: event.target.value })} className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-xs font-normal dark:border-gh-border" /></label><label className="mt-2 block text-xs font-medium text-gray-700 dark:text-gh-text">Text<textarea value={slide.text} onChange={(event) => patch({ text: event.target.value })} className="mt-1 min-h-20 w-full rounded-lg border border-gray-200 bg-transparent p-2 text-xs font-normal dark:border-gh-border" /></label><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs font-medium text-gray-700 dark:text-gh-text">Font size<input type="number" min="8" max="72" value={slide.fontSize} onChange={(event) => patch({ fontSize: Number(event.target.value) })} className="mt-1 min-h-9 w-full rounded-lg border border-gray-200 bg-transparent px-3 text-xs font-normal" /></label><label className="text-xs font-medium text-gray-700 dark:text-gh-text">Text color<input type="color" value={slide.color} onChange={(event) => patch({ color: event.target.value })} className="mt-1 min-h-9 w-full" /></label><button onClick={() => patch({ bold: !slide.bold })} className="min-h-9 rounded-lg border border-gray-200 text-xs font-semibold">Bold</button><button onClick={() => patch({ italic: !slide.italic })} className="min-h-9 rounded-lg border border-gray-200 text-xs italic">Italic</button></div><MobileSelect label="Text alignment" value={slide.align} onChange={(event) => patch({ align: event.target.value })} options={[{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }]} /></MobileBottomSheet>
        <MobileBottomSheet open={tool === 'design'} onClose={() => setTool(null)} title="Slide design and media"><div className="space-y-2 text-xs"><label className="block font-medium">Background<input type="color" value={slide.background} onChange={(event) => patch({ background: event.target.value })} className="mt-1 min-h-9 w-full" /></label><label className="block font-medium">Insert image<input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], 'image')} className="mt-1 min-h-9 w-full" /></label><label className="block font-medium">Global header image<input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], 'header', 'global')} className="mt-1 min-h-9 w-full" /></label><label className="block font-medium">Global footer image<input type="file" accept="image/*" onChange={(event) => readImage(event.target.files?.[0], 'footer', 'global')} className="mt-1 min-h-9 w-full" /></label></div></MobileBottomSheet>
        <MobileBottomSheet open={tool === 'table'} onClose={() => setTool(null)} title="Edit Table">{slide.table && <TableEditor table={slide.table} onChange={(table) => patch({ table })} />}</MobileBottomSheet>
        <MobileBottomSheet open={tool === 'chart'} onClose={() => setTool(null)} title="Edit Chart Data">{slide.chartData && <ChartEditor chartData={slide.chartData} onChange={(chartData) => patch({ chartData })} />}</MobileBottomSheet>
        <MobileConfirmModal open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} danger title="Delete slide" message="This removes the slide from the current local presentation." />
    </div>;
}
