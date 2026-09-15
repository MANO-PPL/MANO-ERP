import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ImagePlus, LoaderCircle, Sparkles, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { adminApi } from '../../../services/adminApi';
import { projectApi } from '../../../services/projectApi.js';
import { customToast } from '../../../utils/toast';
import MobileDatePicker from '../../components/MobileDatePicker';
import MobileFormSection from '../../components/MobileFormSection';
import MobilePageHeader from '../../components/MobilePageHeader';
import MobileSelect from '../../components/MobileSelect';
import MobileStickyActions from '../../components/MobileStickyActions';
import { createRequestLoader } from '../../utils/createRequestLoader';
import {
    buildCreateProjectPayload,
    buildUpdateProjectPayload,
    getCreatedProjectId,
    normalizeProject,
} from './projectModel';

const EMPTY_FORM = {
    name: '',
    projectCode: '',
    description: '',
    location: '',
    startDate: '',
    endDate: '',
    status: 'active',
};

const inputClass = 'min-h-11 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gh-border dark:bg-gh-input dark:text-gh-text';

function formFromProject(project) {
    if (!project) return EMPTY_FORM;
    const normalized = project.raw ? project : normalizeProject(project);
    return {
        name: normalized.name || '',
        projectCode: normalized.code || '',
        description: normalized.description || '',
        location: normalized.location || '',
        startDate: normalized.startDate || '',
        endDate: normalized.endDate || '',
        status: normalized.status || 'active',
    };
}

