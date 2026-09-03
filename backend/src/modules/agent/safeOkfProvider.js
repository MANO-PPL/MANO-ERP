import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fail, fingerprint, sha256 } from './agentValidation.js';

export const CANONICAL = Object.freeze(['index.md', 'vendors/index.md', 'vendors/relationships.md', 'clients/index.md',
    'resources/index.md', 'resources/rate-versioning.md', 'resources/compositions.md', 'resources/impact-tracing.md', 'interactions/index.md', 'projects/index.md']);
export const TRUSTED_STAGE9_SHA = 'f01f2c4f664223e769e9dfb70b9cbd0425328b87b9af906ebd75369edded9020';
const SOURCE_FILES = Object.freeze([
    'modules/admin/adminController.js', 'modules/admin/adminRoutes.js', 'modules/ai/ai.controller.js', 'modules/ai/ai.service.js',
    'modules/clients/clientController.js', 'modules/clients/clientRoutes.js', 'modules/clients/clientService.js',
    'modules/inventory/resourceController.js', 'modules/inventory/resourceRoutes.js', 'modules/inventory/resourceService.js',
    'modules/projects/core/projectController.js', 'modules/projects/core/projectService.js',
    'modules/projects/parties/partyController.js', 'modules/projects/parties/partyRoutes.js', 'modules/projects/parties/partyService.js',
    'modules/projects/projectRoutes.js', 'modules/projects/resources/projectResourceController.js', 'modules/projects/resources/projectResourceRoutes.js',
    'modules/projects/resources/projectResourceService.js', 'modules/shared/jobNatureService.js', 'modules/shared/sectorService.js',
    'modules/vendors/vendorController.js', 'modules/vendors/vendorRoutes.js', 'modules/vendors/vendorService.js', 'services/compositionResolver.js', 'services/unitRegistry.js'
].map(p => `backend/src/${p}`));
export const VALIDATION_SOURCES = SOURCE_FILES;
export function mappedDependencies(sourceMap) {
    if (!Array.isArray(sourceMap) || sourceMap.length !== 10) fail('backend_unavailable', 'invalid_okf_map');
    const sources = new Set();
    if (new Set(sourceMap.map(e => e.okfFile)).size !== 10 || sourceMap.some(e => !CANONICAL.includes(e.okfFile))) fail('backend_unavailable', 'unexpected_okf_identity');
    for (const entry of sourceMap) {
        if (!Array.isArray(entry.primarySources)) fail('backend_unavailable', 'invalid_okf_sources');
        for (const source of entry.primarySources) {
            if (typeof source !== 'string' || !source.trim()) fail('backend_unavailable', 'invalid_okf_source');
            const normalized = source.replace(/\\/g, '/');
            if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || normalized.split('/').includes('..')) fail('backend_unavailable', 'unsafe_okf_source');
            const canonical = path.posix.normalize(normalized);
            if (canonical === 'backend/src') fail('backend_unavailable', 'unsafe_okf_source');
            if (canonical.startsWith('backend/src/')) sources.add(canonical);
        }
    }
    if (sources.size !== SOURCE_FILES.length || SOURCE_FILES.some(p => !sources.has(p))) fail('backend_unavailable', 'unreviewed_okf_dependencies');
    return [...sources].sort();
}
async function safeBytes(root, relative) {
    let current = root;
    for (const segment of relative.split('/')) {
        current = path.join(current, segment);
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink()) fail('backend_unavailable', 'symlinked_okf_input');
    }
    const real = await fs.realpath(current);
    const rel = path.relative(root, real);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) fail('backend_unavailable', 'escaping_okf_input');
    const stat = await fs.stat(real);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) fail('backend_unavailable', 'invalid_okf_input');
    return fs.readFile(real);
}
const runFile = promisify(execFile);
export function createSafeOkfProvider({ root = fileURLToPath(new URL('../../../../', import.meta.url)), run = runFile } = {}) {
    let cached; let pending;
    async function capture() {
        const realRoot = await fs.realpath(root);
        const script = 'backend/scripts/okf-validate-bundle.js';
        const mapPath = 'backend/knowledge/.okf-system/source-map.json';
        const metadataPath = 'backend/knowledge/.okf-system/okf-metadata.json';
        const inputs = { [script]: await safeBytes(realRoot, script), [mapPath]: await safeBytes(realRoot, mapPath) };
        if (sha256(inputs[script]) !== TRUSTED_STAGE9_SHA) fail('backend_unavailable', 'untrusted_stage9');
        const sources = mappedDependencies(JSON.parse(inputs[mapPath].toString('utf8')));
        const paths = [metadataPath, ...CANONICAL.map(p => `backend/knowledge/${p}`), ...sources];
        for (const p of paths) inputs[p] = await safeBytes(realRoot, p);
        const manifest = Object.fromEntries(Object.entries(inputs).map(([p, b]) => [p, sha256(b)]));
        // Reject a live generation that changed during capture. Subsequent consumption uses buffers, not live paths.
        for (const [p, digest] of Object.entries(manifest)) if (sha256(await safeBytes(realRoot, p)) !== digest) fail('backend_unavailable', 'okf_capture_changed');
        const generation = fingerprint(manifest);
        if (cached?.generation === generation) return cached;
        const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'mano-agent-okf-'));
        try {
            for (const [p, bytes] of Object.entries(inputs)) {
                const target = path.join(temporary, p === script ? p.replace(/\.js$/, '.mjs') : p);
                await fs.mkdir(path.dirname(target), { recursive: true });
                await fs.writeFile(target, bytes, { flag: 'wx', mode: 0o400 });
            }
            let result;
            try {
                result = await run(process.execPath, [path.join(temporary, 'backend/scripts/okf-validate-bundle.mjs')], {
                    cwd: temporary, timeout: 15000, maxBuffer: 2 * 1024 * 1024, windowsHide: true,
                    env: { SystemRoot: process.env.SystemRoot || '', PATH: process.env.PATH || '' }
                });
            } catch { fail('backend_unavailable', 'stage9_rejected_generation'); }
            const report = JSON.parse(result.stdout);
            if (report.totalFiles !== 10 || report.checksRun !== 14 || report.failed !== 0
                || report.bundleIsStructurallyValid !== true || report.bundleIsAgentSafe !== true) fail('backend_unavailable', 'unsafe_okf_generation');
            for (const [p, digest] of Object.entries(manifest)) {
                const target = path.join(temporary, p === script ? p.replace(/\.js$/, '.mjs') : p);
                if (sha256(await fs.readFile(target)) !== digest) fail('backend_unavailable', 'validation_tree_changed');
            }
            cached = Object.freeze({ generation, manifest: Object.freeze(manifest),
                markdown: Object.freeze(CANONICAL.map(file => Object.freeze({ file, content: inputs[`backend/knowledge/${file}`].toString('utf8') }))) });
            return cached;
        } finally {
            // Only this mkdtemp-owned tree is removed; never repository/runtime state.
            await fs.rm(temporary, { recursive: true, force: true });
        }
    }
    return { acquire() {
        if (!pending) pending = capture().catch(() => { fail('backend_unavailable', 'okf_unavailable'); }).finally(() => { pending = null; });
        return pending;
    } };
}
