import React from 'react';
import { PERMISSION_LEVELS, SYSTEM_PERMISSION_TREE, defaultSystemPermissions } from './mobileAdminModel';

export default function MobilePermissionTree({ value = {}, onChange, readOnly = false }) {
    const permissions = defaultSystemPermissions(value);
    const row = (node, child = false) => <div key={node.id} className={`rounded-xl border border-gray-200 p-3 dark:border-gh-border ${child ? 'ml-4' : ''}`}>
        <div className="mb-2 flex items-center justify-between gap-2"><span className="text-sm font-bold">{node.label}</span><code className="text-[10px] text-gray-400">{node.id}</code></div>
        <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={`${node.label} permission`}>{PERMISSION_LEVELS.map((level) => <button key={level.value} type="button" role="radio" aria-checked={permissions[node.id] === level.value} disabled={readOnly} onClick={() => onChange?.({ ...permissions, [node.id]: level.value })} className={`min-h-11 rounded-lg px-2 text-xs font-bold disabled:cursor-default ${permissions[node.id] === level.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gh-hover dark:text-gh-muted'}`}>{level.label}</button>)}</div>
    </div>;
    return <div className="space-y-2" data-mobile-permission-tree>{SYSTEM_PERMISSION_TREE.flatMap((node) => [row(node), ...(node.children || []).map((child) => row(child, true))])}</div>;
}