export default function MobileProjectForm({
    mode = 'create',
    project,
    presentation = 'page',
    onCancel,
    onSaved,
    authOverride,
    projectService = projectApi,
    adminService = adminApi,
}) {
    const auth = useAuth();
    const navigate = useNavigate();
    const activeAuth = authOverride || auth;
    const isEdit = mode === 'edit';
    const formId = useId();
    const fileInputRef = useRef(null);
    const [form, setForm] = useState(() => formFromProject(project));
    const [metadata, setMetadata] = useState(project?.metadata || {});
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(project?.logoUrl || '');
    const [employees, setEmployees] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [originalMemberIds, setOriginalMemberIds] = useState([]);
    const [memberQuery, setMemberQuery] = useState('');
    const [membersLoading, setMembersLoading] = useState(true);
    const [loading, setLoading] = useState(isEdit);
    const [submitting, setSubmitting] = useState(false);
    const [loadError, setLoadError] = useState('');
    const canWrite = activeAuth.hasPermission('projects', 2);
    const projectId = project?.id ?? project?.dbId;

    const loadInitialData = useMemo(() => createRequestLoader(async () => {
        const usersRequest = adminService.getUsers().catch(() => ({ success: false, users: [] }));
        if (!isEdit) return { usersResponse: await usersRequest };

        const [projectResponse, usersResponse, membersResponse] = await Promise.all([
            projectService.getProject(projectId),
            usersRequest,
            projectService.getProjectMembers(projectId).catch(() => ({ success: false, members: [] })),
        ]);
        return { projectResponse, usersResponse, membersResponse };
    }), [adminService, isEdit, projectId, projectService]);

    useEffect(() => {
        if (!canWrite || (isEdit && !projectId)) {
            setLoading(false);
            setMembersLoading(false);
            return undefined;
        }
        let active = true;
        if (isEdit) setLoading(true);
        setMembersLoading(true);
        setLoadError('');

        loadInitialData().then(({ projectResponse, usersResponse, membersResponse }) => {
            if (!active) return;
            const users = usersResponse?.success && Array.isArray(usersResponse.users) ? usersResponse.users : [];
            setEmployees(users);
            if (!isEdit) return;
            if (!projectResponse?.success || !projectResponse.project) throw new Error(projectResponse?.message || 'Project details unavailable');
            const normalized = normalizeProject(projectResponse.project);
            const memberIds = membersResponse?.success && Array.isArray(membersResponse.members)
                ? membersResponse.members.map((member) => Number(member.user_id)).filter(Number.isFinite)
                : [];
            setForm(formFromProject(normalized));
            setMetadata(normalized.metadata);
            setLogoPreview(normalized.logoUrl);
            setSelectedMemberIds(memberIds);
            setOriginalMemberIds(memberIds);
        }).catch((error) => {
            if (active && isEdit) setLoadError(error?.message || 'Project details unavailable');
        }).finally(() => {
            if (active) {
                setLoading(false);
                setMembersLoading(false);
            }
        });

        return () => { active = false; };
    }, [canWrite, isEdit, loadInitialData, projectId]);

    useEffect(() => () => {
        if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    }, [logoPreview]);

    const duration = useMemo(() => {
        if (!form.startDate || !form.endDate) return null;
        const days = Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / 86400000);
        if (!Number.isFinite(days)) return null;
        return days < 0 ? 'End date precedes start date' : `${days} days`;
    }, [form.endDate, form.startDate]);

    const visibleEmployees = useMemo(() => {
        const query = memberQuery.trim().toLowerCase();
        if (!query) return employees;
        return employees.filter((employee) => [employee.user_name, employee.email, employee.user_type]
            .some((value) => String(value || '').toLowerCase().includes(query)));
    }, [employees, memberQuery]);

    const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

    const generateCode = () => {
        const initials = form.name.trim().split(/\s+/).filter(Boolean).map((word) => word[0]?.toUpperCase()).join('').slice(0, 4);
        if (!initials) {
            customToast.info('Enter a project name first to generate a code', 'Notice');
            return;
        }
        const year = new Date().getFullYear().toString().slice(-2);
        updateField('projectCode', `${initials}-${year}${Math.floor(10 + Math.random() * 90)}`);
    };

    const selectLogo = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            customToast.error('Please upload a valid image file', 'Invalid File');
            event.target.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            customToast.error('Logo file size must be less than 5MB', 'File Too Large');
            event.target.value = '';
            return;
        }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const removeLogo = () => {
        setLogoFile(null);
        setLogoPreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const syncMembers = async () => {
        if (!isEdit || !projectId) return;
        const selected = new Set(selectedMemberIds);
        const original = new Set(originalMemberIds);
        const additions = [...selected].filter((userId) => !original.has(userId));
        const removals = [...original].filter((userId) => !selected.has(userId));
        await Promise.all([
            ...additions.map((userId) => projectService.assignProjectMember(projectId, { user_id: userId })),
            ...removals.map((userId) => projectService.removeProjectMember(projectId, userId)),
        ]);
    };

    const cancel = onCancel || (() => navigate('/projects'));
    const saved = onSaved || (() => navigate('/projects'));

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!canWrite || submitting) return;
        if (!form.name.trim()) {
            customToast.error('Project Name is required', 'Validation Error');
            return;
        }
        setSubmitting(true);
        let savedProjectId = projectId;
        let baseSaved = false;
        try {
            if (isEdit) {
                const response = await projectService.updateProject(projectId, buildUpdateProjectPayload(form, metadata));
                if (!response?.success) throw new Error(response?.message || 'Failed to update project');
                baseSaved = true;
                await syncMembers();
            } else {
                const response = await projectService.createProject(buildCreateProjectPayload(form, activeAuth.user, selectedMemberIds));
                if (!response?.success) throw new Error(response?.message || 'Failed to create project');
                savedProjectId = getCreatedProjectId(response);
                baseSaved = true;
            }

            if (logoFile && savedProjectId) {
                try {
                    await projectService.uploadProjectLogo(savedProjectId, logoFile);
                } catch {
                    customToast.warning('Project saved, but the logo upload failed.', 'Partial Save');
                }
            }

            customToast.success(isEdit ? 'Project updated successfully' : `Project "${form.name.trim()}" created successfully`, isEdit ? 'Project Updated' : 'Project Created');
            saved({ id: savedProjectId, mode: isEdit ? 'edit' : 'create' });
        } catch (error) {
            const message = error?.response?.data?.message || error?.message || 'Failed to save project';
            customToast.error(baseSaved ? `Project details were saved, but a follow-up operation failed: ${message}` : message, baseSaved ? 'Partial Save' : 'Save Failed');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-4 text-sm text-gray-500 dark:text-gh-muted"><LoaderCircle className="mr-2 inline animate-spin" size={18} aria-hidden="true" />Loading project details…</div>;
    if (loadError) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{loadError}</p>;

    const actions = (
        <div className={`flex w-full gap-2 ${presentation === 'sheet' ? 'pt-3' : ''}`}>
            <button type="button" onClick={cancel} className="min-h-11 flex-1 rounded-xl border border-gray-200 px-4 text-sm font-semibold dark:border-gh-border">Cancel</button>
            <button type="submit" form={formId} disabled={!canWrite || submitting} className="min-h-11 flex-[1.4] rounded-xl bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50">
                {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create project'}
            </button>
        </div>
    );

    const formElement = (
        <form id={formId} onSubmit={handleSubmit} className="space-y-4" data-project-form-mode={isEdit ? 'edit' : 'create'}>
            <MobileFormSection title="Project information" description="Core project identity and location.">
                <div>
                    <label htmlFor={`${formId}-name`} className="mb-1.5 block text-xs font-semibold">Project name *</label>
                    <input id={`${formId}-name`} required value={form.name} onChange={(event) => updateField('name', event.target.value)} className={inputClass} placeholder="Project name" />
                </div>
                <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                        <label htmlFor={`${formId}-code`} className="text-xs font-semibold">Project code</label>
                        {!isEdit && <button type="button" onClick={generateCode} className="inline-flex min-h-11 items-center gap-1 px-2 text-xs font-bold text-blue-600 dark:text-blue-400"><Sparkles size={14} aria-hidden="true" />Generate</button>}
                    </div>
                    <input id={`${formId}-code`} value={form.projectCode} onChange={(event) => updateField('projectCode', event.target.value)} className={inputClass} placeholder="Project code" />
                </div>
                <div>
                    <label htmlFor={`${formId}-description`} className="mb-1.5 block text-xs font-semibold">Description</label>
                    <textarea id={`${formId}-description`} rows={4} value={form.description} onChange={(event) => updateField('description', event.target.value)} className={`${inputClass} py-3`} placeholder="Project scope and key deliverables" />
                </div>
                <div>
                    <label htmlFor={`${formId}-location`} className="mb-1.5 block text-xs font-semibold">Location</label>
                    <input id={`${formId}-location`} value={form.location} onChange={(event) => updateField('location', event.target.value)} className={inputClass} placeholder="City or site address" />
                </div>
            </MobileFormSection>

            {!isEdit && (
                <MobileFormSection title="Initial status">
                    <MobileSelect
                        label="Status"
                        value={form.status}
                        onChange={(event) => updateField('status', event.target.value)}
                        options={[
                            { value: 'active', label: 'Active - Ongoing work' },
                            { value: 'planning', label: 'Planning - Pre-construction' },
                            { value: 'on-hold', label: 'On hold - Pending approval' },
                        ]}
                    />
                </MobileFormSection>
            )}

            <MobileFormSection title="Timeline and schedule" description={duration ? `Project duration: ${duration}` : undefined}>
                <MobileDatePicker label="Start date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} />
                <MobileDatePicker label="Target end date" value={form.endDate} onChange={(event) => updateField('endDate', event.target.value)} />
            </MobileFormSection>

            <MobileFormSection title="Project logo" description="PNG, JPG, WEBP or SVG, up to 5MB.">
                {logoPreview && <img src={logoPreview} alt="Selected project logo preview" className="h-28 w-full rounded-xl border border-gray-200 object-contain p-2 dark:border-gh-border" />}
                <div className="flex gap-2">
                    <label className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold dark:border-gh-border">
                        <ImagePlus size={18} aria-hidden="true" />Choose image
                        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={selectLogo} className="sr-only" />
                    </label>
                    {logoPreview && <button type="button" aria-label="Remove selected logo" onClick={removeLogo} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-red-200 text-red-600 dark:border-red-900 dark:text-red-300"><Trash2 size={18} aria-hidden="true" /></button>}
                </div>
            </MobileFormSection>

            {canWrite && (
                <MobileFormSection title="Project members" description={membersLoading ? 'Loading employees…' : `${selectedMemberIds.length} selected`}>
                    <input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} className={inputClass} placeholder="Search employees" aria-label="Search employees" />
                    <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain">
                        {!membersLoading && visibleEmployees.map((employee) => {
                            const userId = Number(employee.user_id);
                            const selected = selectedMemberIds.includes(userId);
                            return (
                                <label key={employee.user_id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-gray-50 dark:hover:bg-gh-hover">
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => setSelectedMemberIds((current) => selected ? current.filter((item) => item !== userId) : [...current, userId])}
                                        className="h-5 w-5 rounded border-gray-300"
                                    />
                                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{employee.user_name}</span><span className="block truncate text-xs text-gray-500 dark:text-gh-muted">{employee.user_type || employee.email}</span></span>
                                </label>
                            );
                        })}
                        {membersLoading && <p role="status" className="py-4 text-center text-xs text-gray-500 dark:text-gh-muted">Loading employees…</p>}
                        {!membersLoading && visibleEmployees.length === 0 && <p className="py-4 text-center text-xs text-gray-500 dark:text-gh-muted">No employees found</p>}
                    </div>
                </MobileFormSection>
            )}

            {presentation === 'page' ? <MobileStickyActions>{actions}</MobileStickyActions> : actions}
        </form>
    );

    if (presentation === 'sheet') return formElement;
    return (
        <div data-mobile-page="project-form" className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28">
            <MobilePageHeader eyebrow="Projects" title="Create project" subtitle="Initialize a new project workspace." onBack={cancel} />
            {formElement}
        </div>
    );
}
